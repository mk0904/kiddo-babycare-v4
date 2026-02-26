# Deep Linking (Universal Links / App Links)

Product share links use **HTTPS** URLs so they are **clickable** in WhatsApp, SMS, email, etc. When the user taps the link:

- **App installed** → Opens the Kiddo app directly to the product screen
- **App not installed** → Opens the URL in the browser (you can add a Smart App Banner or redirect to Play Store / App Store)

## Link format

- **Example:** `https://app.kiddo.in/product/red-sweater-full-sleeve`
- Domain is set in `config/linking.ts` (default `app.kiddo.in`, or `EXPO_PUBLIC_DEEP_LINK_DOMAIN`).

## What’s already done in the app

1. **Share** – Product screen shares `https://<domain>/product/<handle>` (see `config/linking.ts` and `app/product/[id].tsx`).
2. **Android** – `app.json` has `intentFilters` for `https` + host `app.kiddo.in` + `pathPrefix` `/product`.
3. **iOS** – `app.json` has `associatedDomains`: `applinks:app.kiddo.in`.
4. **Expo Router** – Routes ` /product/[id]`; product screen loads by handle or GID.

## What you must do: host verification files

For the OS to open these links in the app (instead of the browser), your **domain** must host two verification files. Use the templates in `well-known/` and then host them under your domain.

### 1. Domain

- Use the domain you control that matches `app.kiddo.in` (or the host you set in `EXPO_PUBLIC_DEEP_LINK_DOMAIN`).
- That domain must be **HTTPS** and serve the files below at the exact paths.

### 2. Android – `assetlinks.json`

1. Open `well-known/assetlinks.json`.
2. Replace `REPLACE_WITH_YOUR_SHA256_FINGERPRINT` with your app’s SHA256 certificate fingerprint:
   - **EAS Build:** After a build, copy the value under “SHA256 Fingerprint”, or run `eas credentials -p android` and pick the build profile.
   - **Play Console:** Release → Setup → App Signing → “SHA-256 certificate fingerprint”.
3. Host the file so it is available at:
   - **URL:** `https://<your-domain>/.well-known/assetlinks.json`
   - **Content-Type:** `application/json`
   - No redirects; direct 200 response over HTTPS.

### 3. iOS – `apple-app-site-association`

1. Open `well-known/apple-app-site-association`.
2. Replace `REPLACE_WITH_APPLE_TEAM_ID` with your Apple Team ID (e.g. from [Apple Developer](https://developer.apple.com/account) → Membership).
3. Host the file so it is available at **either**:
   - `https://<your-domain>/.well-known/apple-app-site-association`, or
   - `https://<your-domain>/apple-app-site-association`
   - No redirects; served over HTTPS (no file extension).

### 4. Deploy

- Upload the contents of `well-known/` to your server so that:
  - `https://<your-domain>/.well-known/assetlinks.json` → content of `assetlinks.json`
  - `https://<your-domain>/.well-known/apple-app-site-association` → content of `apple-app-site-association`
- If you use a different domain than `app.kiddo.in`, update:
  - `config/linking.ts` (or `EXPO_PUBLIC_DEEP_LINK_DOMAIN`)
  - `app.json`: `ios.associatedDomains` and `android.intentFilters[].data[].host`
  - Then run `npx expo prebuild --clean` and rebuild the app.

## Testing

- **Android:** Install the app, then open `https://<your-domain>/product/<some-handle>` in Chrome or send the link via WhatsApp; it should open the app.
- **iOS:** Same; tap the link from Notes or Messages. If it opens in Safari, check AASA path and Team ID, and reinstall the app so iOS re-fetches the AASA.

## Optional: different domain

To use a domain other than `app.kiddo.in`:

1. Set `EXPO_PUBLIC_DEEP_LINK_DOMAIN` to that host (e.g. `go.yourdomain.com`).
2. In `app.json`, set:
   - `ios.associatedDomains` to `["applinks:<that-host>"]`
   - `android.intentFilters[].data[].host` to that host.
3. Host the same two files at `https://<that-host>/.well-known/` as above.
4. Run `npx expo prebuild --clean` and rebuild.
