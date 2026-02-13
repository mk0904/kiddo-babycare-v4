# Mixpanel Setup Guide

## ✅ What's Been Done

1. ✅ Added `mixpanel-react-native` to `package.json`
2. ✅ Created `mixpanel.js` initialization file
3. ✅ Initialized Mixpanel in `app/_layout.tsx`
4. ✅ Added "App Opened" tracking
5. ✅ Created helper utilities in `utils/mixpanelHelpers.ts`

## 🔧 Next Steps

### 1. Install the Package

```bash
npm install
cd ios && pod install
```

### 2. Add Your Mixpanel Token

Edit `mixpanel.js` and replace `'YOUR_PROJECT_TOKEN'` with your actual token:

```javascript
export const mixpanel = new Mixpanel('YOUR_ACTUAL_TOKEN_HERE');
```

Get your token from: https://mixpanel.com/project/settings

### 3. Usage Examples

#### Basic Event Tracking
```typescript
import { trackEvent } from '@/utils/mixpanelHelpers';

trackEvent('Add to Cart', {
  productId: '123',
  price: 499
});
```

#### Identify User (After Login)
```typescript
import { identifyUser, trackLoginSuccess } from '@/utils/mixpanelHelpers';

// Option 1: Use helper
trackLoginSuccess(userId);

// Option 2: Manual
identifyUser(userId, {
  name: 'User Name',
  email: 'user@email.com'
});
```

#### Track Screen Views
```typescript
import { trackScreenView } from '@/utils/mixpanelHelpers';

trackScreenView('Home');
```

#### Pre-defined Events
```typescript
import {
  trackProductViewed,
  trackAddToCart,
  trackCheckoutStarted,
  trackPaymentSuccess,
  trackPaymentFailed
} from '@/utils/mixpanelHelpers';

trackProductViewed('product-123', 'Product Name', 499);
trackAddToCart('product-123', 'Product Name', 499, 2);
trackCheckoutStarted(998, 2);
trackPaymentSuccess('order-456', 998, 'razorpay');
```

#### Reset on Logout
```typescript
import { resetUser } from '@/utils/mixpanelHelpers';

resetUser(); // Call when user logs out
```

## 📱 Testing

- Use a **real device** for reliable testing
- Check **Live View** in Mixpanel dashboard
- Events appear in real-time

## ⚠️ Important Notes

- **Never call `identifyUser()` before login** - only after successful authentication
- Always call `resetUser()` on logout
- Screen tracking is automatic if you use the helper function

## 🎯 Must-Track Events (Recommended)

- ✅ App Opened (already implemented)
- Login Success / Failed
- Product Viewed
- Add to Cart
- Checkout Started
- Payment Success / Failed

All helpers are ready to use! Just add your token and start tracking.

