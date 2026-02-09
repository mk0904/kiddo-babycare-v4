# Quick OneSignal Pre-Flight Check

## Run These Commands Before TestFlight

### 1. Quick Check (30 seconds)
```bash
./check-onesignal.sh
```

This will verify:
- ✅ Node modules installed
- ✅ Pods installed  
- ✅ Xcode project configured
- ✅ Entitlements correct
- ✅ Info.plist configured

### 2. Full Build Test (2-5 minutes)
```bash
./test-onesignal-build.sh
```

This will:
- Clean previous builds
- Reinstall pods
- Verify frameworks exist
- Attempt a Release build
- Check for linking errors

### 3. Manual Xcode Check

If scripts pass but still having issues:

1. **Open Xcode:**
   ```bash
   open ios/Kiddo.xcodeproj
   ```

2. **Check Build Phases:**
   - Select **Kiddo** target
   - Go to **Build Phases** tab
   - Expand **Link Binary With Libraries**
   - Verify you see:
     - `OneSignalFramework.framework`
     - `OneSignalCore.framework`
     - `OneSignalNotifications.framework`
     - Other OneSignal frameworks

3. **Check Framework Search Paths:**
   - Go to **Build Settings** tab
   - Search for "Framework Search Paths"
   - Should include: `$(inherited)` and OneSignal paths

4. **Clean and Build:**
   - **Product** → **Clean Build Folder** (Shift+Cmd+K)
   - **Product** → **Build** (Cmd+B)
   - Check for any red errors

### 4. Common Issues & Fixes

**Issue: "OneSignal Available: ❌ No"**

**Fix 1: Reinstall Pods**
```bash
cd ios
rm -rf Pods Podfile.lock
pod install
cd ..
```

**Fix 2: Clean Xcode Build**
- Xcode → Product → Clean Build Folder
- Delete DerivedData: `rm -rf ~/Library/Developer/Xcode/DerivedData/Kiddo-*`

**Fix 3: Verify Frameworks are Linked**
- Xcode → Build Phases → Link Binary With Libraries
- If OneSignal frameworks missing, add them manually

**Fix 4: Check Build Configuration**
- Xcode → Product → Scheme → Edit Scheme
- Archive → Build Configuration = **Release**

### 5. After Fixing

1. Run check script again: `./check-onesignal.sh`
2. Build in Xcode: **Product** → **Build**
3. If build succeeds, archive for TestFlight
4. The debug alert in TestFlight will show if it's working

## Expected Results

✅ **All checks pass** → Should work in TestFlight  
❌ **Any check fails** → Fix it before uploading to TestFlight

The debug alert in TestFlight will confirm if OneSignal is actually working.

