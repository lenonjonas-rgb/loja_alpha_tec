const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')
const vm = require('node:vm')

function load(relative, globals = {}) {
  const module = { exports: {} }
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', relative), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText
  vm.runInNewContext(source, { module, exports: module.exports, ...globals })
  return module.exports
}

const video = load('lib/promotion-video.ts')

test('corte conserva início/fim e duração exata, inclusive menor que 12 segundos', () => {
  const clip = video.getVideoClip(20, 3.5, 8)
  assert.equal(clip.start, 3.5)
  assert.equal(clip.end, 8)
  assert.equal(clip.duration, 4.5)
  assert.equal(video.getVideoClip(4, 0, 4).duration, 4)
})

test('corte rejeita tempos inválidos em vez de exportar um trecho diferente', () => {
  for (const args of [[0, 0, 1], [10, -1, 5], [10, 4, 4], [10, 6, 5], [10, 0, 11], [NaN, 0, 5], [10, 0, Infinity]]) {
    assert.throws(() => video.getVideoClip(...args), /trecho válido/)
  }
})

test('enquadramento mantém proporções e permite alcançar as bordas do recorte', () => {
  const box = { x: 54, y: 570, width: 972, height: 900 }
  for (const contain of [true, false]) {
    for (const [sourceWidth, sourceHeight] of [[1920, 1080], [1080, 1920]]) {
      for (const zoom of [1, 1.8, 2.6]) {
        const center = video.getMediaPlacement(sourceWidth, sourceHeight, box, contain, zoom, 0, 0)
        assert.ok(Math.abs(center.width / center.height - sourceWidth / sourceHeight) < 1e-10)
        assert.equal(center.x + center.width / 2, box.x + box.width / 2)
        assert.equal(center.y + center.height / 2, box.y + box.height / 2)
        if (!contain) {
          assert.ok(center.width >= box.width && center.height >= box.height)
          const edge = video.getMediaPlacement(sourceWidth, sourceHeight, box, contain, zoom, 1, 1)
          assert.ok(Math.abs(edge.x - box.x) < 1e-10)
          assert.ok(Math.abs(edge.y - box.y) < 1e-10)
        }
      }
    }
  }
})

function exporter({ native = false, version = 1, error, respond = true } = {}) {
  const events = new Map()
  const timers = new Map()
  const calls = []
  let counter = 0
  const window = {
    __alphaTecNativeExportVersion: version,
    setTimeout: (callback, delay) => { timers.set(++counter, { callback, delay }); return counter },
    clearTimeout: (id) => timers.delete(id),
    addEventListener: (name, callback) => events.set(name, callback),
    removeEventListener: (name) => events.delete(name),
  }
  if (native) window.ReactNativeWebView = { postMessage: (json) => {
    const payload = JSON.parse(json)
    calls.push(payload)
    if (respond) events.get('alpha-tec-export-result')({ detail: { id: payload.id, error } })
  } }
  const link = { click: () => calls.push('click'), remove: () => calls.push('remove') }
  const api = load('lib/promotion-export.ts', {
    window,
    document: { createElement: () => link, body: { appendChild: () => calls.push('append') } },
    URL: { createObjectURL: () => 'blob:post', revokeObjectURL: (url) => calls.push(url) },
    FileReader: class {
      readAsDataURL(blob) { this.result = `data:${blob.type};base64,UE5H`; this.onload() }
    },
  })
  return { ...api, calls, events, timers, link }
}

test('navegador exporta PNG por Blob e libera a URL depois do download', async () => {
  const env = exporter()
  assert.equal(await env.exportPromotion(new Blob(['PNG'], { type: 'image/png' }), 'post.png'), 'download')
  assert.equal(env.link.download, 'post.png')
  assert.equal(env.link.href, 'blob:post')
  assert.deepEqual(env.calls, ['append', 'click', 'remove'])
  const timer = [...env.timers.values()][0]
  assert.equal(timer.delay, 60_000)
  timer.callback()
  assert.equal(env.calls.at(-1), 'blob:post')
})

test('app envia o arquivo ao bridge e só conclui após confirmação nativa', async () => {
  const env = exporter({ native: true, respond: false })
  let finished = false
  const result = env.exportPromotion(new Blob(['PNG'], { type: 'image/png' }), 'post.png').then((value) => { finished = true; return value })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(finished, false)
  assert.equal(env.calls[0].type, 'admin-export-media')
  assert.equal(env.calls[0].fileName, 'post.png')
  assert.equal(env.calls[0].dataUrl, 'data:image/png;base64,UE5H')
  env.events.get('alpha-tec-export-result')({ detail: { id: 'outra-exportacao' } })
  assert.equal(finished, false)
  env.events.get('alpha-tec-export-result')({ detail: { id: env.calls[0].id } })
  assert.equal(await result, 'shared')
  assert.equal(env.events.size, 0)
  assert.equal(env.timers.size, 0)
})

test('APK antigo, arquivo vazio e limite de tamanho não simulam sucesso', async () => {
  const unsupported = exporter({ native: true, version: 0 })
  await assert.rejects(unsupported.exportPromotion(new Blob(['PNG']), 'post.png'), /Atualize/)
  assert.equal(unsupported.calls.length, 0)
  const env = exporter({ native: true })
  await assert.rejects(env.exportPromotion(new Blob(), 'post.png'), /vazio/)
  await assert.rejects(env.exportPromotion({ size: env.MAX_NATIVE_EXPORT_BYTES + 1 }, 'video.mp4'), /32 MB/)
  assert.equal(env.calls.length, 0)
})

test('falha nativa e ausência de confirmação são informadas e removem listeners', async () => {
  const env = exporter({ native: true, error: 'Sem espaço no aparelho.' })
  await assert.rejects(env.exportPromotion(new Blob(['PNG']), 'post.png'), /Sem espaço/)
  assert.equal(env.events.size, 0)
  const timeout = exporter({ native: true, respond: false })
  const result = timeout.exportPromotion(new Blob(['PNG']), 'post.png')
  await new Promise((resolve) => setImmediate(resolve))
  const rejection = assert.rejects(result, /não confirmou/)
  ;[...timeout.timers.values()][0].callback()
  await rejection
  assert.equal(timeout.events.size, 0)
})

function nativeExporter({ available = true, failShare = false } = {}) {
  const files = []
  const shares = []
  const api = load('apps/admin-android/media-export.ts', {
    require: (name) => {
      if (name === 'expo-file-system') return {
        Paths: { cache: 'cache' },
        File: class {
          constructor(directory, name) { this.uri = `${directory}/${name}`; files.push(this) }
          create() { this.exists = true }
          write(data, options) { this.data = data; this.options = options }
          delete() { this.exists = false }
        },
      }
      if (name === 'expo-sharing') return {
        isAvailableAsync: async () => available,
        shareAsync: async (uri, options) => {
          shares.push({ uri, options })
          if (failShare) throw new Error('Falha ao compartilhar')
        },
      }
      throw new Error(`Unexpected import ${name}`)
    },
  })
  return { ...api, files, shares }
}

test('exportação nativa escreve base64 e abre compartilhamento com MIME correto', async () => {
  for (const mime of ['image/png', 'video/mp4', 'video/webm;codecs=vp9']) {
    const env = nativeExporter()
    await env.sharePromotionMedia({ fileName: '../../post.png', dataUrl: `data:${mime};base64,UE5H` })
    assert.equal(env.files[0].data, 'UE5H')
    assert.equal(env.files[0].options.encoding, 'base64')
    assert.ok(!env.files[0].uri.includes('..'))
    assert.equal(env.shares[0].options.mimeType, mime.split(';')[0])
    assert.ok(env.files[0].exists)
  }
})

test('nativo rejeita formato/carga inválidos e informa falha de compartilhamento', async () => {
  const env = nativeExporter()
  for (const dataUrl of ['https://site/image.png', 'data:text/html;base64,UE5H', 'data:image/png;base64,!!!']) {
    await assert.rejects(env.sharePromotionMedia({ fileName: 'post.png', dataUrl }), /Formato inválido/)
  }
  assert.equal(env.files.length, 0)
  await assert.rejects(nativeExporter({ available: false }).sharePromotionMedia({ fileName: 'post.png', dataUrl: 'data:image/png;base64,UE5H' }), /não está disponível/)
  const failure = nativeExporter({ failShare: true })
  await assert.rejects(failure.sharePromotionMedia({ fileName: 'post.png', dataUrl: 'data:image/png;base64,UE5H' }), /Falha ao compartilhar/)
  assert.equal(failure.files[0].exists, false)
})
