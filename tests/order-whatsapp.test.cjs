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

const messaging = load('lib/order-whatsapp.ts', {
  './carrier-tracking': load('lib/carrier-tracking.ts'),
  './loyalty': load('lib/loyalty.ts'),
})
const order = { id: '12345678-abcd', status: 'pending', tracking_code: 'AB123456789BR', carrier: 'Correios' }

test('creates a distinct message for each order stage without claiming payment confirmation', () => {
  const stages = { pending: 'está pendente', confirmed: 'foi confirmado', processing: 'está em separação', shipped: 'foi enviado', delivered: 'consta como entregue', cancelled: 'foi cancelado' }
  for (const [status, text] of Object.entries(stages)) {
    const message = messaging.getOrderWhatsAppMessage({ ...order, status }, 'Maria')
    assert.ok(message.startsWith('Olá, Maria!'))
    assert.ok(message.includes('pedido #12345678'))
    assert.ok(message.includes(text))
    assert.ok(!message.includes('pagamento confirmado'))
  }
  assert.equal(messaging.getOrderWhatsAppMessage({ ...order, status: 'unknown' }), null)
  assert.ok(messaging.getOrderWhatsAppMessage(order).startsWith('Olá!'))
})

test('includes available carrier tracking only in the shipping message', () => {
  const message = messaging.getOrderWhatsAppMessage({ ...order, status: 'shipped' })
  assert.ok(message.includes('Transportadora: Correios'))
  assert.ok(message.includes(order.tracking_code))
  assert.ok(message.includes('https://rastreamento.correios.com.br/'))
  assert.ok(!messaging.getOrderWhatsAppMessage({ ...order, status: 'delivered' }).includes(order.tracking_code))
  const noTracking = messaging.getOrderWhatsAppMessage({ ...order, status: 'shipped', carrier: null, tracking_code: null })
  assert.ok(!noTracking.includes('null'))
  assert.ok(!noTracking.includes('Código de rastreio'))
  for (const carrier of ['Jamef', 'Rodonaves', 'Total Express', 'Expresso São Miguel']) {
    const text = messaging.getOrderWhatsAppMessage({ ...order, status: 'shipped', carrier })
    const expectedUrl = load('lib/carrier-tracking.ts').getCarrierTrackingUrl(carrier, order.tracking_code)
    assert.ok(text.includes(`Clique para rastrear ${order.tracking_code}: ${expectedUrl}`))
    assert.ok(!text.includes('rastreamento.correios.com.br'))
  }
  const unknown = messaging.getOrderWhatsAppMessage({ ...order, status: 'shipped', carrier: 'Outra' })
  assert.ok(unknown.includes('canal de rastreio'))
  assert.ok(!unknown.includes('https://'))
})

test('thanks the buyer and invites honest photo reviews using actual loyalty rewards', () => {
  const confirmed = messaging.getOrderWhatsAppMessage({ ...order, status: 'confirmed' })
  assert.ok(confirmed.includes('Obrigado pela compra'))
  assert.ok(confirmed.includes('próximos passos'))
  const delivered = messaging.getOrderWhatsAppMessage({ ...order, status: 'delivered', customer_id: 'customer' })
  assert.ok(delivered.includes('40 pontos'))
  assert.ok(delivered.includes('20 pontos com foto'))
  assert.ok(delivered.includes('A pontuação independe da nota'))
  assert.ok(delivered.includes('/account'))
  const manual = messaging.getOrderWhatsAppMessage({ ...order, status: 'delivered', customer_id: null })
  assert.ok(!manual.includes('pontos'))
})

test('recovery message includes the exact coupon, deadline, restrictions and cart link', () => {
  const text = messaging.getCartRecoveryMessage('Ana', 'VOLTE10-TEST', '2026-11-11T18:00:00.000Z')
  assert.ok(text.includes('10% de desconto nos produtos'))
  assert.ok(text.includes('VOLTE10-TEST'))
  assert.ok(text.includes('11/11/2026'))
  assert.ok(text.includes('15:00:00'))
  assert.ok(text.includes('exclusivo da sua conta'))
  assert.ok(text.includes('uma compra'))
  assert.ok(text.includes('não inclui o frete'))
  assert.ok(text.includes('/cart'))
})

test('normalizes Brazilian and international numbers and URL-encodes personalized text', () => {
  for (const phone of ['(11) 99999-8888', '+55 (11) 99999-8888', '0055 11 99999-8888']) {
    assert.equal(messaging.normalizeWhatsAppPhone(phone), '5511999998888')
  }
  assert.equal(messaging.normalizeWhatsAppPhone('(11) 3333-4444'), '551133334444')
  assert.equal(messaging.normalizeWhatsAppPhone('+351 912 345 678'), '351912345678')
  for (const phone of [null, '', 'abc', '123', '0'.repeat(12), '1'.repeat(16)]) {
    assert.equal(messaging.getOrderWhatsAppUrl(order, phone), null)
  }
  const url = new URL(messaging.getOrderWhatsAppUrl(order, '(11) 99999-8888', 'João & Ana'))
  assert.equal(url.pathname, '/5511999998888')
  assert.equal(url.searchParams.get('text'), messaging.getOrderWhatsAppMessage(order, 'João & Ana'))
})
