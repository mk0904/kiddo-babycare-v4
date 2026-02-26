# Coupon Code Configuration Guide

Coupons are **configured and served only from the backend** (kiddo-service). The app does not use `kiddoAppConfig.json` for coupons.

## 📍 Location

**Backend (kiddo-service):** `config/coupon.json`

The app fetches eligible coupons via `POST /api/v1/coupons/:userId` with body `{ cartSubTotal, cartItemCount, hasTicketing, hasClothing }`. When the user enters a code manually, the app checks if it exists in the backend response—if present (visible or hidden), it applies; otherwise not. Eligibility (usage limits, minimum purchase, first order, etc.) is computed on the backend using Shopify order history.

## 🔧 Configuration Fields (backend config/coupon.json)

Each coupon supports:

### Required
- `code`: Coupon code (e.g. `"KIDDO25"`)
- `value`: Discount value (number)
- `valueType`: `"percentage"` or `"fixed_amount"`

### Optional
- `minimumPurchaseAmount`: Min cart value (number or null)
- `minimumItemCount`: Min items in cart (number or null)
- `usageLimitPerUser`: Uses per user from Shopify orders (number or null)
- `firstOrderOnly`: true = only for customers with 0 orders
- `ticketingOnly`: true = cart must have ticketing products
- `clothingOnly`: true = cart must have clothing/fashion items
- `nonCombinable`: true = cannot combine with other coupons
- `isVisible`: false = hidden from “Offers” list; manual entry still works

## 🎯 How to Edit

1. In **kiddo-service**, open `config/coupon.json`.
2. Add or edit coupon objects in the `coupons` array.
3. Redeploy the backend (or restart the server) for changes to apply.

The app does not need a release: it always loads coupons from the backend API.

## ⚠️ Notes

- **Usage**: Backend counts how many times a customer used each code from Shopify order `note_attributes` (coupon_code). No app-side config.
- **Visibility**: Set `"isVisible": false` to hide a coupon from the Offers list; users can still apply it by typing the code.
- **kiddoAppConfig**: The `discounts` section in kiddoAppConfig is **not** used for coupons; the app uses the backend only.
