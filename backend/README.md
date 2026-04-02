# Backend app config for kiddo-service

This folder contains the app config payload and instructions for the **kiddo-service** backend.

## Endpoint

- **GET /api/v1/app/config** – returns the JSON in `app-config.json` (cart/checkout features, gift wrap, free shoes offer with per-size `isAvailable`, copy, image URLs).

### Delivery tracking (order detail map)

The app loads a **road-snapped** route from kiddo-service (no routing API keys or polyline decoding in the app).

- **GET /api/v1/orders/:shopifyOrderId/delivery-route**
  - Auth: same as live-location WebSocket — `Authorization: Bearer <storefront_token>` and/or `access_token` query.
  - Query: optional `rider_lat`, `rider_lng`. If both valid, origin is the rider; otherwise origin is the **configured dark store** (still road-snapped to the customer).
  - Response: `{ "coordinates": [ { "latitude", "longitude" }, ... ] }` with at least two points.

See `routes-delivery-route.example.js` for a stub handler.

## kiddo-service integration

1. Copy `app-config.json` into kiddo-service (e.g. `config/app-config.json` or load from DB).
2. Add a route that serves this JSON.

### Express example

```js
// In your kiddo-service app (e.g. routes/appConfig.js or similar)
const appConfig = require('./config/app-config.json');

router.get('/app/config', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300'); // 5 min
  res.json(appConfig);
});
```

### Dynamic loading

If you store config in DB or env, build the same JSON shape and return it. The app expects:

- `features.cart.showGiftWrap`, `showFreePairShoes`, etc. (booleans)
- `cart.freeShoesOffer.enabled`, `cart.freeShoesOffer.sizes` as `[{ size: "S1", isAvailable: true }, ...]`, `cart.freeShoesOffer.shoes`
- `cart.giftWrap.enabled`, `cart.giftWrap.options`, etc.

See `kiddo-app/types/appConfig.ts` for the full TypeScript interface.
