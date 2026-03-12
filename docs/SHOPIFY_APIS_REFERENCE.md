# Shopify APIs Used in Kiddo App — Reference

This document lists **all Shopify (and related) APIs** used in the Kiddo app, the **operations** they perform, and **where they are used** in the codebase.

---

## 1. Overview

| API | Type | Endpoint / config | Purpose |
|-----|------|-------------------|--------|
| **Shopify Storefront API** | GraphQL | `https://{store}/api/2025-01/graphql.json` | Products, collections, cart, customer addresses, orders (read), search |
| **Shopify Admin API** | GraphQL | `https://{store}/admin/api/2025-01/graphql.json` | Draft orders (Try & Buy), customer metafields |
| **Searchanise** | REST (third-party) | `https://searchserverapi1.com` | Product search with filters/facets; results normalized to Shopify-style IDs |

**Config:** `config/shopify.ts` — `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, `SHOPIFY_API_URL`.

---

## 2. Shopify Storefront API

Uses **Storefront API access token** (`X-Shopify-Storefront-Access-Token`).  
Service: `services/shopifyApi.ts`.

### 2.1 Products & collections

| Method | GraphQL operation | Use in app |
|--------|-------------------|------------|
| **getCollectionById** | `getCollection` query — `collection(id)` → id, title, description, image | Collection header/title and image on collection (infinity) screen; ImageGrid/CategoryGrid/VisualCategoryRail when resolving collection name or image by ID. |
| **getProductsByCollection** | `getProductsByCollection` query — `collection(id).products(first, after, sortKey, reverse, filters)` with product + variant + metafields (custom.number_of_pieces, size, sizes, quantity, pack_size, etc.) | Main product listing on collection (infinity) screen; HorizontalProductList; ProductCollection; productCacheService. |
| **getProductByHandle** | `getProductByHandle` query — `product(handle)` with images, variants, options, metafields (fabric, wash_care, price_on_*, number_of_pieces, size, pack_size, highlights) | Product detail page (when opening by handle); productCacheService. |
| **getProductById** | `getProductById` query — `product(id)` same shape as by-handle | Product detail when opening by ID; search result tap (to load full product); cart item product resolution; UniversalAdd when resolving variant from search. |
| **getProductRecommendations** | `getProductRecommendations` query — `productRecommendations(productId)` | “You may also like” on product detail page. |
| **searchProducts** | `getProducts` query — `products(first, query, sortKey, reverse)` | Programmatic product search by query string (Storefront API search). |
| **getVariantsByIds** | `getVariantsByIds` (nodes) — `nodes(ids)` for ProductVariant (price, compareAtPrice, availableForSale, image) | Cart: sync prices/availability when cart loads or after applying coupons; validating variant IDs. |

### 2.2 Cart

| Method | GraphQL operation | Use in app |
|--------|-------------------|------------|
| **createCart** | `cartCreate` mutation — input: lines (merchandiseId, quantity), optional attributes | Creating a new cart when user adds first item or when no cart exists; cartStore. |
| **getCart** | `getCart` query — `cart(id)` → id, checkoutUrl, discountCodes, lines (merchandise, cost, discountAllocations), cost totals, discountAllocations | Loading cart for cart screen; after applying/removing discount codes; cartStore sync. |
| **addLinesToCart** | `cartLinesAdd` mutation | Adding items to existing cart; cartStore. |
| **applyDiscountCodes** | `cartDiscountCodesUpdate` mutation — cartId, discountCodes | Applying or clearing coupon codes on cart; cart screen and cartStore. |
| **updateCartAttributes** | `cartAttributesUpdate` mutation — cartId, attributes (e.g. Gift Wrapping) | Updating cart attributes (e.g. gift wrapping); cartStore. |

### 2.3 Customer (authenticated with customer access token)

| Method | GraphQL operation | Use in app |
|--------|-------------------|------------|
| **getCustomerAddresses** | `customerAddresses` query — `customer(customerAccessToken).addresses(first)`, defaultAddress | Loading saved addresses in AddressContext; address list screen. |
| **createCustomerAddress** | `customerAddressCreate` mutation — customerAccessToken, address (MailingAddressInput) | Adding new address; customerService → AddressContext. |
| **updateCustomerAddress** | `customerAddressUpdate` mutation — customerAccessToken, id, address | Editing address; customerService → AddressContext. |
| **deleteCustomerAddress** | `customerAddressDelete` mutation — customerAccessToken, id | Deleting address; customerService. |
| **setDefaultAddress** | `customerDefaultAddressUpdate` mutation — customerAccessToken, addressId | Setting default address; AddressContext. |
| **updateCustomer** | `customerUpdate` mutation — customerAccessToken, customer (firstName, lastName, email, phone, displayName) | Updating profile; customerService (e.g. after login/merge). |
| **getCurrentCustomerId** | `getCustomerId` query — `customer(customerAccessToken).id` | Resolving Shopify customer GID when backend only returns token; customerService. |

### 2.4 Orders (read-only on Storefront API)

| Method | GraphQL operation | Use in app |
|--------|-------------------|------------|
| **getCustomerOrders** | `getCustomerOrders` query — `customer(customerAccessToken).orders(first, sortKey, reverse)` → order id, orderNumber, processedAt, financialStatus, fulfillmentStatus, currentTotalPrice, lineItems | Orders list screen; order detail when order is a regular Storefront order. |
| **getOrderById** | `getOrderById` query — `node(id)` on Order → totals, shippingAddress, lineItems, etc. | Order detail screen for a given order ID; post-checkout order verification on cart screen. |

---

## 3. Shopify Admin API

Uses **Admin API access token** (`X-Shopify-Access-Token`).  
Service: `services/shopifyAdminApi.ts`.

### 3.1 Draft orders (Try & Buy and custom flows)

| Method | GraphQL operation | Use in app |
|--------|-------------------|------------|
| **createDraftOrder** | `draftOrderCreate` mutation — lineItems (variantId, quantity, customAttributes), optional customerId, email, shippingAddress, billingAddress, tags, note, customAttributes, discountCodes or appliedDiscount | Creating Try & Buy draft order; checkout flow when creating draft for payment. |
| **updateDraftOrder** | `draftOrderUpdate` mutation — id, input (lineItems, tags, note, customAttributes) | Updating Try & Buy draft after user confirms kept/returned items; TryAndBuyContext. |
| **completeDraftOrder** | `draftOrderComplete` mutation — id, paymentPending | Converting draft to order after payment; checkout/order creation. |
| **getDraftOrder** | `getDraftOrder` query — `draftOrder(id)` → lineItems, shippingAddress, totals, tags, customAttributes | Order detail screen when the order is a draft-order-based order (e.g. Try & Buy). |
| **deleteDraftOrder** | `draftOrderDelete` mutation | Cleaning up abandoned draft orders (if used). |

### 3.2 Customer metafields

| Method | GraphQL operation | Use in app |
|--------|-------------------|------------|
| **updateCustomerMetafields** | `metafieldsSet` mutation — ownerId (customer GID), namespace, key, value, type | Storing customer-related data (e.g. Nector/loyalty) on the customer; customerService after login/merge. |

---

## 4. Searchanise API (third-party search)

**Not a Shopify API.** Used for product search with filters and facets.  
Config: `config/searchanise.ts` — `SEARCHANISE_API_KEY`.  
Service: `services/searchaniseApi.ts`.

| Operation | HTTP | Use in app |
|-----------|------|------------|
| **searchProducts** | GET `https://searchserverapi1.com/getresults` with `apiKey`, `q`, `sortBy`, `sortOrder`, `startIndex`, `maxResults`, `facets`, `restrictBy[collections]`, filter params | Search screen: full-text search, collection filter, filters/facets, pagination. Results are transformed to Shopify-like shape (`gid://shopify/Product/...`, `gid://shopify/ProductVariant/...`) so the rest of the app can use them. |

**Note:** When user opens a search result, the app often calls **Shopify Storefront API** `getProductById` to get full product data (variants, metafields, etc.), since Searchanise returns a simplified product shape.

---

## 5. Where each API is used (file reference)

| Area | Files | APIs used |
|------|--------|-----------|
| **Config** | `config/shopify.ts` | Store domain, Storefront + Admin tokens, API URL |
| **Products & collections** | `app/product/[id].tsx`, `app/infinity/[collectionId].tsx`, `components/content/ImageGrid.tsx`, `components/content/CategoryGrid.tsx`, `components/content/HorizontalProductList.tsx`, `components/content/VisualCategoryRail.tsx`, `components/product/ProductCollection.tsx`, `services/productCacheService.ts`, `components/ui/UniversalAdd.tsx` | getProductById, getProductByHandle, getProductsByCollection, getCollectionById, getProductRecommendations |
| **Cart** | `store/cartStore.ts`, `app/cart/index.tsx` | createCart, getCart, addLinesToCart, applyDiscountCodes, getVariantsByIds, getOrderById (verification) |
| **Addresses** | `context/AddressContext.tsx`, `services/customerService.ts` | getCustomerAddresses, createCustomerAddress, updateCustomerAddress, deleteCustomerAddress, setDefaultAddress |
| **Customer profile** | `services/customerService.ts` | updateCustomer, getCurrentCustomerId; plus shopifyAdminApi.updateCustomerMetafields |
| **Orders** | `app/orders/index.tsx`, `app/orders/[id].tsx` | getCustomerOrders, getOrderById; shopifyAdminApi.getDraftOrder for draft-order orders |
| **Try & Buy** | `context/TryAndBuyContext.tsx` | shopifyAdminApi.updateDraftOrder |
| **Checkout / draft orders** | Backend (kiddo-service) + app | Backend likely calls Admin API createDraftOrder/completeDraftOrder; app uses getDraftOrder, getOrderById for display |
| **Search** | `app/search/index.tsx` | Searchanise searchProducts; then shopifyApi.getProductById when opening a result |

---

## 6. GID format reference

The app uses Shopify Global IDs (GIDs) consistently:

- **Product:** `gid://shopify/Product/{id}`
- **ProductVariant:** `gid://shopify/ProductVariant/{id}`
- **Collection:** `gid://shopify/Collection/{id}`
- **Cart:** `gid://shopify/Cart/{id}`
- **Order:** `gid://shopify/Order/{id}`
- **DraftOrder:** `gid://shopify/DraftOrder/{id}`
- **Customer:** `gid://shopify/Customer/{id}`
- **MailingAddress:** `gid://shopify/MailingAddress/{id}`

Searchanise results are normalized to `gid://shopify/Product/...` and `gid://shopify/ProductVariant/...` so they can be passed to Storefront API and cart flows.

---

## 7. Summary table (quick reference)

| API | Operations | Auth |
|-----|------------|------|
| **Storefront** | Products, collections, cart (create/get/add/discount/attributes), customer addresses & profile, customer orders, order by ID, variants by IDs | Storefront access token (public cart); customer access token for addresses/orders/profile |
| **Admin** | Draft order create/update/complete/get/delete; customer metafields set | Admin API access token |
| **Searchanise** | Product search with query, collection, filters, facets, pagination | API key (Searchanise) |

Customer **creation** and **login** (OTP) are handled by the **Kiddo backend** (kiddo-service); the backend returns a **customer access token** for the Storefront API, which the app then uses for all customer-scoped Storefront calls (addresses, orders, profile).
