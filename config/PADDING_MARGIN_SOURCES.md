# Where padding/margin are defined for home & tab sections

## 1. Config: `config/kiddoAppConfig.json`

All section padding/margin that are **config-driven** come from here.

### Global defaults (when a block doesn’t set its own)

- **`productGridDefaults`** (around line 74)  
  - `paddingHorizontal`, `gap`, `rowGap`, `colGap`  
  - Used for product grids (e.g. infinity, search) when not overridden per block.

### Per-screen block arrays (each block can have `styles.container`, `styles.title`, etc.)

| Section | Config key | Approx. line | What you can set |
|--------|------------|---------------|-------------------|
| **Home – All** | `"all"` | ~322 | `styles.container`: `paddingHorizontal`, `paddingVertical`, `paddingTop`, `paddingBottom`, `marginTop`, etc. `styles.title`: `marginBottom`, `marginTop`, `paddingHorizontal`. |
| **Home – Girls** | `"girls"` | ~1049 | Same as above, per block. |
| **Home – Boys** | `"boys"` | ~1232 | Same as above, per block. |
| **Home – Toys** | `"toys"` | ~1448 | Same as above, per block. |
| **Home – Baby Care** | `"babycare"` | ~1970 | Same as above, per block. |
| **Home – Baby Gear** | `"babygear"` | ~2394 | Same as above, per block. |
| **Category tab** | `"categoryScreen"` → `blocks` | ~80 (inside `categoryScreen.blocks[]`) | Same pattern: each block has `styles.container`, `styles.title`, etc. |
| **Ticketing tab** | `"ticketingScreen"` → `blocks` | ~1730 (inside `ticketingScreen.blocks[]`) | Same pattern. |

### Structure of a block in config

```json
{
  "id": "some-block-id",
  "type": "categoryGrid",
  "title": "Section Title",
  "styles": {
    "container": {
      "paddingHorizontal": 16,
      "paddingVertical": 16,
      "paddingTop": 20,
      "paddingBottom": 20,
      "marginTop": 0,
      "marginBottom": 0,
      "backgroundColor": "#fff"
    },
    "title": {
      "marginBottom": 15,
      "marginTop": 20,
      "paddingHorizontal": 16,
      "fontSize": 18
    },
    "text": { }
  }
}
```

So for **“these sections”** (home + category + ticketing), padding/margin are defined in **`kiddoAppConfig.json`**: either in **`productGridDefaults`** or in each block’s **`styles.container`** / **`styles.title`** under the keys listed above.

---

## 2. Components that read padding/margin (from config)

They take values from **`block.styles.container`** and **`block.styles.title`** (and sometimes `productGridDefaults`). Fallbacks are in code when a value is missing.

| File | What it uses from config | Fallback in code (if missing in config) |
|------|---------------------------|----------------------------------------|
| **BlockRenderer.tsx** | (none; spacing is hardcoded) | `marginBottom: 4` between every two blocks |
| **BaseContentBlock.tsx** | `block.styles.container` (spread onto wrapper) | — |
| **CategoryGrid.tsx** | `block.styles.container`, `block.styles.title` | `paddingHorizontal`: 16, title `marginBottom`: 15 |
| **ImageGrid.tsx** | `block.styles.container`, `block.styles.title` | `paddingHorizontal`: 20, title `marginBottom`: 15 |
| **ImageList.tsx** | `block.styles.container` | `paddingHorizontal`: 20 |
| **VisualCategoryRail.tsx** | `block.styles.container`, `block.styles.title` | `paddingHorizontal`: 20, title `marginBottom`: 15 |
| **HorizontalProductList.tsx** | `block.styles.container` (as `customStyles`), config `sidePadding` | `sidePadding`: 20, `paddingVertical`: 10, `marginBottom`: 15 |
| **InfiniteProductGrid.tsx** | `block.styles.container`, `productGridConfig.paddingHorizontal` | `effectivePadding`: 16, title `marginBottom`: 15, `paddingHorizontal`: 20 |
| **CollectionList.tsx** | `block.styles.container` | `paddingHorizontal`: 16, title `marginBottom`: 16 |
| **FlexibleGrid.tsx** | Receives `padding` from parent (e.g. CategoryGrid) | `padding`: 16 (when not passed) |

So **definitions** are in **config**; **usage** (and fallbacks) are in these components.

---

## 3. Quick reference: change padding/margin for a section

1. Open **`config/kiddoAppConfig.json`**.
2. Find the section:
   - **Home (All / Girls / Boys / Babycare / Toys / Babygear):** key `"all"`, `"girls"`, `"boys"`, `"babycare"`, `"toys"`, or `"babygear"` (each is an array of blocks).
   - **Category tab:** `"categoryScreen"` → `"blocks"`.
   - **Ticketing tab:** `"ticketingScreen"` → `"blocks"`.
3. In the right block, set or edit **`styles.container`** and/or **`styles.title`** (e.g. `paddingTop`, `paddingHorizontal`, `marginBottom`, `marginTop`).

That is the single place where padding/margin for those sections are defined; components read from there (with the fallbacks listed above when a value is omitted).
