# Push Notifications with Shopify Integration

## Overview

Shopify doesn't provide native push notification services for mobile apps, but you can implement push notifications by:
1. Using Shopify **Webhooks** to listen for events (orders, products, etc.)
2. Storing push tokens in Shopify **Customer Metafields**
3. Using a push notification service (Expo Push Notifications, Firebase, OneSignal)
4. Creating a backend/webhook handler to send notifications

## Architecture

```
Shopify Store → Webhook → Your Backend → Push Notification Service → Mobile App
```

## Implementation Steps

### 1. Install Expo Notifications

```bash
npx expo install expo-notifications
```

### 2. Request Permissions & Get Push Token

Create: `services/pushNotificationService.ts`

```typescript
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { customerService } from './customerService';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const pushNotificationService = {
  /**
   * Register for push notifications and get token
   */
  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // Request permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push token for push notification!');
      return null;
    }

    // Get Expo push token
    const token = (await Notifications.getExpoPushTokenAsync({
      projectId: 'your-expo-project-id', // Get from app.json or expo config
    })).data;

    console.log('Push token:', token);

    // Save token to Shopify customer metafield
    await this.saveTokenToShopify(token);

    return token;
  },

  /**
   * Save push token to Shopify customer metafield
   */
  async saveTokenToShopify(token: string): Promise<void> {
    try {
      // Get current customer
      const customer = await customerService.getCurrentCustomer();
      if (!customer?.id) {
        console.warn('No customer logged in, cannot save push token');
        return;
      }

      // Save token as customer metafield
      // You'll need to implement this in customerService
      await customerService.updateCustomerMetafield(
        customer.id,
        'push_notification_token',
        token,
        'single_line_text_field'
      );
    } catch (error) {
      console.error('Error saving push token to Shopify:', error);
    }
  },

  /**
   * Setup notification listeners
   */
  setupNotificationListeners() {
    // Handle notification received while app is foregrounded
    Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    // Handle notification tapped
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification tapped:', response);
      const data = response.notification.request.content.data;
      
      // Navigate based on notification data
      if (data?.type === 'order') {
        // Navigate to order details
      } else if (data?.type === 'product') {
        // Navigate to product
      }
    });
  },
};
```

### 3. Update app.json

```json
{
  "expo": {
    "plugins": [
      [
        "expo-notifications",
        {
          "icon": "./assets/images/icon.png",
          "color": "#ffffff",
          "sounds": ["./assets/sounds/notification.wav"]
        }
      ]
    ],
    "extra": {
      "eas": {
        "projectId": "your-expo-project-id"
      }
    }
  }
}
```

### 4. Initialize in App Root

Update: `app/_layout.tsx`

```typescript
import { pushNotificationService } from '@/services/pushNotificationService';
import { useEffect } from 'react';

export default function RootLayout() {
  useEffect(() => {
    // Register for push notifications on app start
    pushNotificationService.registerForPushNotifications();
    
    // Setup notification listeners
    pushNotificationService.setupNotificationListeners();
  }, []);

  // ... rest of your code
}
```

### 5. Create Webhook Handler (Backend)

You'll need a backend service to receive Shopify webhooks and send push notifications.

**Example Node.js/Express webhook handler:**

```javascript
const express = require('express');
const { Expo } = require('expo-server-sdk');
const app = express();

const expo = new Expo();

// Store customer push tokens (in production, use database)
const customerTokens = new Map();

app.post('/webhook/shopify', async (req, res) => {
  const { event, customer_id, order_id } = req.body;

  // Get customer's push token
  const pushToken = customerTokens.get(customer_id);
  if (!pushToken) {
    return res.status(200).send('No push token found');
  }

  // Create notification message
  let message = '';
  let data = {};

  switch (event) {
    case 'orders/create':
      message = 'Your order has been placed! 🎉';
      data = { type: 'order', orderId: order_id };
      break;
    
    case 'orders/paid':
      message = 'Your order payment was successful! ✅';
      data = { type: 'order', orderId: order_id };
      break;
    
    case 'orders/fulfilled':
      message = 'Your order has been shipped! 📦';
      data = { type: 'order', orderId: order_id };
      break;
    
    default:
      return res.status(200).send('Event not handled');
  }

  // Send push notification
  const messages = [{
    to: pushToken,
    sound: 'default',
    title: 'Kiddo',
    body: message,
    data: data,
  }];

  try {
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    
    for (const chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }
    
    console.log('Push notifications sent:', tickets);
    res.status(200).send('OK');
  } catch (error) {
    console.error('Error sending push notification:', error);
    res.status(500).send('Error');
  }
});

app.listen(3000, () => {
  console.log('Webhook server running on port 3000');
});
```

### 6. Setup Shopify Webhooks

In your Shopify Admin:
1. Go to **Settings** → **Notifications**
2. Scroll to **Webhooks**
3. Create webhooks for:
   - `orders/create`
   - `orders/paid`
   - `orders/fulfilled`
   - `orders/cancelled`
   - `products/create` (for new product notifications)
   - `customers/create` (optional)

4. Set webhook URL to: `https://your-backend.com/webhook/shopify`

### 7. Store Push Tokens in Shopify

Update: `services/customerService.ts`

Add method to save push token as customer metafield:

```typescript
async updateCustomerMetafield(
  customerId: string,
  key: string,
  value: string,
  type: string = 'single_line_text_field'
): Promise<void> {
  // Use Shopify Admin API to update customer metafield
  // This requires Admin API access token
}
```

## Alternative: Use Shopify Customer Metafields API

Instead of a separate backend, you can:
1. Store push tokens in Shopify Customer Metafields
2. Use Shopify Flow (for Plus stores) or a Shopify App to send notifications
3. Or use a service like OneSignal that integrates with Shopify

## Recommended Services

1. **Expo Push Notifications** (Easiest for Expo apps)
2. **Firebase Cloud Messaging** (More features, requires native setup)
3. **OneSignal** (Has Shopify integration)
4. **Pusher Beams** (Simple API)

## Next Steps

1. Install `expo-notifications`
2. Create the push notification service
3. Set up a webhook handler (backend)
4. Configure Shopify webhooks
5. Test with Expo's push notification tool

Would you like me to implement any of these components?

