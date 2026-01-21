# Android Icon Cropping Issue - COMPLETE FIX GUIDE

## 🔴 THE REAL PROBLEM

**Android Adaptive Icons have a SAFE ZONE** where only the center portion is guaranteed to be visible. The outer edges can be cropped/masked by different launcher shapes (circle, square, rounded square, etc.).

## ✅ CRITICAL REQUIREMENTS

### 1. **Safe Zone Design (MOST IMPORTANT)**
For a **1024x1024 pixel** foreground image:
- **Safe Zone**: Center **432x432 pixels** (42% of the image)
- **Keep important logo content within this 432x432 center area**
- The outer 34% on all sides can be cropped!

```
┌─────────────────────────────────────────┐
│                                         │
│  ╔═══════════════════════════════╗     │ ← Can be cropped
│  ║                               ║     │
│  ║   ┌─────────────────────┐    ║     │
│  ║   │                     │    ║     │
│  ║   │   SAFE ZONE         │    ║     │ ← Keep logo HERE
│  ║   │   432 x 432 px      │    ║     │
│  ║   │   (42% of image)    │    ║     │
│  ║   │                     │    ║     │
│  ║   └─────────────────────┘    ║     │
│  ║                               ║     │
│  ╚═══════════════════════════════╝     │
│                                         │ ← Can be cropped
└─────────────────────────────────────────┘
        1024 x 1024 pixels
```

### 2. **File Sizes**
All icons must be exactly:
- `icon.png`: **1024x1024** ✅ (currently correct)
- `android-icon-foreground.png`: **1024x1024** ✅ (currently correct)
- `android-icon-background.png`: **1024x1024** ❌ (currently 512x512 - WRONG!)
- `android-icon-monochrome.png`: **1024x1024** ✅ (currently correct)

### 3. **Design Guidelines**

#### For `android-icon-foreground.png`:
1. **Canvas Size**: 1024x1024 pixels
2. **Safe Zone**: Draw your logo within the center 432x432 pixels
3. **Padding**: Leave at least 296 pixels (29%) padding on all sides
4. **Format**: PNG with transparent background
5. **Content**: Only the logo/icon - NO background colors

#### For `android-icon-background.png`:
1. **Canvas Size**: 1024x1024 pixels
2. **Format**: PNG (can be solid color or pattern)
3. **Background Color**: #E6F4FE (light blue) as specified in app.json
4. **Note**: This appears behind the foreground icon

#### For `icon.png` (iOS & Splash):
1. **Canvas Size**: 1024x1024 pixels
2. **Padding**: Leave 10-15% padding around edges
3. **Format**: PNG with transparent background
4. **Content**: Full logo (can use more of the canvas since iOS doesn't mask)

## 🎨 WHAT TO TELL YOUR DESIGNER

**Copy this exact text for your designer:**

---

**REQUIREMENT: Android App Icon with Safe Zone**

I need an Android adaptive icon that won't be cropped. Please follow these EXACT specifications:

1. **Foreground Icon** (`android-icon-foreground.png`):
   - Canvas: 1024x1024 pixels, PNG with transparent background
   - **IMPORTANT**: Place the logo/icon within the CENTER 432x432 pixel area
   - The logo should be small enough to fit in this center zone with padding
   - Leave at least 296 pixels of transparent space on all sides
   - Only include the logo/icon, no background

2. **Background** (`android-icon-background.png`):
   - Canvas: 1024x1024 pixels, PNG
   - Solid color: #E6F4FE (light blue)
   - No logo or content needed, just the background color

3. **Main Icon** (`icon.png`):
   - Canvas: 1024x1024 pixels, PNG with transparent background
   - Can use more of the canvas (up to edges with 10% padding)
   - Used for iOS and splash screen

**The issue**: Android launchers can mask/crop the outer edges of icons into different shapes (circle, rounded square, etc.). Only the center 42% is guaranteed visible, so the logo MUST be within that safe zone.

**Visual Reference**: 
- Draw a 432x432 pixel box in the center of a 1024x1024 canvas
- Place your logo inside this box
- That's the safe zone where your logo won't be cropped

---

## 🔧 CURRENT STATUS

✅ `icon.png`: 1024x1024 (correct)
✅ `android-icon-foreground.png`: 1024x1024 (correct size, but may have logo in wrong position)
❌ `android-icon-background.png`: 512x512 (WRONG - needs to be 1024x1024)
✅ `android-icon-monochrome.png`: 1024x1024 (correct)

## ⚠️ WHY YOUR LOGO IS CROPPED

Even though your foreground image is 1024x1024, if the logo extends beyond the center 432x432 safe zone, it WILL be cropped on many Android devices. Different launchers (OnePlus, Samsung, Pixel, etc.) mask icons differently - some as circles, some as rounded squares, etc.

The solution is to **redesign the logo to fit within the safe zone**, not just resize it.

## 📝 NEXT STEPS

1. **Fix background size**: Update `android-icon-background.png` to 1024x1024
2. **Redesign foreground**: Move logo content to center 432x432 safe zone
3. **Rebuild APK**: After fixing, rebuild the app to see changes
4. **Test on devices**: Test on different Android devices/launchers to verify

## 🔍 HOW TO VERIFY

After receiving the new icons:
1. Check file sizes: All should be 1024x1024
2. Open `android-icon-foreground.png` in an image editor
3. Draw a guide: 432x432 pixel box in the center
4. Verify: Is your logo entirely within this box? If yes, it won't be cropped!

