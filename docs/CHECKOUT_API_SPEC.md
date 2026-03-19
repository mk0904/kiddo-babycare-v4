# Checkout API spec – complete order details in Shopify

The app sends **full checkout details** in the draft request so the backend can persist them on the Shopify order. This ensures each order in Shopify has: delivery preference (scheduled vs instant + exact slot when scheduled), all product details per line, full bill breakdown, and payment method.

## Backward compatibility (old app versions)

All new fields below are **optional**. Old app versions that omit `deliveryType`, `paymentMethod`, `billDetails`, `timeSlotLabel`, and per-line `variantTitle` / `image` / `compareAtPrice` continue to work: the backend defaults `deliveryType` from `deliverySchedule` (scheduled vs instant), uses `payment_method: "pending"` on the draft until `POST /api/v1/checkout/complete` sends the actual method, and skips note/bill lines when `billDetails` is missing.

## Endpoint: `POST /api/v1/checkout/draft`

Request body is extended with the following fields (in addition to existing ones). Backend should store them when creating/completing the draft order so the **final Shopify order** contains this information (e.g. note, metafields, or tags).

---

### 1. Delivery

| Field | Type | Description |
|-------|------|-------------|
| `deliveryType` | `'scheduled' \| 'instant'` | `scheduled` = user chose a time slot; `instant` = no schedule (deliver as soon as possible). |
| `deliverySchedule` | object or `undefined` | Present when user scheduled delivery. |

**`deliverySchedule`** (when present):

| Field | Type | Description |
|-------|------|-------------|
| `date` | string | DD/MM/YYYY |
| `time` | string | HH:MM AM/PM (slot start) |
| `day` | string | Day name (e.g. "Saturday") |
| `dateFormat` | string | Short date (dd/mm/yy) |
| `timeSlotLabel` | string (optional) | Display label e.g. "11AM - 12PM" |

**Backend recommendation:**  
- Put a single **order note** or **metafield** such as:  
  `Delivery: Scheduled - Saturday 15/02/25, 11AM - 12PM` or `Delivery: Instant`.  
- Alternatively use metafields, e.g. `custom.delivery_type`, `custom.delivery_date`, `custom.delivery_time`, `custom.delivery_slot_label`.

---

### 2. Payment method

| Field | Type | Description |
|-------|------|-------------|
| `paymentMethod` | `'razorpay' \| 'cod' \| 'free' \| 'try_and_buy'` | Method used for this order. |

**Backend recommendation:**  
- Store in order note and/or metafield (e.g. `custom.payment_method`) so Shopify order shows Pay Online vs COD vs Free vs Try & Buy.

---

### 3. Bill details

| Field | Type | Description |
|-------|------|-------------|
| `billDetails` | object | Full bill breakdown (all in same currency). |

**`billDetails`:**

| Field | Type | Description |
|-------|------|-------------|
| `subtotal` | number | Sum of (price × quantity) before discount. |
| `subtotalAfterDiscount` | number | Subtotal after coupon discount. |
| `deliveryFee` | number | Delivery fee (e.g. 0 or fixed). |
| `giftWrappingFee` | number | Gift wrapping charge. |
| `discount` | number | Total discount (coupon) amount. |
| `total` | number | Final amount charged (toPay). |
| `currencyCode` | string | e.g. "INR". |

**Backend recommendation:**  
- Append to order note or store as JSON in a metafield (e.g. `custom.bill_details`) so support/admin can see exact breakdown in Shopify.

---

### 4. Line items (product details)

Each element of `items[]` now includes full product info:

| Field | Type | Description |
|-------|------|-------------|
| `variantId` | string | Shopify variant ID (numeric part only is fine). |
| `quantity` | number | Quantity. |
| `price` | number | Unit price (after any item-level discount). |
| `title` | string | Product title. |
| `variantTitle` | string (optional) | Variant title (e.g. "Size M", "Pack of 2"). |
| `image` | string (optional) | Image URL. |
| `compareAtPrice` | number (optional) | Compare-at price (MRP) if applicable. |
| `tags` | string[] | Product tags. |
| `bookingDate` | string (optional) | For ticketing/events – booking date. |

**Backend recommendation:**  
- Draft/order line items already get variant and title from Shopify. Use `variantTitle`, `image`, `compareAtPrice` for order note or metafields if you want to preserve exact snapshot (e.g. “Pack of 2”, image URL, MRP) for each line.

---

### 5. Address – Save as (Home/Work/Other/Events)

When the app sends `address`, it may include:

| Field | Type | Description |
|-------|------|-------------|
| `addressType` | string (optional) | User’s “Save as” choice: `"Home"`, `"Work"`, `"Other"`, or `"Events"`. |

**Backend requirement:** When creating the Shopify draft order, set the draft’s shipping address from `address.addressType` (if present). The backend uses only `addressType`; when calling Shopify, map it to the field Shopify expects so the placed order shows the address type (e.g. Events) on the order’s shipping address.

---

### 6. Other existing fields (unchanged)

- `totalAmount`, `currencyCode`, `email`, `phone`, `name`, `customerId`, `address` (with optional `addressType` above)
- `giftWrapping`, `couponCode`, `discountAmount`, `deliverySchedule` (legacy shape; prefer `deliveryType` + `deliverySchedule` for delivery)
- `selectedShoe`, `isTryAndBuy`

---

### Example order note (suggested format)

You can concatenate into a single note for the Shopify order, e.g.:

```
Delivery: Scheduled - Saturday 15/02/25, 11AM - 12PM
Payment: Pay Online (Razorpay)
Bill: Subtotal ₹X, Discount -₹Y, Delivery ₹Z, Gift wrap ₹W, Total ₹T (INR)
```

Plus any line-level or tagging you need from `items` and `billDetails`.

---

### Completing the order (`POST /api/v1/checkout/complete`)

No change to the complete request. The draft already has all context; when completing, backend should copy the stored draft metadata (delivery, payment method, bill summary) onto the final Shopify order (note/metafields) so the order in Shopify shows **complete checkout details**: scheduled vs instant + slot, full product details, bill breakdown, and method.
