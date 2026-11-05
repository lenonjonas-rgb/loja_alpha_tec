const { spawnSync } = require('node:child_process')
const { createHash } = require('node:crypto')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

const appDir = path.resolve(__dirname, '..')
const repoDir = path.resolve(appDir, '..', '..')
const androidDir = path.join(appDir, 'android')
const sdkDir = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT
const javaHome = process.env.JAVA_HOME
const config = JSON.parse(fs.readFileSync(path.join(appDir, 'app.json'), 'utf8')).expo
const versionCode = config.android.versionCode
const outputName = `Alpha-Tec-v${config.version}-build${versionCode}.apk`
const outputPath = path.join(repoDir, outputName)

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: command.toLowerCase().endsWith('.bat'),
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed with exit code ${result.status}`)
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: command.toLowerCase().endsWith('.bat'),
    ...options,
  })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr || `${path.basename(command)} failed with exit code ${result.status}`)
  return result.stdout
}

function main() {
  if (!sdkDir || !javaHome) throw new Error('Configure ANDROID_HOME and JAVA_HOME before building.')
  if (!Number.isInteger(versionCode) || versionCode < 1) throw new Error('app.json must specify a positive android.versionCode.')
  if (fs.existsSync(outputPath)) throw new Error(`${outputName} already exists. Increment android.versionCode in app.json before another release build.`)

  const credentialsPath = path.join(appDir, 'credentials.json')
  if (!fs.existsSync(credentialsPath)) {
    throw new Error('Download the existing Expo Android keystore first: run `npx eas-cli@latest credentials --platform android` and choose the preview profile.')
  }
  const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8')).android?.keystore
  if (!credentials?.keystorePath || !credentials.keyAlias || !credentials.keystorePassword || !credentials.keyPassword) {
    throw new Error('credentials.json does not contain complete Android keystore credentials.')
  }
  const keystorePath = path.resolve(appDir, credentials.keystorePath)
  if (!fs.existsSync(keystorePath)) throw new Error(`Expo keystore not found: ${keystorePath}`)

  const buildToolsDir = path.join(sdkDir, 'build-tools', '36.0.0')
  const gradle = path.join(androidDir, 'gradlew.bat')
  const unsignedPath = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk')
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-tec-apk-'))
  const signedPath = path.join(tempDir, outputName)
  const certificatePath = path.join(tempDir, 'expo-signing.cer')
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    ALPHA_STORE_PASSWORD: credentials.keystorePassword,
    ALPHA_KEY_PASSWORD: credentials.keyPassword,
  }

  try {
    run('npx.cmd', ['expo', 'prebuild', '--platform', 'android', '--no-install'], { cwd: appDir })
    run(gradle, [':app:assembleRelease', '--no-daemon', '--console=plain', '--max-workers=2'], { cwd: androidDir, env, shell: true })
    if (!fs.existsSync(unsignedPath)) throw new Error(`Gradle did not produce the release APK at ${unsignedPath}`)

    run(path.join(buildToolsDir, 'apksigner.bat'), [
      'sign', '--ks', keystorePath, '--ks-key-alias', credentials.keyAlias,
      '--ks-pass', 'env:ALPHA_STORE_PASSWORD', '--key-pass', 'env:ALPHA_KEY_PASSWORD',
      '--out', signedPath, unsignedPath,
    ], { env })

    const verification = capture(path.join(buildToolsDir, 'apksigner.bat'), [
      'verify', '--verbose', '--print-certs', signedPath,
    ])
    capture(path.join(javaHome, 'bin', 'keytool.exe'), [
      '-exportcert', '-keystore', keystorePath, '-alias', credentials.keyAlias,
      '-storepass:env', 'ALPHA_STORE_PASSWORD', '-file', certificatePath,
    ], { env })
    const certificateDigest = createHash('sha256').update(fs.readFileSync(certificatePath)).digest('hex')
    const signedDigest = verification.match(/Signer #1 certificate SHA-256 digest:\s*([a-f0-9]+)/i)?.[1]?.toLowerCase()
    if (!signedDigest || signedDigest !== certificateDigest) throw new Error('The APK certificate does not match the existing Expo signing key.')

    run(path.join(buildToolsDir, 'zipalign.exe'), ['-c', '-P', '16', '4', signedPath])
    const metadata = capture(path.join(buildToolsDir, 'aapt.exe'), ['dump', 'badging', signedPath])
    if (!metadata.includes(`application-label:'${config.name}'`)) throw new Error('The APK display name does not match app.json.')
    if (!metadata.includes(`versionCode='${versionCode}'`)) throw new Error('The APK versionCode does not match app.json.')
    if (!metadata.includes(`name='${config.android.package}'`)) throw new Error('The APK package name does not match app.json.')

    fs.copyFileSync(signedPath, outputPath, fs.constants.COPYFILE_EXCL)
    console.log(`Signed and verified APK saved to ${outputPath}`)
  } finally {
    delete env.ALPHA_STORE_PASSWORD
    delete env.ALPHA_KEY_PASSWORD
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

try {
  main()
} catch (error) {
  console.error(`APK build failed: ${error.message}`)
  process.exitCode = 1
}
