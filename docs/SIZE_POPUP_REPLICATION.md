# Size Popup Implementation (Replication Guide)

This guide documents how the current **size popup** works in `components/cart/FreePairShoes.tsx` and how to replicate the same pattern in another component.

## Source of Truth

- Main implementation: `components/cart/FreePairShoes.tsx`
- Trigger points: `openSizeModal` from both **Add** and **Edit**
- Popup container: React Native `Modal` with backdrop + bottom card

## Behavior Overview

The popup is a two-step selector inside one modal:

1. User selects a size.
2. Available shoes are filtered by that size.
3. User selects a shoe.
4. Confirm is enabled only when both size + shoe are selected.
5. On confirm, parent callback is called with `(shoeId, size)`.

## State You Need

Use these local states in your component:

- `showSizeModal: boolean` - controls modal visibility
- `sizeModalSelection: string | null` - selected size inside modal
- `sizeModalShoeSelection: string | null` - selected shoe inside modal
- `selectedSize: string | null` - confirmed size shown in card/UI after confirm
- `sizeOptions: Array<{ size: string; isAvailable: boolean; shoeIds?: string[] }>`
- `shoeOptions: Array<{ id: string; name: string; imageUrl: string }>`

## Core Helper Functions

Replicate these helper methods:

- `getShoesForSize(size)`  
  - Finds selected size config
  - Uses `shoeIds` allow-list if present
  - Returns filtered `shoeOptions`

- `getPreferredShoeForSize(size, preferredShoeId)`  
  - Returns preferred shoe if still valid for selected size
  - Otherwise falls back to first available shoe

- `openSizeModal()`  
  - Seeds modal state from current confirmed state
  - Pre-selects best shoe for seeded size
  - Opens modal

- `closeSizeModal()`  
  - Closes modal
  - Clears temporary modal state

- `confirmSize()`  
  - Validates both size + shoe
  - Persists confirmed size
  - Calls `onConfirmSize(shoeId, size)` (or fallback action)

## UI Structure to Copy

Use this structure:

- `Modal` (`transparent`, `animationType="fade"`)
  - full-screen container (`justifyContent: 'flex-end'`)
  - backdrop `Pressable` (dismiss on tap)
  - bottom sheet card
    - title row + close icon
    - divider
    - `ScrollView`
      - size section (grid of chips/buttons)
      - shoe section (grid of image options)
      - confirm button

## Confirm Button Rules

Disable confirm when any of the following is true:

- no selected size
- no selected shoe
- no shoes available for selected size

In code this condition is:

`!sizeModalShoeSelection || !sizeModalSelection || modalShoes.length === 0`

## Minimal Replication Scaffold

```tsx
const [showSizeModal, setShowSizeModal] = useState(false);
const [sizeModalSelection, setSizeModalSelection] = useState<string | null>(null);
const [sizeModalShoeSelection, setSizeModalShoeSelection] = useState<string | null>(null);
const [selectedSize, setSelectedSize] = useState<string | null>(null);

const getShoesForSize = (size: string | null) => {
  if (!size) return shoeOptions;
  const sizeOption = sizeOptions.find((option) => option.size === size);
  const allowedIds = sizeOption?.shoeIds?.length ? sizeOption.shoeIds : shoeOptions.map((shoe) => shoe.id);
  return shoeOptions.filter((shoe) => allowedIds.includes(shoe.id));
};

const getPreferredShoeForSize = (size: string | null, preferredShoeId?: string | null) => {
  const availableShoes = getShoesForSize(size);
  if (availableShoes.length === 0) return null;
  if (preferredShoeId && availableShoes.some((shoe) => shoe.id === preferredShoeId)) return preferredShoeId;
  return availableShoes[0]?.id ?? null;
};

const openSizeModal = () => {
  const firstAvailableSize = sizeOptions.find((s) => s.isAvailable)?.size ?? null;
  const seedSize = selectedSize ?? firstAvailableSize;
  setSizeModalSelection(seedSize);
  setSizeModalShoeSelection(getPreferredShoeForSize(seedSize, null));
  setShowSizeModal(true);
};

const closeSizeModal = () => {
  setShowSizeModal(false);
  setSizeModalSelection(null);
  setSizeModalShoeSelection(null);
};

const confirmSize = () => {
  if (!sizeModalSelection || !sizeModalShoeSelection) return;
  setSelectedSize(sizeModalSelection);
  setShowSizeModal(false);
  setSizeModalSelection(null);
  setSizeModalShoeSelection(null);
  onConfirmSize?.(sizeModalShoeSelection, sizeModalSelection);
};

const modalShoes = getShoesForSize(sizeModalSelection);
const disableConfirm = !sizeModalShoeSelection || !sizeModalSelection || modalShoes.length === 0;
```

## Integration Checklist (Another File)

- Add the state + helpers above.
- Render the `Modal` JSX near your component return bottom.
- Wire your trigger button (`Add`, `Edit`, etc.) to `openSizeModal`.
- Keep selection temporary inside modal states until user taps **Confirm**.
- Pass final values up via callback (`onConfirmSize`) or local action.
- Keep unavailable sizes disabled with distinct disabled styles.

## Notes

- In current code, sizes + shoes are config-driven (`appConfigService`) with fallback defaults.
- If you replicate in a context without config, hardcode `sizeOptions` and `shoeOptions` first, then migrate to config later.
