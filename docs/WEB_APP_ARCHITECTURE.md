# Web App Architecture — Kiddo Config-Driven Parity

This document describes how to build the **web version** of the Kiddo app so it uses the **same remote config** and **architecture** as the mobile app. Use it as the single source of truth when implementing or prompting for the web app.

---

## 1. Config source and loading

- **Single source of truth:** One remote JSON config file (e.g. `https://cdn.shopify.com/.../kiddoAppConfig.json`). The mobile app fetches this on load; the web app should do the same.
- **No hardcoded screens:** Layout, tabs, blocks, categories, and feature flags come from config. Code only defines *how* to render, not *what* to show.
- **Loading:** Fetch the config once at app bootstrap (with optional cache-bust query param). Expose a **ConfigService** that holds the parsed JSON and provides getters. Support optional force-reload for “pull latest” behaviour.

---

## 2. ConfigService API (mirror mobile)

The web app should implement a **ConfigService** with the same contract as the mobile app.

### 2.1 Core methods

| Method | Purpose |
|--------|--------|
| `loadConfig(remoteUrl?, forceReload?)` | Fetch config from URL; return normalized `AppConfig`. Dedupe in-flight requests; support force reload. |
| `getConfig()` | Return normalized `AppConfig` (home, header, categories). |
| `getRawConfig()` | Return the full raw JSON. Use for any key not part of `AppConfig`. |
| `subscribe(listener)` | Subscribe to config updates; return unsubscribe function. |

### 2.2 Screen and block methods

| Method | Purpose |
|--------|--------|
| `getScreenBlocks(screenId, category)` | Blocks for a screen + category. For home, `screenId` is `'home'` and category is e.g. `'all'`, `'girls'`, `'boys'`. Returns array of content blocks (filter `visible !== false`, sort by `order`). |
| `getCategoryScreenBlocks()` | Blocks for the Category screen (from `categoryScreen.blocks`). |
| `getTicketingScreenBlocks()` | Blocks for the Ticketing screen (from `ticketingScreen.blocks`). |
| `getCategoryHeaderConfig(category)` | Header config for a home category (from `categories.items[category].header`). |
| `getCategoryScreenConfig()` | Full `categoryScreen` object (header, blocks, styles). |
| `getTicketingScreenConfig()` | Full `ticketingScreen` object. |

### 2.3 Tab bar and navigation

| Method | Purpose |
|--------|--------|
| `getTabBarConfig()` | `tabBar` object: `visibleTabs`, `items` (per route: `icon`, `activeIcon`, `label`), `styles`. |

### 2.4 Product and grid

| Method | Purpose |
|--------|--------|
| `getProductGridDefaults()` | `productGridDefaults`: `gap`, `rowGap`, `colGap`, `paddingHorizontal`. |
| `getProductCardStyles()` | `productCard.styles`: productName, vendorBadgeText, mainPrice, comparePrice, discountPercentage (fontSize, fontWeight, fontFamily, color). |
| `getProductDetailConfig()` | `productDetail`: styles and sections (recommendations, recentlyViewed). |

### 2.5 Feature and provider config

| Method | Purpose |
|--------|--------|
| `getBabycareCollectionSidebar(collectionId)` | If `babycareSidebarEnabled` is true, return subcategories for the given collection from `babycareCollectionSidebar[collectionId]`. |
| `getAccountConfig()` | `account`: profile, quickActions, menuItems, logout, version, styles. |
| `getDeliveryConfig()` | `delivery`: googleMapsApiKey, darkStoreLocation, packingTime, maxDeliveryTime, etc. |
| `getProvidersConfig()` | `providers`: backend, nector, razorpay, otp (baseUrl and keys). |
| `getRazorpayConfig()` | `providers.razorpay`. |
| `getDiscountsConfig()` | `discounts` (if used). |
| `getFreeShoesOfferConfig()` | `freeShoesOffer`. |

### 2.6 Normalized home config (internal)

- Build **home** from the raw config as follows:
  - Read `categories.order` (e.g. `['all', 'girls', 'boys', 'babycare', 'toys', 'babygear']`).
  - For each key in `order`, if the raw config has a top-level array with that key (e.g. `all`, `girls`), set `home[key] = rawConfig[key]`.
  - So `getScreenBlocks('home', 'all')` uses `home.all`, etc.

---

## 3. Top-level config keys (kiddoAppConfig.json)

The web app must read these from the raw config (via getters above or direct access to raw):

| Key | Used for |
|-----|----------|
| `tabBar` | visibleTabs, items (icon, activeIcon, label), styles |
| `babycareSidebarEnabled` | Toggle collection sidebar |
| `babycareCollectionSidebar` | Map of collectionId → { subcategories: [...] } |
| `productGridDefaults` | gap, rowGap, colGap, paddingHorizontal |
| `productCard` | styles for product name, vendor, price, discount |
| `categoryScreen` | header (title, showSearch, showWishlist), blocks |
| `all`, `girls`, `boys`, `toys`, `babycare`, `babygear` | Home block arrays per category |
| `header` | Global header (textColor, primaryColor, etc.) |
| `ticketingScreen` | header, blocks |
| `categories` | order, items (label, icon, header per category) |
| `productDetail` | styles, sections |
| `discounts` | Discount configuration |
| `account` | profile, quickActions, menuItems, logout, version, styles |
| `delivery` | Maps, timing, distance |
| `freeShoesOffer` | enabled, shoes list |
| `providers` | backend, nector, razorpay, otp |

---

## 4. Block system

### 4.1 BlockRenderer

- **Input:** Array of content blocks (each has `id`, `type`, `order`, `visible`, optional `styles`, and type-specific fields).
- **Behaviour:** Filter where `visible !== false`, sort by `order`, then for each block resolve a React component by `type` and render it with the block as props.
- **Spacing:** Apply consistent spacing between blocks (e.g. marginBottom 4px or as in config).

### 4.2 Block type → component map

Use the same type names and payload shapes as the mobile app. Map as follows:

| type | Component / behaviour |
|------|------------------------|
| `banner`, `imageBanner` | Image banner (imageUrl, optional link, height, borderRadius) |
| `carousel` | Image carousel (data array, autoPlay, height, etc.) |
| `grid` | Grid of collection/image tiles (collectionIds or data, gridConfig) |
| `categoryGrid` | Category grid (collectionIds, gridConfig, layout options) |
| `list`, `horizontalProductList` | Horizontal list (collectionIds or data, productListConfig) |
| `infiniteProductGrid` | Infinite scroll product grid (collectionIds, productGridConfig) |
| `rail` | Visual category rail (data with id, imageUrl, label, collectionId) |
| `flashSale` | Flash sale timer (startTime, endTime, layout) |
| `announcementCarousel`, `announcementStrip` | Announcement strip |
| `promoCarousel` | Promo carousel |
| `searchProductList` | Search-driven product list |
| `featureStrip` | Feature strip (icons + labels) |
| `videoBanner` | Video banner |
| `noInternet` | No-internet placeholder |
| `modal` | Modal (content, height) |
| `collectionList` | Collection list |

Block styles (e.g. `styles.container`, `styles.title`, `styles.text`) support config-driven typography: `fontFamily` (alias or exact), `fontWeight`, `fontStyle`, `fontSize`, `color`. Resolve font aliases (e.g. `semibold` → theme font) the same way as mobile (see design doc).

---

## 5. Screens and data flow

### 5.1 Home

- **Categories:** From `getCategories()` → `order` and `items`. Render a category strip (tabs or chips) with label and optional icon per category. Selected category drives which blocks are shown.
- **Header:** From `getCategoryHeaderConfig(selectedCategory)` merged with `getConfig().header`. Use for background image, background color, text color, primary color.
- **Content:** `getScreenBlocks('home', selectedCategory)` → pass to BlockRenderer.
- **Search:** Header search bar; on press navigate to search screen. Suggestions can be static or from config if you add a key later.

### 5.2 Category

- **Header:** From `getCategoryScreenConfig().header` (title “All Categories”, showSearch, showWishlist).
- **Content:** `getCategoryScreenBlocks()` → BlockRenderer.

### 5.3 Ticketing

- **Header:** From `getTicketingScreenConfig().header`.
- **Content:** `getTicketingScreenBlocks()` → BlockRenderer.

### 5.4 Account

- **Structure:** From `getAccountConfig()`: profile (avatar, phone, email), quickActions (orders, rewards, addresses), menuItems (help, about, terms, privacy), logout, version. Apply `account.styles` for padding/margins (header, quickActions, menuContainer, logoutButton, version).

### 5.5 Collection (product listing) / Infinity

- **URL:** e.g. `/collection/[collectionId]`.
- **Sidebar:** If `getBabycareCollectionSidebar(collectionId)` returns an array, show a sidebar of subcategories (collectionId, label, imageUrl). Otherwise no sidebar.
- **Grid:** Use `getProductGridDefaults()` and `getProductCardStyles()` for layout and product card typography.

### 5.6 Product detail

- Use `getProductDetailConfig()` for title, vendor, description, accordion, variant label/button styles and for sections (recommendations, recentlyViewed) with their styles and gap.

---

## 6. Tab bar

- **Visibility:** Only show tabs whose route name is in `tabBar.visibleTabs` (e.g. `['index', 'category', 'ticketing', 'account']`).
- **Per-tab:** From `tabBar.items[routeName]`: `icon` (inactive URL), `activeIcon` (active URL), `label`. If URLs are remote, render with `<img>` or equivalent; otherwise use local assets.
- **Styles:** Use `tabBar.styles`: backgroundColor, activeTintColor, inactiveTintColor, iconSize, height, shadow (shadowColor, shadowOpacity, shadowRadius), border (e.g. borderTopWidth, borderTopColor). Match mobile tab bar design (see design doc).

---

## 7. Backend and providers

- **Base URL and keys:** Read from `getProvidersConfig()` (e.g. `providers.backend.baseUrl`, `providers.razorpay`, `providers.otp`). Do not hardcode; same config as mobile. For secrets (e.g. Razorpay secret), use env vars or backend proxy; do not expose in client-bundled config.

---

## 8. TypeScript types to mirror

- **Content blocks:** From `types/content.ts`: `BaseBlock`, `ImageBannerBlock`, `ImageCarouselBlock`, `ImageGridBlock`, `CategoryGridBlock`, `ImageListBlock`, `InfiniteProductGridBlock`, `ModalBlock`, `AnnouncementCarouselBlock`, `PromoCarouselBlock`, `SearchProductListBlock`, `CollectionListBlock`, `FlashSaleBlock`, `CategoryRailBlock`, `FeatureStripBlock`, `VideoBannerBlock`, `NoInternetBlock`, and `ContentBlock` union.
- **Config:** `AppConfig`, `ScreenConfig` from `types/content.ts`; `TabBarConfig`, `TabBarItemConfig`, `TabBarStyles` from `types/tabBarTypes.ts`.

Copy or adapt these types into the web project so block payloads and config are type-safe and match mobile.

---

## 9. Files to reference (mobile codebase)

When implementing or prompting, attach or reference:

| File | Purpose |
|------|--------|
| `services/configService.ts` | Load, normalize, and getter logic |
| `types/content.ts` | Block and AppConfig types |
| `types/tabBarTypes.ts` | Tab bar types |
| `components/content/BlockRenderer.tsx` | Block type → component map and render loop |
| `config/kiddoAppConfig.json` | Sample config (or use remote URL + this doc) |

Optional: `app/(tabs)/index.tsx`, `app/(tabs)/category.tsx` for how home/category consume config and BlockRenderer.

---

## 10. Web-specific notes

- **CORS:** Ensure the config URL allows the web origin, or serve the same JSON via your backend.
- **Caching:** Use HTTP cache or a short TTL so updates propagate; optional cache-bust query param for “pull latest”.
- **Secrets:** Keep sensitive keys (e.g. Razorpay secret, OTP API key) out of client-exposed config; use env or backend.

Using this architecture, the web app will stay in parity with the mobile app for everything driven by `kiddoAppConfig.json`.
