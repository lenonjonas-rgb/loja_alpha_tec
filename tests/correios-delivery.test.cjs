const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const { createHmac } = require('node:crypto')
const { Readable } = require('node:stream')
const ts = require('typescript')

function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(
    name => dependencies[name] || require(name), module, module.exports
  )
  return module.exports
}

const delivery = load('lib/correios-delivery.ts')
const fixture = (codigo = 'BDE', tipo = '01') => [{
  codObjeto: 'AB123456789BR',
  eventos: [{ codigo, tipo, dtHrCriado: '2026-01-02T10:30:00' }],
}]

test('verifies HMAC over the original bytes and rejects missing, malformed or forged signatures', () => {
  const raw = Buffer.from(JSON.stringify(fixture()))
  const signature = 'sha256=' + createHmac('sha256', 'test-secret').update(raw).digest('hex')
  assert.equal(delivery.verifyCorreiosSignature(raw, signature, 'test-secret'), true)
  assert.equal(delivery.verifyCorreiosSignature(Buffer.concat([raw, Buffer.from(' ')]), signature, 'test-secret'), false)
  for (const invalid of ['', 'sha256=00', 'sha256=' + '0'.repeat(64)]) {
    assert.equal(delivery.verifyCorreiosSignature(raw, invalid, 'test-secret'), false)
  }
})

test('accepts all confirmed delivery types, converts Brazil local time and deduplicates objects', () => {
  for (const code of ['BDE', 'BDI', 'BDR']) {
    assert.deepEqual(delivery.parseCorreiosDeliveries([...fixture(code), ...fixture(code)], `${code}-1`), [
      { tracking_code: 'AB123456789BR', delivered_at: '2026-01-02T13:30:00.000Z' },
    ])
    assert.equal(delivery.parseCorreiosDeliveries({ objetos: fixture(code) }, `${code}-1`).length, 1)
  }
})

test('ignores transit and failed delivery types; rejects invalid or mismatched delivery payloads', () => {
  for (const type of ['RO-1', 'BDE-2', 'BDR-23']) assert.deepEqual(delivery.parseCorreiosDeliveries(fixture(), type), [])
  for (const payload of [null, [], {}, [{ codObjeto: 'bad' }], fixture('BDE', '02'), [{ ...fixture()[0], eventos: [] }]]) {
    assert.throws(() => delivery.parseCorreiosDeliveries(payload, 'BDE-1'))
  }
  const invalidDate = fixture()
  invalidDate[0].eventos[0].dtHrCriado = 'invalid'
  assert.throws(() => delivery.parseCorreiosDeliveries(invalidDate, 'BDE-1'))
})

async function request({ signatureValid = true, contract = 'test-contract', rpcError = null, payload = fixture(), eventType = 'BDE-1' } = {}) {
  const calls = []
  const handler = load('pages/api/correios-webhook.ts', {
    '../../lib/correios-delivery': delivery,
    '../../lib/supabase-server': { getSupabaseServer: () => ({
      rpc: async (...args) => { calls.push(args); return { error: rpcError } },
    }) },
  }).default
  const raw = Buffer.from(JSON.stringify(payload))
  const req = Readable.from([raw])
  req.method = 'POST'
  req.headers = {
    'x-correios-signature': 'sha256=' + createHmac('sha256', signatureValid ? 'test-secret' : 'wrong').update(raw).digest('hex'),
    'x-correios-hook-id': 'wh-rastro',
    'x-correios-hook-nu-contrato': contract,
    'x-correios-hook-event': eventType,
  }
  const res = { status(code) { this.code = code; return this }, end() { this.ended = true; return this } }
  await handler(req, res)
  return { res, calls }
}

test('handler authenticates before mutation, acknowledges empty-body success and retries database failures', async () => {
  const previous = { secret: process.env.CORREIOS_WEBHOOK_SECRET, contract: process.env.CORREIOS_CONTRATO }
  process.env.CORREIOS_WEBHOOK_SECRET = 'test-secret'
  process.env.CORREIOS_CONTRATO = 'test-contract'
  try {
    const success = await request()
    assert.equal(success.res.code, 200)
    assert.equal(success.res.ended, true)
    assert.equal(success.calls[0][0], 'apply_correios_deliveries')
    assert.equal(success.calls[0][1].deliveries[0].tracking_code, 'AB123456789BR')
    for (const [options, code] of [[{ signatureValid: false }, 401], [{ contract: 'other' }, 403], [{ eventType: 'BDE-2' }, 200]]) {
      const result = await request(options)
      assert.equal(result.res.code, code)
      assert.equal(result.calls.length, 0)
    }
    assert.equal((await request({ rpcError: { message: 'Unavailable' } })).res.code, 500)
    assert.equal((await request({ payload: {} })).res.code, 500)
    delete process.env.CORREIOS_WEBHOOK_SECRET
    assert.equal((await request()).res.code, 503)
  } finally {
    for (const [key, value] of [['CORREIOS_WEBHOOK_SECRET', previous.secret], ['CORREIOS_CONTRATO', previous.contract]]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
