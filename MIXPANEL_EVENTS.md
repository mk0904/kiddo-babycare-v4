# Mixpanel Events Tracking

## ✅ Events Now Being Tracked:

1. **App Opened** - Automatically when app starts
2. **Screen View** - Automatically on every screen navigation
3. **Login Success** - When user successfully logs in (with user identification)
4. **Product Viewed** - When user views a product detail page
5. **Add to Cart** - When user adds item to cart
6. **Checkout Started** - When user clicks "Place Order"
7. **Payment Success** - When order is successfully placed
8. **Payment Failed** - When order/payment fails

## 🔍 Debugging:

Check your console logs for:
- `✅ Mixpanel initialized successfully` - Means Mixpanel is working
- `✅ Mixpanel: App Opened event tracked` - Confirms event was sent
- `⚠️ Mixpanel not initialized` - Means there's an issue

## 📊 View Events in Mixpanel:

1. Go to https://mixpanel.com
2. Open your project
3. Go to **Live View** or **Events**
4. You should see events appearing in real-time

## 🧪 Test Events:

1. **App Opened** - Just open the app
2. **Product Viewed** - Open any product detail page
3. **Add to Cart** - Add a product to cart
4. **Login Success** - Complete OTP login
5. **Checkout Started** - Click "Place Order" button
6. **Payment Success/Failed** - Complete or cancel checkout

If events still don't show:
- Check your Mixpanel token is correct
- Make sure you're testing on a **real device** (not simulator)
- Check console for any errors
- Verify Mixpanel dashboard is set to the correct project

