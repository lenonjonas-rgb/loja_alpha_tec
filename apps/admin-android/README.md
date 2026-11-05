# Alpha Tec Android

Expo app that opens the protected admin site online. The website remains the source of truth, so published admin updates appear when the app is opened or refreshed.

## Run with Expo Go

```powershell
cd apps/admin-android
npm run start
```

Install Expo Go on the Android device and scan the QR code shown by Expo.

The default URL is `https://lojaalphatec.com.br/admin`. For local development, create `.env.local` in this folder and point `EXPO_PUBLIC_ADMIN_URL` to the development server, for example `http://10.0.2.2:3000/admin` for the Android emulator. For a physical phone, use the computer's LAN IP and run Next.js with `--hostname 0.0.0.0`.

The device needs internet access to use the admin panel. Expo Go is for development; a standalone Android build can be produced later with EAS Build.

## Local signed APK

On Windows, install a compatible Java 17 JDK and Android SDK (platform/build
tools 36.0.0, NDK 27.1.12297006), and set `JAVA_HOME` and `ANDROID_HOME`.
The Expo signing key must be downloaded once with
`npx eas-cli@latest credentials --platform android` using the `preview` profile.
Keep `credentials.json` and `credentials/android/keystore.jks` private; both are
ignored by Git and EAS uploads.

From this directory, run `npm run build:apk`. The script prebuilds and compiles
the release app, signs it with the existing Expo keystore, verifies its
certificate/package/name/version and alignment, then writes
`Alpha-Tec-v<version>-build<versionCode>.apk` directly into the repository root.
Before each subsequent release, increase `android.versionCode` in `app.json`;
the script refuses to overwrite an existing APK. Install with
`adb install -r C:\Sistema\loja_alpha_tec\Alpha-Tec-v1.0.0-build3.apk` to update
the existing app without uninstalling it.

## App icon

The launcher icon uses the same `public/brand-mark.svg` as the website favicon.
Run `npm run icons:generate` from the repository root to regenerate both sets
of icons. Android adaptive and themed icons use separate transparent layers,
with padding to avoid clipping in circular launcher masks.
Icon changes require building and installing a new APK.
The repository-root `.easignore` excludes local environment files, cookies,
dependencies and caches from the cloud build upload.

## Posts and video export

The app receives generated PNG/MP4/WebM files from the protected admin page,
writes them to its local cache and opens Android's share sheet. Choose a
compatible app to save or send the file. Cancelling the sheet does not mean
the file was saved. Cache files may be removed by the operating system.
Exports are limited to 32 MB per file; trim longer videos in **Posts** first.
The editor supports start/end trimming, zoom and horizontal/vertical positioning.
Video export is silent, runs in real time and requires keeping the app open.
MP4 support depends on the device WebView; WebM may require conversion for Instagram.

This feature requires a new APK containing `expo-file-system` and `expo-sharing`
and the updated admin website. Publishing only the website is not enough.
Build with `npx eas-cli@latest build --platform android --profile preview`
and install the resulting APK. Old APKs show an update instruction on export.
On a physical device, verify a PNG export, a trimmed video export, cancelling
the share sheet and returning to the editor without losing the selected file.

## Android push notifications

Remote push is not available in Expo Go on Android. Install an EAS APK to test it.

Before rebuilding with push enabled:

1. Create a Firebase project and register the Android package `br.com.lojaalphatec.admin`.
2. Download that app's `google-services.json` into this folder; `app.json` is configured to use it. This is Firebase's public client configuration and may be included in the app build.
3. In Firebase, create an FCM V1 service-account key and upload it to the Alpha Tec Admin project under Expo dashboard **Credentials > Android > FCM V1 service account key**. Never commit or send the private service-account JSON in chat.
4. Build a new APK with `eas build --platform android --profile preview` and reinstall it.

The installed app asks Android for notification permission. After admin login, its Expo push token is registered automatically. Alerts are sent for new cart starts, orders/payments, questions, reviews, new customers and leads.