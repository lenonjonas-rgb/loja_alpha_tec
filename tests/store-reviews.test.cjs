const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')

function loadHandler(results) {
  const calls = []
  const supabase = {
    from(table) {
      const chain = {}
      for (const method of ['select', 'eq', 'in', 'order', 'limit']) {
        chain[method] = (...args) => {
          calls.push({ table, method, args })
          return chain
        }
      }
      chain.then = (resolve, reject) => Promise.resolve(results[table]).then(resolve, reject)
      return chain
    },
  }
  const source = fs.readFileSync(path.join(__dirname, '..', 'pages', 'api', 'reviews.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const module = { exports: {} }
  const dependencies = {
    '../../lib/supabase-server': { getSupabaseServer: () => supabase },
    '../../lib/loyalty': {},
    '../../lib/admin-push': {},
  }
  const logs = []
  new Function('require', 'module', 'exports', 'console', compiled)(
    (name) => Object.hasOwn(dependencies, name) ? dependencies[name] : require(name),
    module,
    module.exports,
    { ...console, error: (...args) => logs.push(args) }
  )
  return { handler: module.exports.default, calls, logs }
}

async function requestStoreReviews(results, query = { scope: 'store' }) {
  const loaded = loadHandler(results)
  const response = {
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this },
  }
  await loaded.handler({ method: 'GET', query, headers: {} }, response)
  return { ...loaded, response }
}

test('returns a truthful empty state when there are no delivered reviews', async () => {
  const { response, calls } = await requestStoreReviews({
    product_reviews: { data: [], count: 0, error: null },
  })
  assert.equal(response.code, 200)
  assert.deepEqual(response.body, { total: 0, reviews: [] })
  assert.ok(calls.some((call) => call.method === 'eq' && call.args[0] === 'orders.status' && call.args[1] === 'delivered'))
  assert.ok(calls.some((call) => call.method === 'limit' && call.args[0] === 6))
  assert.ok(!calls.some((call) => call.table === 'customers'))
})

test('keeps negative reviews, masks names, excludes private fields and uses exact total', async () => {
  const { response, calls } = await requestStoreReviews({
    product_reviews: {
      data: [{
        id: 'review-1', customer_id: 'customer-1', rating: 2, comment: 'Minha experiência.',
        photos: ['https://example.com/photo.jpg', 'http://example.com/photo.jpg', 42],
        created_at: '2026-10-07T12:00:00Z', orders: { status: 'delivered' },
      }],
      count: 10, error: null,
    },
    customers: { data: [{ id: 'customer-1', name: 'Maria da Silva' }], error: null },
  })
  assert.equal(response.code, 200)
  assert.equal(response.body.total, 10)
  assert.deepEqual(response.body.reviews, [{
    id: 'review-1', rating: 2, comment: 'Minha experiência.',
    photos: ['https://example.com/photo.jpg'],
    createdAt: '2026-10-07T12:00:00Z', customerName: 'Maria S.',
  }])
  assert.ok(calls.some((call) => call.method === 'select' && call.args[1]?.count === 'exact'))
  assert.ok(!calls.some((call) => call.method === 'eq' && call.args[0] === 'rating'))
})

test('reports database failures instead of returning a success-shaped empty list', async () => {
  const { response, logs } = await requestStoreReviews({
    product_reviews: { data: null, count: null, error: { message: 'Database unavailable' } },
  })
  assert.equal(response.code, 500)
  assert.deepEqual(response.body, { error: 'Não foi possível carregar as avaliações da loja.' })
  assert.equal(logs.length, 1)
})

test('reports customer lookup failures explicitly', async () => {
  const { response } = await requestStoreReviews({
    product_reviews: { data: [{ customer_id: 'customer-1' }], count: 1, error: null },
    customers: { data: null, error: { message: 'Customer query failed' } },
  })
  assert.equal(response.code, 500)
})

test('does not accept a missing review count as zero', async () => {
  const { response } = await requestStoreReviews({
    product_reviews: { data: [], count: null, error: null },
  })
  assert.equal(response.code, 500)
})

test('preserves the existing product review endpoint empty response', async () => {
  const { response } = await requestStoreReviews({
    order_items: { data: [], error: null },
  }, { productId: 'product-1' })
  assert.equal(response.code, 200)
  assert.deepEqual(response.body, { average: 0, total: 0, reviews: [] })
})

test('still requires a product ID outside the store scope', async () => {
  const { response } = await requestStoreReviews({}, {})
  assert.equal(response.code, 400)
  assert.deepEqual(response.body, { error: 'Produto não informado.' })
})
