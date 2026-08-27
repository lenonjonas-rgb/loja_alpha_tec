const fs = require('fs/promises')
const path = require('path')
const sharp = require('sharp')

const inputDir = path.join(process.cwd(), 'images-inbox')
const outputDir = path.join(process.cwd(), 'public', 'images', 'products')
const metadataFile = path.join(process.cwd(), 'lib', 'catalog.generated.json')
const supportedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const processing = new Set()

async function ensureDirectories() {
  await fs.mkdir(inputDir, { recursive: true })
  await fs.mkdir(outputDir, { recursive: true })
}

function outputName(fileName) {
  return `${path.basename(fileName, path.extname(fileName)).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.webp`
}

function parseProductName(fileName) {
  const baseName = path.basename(fileName, path.extname(fileName)).trim()
  const match = baseName.match(/^(.+?)\s*\(([^)]+)\)\s*\{([^}]+)\}$/)
  if (!match) return null
  return { name: match[1].trim(), compatibleEquipment: match[2].trim(), description: match[3].trim() }
}

async function processImage(fileName) {
  const extension = path.extname(fileName).toLowerCase()
  if (!supportedExtensions.has(extension) || processing.has(fileName)) return
  processing.add(fileName)
  try {
    const source = path.join(inputDir, fileName)
    const destination = path.join(outputDir, outputName(fileName))
    await sharp(source).rotate().resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(destination)
    const productDetails = parseProductName(fileName)
    if (productDetails) {
      const catalog = JSON.parse(await fs.readFile(metadataFile, 'utf8').catch(() => '[]'))
      const generatedProduct = { id: path.basename(destination, '.webp'), name: productDetails.name, category: 'Peças', compatibleEquipment: productDetails.compatibleEquipment, description: productDetails.description, price: 0, image: `/images/products/${path.basename(destination)}` }
      const updatedCatalog = catalog.filter((product) => product.id !== generatedProduct.id).concat(generatedProduct)
      await fs.writeFile(metadataFile, `${JSON.stringify(updatedCatalog, null, 2)}\n`)
    } else console.warn(`Imagem otimizada, mas não cadastrada: ${fileName}. Use (equipamentos) {descrição} para preencher o catálogo.`)
    console.log(`Imagem processada: ${fileName} -> public/images/products/${path.basename(destination)}`)
  } catch (error) {
    console.error(`Não foi possível processar ${fileName}:`, error.message)
  } finally {
    processing.delete(fileName)
  }
}

async function processExistingImages() {
  const files = await fs.readdir(inputDir)
  await Promise.all(files.map(processImage))
}

async function main() {
  await ensureDirectories()
  await processExistingImages()
  if (process.argv.includes('--watch')) {
    console.log(`Observando novas imagens em ${inputDir}`)
    const watcher = require('fs').watch(inputDir, (_, fileName) => fileName && setTimeout(() => processImage(fileName), 300))
    process.on('SIGINT', () => { watcher.close(); process.exit(0) })
  }
}

main().catch((error) => { console.error(error); process.exit(1) })
