# iOS OneSignal Push Notifications - Implementation Checklist

## ✅ What's Working

1. ✅ **OneSignal Package Installed**
   - `react-native-onesignal` v5.3.1 in package.json
   - OneSignalXCFramework v5.4.1 in Podfile.lock

2. ✅ **OneSignal Pods Installed**
   - `ios/Pods/OneSignalXCFramework` exists
   - All required frameworks linked in Xcode project

3. ✅ **OneSignal Service Implementation**
   - Service file: `services/oneSignalService.ts`
   - App ID configured: `f27e340f-3a14-47bb-abef-d94319e7e93e`
   - Initialization in `app/_layout.tsx`
   - Permission request implemented
   - Subscription status checking implemented

4. ✅ **iOS Import Handling**
   - Safe import for iOS simulator (handles NativeEventEmitter error)
   - Android uses direct import (unchanged)

## ❌ Missing/Issues Found

### 1. 🔴 **Push Notification Capabilities Missing** (CRITICAL)
**Location:** `ios/Kiddo/Kiddo.entitlements`
**Status:** File is empty - missing push notification entitlements
**Required:**
```xml
<key>aps-environment</key>
<string>development</string> <!-- or "production" for release -->
```

### 2. 🔴 **Notification Permission Description Missing** (CRITICAL)
**Location:** `ios/Kiddo/Info.plist`
**Status:** Missing `NSUserNotificationsUsageDescription`
**Required for iOS 10+:** Add notification permission description

### 3. ⚠️ **No Native OneSignal Initialization in AppDelegate**
**Location:** `ios/Kiddo/AppDelegate.swift`
**Status:** OneSignal not initialized natively (may be optional for v5)
**Note:** OneSignal v5 may auto-initialize via JS, but native init is recommended

### 4. ⚠️ **Background Modes Not Configured**
**Location:** `ios/Kiddo/Info.plist` or Xcode Capabilities
**Status:** Background modes for remote notifications not explicitly set
**Note:** May work without, but recommended for reliable delivery

---

## 🔧 Required Fixes

### Fix 1: Add Push Notification Entitlements
**File:** `ios/Kiddo/Kiddo.entitlements`

Add:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>aps-environment</key>
    <string>development</string>
  </dict>
</plist>
```

**For Production:** Change `development` to `production`

### Fix 2: Add Notification Permission Description
**File:** `ios/Kiddo/Info.plist`

Add before closing `</dict>`:
```xml
<key>NSUserNotificationsUsageDescription</key>
<string>We need permission to send you push notifications about your orders and updates</string>
```

### Fix 3: (Optional) Add Background Modes
**File:** `ios/Kiddo/Info.plist`

Add:
```xml
<key>UIBackgroundModes</key>
<array>
  <string>remote-notification</string>
</array>
```

---

## 📋 Testing Checklist

- [ ] Test on **physical iOS device** (push notifications don't work in simulator)
- [ ] Verify permission prompt appears on first launch
- [ ] Check OneSignal dashboard for device registration
- [ ] Send test notification from OneSignal dashboard
- [ ] Verify notification appears when app is:
  - [ ] In foreground
  - [ ] In background
  - [ ] Closed/killed
- [ ] Test notification tap navigation

---

## 🚀 Next Steps

1. **Fix entitlements file** - Add `aps-environment`
2. **Add permission description** - Add to Info.plist
3. **Test on physical device** - Simulator won't work
4. **Verify in OneSignal dashboard** - Check device registration
5. **Send test notification** - Verify end-to-end flow

---

## 📝 Notes

- **Simulator Limitation:** Push notifications don't work in iOS simulator - must test on physical device
- **APNs Certificate:** Ensure OneSignal dashboard has correct APNs certificate/key configured
- **Bundle ID:** Verify `com.kiddo.ak` matches OneSignal dashboard configuration
- **OneSignal v5:** Uses JS initialization - native AppDelegate init may not be required

---

**Status:** ⚠️ **NOT READY** - Missing critical entitlements and permission description

