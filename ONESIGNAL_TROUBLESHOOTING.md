# OneSignal Initialization Failed - Troubleshooting Guide

## Issue: "OneSignal Available: ❌ No" in TestFlight

This means the OneSignal native module is not being loaded at runtime.

## Step-by-Step Fix

### 1. Verify Pods are Installed
```bash
cd ios
pod install
pod update OneSignalXCFramework
```

### 2. Clean Build
```bash
# Clean Xcode build
cd ios
rm -rf build/
rm -rf ~/Library/Developer/Xcode/DerivedData/Kiddo-*

# Clean pods
pod deintegrate
pod install
```

### 3. Verify Xcode Build Settings

1. Open `ios/Kiddo.xcodeproj` in Xcode
2. Select the **Kiddo** target
3. Go to **Build Phases** → **Link Binary With Libraries**
4. Verify you see:
   - `OneSignalFramework.framework`
   - `OneSignalCore.framework`
   - `OneSignalNotifications.framework`
   - Other OneSignal frameworks

5. If missing, add them manually:
   - Click `+` button
   - Add the frameworks from `Pods/OneSignalXCFramework/...`

### 4. Check Build Configuration

1. In Xcode, select **Product** → **Scheme** → **Edit Scheme**
2. Select **Archive** configuration
3. Verify **Build Configuration** is set to **Release**

### 5. Verify Framework Search Paths

1. Select **Kiddo** target → **Build Settings**
2. Search for **Framework Search Paths**
3. Verify it includes:
   - `$(inherited)`
   - `"${PODS_CONFIGURATION_BUILD_DIR}/OneSignalXCFramework"`

### 6. Check for Build Errors

1. Build the project in Xcode: **Product** → **Build**
2. Check for any red errors related to OneSignal
3. Look for warnings about missing frameworks

### 7. Verify React Native Auto-linking

React Native 0.81+ should auto-link, but verify:

1. Check `ios/Podfile` - should have `use_expo_modules!`
2. Check `node_modules/react-native-onesignal/package.json` exists
3. Run: `npx react-native config` to verify linking

### 8. Rebuild for TestFlight

After making changes:

```bash
# 1. Clean everything
cd ios
rm -rf build/ Pods/ Podfile.lock

# 2. Reinstall pods
pod install

# 3. Open Xcode and Archive
open Kiddo.xcodeproj
# Then: Product → Archive
```

## Common Causes

### Cause 1: Pods Not Installed in Production Build
**Solution:** Run `pod install` and rebuild

### Cause 2: Frameworks Not Linked
**Solution:** Manually add frameworks in Xcode Build Phases

### Cause 3: Import Failing Silently
**Solution:** The require() might be failing. Check console logs for import errors.

### Cause 4: Build Configuration Mismatch
**Solution:** Ensure Release configuration includes all frameworks

## Debug Steps

1. **Check Console Logs**: Look for `[OneSignal]` prefixed logs
2. **Check Xcode Console**: Look for native module loading errors
3. **Verify Module**: The alert will show if module is available or not

## Next Steps

After fixing, rebuild and upload to TestFlight. The debug alert will show:
- ✅ **OneSignal Available: Yes** (if fixed)
- ❌ **OneSignal Available: No** (if still broken - check logs)

## Still Not Working?

If after all steps it still doesn't work:

1. Check Xcode build logs for specific errors
2. Verify OneSignal SDK version compatibility
3. Try downgrading/upgrading `react-native-onesignal` version
4. Check if other native modules work (if they also fail, it's a general linking issue)

