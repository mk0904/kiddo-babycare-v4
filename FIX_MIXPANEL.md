# Fix Mixpanel Error

## Quick Fix Steps:

1. **Rebuild native code:**
```bash
npx expo prebuild --clean
```

2. **Install iOS pods:**
```bash
cd ios
pod install
cd ..
```

3. **Rebuild app in Xcode** (or run `npm start`)

The plugin is now added to `app.json` and mixpanel.js has error handling.

