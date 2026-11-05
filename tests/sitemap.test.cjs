const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

function load(db, products = []) {
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'pages', 'sitemap.xml.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  const dependencies = { '../lib/products': { products }, '../lib/supabase-server': { getSupabaseServer: () => db } }
  new Function('require', 'module', 'exports', compiled)(name => dependencies[name], module, module.exports)
  return module.exports
}

function response() {
  return { headers: {}, body: '', setHeader(k, v) { this.headers[k] = v }, write(s) { this.body += s }, end(s = '') { this.body += s } }
}

test('sitemap lists live active products, removes duplicates and does not invent modification dates', async () => {
  const calls = []
  const first = Array.from({ length: 1000 }, (_, i) => ({ id: `live-${i}`, active: true }))
  const db = { from(table) {
    assert.equal(table, 'products')
    return { select() { return this }, order() { return this }, range: async (start, end) => {
      calls.push([start, end])
      return { data: start === 0 ? first : [{ id: 'hidden', active: false }, { id: 'special&<>', active: true }], error: null }
    } }
  } }
  const res = response()
  await load(db, [{ id: 'hidden', active: true }, { id: 'live-1', active: true }, { id: 'fallback', active: true }]).getServerSideProps({ res })
  const locations = Array.from(res.body.matchAll(/<loc>(.*?)<\/loc>/g), m => m[1])
  assert.equal(locations.length, new Set(locations).size)
  assert.ok(locations.some(url => url.endsWith('/products/live-999')))
  assert.ok(locations.some(url => url.endsWith('/products/fallback')))
  assert.ok(!locations.some(url => url.endsWith('/products/hidden')))
  assert.ok(locations.some(url => url.endsWith('/products/special%26%3C%3E')))
  assert.ok(!res.body.includes('lastmod'))
  assert.deepEqual(calls, [[0, 999], [1000, 1999]])
  assert.equal(res.headers['Content-Type'], 'application/xml')
})

test('database failures return 503 instead of a successful incomplete sitemap', async () => {
  const db = { from: () => ({ select() { return this }, order() { return this }, range: async () => ({ error: new Error('Unavailable'), data: null }) }) }
  const res = response()
  await load(db).getServerSideProps({ res })
  assert.equal(res.statusCode, 503)
  assert.ok(!res.body.includes('<urlset'))
})
