const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')
const ts = require('typescript')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

function render(orders, carts, status = 'pending') {
  let stateIndex = 0
  const states = [orders, carts, null, {}, status]
  const compiled = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'components', 'AdminOrders.tsx'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const module = { exports: {} }
  const dependencies = {
    react: { ...React, useEffect: () => {}, useState: initial => [stateIndex < states.length ? states[stateIndex++] : initial, () => {}] },
    '../lib/carrier-tracking': { getCarrierTrackingUrl: () => null },
    '../lib/order-whatsapp': { getOrderWhatsAppUrl: () => null, normalizeWhatsAppPhone: () => null },
    '../lib/shipping-label': { resolveLabelAddress: () => ({}) },
  }
  new Function('require', 'module', 'exports', compiled)(name => dependencies[name] || require(name), module, module.exports)
  return renderToStaticMarkup(React.createElement(module.exports.default, { products: [], onMessage: () => {} }))
}

const order = (id, status) => ({ id, status, created_at: '2026-01-01', order_items: [], total: 10 })
const cart = { customer_id: 'customer', updated_at: '2026-01-01', items: [{ product_name: 'Produto', quantity: 1, unit_price: 10 }] }

test('pending badge includes a cart even without a pending order and disables order selection', () => {
  const html = render([], [cart])
  assert.match(html, /<span>Pendente<\/span><strong>1<\/strong>/)
  assert.match(html, /1 pendência\(s\): 1 carrinho\(s\) e 0 pedido\(s\)/)
  assert.match(html, /type="checkbox" disabled=""/)
  assert.ok(!html.includes('Nenhum pedido nesta etapa.'))
})

test('mixed pending items are counted separately without changing other status totals', () => {
  const html = render([order('pending', 'pending'), order('delivered', 'delivered')], [cart])
  assert.match(html, /<span>Pendente<\/span><strong>2<\/strong>/)
  assert.match(html, /<span>Entregue<\/span><strong>1<\/strong>/)
  assert.match(html, /2 pendência\(s\): 1 carrinho\(s\) e 1 pedido\(s\)/)
  assert.ok(!html.includes('type="checkbox" disabled=""'))
})

test('empty pending tab and other tabs retain their correct totals and empty states', () => {
  const empty = render([], [])
  assert.match(empty, /<span>Pendente<\/span><strong>0<\/strong>/)
  assert.ok(empty.includes('Nenhum pedido nesta etapa.'))
  const delivered = render([order('delivered', 'delivered')], [cart], 'delivered')
  assert.match(delivered, /1 pedido\(s\) em entregue/)
  assert.ok(!delivered.includes('Carrinhos para recuperar'))
})
