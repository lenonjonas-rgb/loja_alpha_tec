const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const ts = require('typescript')
const sharp = require('sharp')
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')

const root = path.join(__dirname, '..')
const cache = new Map()

function loadSource(relativePath) {
  const filename = path.join(root, relativePath)
  if (cache.has(filename)) return cache.get(filename)
  const module = { exports: {} }
  const requireFromFile = createRequire(filename)
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const localRequire = (name) => {
    if (name.startsWith('.')) {
      for (const extension of ['.ts', '.tsx']) {
        const target = path.resolve(path.dirname(filename), name + extension)
        if (fs.existsSync(target)) return loadSource(path.relative(root, target))
      }
    }
    return requireFromFile(name)
  }
  new Function('module', 'exports', 'require', output)(module, module.exports, localRequire)
  cache.set(filename, module.exports)
  return module.exports
}

const presentation = loadSource(path.join('lib', 'product-presentation.ts'))
const ProductCard = loadSource(path.join('components', 'ProductCard.tsx')).default
const HeroBanner = loadSource(path.join('components', 'HeroBanner.tsx')).default
const PaymentMethods = loadSource(path.join('components', 'PaymentMethods.tsx')).default
const FooterSecurity = loadSource(path.join('components', 'FooterSecurity.tsx')).default
const base = { id: 'piece', name: 'Correia de teste', category: 'Esteiras', price: 120, image: '', stock: 3, description: '', active: true }

test('divulgação dos pagamentos permanece somente no rodapé compartilhado', () => {
  const layout = fs.readFileSync(path.join(root, 'components', 'Layout.tsx'), 'utf8')
  assert.equal((layout.match(/<PaymentMethods\b/g) || []).length, 1)
  assert.match(layout, /<footer[\s\S]*<PaymentMethods \/>[\s\S]*<\/footer>/)
  assert.doesNotMatch(layout, /<main>[\s\S]*<PaymentMethods[\s\S]*<\/main>/)
  for (const file of ['index.tsx', path.join('products', '[id].tsx')]) {
    const page = fs.readFileSync(path.join(root, 'pages', file), 'utf8')
    assert.doesNotMatch(page, /PaymentMethods|home-payment-section|detail-payment-methods/)
  }
})

test('rodapé apresenta as quatro bandeiras verificadas e Pix sem boleto ou promessas de aprovação', () => {
  const html = renderToStaticMarkup(React.createElement(PaymentMethods))
  for (const name of ['Visa', 'Mastercard', 'Elo', 'American Express']) {
    assert.ok(html.includes(`alt="${name}"`))
  }
  assert.match(html, /Pix/)
  assert.match(html, /condições do checkout/)
  assert.doesNotMatch(html, /Boleto|Google|aprovação garantida/i)
})

test('indicadores próprios não alegam certificação externa e HTTPS depende da URL oficial', () => {
  const https = renderToStaticMarkup(React.createElement(FooterSecurity, { https: true }))
  assert.match(https, /Conexão HTTPS/)
  assert.match(https, /Mercado Pago/)
  assert.match(https, /não selos de certificação externa/)
  assert.doesNotMatch(https, /Google|Safe Browsing|compra garantida/i)
  const http = renderToStaticMarkup(React.createElement(FooterSecurity, { https: false }))
  assert.doesNotMatch(http, /Conexão HTTPS/)
})

test('logotipos de bandeiras são arquivos PNG locais válidos', async () => {
  for (const brand of ['visa', 'mastercard', 'elo', 'amex']) {
    const metadata = await sharp(path.join(root, 'public', 'payment-brands', `${brand}.png`)).metadata()
    assert.equal(metadata.format, 'png')
    assert.ok(metadata.width > 0 && metadata.height > 0)
  }
})

test('preço e desconto preservam o valor do catálogo e usam moeda brasileira', () => {
  assert.equal(presentation.getProductSalePrice({ ...base, discountPercent: 25 }), 90)
  assert.equal(presentation.getProductSalePrice({ ...base, discountPercent: -10 }), 120)
  assert.equal(presentation.getProductSalePrice({ ...base, discountPercent: 120 }), 0)
  assert.match(presentation.formatProductPrice(1234.5), /1\.234,50/)
  assert.equal(presentation.formatProductPrice(0), 'Consulte o preço')
  assert.equal(presentation.formatProductPrice(NaN), 'Consulte o preço')
})

test('compatibilidade resume modelos reais, deduplica e informa os adicionais', () => {
  assert.equal(presentation.getProductCompatibilityLabel({ ...base, compatibleEquipment: 'LX; RT;LX;\nAria' }), 'LX / RT + 1 modelo')
  assert.equal(presentation.getProductCompatibilityLabel(base), 'Confirme a compatibilidade com nossa equipe.')
})

test('card mostra referência pública, estoque e consulta sem expor código interno', () => {
  const html = renderToStaticMarkup(React.createElement(ProductCard, { product: { ...base, manufacturerPartNumber: 'PN-123', internalCode: 'PRIVATE-CODE' } }))
  assert.match(html, /PN-123/)
  assert.match(html, /3 em estoque/)
  assert.match(html, /Foto indisponível/)
  assert.match(html, /Ver peça e compatibilidade/)
  assert.doesNotMatch(html, /PRIVATE-CODE|logo-header|Compra verificada/)
})

test('card indisponível não anuncia desconto ou disponibilidade', () => {
  const html = renderToStaticMarkup(React.createElement(ProductCard, { product: { ...base, stock: 0, discountPercent: 10 } }))
  assert.match(html, /Indisponível/)
  assert.match(html, /Consulte disponibilidade/)
  assert.doesNotMatch(html, /OFF|em estoque|<del>/)
})

test('banner respeita seleção administrativa e não inventa promoção', () => {
  const html = renderToStaticMarkup(React.createElement(HeroBanner, {
    products: [{ ...base, showInBanner: true }, { ...base, id: 'hidden', name: 'Não selecionada', showInBanner: false }, { ...base, id: 'inactive', name: 'Inativa', active: false, showInBanner: true }],
    loading: false, error: '',
  }))
  assert.match(html, /Correia de teste/)
  assert.doesNotMatch(html, /Não selecionada|Inativa|DESTAQUE DA SEMANA|OFF|Próxima peça/)
})

test('banner sem seleção explica identificação; com várias peças oferece controles', () => {
  const empty = renderToStaticMarkup(React.createElement(HeroBanner, { products: [], loading: false, error: '' }))
  assert.match(empty, /modelo certo/)
  const multiple = renderToStaticMarkup(React.createElement(HeroBanner, { products: [{ ...base, showInBanner: true }, { ...base, id: 'second', showInBanner: true }], loading: false, error: '' }))
  assert.match(multiple, /Peça anterior/)
  assert.match(multiple, /Próxima peça/)
  assert.match(multiple, /aria-pressed="true"/)
})

test('PNGs e ícone Apple têm dimensões quadradas reais sem ampliação de raster', async () => {
  for (const [file, size] of [['favicon-48.png', 48], ['favicon-96.png', 96], ['favicon-192.png', 192], ['favicon-512.png', 512], ['apple-touch-icon.png', 180]]) {
    const metadata = await sharp(path.join(root, 'public', file)).metadata()
    assert.equal(metadata.format, 'png')
    assert.equal(metadata.width, size)
    assert.equal(metadata.height, size)
  }
})

test('ICO contém quadros válidos de 16, 32 e 48 px', async () => {
  const ico = fs.readFileSync(path.join(root, 'public', 'favicon.ico'))
  assert.equal(ico.readUInt16LE(0), 0)
  assert.equal(ico.readUInt16LE(2), 1)
  assert.equal(ico.readUInt16LE(4), 3)
  for (const [index, size] of [16, 32, 48].entries()) {
    const entry = 6 + index * 16
    assert.equal(ico[entry], size)
    assert.equal(ico[entry + 1], size)
    const length = ico.readUInt32LE(entry + 8)
    const offset = ico.readUInt32LE(entry + 12)
    assert.ok(offset + length <= ico.length)
    const metadata = await sharp(ico.subarray(offset, offset + length)).metadata()
    assert.equal(metadata.width, size)
    assert.equal(metadata.height, size)
  }
})

test('marca e favicon usam o mesmo A com triângulo e sem chave de boca', async () => {
  const logo = fs.readFileSync(path.join(root, 'public', 'brand-logo.svg'), 'utf8')
  const mark = fs.readFileSync(path.join(root, 'public', 'brand-mark.svg'), 'utf8')
  const a = logo.match(/<path id="letter-a" d="([^"]+)"/)[1]
  assert.ok(mark.includes(`d="${a}"`))
  assert.match(logo, /translate\(24 13\) scale\(1\.9\)/)
  assert.match(logo, /translate\(134 117\.5\) scale\(\.95\)/)
  assert.equal(1.9 / .95, 2)
  assert.equal(13 + 110 * 1.9, 117.5 + 110 * .95)
  assert.equal((logo.match(/<use href="#letter-a"/g) || []).length, 2)
  for (const svg of [logo, mark]) {
    assert.match(svg, /m45 110 15-28 15 28Z/)
    assert.doesNotMatch(svg, /chave|ferramentas/i)
  }
  const layout = fs.readFileSync(path.join(root, 'components', 'Layout.tsx'), 'utf8')
  assert.match(layout, /<img src="\/brand-logo\.svg"/)
  const jpg = await sharp(path.join(root, 'public', 'logo-header-uniform.jpg')).metadata()
  assert.equal(jpg.width, 1280)
  assert.equal(jpg.height, 240)
  for (const [file, size] of [['favicon-192.png', 192], ['apple-touch-icon.png', 180]]) {
    const expected = await sharp(Buffer.from(mark)).resize(size, size).raw().toBuffer()
    const actual = await sharp(path.join(root, 'public', file)).raw().toBuffer()
    assert.deepEqual(actual, expected)
  }
})
