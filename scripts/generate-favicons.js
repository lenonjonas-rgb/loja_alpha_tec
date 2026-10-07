const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')

const publicDir = path.join(__dirname, '..', 'public')
const source = path.join(publicDir, 'brand-mark.svg')

async function generate() {
  for (const size of [48, 96, 192, 512]) {
    await sharp(source).resize(size, size).png().toFile(path.join(publicDir, `favicon-${size}.png`))
  }
  await sharp(source).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'))

  const sizes = [16, 32, 48]
  const images = await Promise.all(sizes.map((size) => sharp(source).resize(size, size).png().toBuffer()))
  const header = Buffer.alloc(6 + 16 * sizes.length)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(sizes.length, 4)
  let offset = header.length
  images.forEach((image, index) => {
    const entry = 6 + 16 * index
    header[entry] = sizes[index]
    header[entry + 1] = sizes[index]
    header.writeUInt16LE(1, entry + 4)
    header.writeUInt16LE(32, entry + 6)
    header.writeUInt32LE(image.length, entry + 8)
    header.writeUInt32LE(offset, entry + 12)
    offset += image.length
  })
  await fs.writeFile(path.join(publicDir, 'favicon.ico'), Buffer.concat([header, ...images]))
  console.log('Favicons PNG, ICO e apple-touch-icon gerados a partir de brand-mark.svg.')
}

generate().catch((error) => {
  console.error('Falha ao gerar favicons:', error)
  process.exitCode = 1
})
