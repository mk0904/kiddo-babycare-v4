# Age Filter Implementation: Variant-Based with Tag Fallback

## Overview
The age filter has been updated to use **variant-based filtering** as the primary method, with **tag-based filtering** as a fallback. This provides better accuracy while maintaining compatibility with products that don't have age information in variants.

## Changes Made

### 1. **ProductCollection.tsx**
- Added `matchesAgeByVariant()` function: Checks if any available variant has an age/size option matching the selected age filter
- Kept `matchesAgeByTags()` function: Fallback method using product tags
- Updated filtering logic: Tries variant-based first, falls back to tags if no variants match

### 2. **shopifyApi.ts**
- Updated `GET_PRODUCTS_BY_COLLECTION_QUERY`: Changed `variants(first: 10)` to `variants(first: 250)` to fetch all variants for accurate filtering

## How It Works

### Variant-Based Filtering (Primary)
1. Checks all variants of a product
2. Looks for variant options with names containing "age" or "size"
3. Matches option values against age filter patterns (e.g., "3-6m", "1-2y")
4. Only considers variants that are `availableForSale` and have `quantityAvailable > 0`

### Tag-Based Filtering (Fallback)
1. If no variants match, falls back to checking product tags
2. Uses the existing tag pattern matching logic
3. Ensures products without variant age data still work

## Age Mapping Patterns

The system recognizes these age formats in variants:
- `3-6m`, `3-6 m`, `3-6 months`, `3-6M`
- `6-12m`, `6-12 m`, `6-12 months`, `6-12M`
- `1-2y`, `1-2 y`, `1-2 years`, `1-2Y`, `12-24m`
- `2-3y`, `2-3 y`, `2-3 years`, `2-3Y`, `24-36m`
- `3-4y`, `3-4 y`, `3-4 years`, `3-4Y`, `36-48m`
- `4-5y`, `4-5 y`, `4-5 years`, `4-5Y`, `48-60m`
- `5+y`, `5+ y`, `5+ years`, `5y+`, `5Y+`, `60m+`

## Benefits

✅ **More Accurate**: Only shows products with actually available variants for the selected age
✅ **Inventory-Aware**: Respects variant availability and stock levels
✅ **Better UX**: Users see products they can actually purchase
✅ **Backward Compatible**: Falls back to tags for products without variant age data
✅ **Flexible**: Handles various age format conventions

## Performance Considerations

⚠️ **Increased Data Transfer**: Fetching 250 variants per product increases payload size
- **Mitigation**: Variants are only used for filtering, not all displayed
- **Trade-off**: Better accuracy vs. slightly larger API responses

⚠️ **Client-Side Processing**: Filtering happens client-side after data fetch
- **Mitigation**: Uses React.useMemo for efficient filtering
- **Trade-off**: More accurate results vs. client-side computation

## Best Practices

### ✅ **DO:**
- Use variant-based filtering when age/size is stored in variant options
- Ensure variant option names are consistent (e.g., "Size", "Age", "Age Group")
- Keep variant option values standardized (e.g., "3-6m" not "3-6 months" and "3-6m")
- Test with products that have many variants to ensure performance is acceptable

### ❌ **DON'T:**
- Don't remove tag-based fallback (some products may not have variant age data)
- Don't fetch more than 250 variants (Shopify limit is 250 per query)
- Don't filter out products that have variants but no matching age (fallback handles this)

## Testing Checklist

- [ ] Products with age in variant options filter correctly
- [ ] Products with age only in tags still filter correctly (fallback)
- [ ] Products with no age data are handled gracefully
- [ ] Performance is acceptable with large product lists
- [ ] Variant availability is respected (out-of-stock variants don't match)

## Future Improvements

1. **Server-Side Filtering**: Move to Shopify's ProductFilter API for age filtering (requires standardized variant option names)
2. **Caching**: Cache variant age mappings to reduce repeated processing
3. **Indexing**: Pre-compute age availability for faster filtering
4. **Hybrid Approach**: Use server-side filtering when possible, client-side as fallback

