# OneSignal TestFlight Setup Guide

## ✅ Changes Made for TestFlight Compatibility

1. **Entitlements Updated**: Changed `aps-environment` from `development` to `production` in `ios/Kiddo/Kiddo.entitlements`
2. **Debug Alerts Enabled**: Debug alerts now work in TestFlight builds (removed `__DEV__` check)

## ⚠️ Important Notes

### For Local Development:
If you need to test push notifications locally, you have two options:

**Option 1: Temporarily change entitlements back**
- Edit `ios/Kiddo/Kiddo.entitlements`
- Change `<string>production</string>` to `<string>development</string>`
- Rebuild the app

**Option 2: Use Xcode Build Settings (Recommended)**
1. Open `ios/Kiddo.xcodeproj` in Xcode
2. Select the project → Target "Kiddo" → Build Settings
3. Search for "Code Signing Entitlements"
4. For Debug configuration, you can create a separate entitlements file with `development`
5. For Release configuration, use the current file with `production`

### For TestFlight/Production:
✅ The current setup is correct for TestFlight:
- `aps-environment` is set to `production`
- Debug alerts will show in TestFlight to help troubleshoot

## 🔧 OneSignal Dashboard Configuration

**CRITICAL**: You must configure the production APNs certificate in OneSignal dashboard:

1. Go to OneSignal Dashboard → Settings → Platforms → Apple iOS
2. Upload your **Production APNs Certificate** or **APNs Auth Key**
3. Ensure the Bundle ID matches: `com.kiddo.ak`
4. Save the configuration

### APNs Certificate Options:
- **APNs Auth Key** (Recommended - works for both dev and production)
- **APNs Production Certificate** (Required for TestFlight/App Store)

## 📱 Testing in TestFlight

1. Build and upload to TestFlight
2. Install the app on a physical device (push notifications don't work in simulator)
3. When the app opens, you'll see debug alerts showing:
   - OneSignal availability
   - Permission status
   - Subscription status
   - Subscription ID
   - Any errors

4. Grant notification permission when prompted
5. Check the debug alert to confirm subscription

## 🐛 Troubleshooting

### If notifications don't work in TestFlight:

1. **Check OneSignal Dashboard**:
   - Verify production APNs certificate/key is uploaded
   - Check that Bundle ID matches `com.kiddo.ak`
   - Look for device registration in the dashboard

2. **Check Device**:
   - Ensure notifications are enabled in Settings > Kiddo > Notifications
   - Check the debug alert in the app for specific error messages

3. **Check Entitlements**:
   - Verify `aps-environment` is set to `production` in the entitlements file
   - Rebuild and re-upload to TestFlight

4. **Check OneSignal Service**:
   - The debug alerts will show if OneSignal is available and initialized
   - Check console logs for detailed error messages

## 📝 Summary

✅ **TestFlight Ready**: The app is now configured for TestFlight with:
- Production APNs environment
- Debug alerts enabled for troubleshooting
- Comprehensive error reporting

⚠️ **Action Required**: Upload production APNs certificate/key to OneSignal dashboard before testing

