# Logo/Icon Size Requirements for Kiddo App

## Required Icon Files and Sizes

### 1. Main App Icon (iOS & Splash Screen)
**File:** `assets/images/icon.png`
- **Size:** 1024 x 1024 pixels
- **Format:** PNG with transparency
- **Usage:** iOS app icon and splash screen
- **Important:** Keep important content in the center, as edges may be cropped

### 2. Android Adaptive Icon - Foreground
**File:** `assets/images/android-icon-foreground.png`
- **Size:** 1024 x 1024 pixels
- **Format:** PNG with transparency
- **Safe Area:** Keep important content within 432 x 432 pixels in the center
- **Usage:** The main logo/icon that appears on Android home screen

### 3. Android Adaptive Icon - Background
**File:** `assets/images/android-icon-background.png`
- **Size:** 1024 x 1024 pixels
- **Format:** PNG (can be solid color or pattern)
- **Background Color:** #E6F4FE (light blue) as specified in app.json
- **Usage:** Background layer for Android adaptive icon

### 4. Android Adaptive Icon - Monochrome
**File:** `assets/images/android-icon-monochrome.png`
- **Size:** 1024 x 1024 pixels
- **Format:** PNG with transparency
- **Usage:** Monochrome version for Android theming
- **Note:** This one is already correct at 1024x1024!

### 5. Web Favicon
**File:** `assets/images/favicon.png`
- **Size:** 48 x 48 pixels (or 32 x 32)
- **Format:** PNG or ICO
- **Usage:** Browser tab icon

## Design Guidelines

1. **Square Format:** All icons must be square (1:1 aspect ratio)
2. **Transparent Background:** Use PNG with alpha channel for foreground icons
3. **Padding:** Leave 10-15% padding around edges to prevent cropping
4. **High Resolution:** Use 1024x1024 for all main icons to ensure crisp display on all devices
5. **Safe Zone:** For Android foreground, keep critical elements within the center 432x432 area

## What to Provide to Your Designer

Ask your designer to create:
- **icon.png**: 1024x1024px PNG with transparent background
- **android-icon-foreground.png**: 1024x1024px PNG with transparent background (logo centered, safe zone: 432x432)
- **android-icon-background.png**: 1024x1024px PNG with solid color #E6F4FE
- **android-icon-monochrome.png**: 1024x1024px PNG with transparent background (black/white version)
- **favicon.png**: 48x48px or 32x32px PNG

## Current Issues

Your current files have incorrect sizes:
- ❌ icon.png: 1330x1330 (needs to be 1024x1024)
- ❌ android-icon-foreground.png: 1432x1432 (needs to be 1024x1024)
- ❌ android-icon-background.png: 512x512 (needs to be 1024x1024)
- ✅ android-icon-monochrome.png: 1024x1024 (correct!)

These incorrect sizes can cause:
- Blurry or pixelated icons
- Icons not displaying correctly
- Icons being cropped incorrectly
- Build errors or warnings

