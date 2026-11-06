import { Html, Head, Main, NextScript } from 'next/document'

// Import map usado pela IA de recorte do Editor de mídia: o bundle nativo de
// @imgly/background-removal importa 'onnxruntime-web' por especificador bare,
// resolvido aqui para o CDN (versão fixada pela peer dependency do pacote).
const importMap = JSON.stringify({
  imports: {
    'onnxruntime-web': 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.bundle.min.mjs',
    'onnxruntime-web/webgpu': 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.webgpu.bundle.min.mjs',
    'onnxruntime-web/wasm': 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.21.0/dist/ort.wasm.bundle.min.mjs',
  },
})

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        <script type="importmap" dangerouslySetInnerHTML={{ __html: importMap }} />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
