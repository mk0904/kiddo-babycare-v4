# CleverTap push (Android & iOS)

## What the app does

`clevertapService.syncNativePushTokenWithCleverTap()`:

1. Ensures **notification permission** (via `expo-notifications`).
2. Reads the **native device token** with `getDevicePushTokenAsync()`.
3. Sends it to CleverTap with **`CleverTap.setFCMPushToken(token)`**:
   - **Android:** FCM token (despite the name, this is what the RN bridge uses).
   - **iOS:** Native code maps this call to **`setPushTokenAsString`** (APNs token).

**Android only:** creates notification channel **`default_channel`** to match `app.json` → `@clevertap/clevertap-expo-plugin` → `android.defaultNotificationChannelId`.

**Triggers**

- After **OneSignal** init (~3s), or when OneSignal fails to init (still try CleverTap token).
- On **login / identify** (`identifyUser` → `onUserLogin`).

## Backend (same endpoint as OneSignal)

`POST /api/v1/push/register` also receives CleverTap-oriented fields when the user has granted notifications and a native token exists:

| Field | Role |
|--------|------|
| `user_id` | Same stable id as OneSignal registration |
| `subscription_id` | OneSignal player / subscription id (empty if unavailable) |
| `native_push_token` | FCM (Android) or APNs (iOS) string from `expo-notifications` |
| `platform` | `android` or `ios` |

The service layer (`pushRegistrationService.registerWithBackend`) sends `native_push_token` + `platform` whenever permission is granted; your **kiddo-service** should map these to CleverTap’s [Upload User Profiles](https://developer.clevertap.com/docs/upload-user-profiles-api) (or your chosen server API) using Account Id / Passcode on the server only.

---

## Android checklist

1. **CleverTap dashboard:** **Settings → Mobile Push → Android** — add **FCM** credentials for the same Firebase project as `android/app/google-services.json` (package `com.barereactnativeapp072`).
2. **Device:** real device with Google Play Services; **POST_NOTIFICATIONS** granted (Android 13+).
3. **Profile:** after opening the app and allowing notifications, CleverTap user profile should show a push / FCM token.

---

## iOS checklist

1. **Real device** — iOS **Simulator does not receive APNs**; `getDevicePushTokenAsync()` will not return a usable token there.
2. **CleverTap dashboard:** **Settings → Mobile Push → iOS** — upload **APNs** credentials:
   - **.p8** key + Key ID + Team ID + **Bundle ID** (`com.kiddo.ak` per `app.json`), *or*
   - Certificates flow per CleverTap docs.
3. **`app.json`** CleverTap plugin uses `"ios": { "mode": "production" }` — push environment must match how you build:
   - **TestFlight / App Store** → production APNs.
   - **Development installs** from Xcode → often **development** APNs; if pushes never arrive, try `"mode": "development"` for dev builds only.
4. **Xcode:** **Push Notifications** capability enabled on the app target; provisioning profile includes it.
5. **Coexistence with OneSignal:** same APNs device token can be registered with both; if CleverTap still doesn’t deliver, confirm CleverTap’s iOS credentials and campaign targeting.

---

## Deprecated doc name

Earlier notes lived in `CLEVERTAP_ANDROID_PUSH.md`; use this file for both platforms.
