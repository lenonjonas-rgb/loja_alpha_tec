const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
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

const rules = load('lib/coupon-rules.ts')
const messaging = load('lib/order-whatsapp.ts', {
  './carrier-tracking': load('lib/carrier-tracking.ts'),
  './loyalty': load('lib/loyalty.ts'),
})
const customerId = '11111111-1111-4111-8111-111111111111'
const otherId = '22222222-2222-4222-8222-222222222222'
const coupon = { id: 'coupon', code: 'VOLTE10-TEST', discount_percent: 10, expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), usage_limit: 1, used_count: 0, customer_id: customerId, free_shipping: false }

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } }
}

function database(results, calls) {
  return {
    auth: { getUser: async token => ({ data: { user: token === 'owner' ? { id: customerId } : token === 'other' ? { id: otherId } : null }, error: null }) },
    from(table) {
      const builder = {
        select() { return this }, eq(...args) { calls.push([table, 'eq', ...args]); return this },
        in() { return this }, update(value) { calls.push([table, 'update', value]); return this },
        insert(value) { calls.push([table, 'insert', value]); return this },
        single: async () => results[table], maybeSingle: async () => results[table],
      }
      return builder
    },
  }
}

test('exclusive coupon needs authenticated ownership; generic coupons remain available', () => {
  assert.equal(rules.getCouponError(coupon, customerId), null)
  for (const id of [null, undefined, otherId]) assert.match(rules.getCouponError(coupon, id), /exclusivo/)
  assert.equal(rules.getCouponError({ ...coupon, customer_id: null }), null)
  for (const invalid of [null, { ...coupon, used_count: 1 }, { ...coupon, expires_at: '2000-01-01T00:00:00Z' }]) {
    assert.match(rules.getCouponError(invalid, customerId), /inválido/)
  }
})

test('COMPRA10 uses private eligibility, expiry and redemption for the authenticated customer', async () => {
  const shared = { ...coupon, code: 'COMPRA10', customer_id: null, usage_limit: null, expires_at: null }
  for (const [offer, expected] of [
    [null, /não foi liberado/],
    [{ expires_at: coupon.expires_at, redeemed_order_id: null }, null],
    [{ expires_at: '2000-01-01T00:00:00Z', redeemed_order_id: null }, /expirou/],
    [{ expires_at: coupon.expires_at, redeemed_order_id: 'order' }, /já utilizou/],
  ]) {
    const calls = []
    const db = database({ cart_recovery_offers: { data: offer, error: null } }, calls)
    const error = await rules.getCustomerCouponError(db, shared, customerId)
    if (expected) assert.match(error, expected)
    else assert.equal(error, null)
    assert.ok(calls.some(c => c[0] === 'cart_recovery_offers' && c[2] === 'customer_id' && c[3] === customerId))
  }
  assert.match(await rules.getCustomerCouponError(database({}, []), shared), /Entre na conta/)
  const failing = database({ cart_recovery_offers: { data: null, error: new Error('Database failed') } }, [])
  await assert.rejects(() => rules.getCustomerCouponError(failing, shared, customerId), /Database failed/)
})

test('recovery API creates only after admin authorization and valid customer phone', async () => {
  for (const scenario of ['success', 'reused', 'forbidden', 'invalid-id', 'invalid-phone', 'no-cart', 'failure']) {
    const calls = []
    const issued = scenario === 'reused'
      ? { ...coupon, code: 'COMPRA10', expires_at: new Date(Date.now() + 1.5 * 86400000).toISOString() }
      : coupon
    const db = database({ customers: { data: { name: 'Maria', phone: scenario === 'invalid-phone' ? '' : '(11) 99999-8888' }, error: null } }, calls)
    db.rpc = async (name, args) => {
      calls.push(['rpc', name, args])
      return scenario === 'no-cart' ? { error: { code: 'P0001', message: 'Carrinho vazio.' } } :
        scenario === 'failure' ? { error: { code: 'XX000', message: 'Database failed' } } : { data: [issued], error: null }
    }
    const handler = load('pages/api/cart-recovery.ts', {
      '../../lib/admin-auth': { requireRole: (req, res) => scenario !== 'forbidden' || (res.status(403).json({ error: 'Não autorizado.' }), false) },
      '../../lib/supabase-server': { getSupabaseServer: () => db },
      '../../lib/order-whatsapp': messaging,
    }).default
    const res = response()
    await handler({ method: 'POST', body: { customerId: scenario === 'invalid-id' ? 'bad' : customerId } }, res)
    const expected = { success: 201, reused: 201, forbidden: 403, 'invalid-id': 400, 'invalid-phone': 400, 'no-cart': 409, failure: 500 }[scenario]
    assert.equal(res.statusCode, expected, scenario)
    if (scenario === 'success' || scenario === 'reused') {
      const url = new URL(res.body.whatsappUrl)
      assert.equal(url.pathname, '/5511999998888')
      assert.ok(url.searchParams.get('text').includes(issued.code))
      if (scenario === 'reused') assert.ok(url.searchParams.get('text').includes('válido por 2 dias'))
      assert.deepEqual(calls.find(c => c[0] === 'rpc'), ['rpc', 'create_cart_recovery_coupon', { p_customer_id: customerId }])
    }
    if (['forbidden', 'invalid-id', 'invalid-phone'].includes(scenario)) assert.ok(!calls.some(c => c[0] === 'rpc'))
  }
})

test('public coupon validation never trusts a supplied customerId and allows the owner only', async () => {
  for (const token of ['', 'other', 'owner', 'invalid']) {
    const calls = []
    const handler = load('pages/api/coupons.ts', {
      '../../lib/supabase-server': { getSupabaseServer: () => database({ coupons: { data: coupon, error: null } }, calls) },
      '../../lib/products': { hasProductCategory: () => true },
      '../../lib/coupon-rules': rules,
    }).default
    const res = response()
    await handler({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: { code: coupon.code, customerId } }, res)
    assert.equal(res.statusCode, token === 'owner' ? 200 : token === 'invalid' ? 401 : 400)
    if (token === 'owner') assert.equal(res.body.discountPercent, 10)
  }
})

test('public COMPRA10 validation uses the session offer and returns the fixed discount', async () => {
  const shared = { ...coupon, code: 'COMPRA10', customer_id: null, usage_limit: null, expires_at: null }
  for (const token of ['', 'other', 'owner']) {
    const calls = []
    const db = database({
      coupons: { data: shared, error: null },
      cart_recovery_offers: { data: token === 'owner' ? { expires_at: coupon.expires_at, redeemed_order_id: null } : null, error: null },
    }, calls)
    const handler = load('pages/api/coupons.ts', {
      '../../lib/supabase-server': { getSupabaseServer: () => db },
      '../../lib/products': { hasProductCategory: () => true },
      '../../lib/coupon-rules': rules,
    }).default
    const res = response()
    await handler({ method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: { code: 'compra10', customerId } }, res)
    assert.equal(res.statusCode, token === 'owner' ? 200 : 400)
    if (token === 'owner') assert.deepEqual(res.body, { code: 'COMPRA10', discountPercent: 10, freeShipping: false })
    if (token === 'other') assert.ok(calls.some(c => c[0] === 'cart_recovery_offers' && c[2] === 'customer_id' && c[3] === otherId))
  }
})

test('checkout rejects a recovery coupon belonging to another authenticated customer before payment', async () => {
  const calls = []
  const db = database({
    coupons: { data: coupon, error: null },
    products: { data: [{ id: 'product', name: 'Produto', price: 100, active: true }], error: null },
  }, calls)
  db.from = new Proxy(db.from, { apply(target, thisArg, args) {
    const builder = Reflect.apply(target, thisArg, args)
    if (args[0] === 'products') builder.in = async () => ({ data: [{ id: 'product', name: 'Produto', price: 100, active: true }], error: null })
    return builder
  } })
  const dependencies = {
    '../../lib/supabase-server': { getSupabaseServer: () => db },
    '../../lib/stripe': { getStripe: () => { throw new Error('Gateway must not be called') } },
    '../../lib/loyalty': load('lib/loyalty.ts'),
    '../../lib/shipping-limits': { getCorreiosLimitViolation: () => null },
    '../../lib/products': { getCompatibleModels: () => [] },
    '../../lib/coupon-rules': rules,
    '../../lib/admin-auth': { isAdmin: () => false },
    '../../lib/admin-push': { sendAdminPush: async () => {} },
  }
  for (const file of ['pages/api/checkout-session.ts', 'pages/api/orders.ts']) {
    const handler = load(file, dependencies).default
    const res = response()
    await handler({ method: 'POST', headers: { authorization: 'Bearer other' }, body: { customerId: otherId, couponCode: coupon.code, items: [{ id: 'product', quantity: 1 }] } }, res)
    assert.equal(res.statusCode, 400, file)
    assert.match(res.body.error, /exclusivo/)
    assert.ok(!calls.some(c => c[1] === 'insert'))
  }
})

test('both checkout paths reject COMPRA10 when an authenticated customer has no offer', async () => {
  const calls = []
  const shared = { ...coupon, code: 'COMPRA10', customer_id: null, usage_limit: null, expires_at: null }
  const db = database({ coupons: { data: shared, error: null }, cart_recovery_offers: { data: null, error: null } }, calls)
  const from = db.from
  db.from = table => {
    const builder = from(table)
    if (table === 'products') builder.in = async () => ({ data: [{ id: 'product', name: 'Produto', price: 100, active: true }], error: null })
    return builder
  }
  const dependencies = {
    '../../lib/supabase-server': { getSupabaseServer: () => db },
    '../../lib/stripe': { getStripe: () => { throw new Error('Gateway must not be called') } },
    '../../lib/loyalty': load('lib/loyalty.ts'),
    '../../lib/shipping-limits': { getCorreiosLimitViolation: () => null },
    '../../lib/products': { getCompatibleModels: () => [] },
    '../../lib/coupon-rules': rules,
    '../../lib/admin-auth': { isAdmin: () => false },
    '../../lib/admin-push': { sendAdminPush: async () => {} },
  }
  for (const file of ['pages/api/checkout-session.ts', 'pages/api/orders.ts']) {
    const res = response()
    await load(file, dependencies).default({ method: 'POST', headers: { authorization: 'Bearer owner' }, body: { customerId, couponCode: 'COMPRA10', items: [{ id: 'product', quantity: 1 }] } }, res)
    assert.equal(res.statusCode, 400, file)
    assert.match(res.body.error, /não foi liberado/)
  }
  assert.ok(!calls.some(c => c[1] === 'insert'))
})
