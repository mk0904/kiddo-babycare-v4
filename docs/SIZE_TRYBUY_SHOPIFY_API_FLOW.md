# Size + Try & Buy → Shopify API Flow

This explains **how the selected size** (and optional **Try & Buy** second size) is sent to Shopify when user taps **Add** and confirms in the popup.

## Where the Selection Happens

- Popup UI: `components/modals/VariantSelectionModal.tsx`
  - User picks **primary** size (required) → resolves to `keepVariant`
  - User optionally picks **try** size (optional) → resolves to `tryVariant`
  - Confirm returns `{ keepVariant, tryVariant? }`
- Orchestration: `components/ui/UniversalAdd.tsx`
  - `handleTryBuyModalConfirm(result)` → calls `completeAddToCart(currentItem, result.keepVariant, result.tryVariant)`

## What “Size” Means

Shopify “size” is not sent as a string field.

- The selected size is encoded by the **Shopify ProductVariant ID** (`keepVariant.id`)
- That variant’s selected options contain the displayed size (e.g. option1 = Size = “2Y”)

So, sending “size” to Shopify = adding the **selected variant** to the cart.

## What Gets Sent for Try & Buy Size

Try & Buy second size is **not** added as a second line item by default.

It is stored as **line item custom attributes** (so it stays attached to the main cart line):

- `try_buy_trial_variant_id`
- `try_buy_trial_variant_title`
- `try_buy_trial_option_value`

These come from `tryVariant` inside `UniversalAdd.completeAddToCart(...)`.

## Which Backend API Is Called

This app uses Shopify **Storefront GraphQL API** (via `SHOPIFY_API_URL`) in `services/shopifyApi.ts` with `axios`.

### Cart create (GraphQL mutation)

If there is no active Shopify cart yet (or cart is being re-created), the app calls:

- `shopifyApi.createCart(lines)`
- GraphQL mutation: `cartCreate`

Mutation constant: `CART_CREATE_MUTATION` in `services/shopifyApi.ts`

### Add item to cart (GraphQL mutation)

If there is an active Shopify cart, the app calls:

- `shopifyApi.addLinesToCart(cartId, lines)`
- GraphQL mutation: `cartLinesAdd`

Mutation constant: `CART_LINES_ADD_MUTATION` in `services/shopifyApi.ts`

### Transport details

All Shopify Storefront requests use:

- `POST` to `SHOPIFY_API_URL` (axios `client.post('', { query, variables })`)
- Header: `X-Shopify-Storefront-Access-Token`

## What Payload Is Sent

### Primary (keep) size / variant

For the primary size, the cart line uses:

- `merchandiseId`: `keepVariant.id` (Shopify ProductVariant GID)
- `quantity`: typically `1` for the initial add

### Try & Buy info (attributes)

When Try & Buy is active and a try size was chosen, `UniversalAdd` adds custom attributes to the cart item payload.

Depending on how your cart sync is implemented, these attributes are:

- stored locally on the cart item as `customAttributes`
- and must be included as Shopify cart line `attributes` when building `CartLineInput`

Look for the conversion function in the cart layer:

- `shopifyLineFromCartItem` in `store/cartStore.ts` (used when building `lines` arrays for Shopify mutations)

## Important Note About Local vs Shopify Sync

`components/ui/UniversalAdd.tsx` calls `useCartStore().addItem(...)`.

The Shopify mutations are executed from the cart sync layer (in `store/cartStore.ts`) when the app:

- creates/re-creates a Shopify cart, or
- syncs lines to Shopify

So the flow is:

`VariantSelectionModal` → `UniversalAdd.completeAddToCart` → `cartStore.addItem` → (later/immediately) `shopifyApi.cartCreate` / `shopifyApi.cartLinesAdd`

## Quick Answer

- **Primary size** is sent by adding the chosen **variant ID** to Shopify cart (`cartCreate` or `cartLinesAdd`).
- **Try & Buy size** is sent as **line item attributes** tied to that same cart line.

