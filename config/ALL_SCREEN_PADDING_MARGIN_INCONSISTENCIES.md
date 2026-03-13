# All (Home) screen – padding/margin inconsistencies

Summary of inconsistencies in `kiddoAppConfig.json` for the **"all"** blocks.

---

## 1. Horizontal padding (container)

| Block / section | paddingHorizontal | Note |
|-----------------|-------------------|------|
| **home-rail-top** (rail) | **20** | Only block using 20; all others use 16 |
| **all-infinite-grid-1** (New Arrivals) | 20 (in productGridConfig) | Not in container; grid uses 20 |
| All categoryGrid blocks | 16 | Consistent |
| horizontalProductList (Featured Products) | 16 | Consistent |
| all-winter-wear-featured | **(missing)** | Only paddingVertical: 16; no horizontal |

**Inconsistency:** Rail uses **20**, infinite grid uses **20** in grid config; everything else uses **16**. One block has no horizontal padding.

---

## 2. Vertical padding (container)

| Block | paddingVertical | paddingTop / paddingBottom |
|-------|-----------------|----------------------------|
| **home-rail-top** | 16 | – |
| **category-grid-trending** | **16** | – |
| **frequently-bought-carousel** | **0** | – |
| **category-grid-school-stationery** | **0** | – |
| **category-grid-fashion** | **0** | – |
| **category-grid-toys** | **0** | – |
| **category-grid-toy-brands** | **0** | – |
| **category-grid-baby-care** | **16** | – |
| **category-grid-gear-furniture** | **16** | – |
| **all-product-list-1** (Featured Products) | 16 | – |
| **all-winter-wear-featured** | 16 | – |
| **all-infinite-grid-1** (New Arrivals) | – | paddingTop: **10**, paddingBottom: **20** |

**Inconsistency:** categoryGrid blocks mix **paddingVertical: 0** (Trending, Frequently Bought, Fashion, Toys, Toy Brands) and **paddingVertical: 16** (Baby Care, Gear). Infinite grid uses a different pattern (top 10, bottom 20).

---

## 3. Title spacing

| Block | title.marginTop | title.marginBottom |
|-------|-----------------|--------------------|
| **category-grid-trending** | 20 | 0 |
| Other categoryGrid blocks | (not set; component default) | 0 |
| **One horizontalProductList** (see config) | 20 | **10** |

**Inconsistency:** Most blocks use marginBottom: 0; one product list uses marginBottom: 10 and marginTop: 20.

---

## 4. Special / one-off values

- **all-banner-1** (carousel): container has only **marginTop: -61** (overlap), no padding.
- **Shop by Brand** (categoryScreen): container has **paddingBottom: 128** (extra bottom space).
- **all-infinite-grid-1**: **paddingTop: 10**, **paddingBottom: 20** (no paddingVertical).

---

## Recommended normalization (optional)

- **Horizontal:** Use **16** everywhere (or 20 everywhere). Change rail from 20 → 16, and ensure infinite grid and any list without horizontal padding use the same value (e.g. 16).
- **Vertical for categoryGrid:** Pick one: either **paddingVertical: 16** for all category grids, or **0** for all, then add spacing via **title.marginTop** / **marginBottom** if needed.
- **Title:** Use the same **marginBottom** (e.g. 0 or 12) and **marginTop** (e.g. 20) for all section titles.

I can apply these normalizations in `kiddoAppConfig.json` if you want.
