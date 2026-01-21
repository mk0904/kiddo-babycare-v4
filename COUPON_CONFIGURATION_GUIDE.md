# Coupon Code Configuration Guide

This guide shows you exactly where and how to configure coupon code conditions in your app.

## 📍 Location

All coupon configurations are in: **`config/kiddoAppConfig.json`**

Navigate to the `discounts` section (around line 2390).

## 🔧 Configuration Fields

Each coupon code supports the following fields:

### Required Fields
- `code`: The coupon code (e.g., "KIDDO25")
- `value`: Discount value (number)
- `valueType`: Either `"percentage"` or `"fixed_amount"`

### Optional Conditions
- `minimumPurchaseAmount`: Minimum cart value required (number or null)
- `usageLimitPerUser`: How many times a single user can use this coupon (number or null)
- `startsAt`: Start date in ISO format (string or null)
- `endsAt`: End date in ISO format (string or null)

## 📝 Examples

### Example 1: Minimum Purchase Amount
```json
{
  "code": "KIDDO25",
  "title": "₹250 Off",
  "description": "Get ₹250 off on orders above ₹1000",
  "value": 250,
  "valueType": "fixed_amount",
  "minimumPurchaseAmount": 1000,
  "startsAt": null,
  "endsAt": null,
  "usageLimitPerUser": null
}
```

### Example 2: Usage Limit Per User
```json
{
  "code": "KIDDO10",
  "title": "10% Off",
  "description": "Get 10% off (One-time use per user)",
  "value": 10,
  "valueType": "percentage",
  "minimumPurchaseAmount": null,
  "startsAt": null,
  "endsAt": null,
  "usageLimitPerUser": 1
}
```

### Example 3: Date Range
```json
{
  "code": "KIDDO50",
  "title": "₹500 Off",
  "description": "Get ₹500 off this month",
  "value": 500,
  "valueType": "fixed_amount",
  "minimumPurchaseAmount": null,
  "startsAt": "2024-01-01T00:00:00Z",
  "endsAt": "2024-01-31T23:59:59Z",
  "usageLimitPerUser": null
}
```

### Example 4: All Conditions Combined
```json
{
  "code": "KIDDO100",
  "title": "₹1000 Off",
  "description": "Get ₹1000 off on orders above ₹5000 (Valid until Dec 31, max 2 uses per user)",
  "value": 1000,
  "valueType": "fixed_amount",
  "minimumPurchaseAmount": 5000,
  "startsAt": "2024-01-01T00:00:00Z",
  "endsAt": "2024-12-31T23:59:59Z",
  "usageLimitPerUser": 2
}
```

## 🎯 How to Edit

1. Open `config/kiddoAppConfig.json`
2. Find the `discounts` section (around line 2390)
3. Edit the coupon code you want to modify
4. Set the desired values:
   - For minimum purchase: Set `minimumPurchaseAmount` to a number (e.g., `1000`)
   - For usage limit: Set `usageLimitPerUser` to a number (e.g., `1` for one-time use, `2` for twice, etc.)
   - For dates: Set `startsAt` and/or `endsAt` in ISO format (e.g., `"2024-12-31T23:59:59Z"`)
5. Set to `null` to disable any condition
6. Save the file

## ⚠️ Important Notes

- **Minimum Purchase Amount**: Set as a number (e.g., `1000` for ₹1000), or `null` to disable
- **Usage Limit Per User**: Tracks usage per user ID. Set to `1` for one-time use, `2` for twice, etc., or `null` for unlimited
- **Date Format**: Use ISO 8601 format: `"YYYY-MM-DDTHH:mm:ssZ"` (e.g., `"2024-12-31T23:59:59Z"`)
- **Null Values**: Use `null` (not `"null"` as a string) to disable any condition

## 🔄 After Making Changes

After updating the config file, you may need to:
1. Restart your app/development server
2. Clear app cache if changes don't reflect immediately

## 📱 User Experience

When conditions aren't met, users will see helpful error messages:
- **Minimum purchase**: "This coupon requires a minimum purchase of ₹1000. Add ₹200 more to your cart."
- **Usage limit**: "You have already used this coupon code 1 time. This coupon can only be used 1 time per user."
- **Not started**: "This coupon code is not valid yet. It starts on [date]."
- **Expired**: "This coupon code has expired. It was valid until [date]."

