# Alpha Tec Admin Android

Expo app that opens the protected admin site online. The website remains the source of truth, so published admin updates appear when the app is opened or refreshed.

## Run with Expo Go

```powershell
cd apps/admin-android
npm run start
```

Install Expo Go on the Android device and scan the QR code shown by Expo.

The default URL is `https://lojaalphatec.com.br/admin`. For local development, create `.env.local` in this folder and point `EXPO_PUBLIC_ADMIN_URL` to the development server, for example `http://10.0.2.2:3000/admin` for the Android emulator. For a physical phone, use the computer's LAN IP and run Next.js with `--hostname 0.0.0.0`.

The device needs internet access to use the admin panel. Expo Go is for development; a standalone Android build can be produced later with EAS Build.

## Android push notifications

Remote push is not available in Expo Go on Android. Install an EAS APK to test it.

Before rebuilding with push enabled:

1. Create a Firebase project and register the Android package `br.com.lojaalphatec.admin`.
2. Download that app's `google-services.json` into this folder; `app.json` is configured to use it. This is Firebase's public client configuration and may be included in the app build.
3. In Firebase, create an FCM V1 service-account key and upload it to the Alpha Tec Admin project under Expo dashboard **Credentials > Android > FCM V1 service account key**. Never commit or send the private service-account JSON in chat.
4. Build a new APK with `eas build --platform android --profile preview` and reinstall it.

The installed app asks Android for notification permission. After admin login, its Expo push token is registered automatically. Alerts are sent for new cart starts, orders/payments, questions, reviews, new customers and leads.