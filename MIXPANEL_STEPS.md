# Mixpanel Setup - Step by Step

## Step 1: Install Package
```bash
cd /Users/farzan/Desktop/kiddo-app
npm install
```

## Step 2: Install iOS Pods
```bash
cd ios
pod install
cd ..
```

## Step 3: Get Your Mixpanel Token
1. Go to https://mixpanel.com
2. Sign in or create account
3. Create a new project (or use existing)
4. Go to **Project Settings**
5. Copy your **Project Token**

## Step 4: Add Token to mixpanel.js
1. Open `mixpanel.js` in your editor
2. Replace `'YOUR_PROJECT_TOKEN'` with your actual token
3. Save the file

Example:
```javascript
export const mixpanel = new Mixpanel('abc123def456ghi789');
```

## Step 5: Test It
1. Run your app: `npm start` or in Xcode
2. Open the app - "App Opened" event should fire automatically
3. Check Mixpanel dashboard → Live View to see events

## ✅ Done!
Mixpanel is now tracking. Use the helper functions from `utils/mixpanelHelpers.ts` anywhere in your app.

