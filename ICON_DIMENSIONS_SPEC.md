# iOS Icon Dimensions Specification

## Required Dimensions for Zero Padding Display

### Canvas Size
- **Total Size**: 1024 x 1024 pixels (exactly)

### Logo Placement (To Fill Entire Icon Space)

#### For Maximum Fill (Recommended):
- **Logo should fill**: 972 x 972 pixels (95% of canvas)
- **Margin from edges**: 26 pixels on all sides
- **Logo center**: 512 x 512 pixels (center of canvas)

#### For Edge-to-Edge Fill (Aggressive):
- **Logo should fill**: 1000 x 1000 pixels (97.6% of canvas)
- **Margin from edges**: 12 pixels on all sides
- **Logo center**: 512 x 512 pixels (center of canvas)

### iOS Safe Zone Reality
- iOS applies ~10-15px safe zone automatically
- To compensate, logo should fill **95-97%** of canvas
- This ensures logo appears to fill entire icon after iOS processing

### Current Issue
The `gpt.png` file has padding built into the image itself. The logo needs to be:
1. **Enlarged** to fill 972-1000px of the 1024px canvas
2. **Centered** at 512x512
3. **No transparent or background padding** around the logo

### Solution
Redesign the icon so:
- Logo fills **972x972 pixels minimum** (centered)
- Background color extends to all edges (no padding)
- Logo elements extend close to edges (within 26px margin)

### Visual Guide
```
┌─────────────────────────────────┐
│ 26px margin                      │
│  ┌───────────────────────────┐   │
│  │                           │   │
│  │   LOGO (972x972 min)      │   │
│  │   Centered at 512x512     │   │
│  │                           │   │
│  └───────────────────────────┘   │
│ 26px margin                      │
└─────────────────────────────────┘
    1024 x 1024 canvas
```

