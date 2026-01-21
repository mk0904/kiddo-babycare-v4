# Android Icon Cropping - The Safe Zone Problem

## Why Your Logo Gets Cropped

Android Adaptive Icons can be displayed in different shapes by different launchers:
- **Circles** (Pixel launcher)
- **Rounded squares** (Samsung)
- **Squircles** (OnePlus)
- **Squares** (Some launchers)

Each shape **masks/crops** the outer edges of your icon. Only the **center safe zone** is guaranteed visible across all devices.

## The Safe Zone

For a **1024x1024 pixel** foreground image:

```
Total Canvas: 1024 x 1024 pixels
Safe Zone:     432 x 432 pixels (center)
Padding:       296 pixels on all sides (29%)
```

**Visual Layout:**
```
┌─────────────────────────────────────────────────┐
│                                                 │
│  ╔═══════════════════════════════════════╗     │ ← Cropped area
│  ║                                       ║     │   (296px top)
│  ║   ╔═══════════════════════════╗      ║     │
│  ║   ║                           ║      ║     │
│  ║   ║                           ║      ║     │
│  ║   ║    SAFE ZONE              ║      ║     │ ← Your logo
│  ║   ║    432 x 432 px           ║      ║     │   MUST be here!
│  ║   ║    (Center)               ║      ║     │
│  ║   ║                           ║      ║     │
│  ║   ╚═══════════════════════════╝      ║     │
│  ║                                       ║     │
│  ╚═══════════════════════════════════════╝     │
│                                                 │ ← Cropped area
└─────────────────────────────────────────────────┘    (296px bottom)
```

## Current Issues

1. ❌ **Background image wrong size**: `android-icon-background.png` is 512x512, should be 1024x1024
2. ⚠️ **Logo position**: Your logo likely extends beyond the 432x432 safe zone in `android-icon-foreground.png`

## The Fix

### Step 1: Update Background Image
- Resize `android-icon-background.png` from 512x512 to **1024x1024**
- Solid color #E6F4FE (or your preferred background)

### Step 2: Redesign Foreground Icon
1. Open your logo in a 1024x1024 canvas
2. Draw a guide box: **432x432 pixels** centered
3. **Scale down your logo** to fit entirely within this box
4. Ensure at least 296px transparent padding on all sides
5. Export as PNG with transparency

### Step 3: Test Your Design
Before sending to developer:
1. Open `android-icon-foreground.png` in image editor
2. Add a centered 432x432 pixel guide/overlay
3. If logo touches or goes outside this box → **IT WILL BE CROPPED**
4. If logo is entirely inside this box → **It will display correctly**

## Quick Designer Instructions

**"Please redesign the Android foreground icon with the logo scaled down to fit within the center 432x432 pixels of a 1024x1024 canvas. The outer 296 pixels on all sides should be transparent padding. This ensures the logo won't be cropped on different Android devices."**

## After Fixing

1. Replace the icon files
2. Clean build: `cd android && ./gradlew clean`
3. Rebuild APK: `./gradlew assembleRelease`
4. Test on multiple Android devices/launchers

