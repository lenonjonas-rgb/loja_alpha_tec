const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

function createBanner() {
  const states = []
  let cursor = 0
  let dependencies
  let cleanup
  let timer
  let interval
  const react = {
    useState(initial) {
      const slot = cursor++
      if (!(slot in states)) states[slot] = initial
      return [states[slot], (value) => {
        states[slot] = typeof value === 'function' ? value(states[slot]) : value
      }]
    },
    useEffect(effect, next) {
      if (!dependencies || next.some((value, i) => value !== dependencies[i])) {
        if (cleanup) cleanup()
        dependencies = next
        cleanup = effect()
      }
    },
  }
  const source = fs.readFileSync(path.join(__dirname, '..', 'components', 'HeroBanner.tsx'), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  const requireMock = (name) => {
    if (name === 'react') return react
    if (name === 'react/jsx-runtime') return {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    }
    if (name.includes('product-presentation')) return {
      formatProductPrice: String,
      getProductCompatibilityLabel: () => '',
      getProductSalePrice: () => 10,
    }
    return { default: () => null, __esModule: true }
  }
  new Function('module', 'exports', 'require', 'setInterval', 'clearInterval', output)(
    module, module.exports, requireMock,
    (callback, delay) => { timer = callback; interval = delay; return 1 },
    () => { timer = undefined },
  )
  return {
    render(count = 3) {
      cursor = 0
      return module.exports.default({
        products: Array.from({ length: count }, (_, id) => ({ id: String(id), name: `Piece ${id}`, showInBanner: true })),
        loading: false, error: '',
      })
    },
    tick() { if (timer) timer() },
    get index() { return states[0] },
    get active() { return !!timer },
    get interval() { return interval },
    unmount() { if (cleanup) cleanup() },
  }
}

test('banner rotates every 2000ms, wraps and pauses on hover until mouse leaves', () => {
  const banner = createBanner()
  let tree = banner.render()
  assert.equal(banner.interval, 2000)
  banner.tick()
  assert.equal(banner.index, 1)
  tree.props.onMouseEnter()
  tree = banner.render()
  assert.equal(banner.active, false)
  banner.tick()
  assert.equal(banner.index, 1)
  tree.props.onMouseLeave()
  banner.render()
  assert.equal(banner.active, true)
  banner.tick()
  banner.tick()
  assert.equal(banner.index, 0)
  banner.unmount()
  assert.equal(banner.active, false)
})

test('keyboard focus pauses rotation; zero or one slide never starts a timer', () => {
  const banner = createBanner()
  let tree = banner.render()
  tree.props.onFocus()
  tree = banner.render()
  assert.equal(banner.active, false)
  tree.props.onBlur({ currentTarget: { contains: () => true }, relatedTarget: {} })
  tree = banner.render()
  assert.equal(banner.active, false)
  tree.props.onBlur({ currentTarget: { contains: () => false }, relatedTarget: null })
  banner.render()
  assert.equal(banner.active, true)
  banner.render(1)
  assert.equal(banner.active, false)
  banner.render(0)
  assert.equal(banner.active, false)
})
