const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')
const React = require('react')

function load(file, dependencies) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', compiled)(name => dependencies[name] || require(name), module, module.exports)
  return module.exports
}

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
}

test('scheduled cart notifications require a configured secret and POST', async () => {
  const previous = process.env.CART_NOTIFICATIONS_SECRET
  const calls = []
  const handler = load('pages/api/cron/cart-notifications.ts', {
    '../../../lib/supabase-server': { getSupabaseServer: () => { calls.push('db'); throw new Error('Must not run') } },
    '../../../lib/admin-push': { sendAdminPush: async () => { calls.push('push') } },
  }).default
  try {
    for (const [method, secret, authorization, status] of [
      ['GET', 'x'.repeat(32), '', 405], ['POST', '', '', 503],
      ['POST', 'short', 'Bearer short', 503], ['POST', 'x'.repeat(32), '', 401],
      ['POST', 'x'.repeat(32), `Bearer ${'y'.repeat(32)}`, 401],
    ]) {
      process.env.CART_NOTIFICATIONS_SECRET = secret
      const res = response()
      await handler({ method, headers: { authorization } }, res)
      assert.equal(res.statusCode, status)
    }
    assert.deepEqual(calls, [])
  } finally {
    if (previous === undefined) delete process.env.CART_NOTIFICATIONS_SECRET
    else process.env.CART_NOTIFICATIONS_SECRET = previous
  }
})

test('scheduled delivery releases only totally failed sends and reports database errors', async () => {
  const previous = process.env.CART_NOTIFICATIONS_SECRET
  process.env.CART_NOTIFICATIONS_SECRET = 'x'.repeat(32)
  try {
    for (const scenario of ['sent', 'partial', 'no-devices', 'failed', 'throws', 'db-error', 'empty', 'changed', 'paid']) {
      const calls = []
      const cart = { customer_id: 'customer', pending_version: 'version' }
      const handler = load('pages/api/cron/cart-notifications.ts', {
        '../../../lib/supabase-server': { getSupabaseServer: () => ({
          from: () => ({
            select() { return this }, eq() { return this },
            maybeSingle: async () => ({ data: {
              pending_version: scenario === 'changed' ? 'new-version' : 'version',
              pending_since: scenario === 'paid' ? null : '2026-01-01',
            }, error: null }),
          }),
          rpc: async (name, args) => {
            calls.push([name, args])
            return name.startsWith('release') ? { error: null } :
              { data: scenario === 'empty' ? [] : [cart], error: scenario === 'db-error' ? new Error('DB failed') : null }
          },
        }) },
        '../../../lib/admin-push': { sendAdminPush: async payload => {
          calls.push(['push', payload])
          if (scenario === 'throws') throw new Error('Push failed')
          return { sent: ['sent', 'partial'].includes(scenario) ? 1 : 0, failed: ['failed', 'partial'].includes(scenario) ? 1 : 0 }
        } },
      }).default
      const res = response()
      await handler({ method: 'POST', headers: { authorization: `Bearer ${process.env.CART_NOTIFICATIONS_SECRET}` } }, res)
      assert.equal(res.statusCode, ['db-error', 'throws'].includes(scenario) ? 500 : 200, scenario)
      const release = calls.find(c => c[0] === 'release_pending_cart_notification')
      assert.equal(Boolean(release), ['failed', 'no-devices', 'throws'].includes(scenario), scenario)
      if (release) assert.deepEqual(release[1], { p_customer_id: 'customer', p_version: 'version' })
      if (['sent', 'partial'].includes(scenario)) assert.equal(res.body.notified, 1)
      if (['db-error', 'changed', 'paid'].includes(scenario)) assert.ok(!calls.some(c => c[0] === 'push'))
    }
  } finally {
    if (previous === undefined) delete process.env.CART_NOTIFICATIONS_SECRET
    else process.env.CART_NOTIFICATIONS_SECRET = previous
  }
})

test('saving a customer cart never sends an immediate push', async () => {
  const writes = []
  const handler = load('pages/api/cart.ts', {
    '../../lib/supabase-server': { getSupabaseServer: () => ({
      auth: { getUser: async () => ({ data: { user: { id: 'customer' } }, error: null }) },
      from: () => ({ upsert: async value => { writes.push(value); return { error: null } } }),
    }) },
    '../../lib/admin-push': { sendAdminPush: () => { throw new Error('Immediate push forbidden') } },
  }).default
  for (let i = 0; i < 2; i++) {
    const res = response()
    await handler({ method: 'PUT', headers: { authorization: 'Bearer session' }, body: { items: [{ id: 'one', quantity: 1 }] } }, res)
    assert.equal(res.statusCode, 200)
  }
  assert.equal(writes.length, 2)
})

test('old guest clients cannot trigger immediate cart notifications', async () => {
  const handler = load('pages/api/guest-cart-event.ts', {
    '../../lib/admin-push': { sendAdminPush: () => { throw new Error('Immediate push forbidden') } },
  }).default
  const res = response()
  await handler({ method: 'POST', headers: { origin: 'https://store.test', host: 'store.test' } }, res)
  assert.equal(res.statusCode, 202)
  assert.equal(res.body.notified, false)
})

test('login waits for the saved cart before allowing a PUT; stale login results are ignored', async () => {
  const originalFetch = global.fetch
  const originalTimeout = global.setTimeout
  try {
    for (const cancelled of [false, true]) {
      const states = [[], true, null]
      let stateIndex = 0
      let effects = []
      const timers = []
      let resolveCart
      global.fetch = () => new Promise(resolve => { resolveCart = resolve })
      global.setTimeout = fn => { timers.push(fn); return 1 }
      const cart = load('components/CartContext.tsx', {
        react: { ...React,
          useState: () => { const i = stateIndex++; return [states[i], value => { states[i] = typeof value === 'function' ? value(states[i]) : value }] },
          useEffect: effect => { effects.push(effect) },
        },
        '../lib/supabase': { supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'session' } } }) } } },
        './CustomerContext': { useCustomer: () => ({ customer: { id: 'customer' } }) },
      })
      cart.CartProvider({ children: null })
      const cleanup = effects[2]()
      effects[3]()
      assert.equal(timers.length, 0, 'Saved an empty cart while GET was still loading')
      await new Promise(resolve => setImmediate(resolve))
      if (cancelled) cleanup()
      resolveCart({ ok: true, json: async () => ({ items: [{ id: 'one', quantity: 1 }] }) })
      await new Promise(resolve => setImmediate(resolve))
      assert.equal(states[2], cancelled ? null : 'customer')
      assert.equal(states[0].length, cancelled ? 0 : 1)
      if (!cancelled) {
        stateIndex = 0
        effects = []
        cart.CartProvider({ children: null })
        effects[3]()
        assert.equal(timers.length, 1, 'Merged cart was not enabled for saving')
      }
    }
  } finally {
    global.fetch = originalFetch
    global.setTimeout = originalTimeout
  }
})
