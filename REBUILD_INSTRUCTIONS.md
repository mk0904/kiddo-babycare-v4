# Steps to Apply New Logos

## 1. Fix Remaining Issue
⚠️ **`android-icon-background.png`** is still 512x512 - needs to be 1024x1024

## 2. Clear Caches and Rebuild

### For Development (Expo):
```bash
# Clear Expo cache
npx expo start --clear

# Or if using npm/yarn
npm start -- --clear
# or
yarn start --clear
```

### For Production Builds:

#### iOS:
```bash
# Clear iOS build cache
cd ios
rm -rf build
rm -rf Pods
pod deintegrate
pod install
cd ..

# Rebuild
npx expo prebuild --clean
# Then build in Xcode or:
npx expo run:ios
```

#### Android:
```bash
# Clear Android build cache
cd android
./gradlew clean
rm -rf app/build
cd ..

# Rebuild
npx expo prebuild --clean
# Then build:
npx expo run:android
```

### Quick Full Clean (Recommended):
```bash
# Clear all caches
rm -rf node_modules/.cache
rm -rf .expo
rm -rf ios/build
rm -rf android/app/build
rm -rf android/build

# For iOS
cd ios && rm -rf Pods && pod install && cd ..

# For Android
cd android && ./gradlew clean && cd ..

# Start fresh
npx expo start --clear
```

## 3. Verify Icons After Rebuild

After rebuilding, check:
- ✅ App icon appears correctly on home screen
- ✅ Splash screen shows correct logo
- ✅ Android adaptive icon displays properly
- ✅ No blurry or pixelated icons

## Note
Icons are cached by the OS and build system, so a full clean rebuild is necessary to see the changes.

