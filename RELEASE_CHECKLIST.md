# Android Release Checklist - Final Items

**Status:** ✅ Keystore configured | ⚠️ Review remaining items below

---

## ✅ Already Completed

1. ✅ **Production Keystore** - Configured and secured
2. ✅ **OneSignal** - Configured with POST_NOTIFICATIONS permission
3. ✅ **Firebase** - google-services.json configured
4. ✅ **Package Name** - Consistent across all configs
5. ✅ **Permissions** - All required permissions declared
6. ✅ **Build Config** - Hermes, New Architecture enabled

---

## 📋 Remaining Items for Release

### 1. ⚠️ **Version Management** (IMPORTANT)

**Current:**
- `versionCode`: `1` (in `android/app/build.gradle:102`)
- `versionName`: `"1.7.0"` (in `android/app/build.gradle:103` and `app.json:5`)

**Status:** ✅ OK for first release, but note:
- `versionCode` must increment for each Play Store update (1, 2, 3, ...)
- `versionName` can be any string (1.7.0, 1.7.1, 2.0.0, etc.)

**Action:** No change needed for first release, but remember to increment `versionCode` for future updates.

---

### 2. ⚠️ **Build Optimizations** (OPTIONAL but Recommended)

**Current Status:**
- Code minification: **Disabled** (defaults to `false`)
- Resource shrinking: **Disabled** (defaults to `false`)
- PNG crunching: **Enabled** ✅

**Recommendation:** Enable optimizations to reduce APK size:

Add to `android/gradle.properties`:
```properties
# Enable code minification for release builds
android.enableMinifyInReleaseBuilds=true

# Enable resource shrinking for release builds
android.enableShrinkResourcesInReleaseBuilds=true
```

**Impact:**
- Reduces APK size by 20-40%
- Slightly longer build time
- Better performance

**Action:** Optional - can enable now or after first release.

---

### 3. ⚠️ **Play Store Listing Requirements** (REQUIRED before upload)

Before uploading to Google Play Console, you need:

#### a. **App Information**
- [ ] App name: "Kiddo" ✅ (from app.json)
- [ ] Short description (80 characters max)
- [ ] Full description (4000 characters max)
- [ ] App icon (512x512 PNG) - You have this ✅
- [ ] Feature graphic (1024x500 PNG)
- [ ] Screenshots (at least 2, up to 8)
  - Phone: 16:9 or 9:16 aspect ratio
  - Tablet (if supported): 16:9 or 9:16

#### b. **Privacy & Security**
- [ ] Privacy Policy URL ✅ (Found: `https://kiddo-quick-baby-joy-m4bpo.myshopify.com/pages/privacy-policy`)
- [ ] Terms of Service URL ✅ (Found: `https://kiddo-quick-baby-joy-m4bpo.myshopify.com/pages/terms-and-conditions`)
- [ ] Data safety section (required for all apps)
- [ ] Content rating questionnaire

#### c. **App Content**
- [ ] Age rating
- [ ] Target audience
- [ ] Category selection
- [ ] Contact information (email, phone, website)

#### d. **Pricing & Distribution**
- [ ] Pricing (Free/Paid)
- [ ] Countries/regions for distribution
- [ ] Content guidelines compliance

---

### 4. ⚠️ **Testing Requirements** (CRITICAL)

Before release, test on:

- [ ] **Physical Android device** (not emulator) - Required for push notifications
- [ ] **Different Android versions** (if possible):
  - Android 13+ (for POST_NOTIFICATIONS)
  - Android 11-12
  - Android 8-10
- [ ] **Different screen sizes** (if possible)
- [ ] **All critical features:**
  - [ ] App launches successfully
  - [ ] OneSignal push notifications work
  - [ ] Firebase integration works
  - [ ] Location permissions work
  - [ ] Payment flows (if applicable)
  - [ ] Login/signup flows
  - [ ] Core app functionality

---

### 5. ⚠️ **Security Review**

- [ ] ✅ Keystore files added to `.gitignore` (DONE)
- [ ] ✅ Passwords not hardcoded in build.gradle (DONE - using keystore.properties)
- [ ] Review API keys in code (Google Maps, etc.) - Consider using environment variables
- [ ] Ensure no debug logging in production builds
- [ ] Review ProGuard rules for proper obfuscation

---

### 6. ⚠️ **App Icons & Assets** (VERIFY)

**Current Configuration:**
- Main icon: `assets/images/icon.png` ✅
- Android foreground: `assets/images/gpt1.png` ✅
- Android background: `assets/images/android-icon-background.png` ✅
- Monochrome: `assets/images/gpt1.png` ✅

**Action:** Verify all icon files exist and are correct sizes (1024x1024 for main icons).

---

### 7. ⚠️ **Build & Verify Release**

**Steps to build release:**

1. **Build release APK (for testing):**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
   Output: `android/app/build/outputs/apk/release/app-release.apk`

2. **Verify APK signing:**
   ```bash
   jarsigner -verify -verbose -certs android/app/build/outputs/apk/release/app-release.apk
   ```
   Should show: "jar verified."

3. **Test the APK:**
   ```bash
   adb install android/app/build/outputs/apk/release/app-release.apk
   ```
   Test on physical device.

4. **Build AAB for Play Store:**
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
   Output: `android/app/build/outputs/bundle/release/app-release.aab`

5. **Verify AAB:**
   ```bash
   bundletool validate --bundle=android/app/build/outputs/bundle/release/app-release.aab
   ```

---

### 8. ⚠️ **Pre-Upload Checklist**

Before uploading to Play Console:

- [ ] Release APK/AAB built successfully
- [ ] Tested on physical device
- [ ] All features working
- [ ] Push notifications tested
- [ ] Version code and name correct
- [ ] Privacy policy URL accessible
- [ ] Terms of service URL accessible
- [ ] App icons and screenshots ready
- [ ] App description written
- [ ] Support email configured

---

## 🚀 Quick Start Commands

### Build Release APK:
```bash
cd android && ./gradlew assembleRelease
```

### Build Release AAB (for Play Store):
```bash
cd android && ./gradlew bundleRelease
```

### Clean build (if issues):
```bash
cd android && ./gradlew clean && ./gradlew assembleRelease
```

---

## 📊 Summary

**Ready for Release:** ⚠️ **Almost** - Complete testing and Play Store listing prep

**Critical Items:**
1. ✅ Keystore configured
2. ⚠️ Test on physical device
3. ⚠️ Prepare Play Store listing materials

**Optional Items:**
- Enable build optimizations (minification, shrinking)
- Review security settings

**Next Steps:**
1. Test release build on physical device
2. Prepare Play Store listing (screenshots, descriptions)
3. Build and upload AAB to Play Console

---

## 📝 Notes

- **Version Code:** Must increment for each update (1 → 2 → 3...)
- **Version Name:** Can be any format (1.7.0, 1.7.1, 2.0.0...)
- **Keystore:** Keep backup of `release.keystore` and `keystore.properties` - you'll need them for all future updates!
- **Privacy Policy:** Already configured in app ✅
- **Terms of Service:** Already configured in app ✅

---

**Last Updated:** After keystore configuration
**Status:** Ready for testing and Play Store preparation

