# Web App Design Details — Recreate Precisely

This document captures **design tokens, component styles, and layout rules** from the Kiddo mobile app so the web app can recreate the same look and feel. Use it together with `WEB_APP_ARCHITECTURE.md`.

---

## 1. Design tokens (theme)

### 1.1 Colors

Use these as CSS variables or theme object:

| Token | Value | Usage |
|-------|--------|--------|
| **Primary** | `#fc5d5b` | Primary buttons, active states, accents, Try & Buy tag |
| **Primary light** | `#fd7a78` | Hover / secondary primary |
| **Background white** | `#FFFFFF` | Cards, tab bar, headers, search bar |
| **Background secondary** | `#fff5f4` | Product card image placeholder |
| **Grey (light bg)** | `#fefcf9` | Subtle backgrounds |
| **Text primary** | `#363636` | Body text, headings (config often uses this) |
| **Text secondary** | `#9197a6` | Muted text, tab icon default |
| **Disabled** | `#9197a6` | Disabled buttons/text |
| **Border** | `#d0d4dc` | Dividers, tab bar top border |
| **Success** | `#28A745` | Success states |
| **Tab icon selected** | `#fc5d5b` (or from config) | Active tab |
| **Tab icon default** | `#687076` (or from config) | Inactive tab |
| **Price / discount accent** | `#2c6975` | Main price, discount %, essentials “Our Price” |
| **Compare price / strike** | `#666666` or `#888888` | Compare-at price, market price |
| **Black** | `#000000` | Vendor badge, strong text |
| **Category label** | `#222222` | Category nav label and bottom border |
| **Search placeholder** | `#666666` | Search bar text |
| **Header border** | `#E5E5E5` | Home header bottom border when sticky |
| **Screen header border** | `#F0F0F0` | Category/account screen header bottom |
| **Section gap** | `#f5f5f5` | Product detail section gaps |
| **Wishlist heart active** | `#ff4444` | Filled heart |

### 1.2 Typography — font families

**Primary font stack (Metropolis):**

- **Regular:** `Metropolis-Regular` (400)
- **Medium:** `Metropolis-Medium` (500)
- **SemiBold:** `Metropolis-SemiBold` (600)
- **Bold:** `Metropolis-Bold` (700)
- **ExtraBold:** `Metropolis-ExtraBold` (800)
- **Black:** `Metropolis-Black` (900)

**Config aliases (for `fontFamily` in config):** Map these to the above:

- `regular` → Metropolis-Regular  
- `medium` → Metropolis-Medium  
- `semibold`, `semi-bold` → Metropolis-SemiBold  
- `bold` → Metropolis-Bold  
- `extrabold`, `extra-bold` → Metropolis-ExtraBold  
- `black` → Metropolis-Black  

**Web fallback (if Metropolis not loaded):**

```css
font-family: "Metropolis-Regular", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
```

Use the same mapping for **fontWeight** in config: `"400"` → Regular, `"500"` → Medium, `"600"` → SemiBold, `"700"` → Bold, `"900"` → Black.

---

## 2. Spacing and layout constants

### 2.1 Global padding

- **Screen horizontal padding:** `20px` (home header, category nav, many blocks). Config often overrides with `paddingHorizontal: 16` or `20`.
- **Block spacing:** `4px` margin between blocks (BlockRenderer).
- **Product grid (default from config):** `gap: 16`, `rowGap: 16`, `colGap: 16`, `paddingHorizontal: 16`. Use these when config does not override.

### 2.2 Border radius

- **Cards (product, grid items):** `12px`
- **Search bar:** `25px`
- **Buttons (primary/secondary):** `25px` (pill)
- **Tab bar container:** `20px` top-left and top-right
- **Vendor badge:** `4px`
- **Try & Buy tag:** `6px`
- **Wishlist button (circle):** `20px`
- **Category grid images (from config):** often `20px`
- **Small chips/badges:** `6px`

---

## 3. Component-by-component specs

### 3.1 Tab bar

- **Height:** Default `60px` (config: `tabBar.styles.height`).
- **Background:** `#FFFFFF` (or `tabBar.styles.backgroundColor`).
- **Top border:** `1px` solid `#d0d4dc` (or config `borderTopColor`).
- **Top corners:** `border-radius: 20px` (top-left, top-right).
- **Shadow:** Optional; if used: `shadowColor` (e.g. `#000` or config), `shadowOffset: { width: 0, height: -2 }`, `shadowOpacity: 0.15`, `shadowRadius: 6`.
- **Icon size:** Default `26px` (config: `tabBar.styles.iconSize`; config example uses 30).
- **Label:** `font-size: 10px`, font **Medium**. Color: active = `activeTintColor` (e.g. `#E84E4B` or `#fc5d5b`), inactive = `inactiveTintColor` (e.g. `#999999`).
- **Item layout:** Flex, equal width, `paddingVertical: 6px`, small gap (e.g. 2px) between icon and label.
- **Safe area:** Add bottom inset below the tab bar (same background as tab bar).

### 3.2 Home header

- **Background:** Transparent when using background image; else `backgroundColor` from config. Background image: `resizeMode: cover`, full width.
- **Top info row:**  
  - Padding: `paddingHorizontal: 20px`, `paddingTop: 8px`.  
  - Left: tagline “The best for your kiddo” — `fontSize: 15`, font **Black** (900), color from config `textColor` (e.g. `#FFFFFF`).  
  - Below: delivery estimate “in ⚡️ X mins” — `fontSize: 19`, font **Bold**, same text color.  
  - Right: wishlist icon (heart outline), size 24, same text color.  
- **Search bar:** Below top row, `paddingHorizontal: 20px`, `paddingTop: 10px`, `paddingBottom: 4px`.
- **Category nav:** Below search; see Category navigation bar.
- **Sticky behaviour:** On scroll, header can translate up and show a bottom border (`1px` solid `#E5E5E5`, opacity 0→1). Top info opacity can fade (1 → 0) as user scrolls.

### 3.3 Search bar

- **Container:** White background `#FFFFFF`, `border-radius: 25px`, `paddingHorizontal: 16px`, `paddingVertical: 12px`, flex row, align center.
- **Shadow:** `shadowColor: #000`, `shadowOffset: 0 2px`, `shadowOpacity: 0.1`, `shadowRadius: 4`.
- **Icon:** Search icon left, size 20, `marginRight: 10px`.
- **Placeholder text:** `fontSize: 15`, color `#666666`, font **Medium**, `letterSpacing: 0.2`. Single line, ellipsis.

### 3.4 Category navigation bar (home)

- **Container:** Full width, no vertical padding on wrapper; horizontal padding `20px` for the scroll content; `gap: 16` between category items.
- **Item:** Min width 60px, centered; icon above label.
- **Icon container:** 63×63px (or 44×44 for image), transparent background, no border. Image: 44×44 if using URL.
- **Label (unselected):** `fontSize: 11`, color `#222222`, `fontWeight: 400`, `marginTop: 1`, `marginBottom: 4`, `lineHeight: 14`, text-align center.
- **Label (selected):** `fontSize: 12`, `fontWeight: 600`, color `#222222`, `lineHeight: 14`.
- **Selected indicator:** Bottom border pill: `height: 3px`, `borderRadius: 18px` (top-left and top-right), background `#222222`, `marginTop: 4`, centered under item.

### 3.5 Screen header (Category, Account, etc.)

- **Container:** Flex row, space-between, align center; `paddingHorizontal: 20px`, `paddingVertical: 12px`; background `#FFFFFF`; `borderBottom: 1px solid #F0F0F0`.
- **Title:** `fontSize: 18`, `fontWeight: 600`, color `#363636`, font **Medium**, flex 1.
- **Back button (if shown):** Arrow icon size 24, color `#363636`, `padding: 4px`, `marginRight: 8px`.
- **Right actions:** Search (size 20), wishlist (size 24), color `#363636`, `gap: 8px`, `padding: 4px`.

### 3.6 Product card

- **Container:** `border-radius: 12px`, background `#fff`, `marginBottom: 8px`. Width from grid (e.g. 2 columns, padding and gap from `productGridDefaults`).
- **Image container:** Aspect ratio 1:1, `border-radius: 12px`, background `#fff5f4` (backgroundSecondary), overflow visible, position relative.
- **Image:** Full size, `border-radius: 12px`, `object-fit: cover`.
- **Text styles (defaults; overridden by config `productCard.styles`):**
  - **Product name:** `fontSize: 13`, font **SemiBold**, color `#363636`, `lineHeight: 18`, `marginBottom: 2`, max 2 lines, ellipsis.
  - **Vendor badge:** `fontSize: 10`, font **SemiBold**, color `#000000`.
  - **Main price:** `fontSize: 14`, font **Bold**, color `#000000` (config often uses `#2c6975`).
  - **Compare price:** `fontSize: 12`, font **Medium**, color `#666666`, line-through.
  - **Discount %:** `fontSize: 12`, font **SemiBold**, color `#2c6975`.
- **Content area:** `paddingHorizontal: 8px`, `paddingTop: 6px`, `paddingBottom: 8px`; price row at bottom.
- **Vendor badge (on image):** Position bottom-left (e.g. left 6px, bottom 6px); background `rgba(255,255,255,0.85)`, `paddingHorizontal: 6px`, `paddingVertical: 3px`, `borderRadius: 4px`.
- **Wishlist button (on image):** Top-right (e.g. top 8px, right 8px); background `rgba(255,255,255,0.9)`, `borderRadius: 20px`, `padding: 6px`; heart icon size 16, inactive `#363636`, active `#ff4444`.
- **Try & Buy tag:** Top-left on image; background primary `#fc5d5b`, `paddingHorizontal: 6px`, `height: 18px`, `borderRadius: 6px`, icon + “Try & Buy” text, `fontSize: 10`, font **SemiBold**, color white.
- **Add button:** Positioned bottom-right of image (e.g. bottom -6px, right -6px); use UniversalAdd / prominent CTA.

### 3.7 Buttons (primary / secondary)

- **Container:** `minHeight: 50px`, `borderRadius: 25`, `paddingVertical: 14px`, align center, justify center.
- **Primary:** Background `#fc5d5b`; text color `#FFFFFF`, `fontSize: 16`, font **SemiBold**.
- **Secondary:** Background transparent, `border: 1px solid #fc5d5b`; text color `#fc5d5b`, same font.
- **Disabled:** Background `#9197a6`, opacity 0.6.

### 3.8 Grid blocks (ImageGrid, CategoryGrid)

- **Section title:** Often `fontSize: 16` or `18`, `fontWeight: 600` or `700`, color `#363636`; `marginBottom` from config (e.g. 0 or 12).
- **Container padding:** From block `styles.container` (e.g. `paddingHorizontal: 16`, `paddingVertical: 16`).
- **Grid gaps:** From block `gridConfig`: `colGap`, `rowGap` (e.g. 12 or 16).
- **Image:** Often `width: 100%`, `borderRadius: 20`; container can have `backgroundColor: #FFFFFF`, `borderRadius: 20`, optional shadow.
- **Text below image:** Optional; when shown, `fontSize: 12`, color `#666666`, bold for subcategory names; can be hidden with `display: none` in config.

### 3.9 Account screen (from config)

- **Header (account.styles.header):** `paddingTop: 60`, `paddingBottom: 20`, `paddingHorizontal: 20`.
- **Quick actions (account.styles.quickActions):** `paddingHorizontal: 20`, `paddingVertical: 20`.
- **Menu container:** `marginTop: 10`, `paddingHorizontal: 20`.
- **Logout button:** `marginHorizontal: 20`, `marginTop: 20`, `paddingVertical: 16`, `borderRadius: 12`, `borderWidth: 1`.
- **Version:** `marginTop: 20`, `paddingBottom: 10`.

### 3.10 Product detail (from config productDetail.styles)

- **Title:** `fontSize: 20`, `fontWeight: 700`, color `#363636`, `paddingHorizontal: 16`, `paddingTop: 10`, `lineHeight: 28`.
- **Vendor:** `fontSize: 14`, `fontWeight: 500`, color `#666666`, `paddingHorizontal: 16`, `marginTop: 8`, `textTransform: uppercase`.
- **Description / material / washCare:** `fontSize: 14`, `fontWeight: 400`, color `#333333`, `lineHeight: 20`.
- **Accordion title:** `fontSize: 16`, `fontWeight: 600`, color `#363636`.
- **Variant label:** `fontSize: 16`, `fontWeight: 600`, color `#333333`.
- **Variant button:** `fontSize: 14`, `fontWeight: 500`, color `#363636`.
- **Section title (e.g. “You May Also Like”):** `fontSize: 20`, `fontWeight: 700`, color `#363636`.
- **Section gap:** `height: 8px`, `backgroundColor: #f5f5f5`, `marginTop: 20`.

---

## 4. Config-driven style resolution

- **Block styles:** Many blocks have `styles.container`, `styles.title`, `styles.text`, `styles.image`, etc. Apply numeric values (padding, margin, fontSize, borderRadius) directly. For typography, use a **processFontStyle** helper:
  - **fontFamily:** Resolve alias (e.g. `semibold`) to theme font; allow exact name (e.g. `Metropolis-Bold`).
  - **fontWeight:** If no fontFamily, map weight to font (400→Regular, 600→SemiBold, 700→Bold, etc.).
  - **fontStyle:** Pass through (normal, italic).
  - **color, fontSize, lineHeight, etc.:** Pass through.
- **Product card:** Merge `productCard.styles.productName` (and similar) with defaults; apply merged object to each text element so config can override font and color precisely.

---

## 5. Responsive and layout notes

- **Grid columns:** Home/category grids often 2–4 columns; use `numColumns` from block `gridConfig`. On web, use CSS Grid or flex with calculated widths; product grid card width = `(100% - 2 * paddingHorizontal - (numColumns - 1) * colGap) / numColumns`.
- **Safe areas:** Mobile uses top/bottom insets; on web you can use `env(safe-area-inset-*)` or fixed padding for header and tab bar.
- **Images:** Use `object-fit: cover` (or `contain` when config says) and respect `aspectRatio` from config where applicable.

---

## 6. Summary checklist for pixel-accurate web

- [ ] Theme: Colors and font stack (Metropolis + aliases) match.
- [ ] Tab bar: Height, radius, border, icon size, label 10px Medium, active/inactive colors from config.
- [ ] Home header: Tagline 15px Black, delivery 19px Bold, search bar 25px radius, 20px horizontal padding.
- [ ] Search bar: White, 25px radius, 15px placeholder #666, shadow.
- [ ] Category nav: 11px/12px labels, #222222, 3px pill indicator, 16px gap.
- [ ] Screen header: 18px SemiBold title, 20px padding, #F0F0F0 bottom border.
- [ ] Product card: 12px radius, config-driven productName/vendor/mainPrice/comparePrice/discount styles, wishlist/vendor/T&B/add positions.
- [ ] Buttons: 25px radius, 50px min height, primary #fc5d5b.
- [ ] Grid blocks: Container/title styles from config, 16–20px radius for images, colGap/rowGap from config.
- [ ] Account: Padding and margins from account.styles.
- [ ] Product detail: All productDetail.styles and section gap #f5f5f5.

Using this doc together with `WEB_APP_ARCHITECTURE.md` and the same `kiddoAppConfig.json` (or remote URL), the web app can replicate the mobile app’s architecture and design precisely.
