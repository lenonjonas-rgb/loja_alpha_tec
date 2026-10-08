const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vm = require('node:vm')

const root = path.join(__dirname, '..')
const source = ts.transpileModule(fs.readFileSync(path.join(root, 'components', 'AdminPromotions.tsx'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText

async function renderPost({ mode = 'product', format = 'portrait', coupon = false, logo = true, failLogo = false, layout = 'details', photoWidth = 400, photoHeight = 400, failPhoto = false, freeShipping = false, invalidCoupon = false } = {}) {
  const texts = []
  const images = []
  const effects = []
  const messages = []
  const states = []
  const brand = { src: '/brand-logo.svg', naturalWidth: 1280, naturalHeight: 240 }
  const overrides = {
    0: mode, 2: 'Musculação', 3: ['piece'], 5: coupon ? 'ALPHA10' : '',
    6: coupon ? [{ code: 'ALPHA10', active: !invalidCoupon, discount_percent: 10, usage_limit: 10, free_shipping: freeShipping }] : [],
    8: format, 21: logo ? brand : null, 22: layout,
  }
  let stateIndex = 0
  let refIndex = 0
  const context = {
    fillText: (text, x, y) => texts.push({ text, x, y }),
    drawImage: (...args) => images.push(args),
    measureText: (text) => ({ width: text.length * 10 }),
    clearRect() {}, fillRect() {}, strokeRect() {}, save() {}, restore() {}, beginPath() {}, rect() {}, clip() {},
  }
  const canvas = { getContext: () => context }
  const jsx = (type, props) => ({ type, props })
  const module = { exports: {} }
  const sandbox = {
    module, exports: module.exports,
    fetch: async () => ({ ok: true, json: async () => [] }),
    Image: class {
      constructor() { this.naturalWidth = photoWidth; this.naturalHeight = photoHeight }
      set src(value) { this.url = value; if ((failLogo && value === '/brand-logo.svg') || (failPhoto && value === '/piece.png')) this.onerror(); else this.onload() }
    },
    require: (name) => {
      if (name === 'react') return {
        useMemo: (fn) => fn(),
        useEffect: (fn) => effects.push(fn),
        useRef: () => ({ current: refIndex++ === 0 ? canvas : null }),
        useState: (initial) => {
          const index = stateIndex++
          return [Object.hasOwn(overrides, index) ? overrides[index] : initial, (value) => states.push({ index, value })]
        },
      }
      if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx }
      if (name === '../lib/products') return {
        getProductCategories: (category) => [category],
        hasProductCategory: (category, selected) => category === selected,
      }
      throw new Error(`Unexpected import ${name}`)
    },
  }
  vm.runInNewContext(source, sandbox)
  const tree = module.exports.default({
    products: [{ id: 'piece', name: 'Rolamento LM40', category: 'Musculação', price: 137.5, discountPercent: 20, description: 'Rolamento linear para equipamentos fitness.', image: '/piece.png', active: true }],
    onMessage: (message) => messages.push(message),
  })
  const cleanups = effects.map((effect) => effect())
  await new Promise((resolve) => setImmediate(resolve))
  function findCaption(node) {
    if (!node || typeof node !== 'object') return ''
    if (node.type === 'textarea') return node.props.value
    const children = node.props?.children
    return (Array.isArray(children) ? children.flat(Infinity) : [children]).map(findCaption).find(Boolean) || ''
  }
  return { texts, images, messages, states, cleanups, caption: findCaption(tree), canvas }
}

for (const mode of ['product', 'category']) {
  for (const format of ['portrait', 'square']) {
    for (const coupon of [false, true]) {
      test(`${mode} ${format} cupom=${coupon}: logo, chamada e nenhum preço`, async () => {
        const result = await renderPost({ mode, format, coupon })
        const text = result.texts.map((item) => item.text).join('\n')
        assert.match(text, /CONFIRA NO SITE/)
        assert.match(text, /www\.lojaalphatec\.com\.br/)
        assert.doesNotMatch(text + result.caption, /R\$|137,50|CONSULTE O PREÇO/)
        assert.match(result.caption, /www\.lojaalphatec\.com\.br/)
        assert.ok(result.images.some(([image]) => image.src === '/brand-logo.svg'))
        assert.ok(result.states.some(({ index, value }) => index === 20 && value === true))
        const height = format === 'portrait' ? 1350 : 1080
        assert.equal(result.canvas.width, 1080)
        assert.equal(result.canvas.height, height)
        assert.ok(result.texts.every(({ y }) => y > 0 && y < height))
        if (coupon) assert.match(text, /CUPOM/)
      })
    }
  }
}

test('falha de logo é informada e não libera exportação sem marca', async () => {
  const result = await renderPost({ logo: false, failLogo: true })
  assert.match(result.messages[0], /Não foi possível carregar a logo/)
  assert.equal(result.images.length, 0)
  assert.ok(!result.states.some(({ index, value }) => index === 20 && value === true))
})

for (const format of ['portrait', 'square']) {
  for (const [photoWidth, photoHeight] of [[400, 400], [800, 400], [400, 800]]) {
    test(`foto ampliada ${format} ${photoWidth}×${photoHeight}: somente logo e site, quadro preenchido sem distorção`, async () => {
      const result = await renderPost({ format, layout: 'photo', photoWidth, photoHeight })
      assert.deepEqual(result.texts.map(({ text }) => text), ['CONFIRA NO SITE', 'www.lojaalphatec.com.br'])
      assert.doesNotMatch(result.caption, /Rolamento|cupom|137,50|R\$/i)
      const [, , , width, height] = result.images.find(([image]) => image.url === '/piece.png')
      const side = Math.min(1080 - 84, (format === 'square' ? 1080 : 1350) - 264)
      assert.ok(width >= side && height >= side)
      assert.equal(width / height, photoWidth / photoHeight)
      assert.ok(result.images.some(([image]) => image.src === '/brand-logo.svg'))
    })
  }
}

test('modelo de foto não permite exportar uma imagem indisponível', async () => {
  const result = await renderPost({ layout: 'photo', failPhoto: true })
  assert.match(result.messages[0], /precisa de uma foto/)
  assert.ok(!result.states.some(({ index, value }) => index === 20 && value === true))
})

for (const format of ['portrait', 'square']) {
  for (const freeShipping of [false, true]) {
    test(`foto ${format}: chamada para cupom ${freeShipping ? 'frete grátis' : 'desconto'} sem preço`, async () => {
      const result = await renderPost({ format, layout: 'photo', coupon: true, freeShipping })
      const text = result.texts.map(({ text }) => text).join('\n')
      assert.match(text, /USE O CUPOM ALPHA10 NO SITE/)
      assert.ok(text.includes(freeShipping ? 'APROVEITE FRETE GRÁTIS' : 'APROVEITE 10% OFF'))
      assert.match(text, /PRIMEIROS 10 CLIENTES/)
      assert.match(result.caption, /Use o cupom ALPHA10 no site/)
      assert.doesNotMatch(text + result.caption, /R\$|Rolamento|ESPECIFICAÇÕES/)
      const [, , y, width, height] = result.images.find(([image]) => image.url === '/piece.png')
      const canvasHeight = format === 'square' ? 1080 : 1350
      assert.ok(y + height <= canvasHeight - 252)
      assert.equal(width, height)
    })
  }
}

test('cupom inativo não aparece na arte nem na legenda do modelo de foto', async () => {
  const result = await renderPost({ layout: 'photo', coupon: true, invalidCoupon: true })
  assert.deepEqual(result.texts.map(({ text }) => text), ['CONFIRA NO SITE', 'www.lojaalphatec.com.br'])
  assert.doesNotMatch(result.caption, /ALPHA10|cupom/i)
})
