# Meta (Facebook) SDK setup in Kiddo app

The Meta SDK is integrated for app install attribution and event tracking. Events are sent both from the app (SDK) and from the backend (CAPI) with the same `event_id` so Meta can deduplicate.

## iOS SDK version (Podfile)

Per Meta's official documentation, the app's **ios/Podfile** pins these pods (used by `react-native-fbsdk-next`):

- `FBSDKCoreKit` ~> 18.0.0  
- `FBSDKLoginKit` ~> 18.0.0  
- `FBSDKShareKit` ~> 18.0.0  
- `FBSDKGamingServicesKit` ~> 18.0.0  

**Note:** Meta’s official CocoaPods doc shows `~> 8.0.0`. The package `react-native-fbsdk-next` (v13.x) depends on Facebook SDK **~> 18.0**, so the Podfile uses 18.0.0 for compatibility. To use 8.x you would need an older `react-native-fbsdk-next` that supports it.

To update to the latest 18.x:

```bash
cd ios && pod update FBSDKCoreKit FBSDKLoginKit FBSDKShareKit FBSDKGamingServicesKit && cd ..
```

## 1. Install native dependency

From the kiddo-app root:

```bash
npm install
cd ios && pod install && cd ..
```

## 2. Configure Facebook App ID and Client Token

1. Create or use an app at [developers.facebook.com](https://developers.facebook.com).
2. In **app.json**, replace the placeholders in the `react-native-fbsdk-next` plugin:
   - **appID**: Your Facebook App ID.
   - **clientToken**: From the app dashboard → Settings → Advanced → Client token.

Example (use your real values):

```json
[
  "react-native-fbsdk-next",
  {
    "appID": "1234567890123456",
    "clientToken": "abc123clienttoken",
    "displayName": "Kiddo",
    ...
  }
]
```

## 3. Rebuild the app

After changing `app.json` plugins:

```bash
npx expo prebuild --clean
npx expo run:ios
# or
npx expo run:android
```

## 4. iOS: App Tracking Transparency (ATT)

On iOS 14+, Meta can only receive app events if the user has been shown the **App Tracking Transparency** prompt and (for full attribution) has allowed tracking. The app uses `expo-tracking-transparency` to request permission shortly after launch. If the user taps **Ask App Not to Track**, events may still be sent but with limited data (e.g. no IDFA). If you never show the ATT prompt, Meta may not receive iOS events.

- The prompt is shown automatically ~500ms after the app is ready (see `requestMetaTrackingPermission()` in `utils/metaSDK.ts`).
- Ensure **Settings → Privacy & Security → Tracking** has “Allow Apps to Request to Track” enabled on the test device if you want to see the prompt.
- Meta Events Manager may still show “Your app is out of date” with a suggestion to use SDK 8.0; that message is outdated. The app correctly uses **FBSDK 18.x** for `react-native-fbsdk-next`; you can ignore that warning.

## 5. Backend (kiddo-service) CAPI

Ensure kiddo-service has Meta CAPI configured (`META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`) so server-side events are sent. Same Pixel ID as in your Meta Events Manager.

## 6. Events and dedup

- **Order / Purchase** events include `event_id: orderId` so the same event from the app and from the backend are deduplicated by Meta.
- Other events can pass `event_id` or `orderId` in `properties` when calling `trackEvent()` for CAPI dedup.
