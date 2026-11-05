const fs = require('node:fs/promises')
const path = require('node:path')
const sharp = require('sharp')

const publicDir = path.join(__dirname, '..', 'public')
const source = path.join(publicDir, 'brand-mark.svg')
const appAssetsDir = path.join(__dirname, '..', 'apps', 'admin-android', 'assets')

async function generate() {
  await sharp(path.join(publicDir, 'brand-logo.svg'))
    .resize(1280, 240)
    .flatten({ background: '#18191b' })
    .jpeg({ quality: 95, chromaSubsampling: '4:4:4' })
    .toFile(path.join(publicDir, 'logo-header-uniform.jpg'))
  for (const size of [48, 96, 192, 512]) {
    await sharp(source).resize(size, size).png().toFile(path.join(publicDir, `favicon-${size}.png`))
  }
  await sharp(source).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'))

  await sharp(source).resize(1024, 1024).flatten({ background: '#18191b' }).png().toFile(path.join(appAssetsDir, 'icon.png'))
  await sharp(source).resize(48, 48).png().toFile(path.join(appAssetsDir, 'favicon.png'))
  const mark = (await fs.readFile(source, 'utf8')).replace(/<rect\b[^>]*\/>/, '')
  const foreground = await sharp(Buffer.from(mark)).resize(720, 720).png().toBuffer()
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#00000000' } })
    .composite([{ input: foreground, gravity: 'centre' }])
    .png()
    .toFile(path.join(appAssetsDir, 'android-icon-foreground.png'))
  const monochrome = await sharp(foreground).tint('#ffffff').png().toBuffer()
  await sharp({ create: { width: 1024, height: 1024, channels: 4, background: '#00000000' } })
    .composite([{ input: monochrome, gravity: 'centre' }])
    .png()
    .toFile(path.join(appAssetsDir, 'android-icon-monochrome.png'))

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
  console.log('Logo JPG gerado de brand-logo.svg; favicons e ícones do app gerados de brand-mark.svg.')
}

generate().catch((error) => {
  console.error('Falha ao gerar favicons:', error)
  process.exitCode = 1
})
