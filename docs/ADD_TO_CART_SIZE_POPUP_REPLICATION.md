# Add-to-Cart Size Popup (Product) Replication Guide

This guide covers the exact popup shown when user taps **Add** on product cards and variant choice is needed.

## Components Involved

- Trigger and orchestration: `components/ui/UniversalAdd.tsx`
- Popup UI + variant selection logic: `components/modals/VariantSelectionModal.tsx`
- Card usage: `components/product/ProductCard.tsx` (`<UniversalAdd item={product} variant="prominent" />`)

## Is Backend API Called?

Yes, conditionally.

`UniversalAdd` may call Shopify API before showing/processing add:

- `shopifyApi.getProductById(productId)` is called when item payload is likely incomplete:
  - search/listing item with synthetic/incomplete variant IDs
  - missing variants
  - only default/single placeholder variant
- It also may call `shopifyApi.getProductById(pid)` in `completeAddToCart` to fetch tags if tags are missing.

If your incoming product payload already has complete variant + tag data, these calls may not be needed.

## Open Logic (What Actually Triggers Popup)

Inside `UniversalAdd.handleAdd()`:

1. Determine `activeVariant` from `selectedVariant` or first variant.
2. Detect if payload is incomplete (`isSearchResultVariant` heuristic).
3. If incomplete, fetch full product (`getProductById`) and replace current item data.
4. Re-check variant count and product type.
5. If product has multiple variants and qualifies for Try & Buy (non-PDP flow), open popup:
   - `setVariantModalVisible(true)`
6. Render modal:
   - `visible={variantModalVisible}`
   - `product={fullProductData || item}`
   - `layout="sheet"`
   - `onAddToCart={handleTryBuyModalConfirm}`

## Popup Behavior (`VariantSelectionModal`)

The modal supports Try & Buy-aware selection:

- Primary option row (required; usually size).
- Secondary try row (optional second size).
- Disabled chips for:
  - unavailable values
  - invalid by rule (for example, same value as primary in try row)
- Confirm button enabled only when selected primary resolves to available variant.

Confirm callback payload:

- `keepVariant` (required)
- `tryVariant` (optional)

`UniversalAdd` then calls `completeAddToCart(currentItem, keepVariant, tryVariant)`.

## Data Written To Cart

`completeAddToCart(...)` writes:

- product/variant IDs
- title, variant title
- price, compare-at price, currency
- image URL
- quantity, availability, `quantityAvailable`
- tags
- optional ticketing `bookingDate`
- optional Try & Buy custom attributes:
  - `try_buy_trial_variant_id`
  - `try_buy_trial_variant_title`
  - `try_buy_trial_option_value`

## Required Dependencies For Replication

If replicating in another folder/module, wire these equivalents:

- Cart actions: `addItem`, `removeItem`, `updateQuantity` (or your store/service alternatives)
- Availability helper: `isVariantAvailable`
- Try & Buy helpers (if feature needed):
  - `hasTryAndBuyProduct`
  - `tryBuyTrialOptionValueFromVariant`
- Full product fetch fallback:
  - `shopifyApi.getProductById(...)`
- Modal component:
  - `VariantSelectionModal`

## Replication Checklist

1. Keep local modal state:
   - `variantModalVisible`
   - optional `fullProductData`
2. Implement `handleAdd()` decision flow:
   - inspect variants
   - fetch full product if incomplete
   - decide modal open vs direct add
3. Render `VariantSelectionModal` with correct props.
4. On modal confirm, call centralized add-to-cart function.
5. Ensure fallback to first available variant when selected/default is out of stock.
6. Preserve analytics/custom attributes as needed by your cart backend.

## Minimal Integration Pattern

```tsx
const [variantModalVisible, setVariantModalVisible] = useState(false);
const [fullProductData, setFullProductData] = useState<any>(null);

const ensureFullProduct = async (item: any) => {
  if (hasCompleteVariantData(item)) return item;
  const full = await shopifyApi.getProductById(item.id);
  if (full) setFullProductData(full);
  return full || item;
};

const handleAddPress = async () => {
  const productToUse = await ensureFullProduct(item);
  const variants = productToUse?.variants?.edges || productToUse?.variants || [];
  const isTryBuy = hasTryAndBuyProduct(productToUse);

  if (variants.length > 1 && isTryBuy) {
    setVariantModalVisible(true);
    return;
  }

  const nodes = variants.map((v: any) => v?.node ?? v);
  const firstAvailable = nodes.find((v: any) => isVariantAvailable(v) !== false) || nodes[0];
  if (firstAvailable) {
    await addToCartWithVariant(productToUse, firstAvailable);
  }
};

const handleVariantConfirm = async ({
  keepVariant,
  tryVariant,
}: {
  keepVariant: any;
  tryVariant?: any;
}) => {
  const productToUse = fullProductData || item;
  await addToCartWithVariant(productToUse, keepVariant, tryVariant);
  setVariantModalVisible(false);
};

return (
  <>
    <TouchableOpacity onPress={handleAddPress}>
      <Text>Add</Text>
    </TouchableOpacity>

    <VariantSelectionModal
      visible={variantModalVisible}
      product={fullProductData || item}
      layout="sheet"
      onClose={() => setVariantModalVisible(false)}
      onAddToCart={handleVariantConfirm}
    />
  </>
);
```

## Edge Cases To Keep

- Missing/partial variants in list/search payloads.
- Out-of-stock first variant: auto-fallback to first available.
- PDP flow differences: PDP may use inline selector and not always open this modal.
- Ticketing/date-based products: validate required date before add.

## Quick Summary

To replicate reliably, copy not just the modal UI but the full `UniversalAdd` decision pipeline:

- payload completeness check
- optional backend fetch
- availability filtering
- modal confirm-to-cart bridge
- optional Try & Buy attributes
