# Meta (Facebook) SDK setup in Kiddo app

The Meta SDK is integrated for app install attribution and event tracking. Events are sent both from the app (SDK) and from the backend (CAPI) with the same `event_id` so Meta can deduplicate.

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

## 4. Backend (kiddo-service) CAPI

Ensure kiddo-service has Meta CAPI configured (`META_PIXEL_ID`, `META_CAPI_ACCESS_TOKEN`) so server-side events are sent. Same Pixel ID as in your Meta Events Manager.

## Events and dedup

- **Order / Purchase** events include `event_id: orderId` so the same event from the app and from the backend are deduplicated by Meta.
- Other events can pass `event_id` or `orderId` in `properties` when calling `trackEvent()` for CAPI dedup.
