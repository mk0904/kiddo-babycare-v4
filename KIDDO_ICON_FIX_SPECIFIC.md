# Kiddo Icon Fix - Specific Instructions

## Current Problem
Your "Kiddo" text extends too close to the left and right edges, causing the "K" and "o" to be cropped on Android devices.

## Solution: Scale Down and Center

### For `android-icon-foreground.png` (1024x1024):

1. **Canvas Size**: 1024 x 1024 pixels

2. **Safe Zone Box**:
   - Draw a centered box: 432 x 432 pixels
   - Position: 296 pixels from all edges (top, bottom, left, right)
   - This is where your logo MUST fit

3. **Text Positioning**:
   - **Scale down** the "Kiddo" text so it fits entirely within the 432x432 safe zone
   - The text should have padding on all sides (at least 40-50 pixels inside the safe zone)
   - **Maximum text width**: Approximately 350 pixels (leaving 40px padding on each side)
   - **Center the text** both horizontally and vertically within the safe zone

4. **Background Bands** (beige, blue, yellow):
   - These can extend to the edges of the 1024x1024 canvas (that's fine for background)
   - The foreground layer will overlay on top

5. **Final Check**:
   - Place a guide box: 432x432 pixels, centered
   - The "K" should be at least 296px from the left edge
   - The "o" should be at least 296px from the right edge
   - The heart above the 'i' should be at least 296px from the top edge
   - All text should be well within the guide box

## Visual Guide

```
Canvas: 1024x1024 pixels

┌─────────────────────────────────────────┐
│                                         │
│  296px ╔═══════════════════════════╗   │
│        ║                           ║   │
│        ║                           ║   │
│        ║     ┌─────────────┐      ║   │
│        ║     │             │      ║   │
│        ║     │   Kiddo ♥   │      ║   │ ← Text here
│        ║     │  (scaled)   │      ║   │
│        ║     │             │      ║   │
│        ║     └─────────────┘      ║   │
│        ║                           ║   │
│        ║  432px x 432px Safe Zone  ║   │
│        ║                           ║   │
│        ╚═══════════════════════════╝   │
│  296px                                  │
│                                         │
└─────────────────────────────────────────┘
         ↑                      ↑
      296px                  296px
```

## Exact Measurements for Your Logo

### Recommended Text Size:
- **Width**: Maximum 350 pixels (centered within 432px safe zone)
- **Height**: Proportional to width, maintaining aspect ratio
- **Horizontal Position**: Centered (512px from left edge)
- **Vertical Position**: Centered (512px from top edge)

### Padding Required:
- **Left edge to "K"**: At least 296px + 40px = 336px minimum
- **Right edge to "o"**: At least 296px + 40px = 336px minimum  
- **Top edge to heart**: At least 296px + 40px = 336px minimum

## What Your Designer Should Do

1. Open your current 1024x1024 `android-icon-foreground.png`
2. Add a guide layer: 432x432 pixel box, centered (296px from all edges)
3. Scale down the "Kiddo" text so:
   - The "K" is at least 40px inside the left edge of the safe zone box
   - The "o" is at least 40px inside the right edge of the safe zone box
   - The heart is at least 40px inside the top edge of the safe zone box
4. Keep the background bands (beige, blue, yellow) as they are - they can extend to edges
5. Export as PNG with transparent background
6. Verify: All text is entirely within the 432x432 guide box

## Quick Fix Option

If you want a quick fix without redesigning:
- **Scale down the entire logo by 40-50%** 
- **Center it in the 1024x1024 canvas**
- This will ensure it fits in the safe zone, but may make the text smaller

The better solution is to **redesign with proper safe zone positioning** as described above.

