# Backend app config for kiddo-service

This folder contains the app config payload and instructions for the **kiddo-service** backend.

## Endpoint

- **GET /api/v1/app/config** – returns the JSON in `app-config.json` (cart/checkout features, gift wrap, free shoes offer with per-size `isAvailable`, copy, image URLs).

### Delivery tracking (order detail map)

The app loads a **road-snapped** route from kiddo-service (no routing API keys or polyline decoding in the app).

- **GET /api/v1/orders/:shopifyOrderId/delivery-route**
  - Query: optional `rider_lat`, `rider_lng`. If both valid, origin is the rider; otherwise origin is the **configured dark store** (still road-snapped to the customer).
  - Response: `{ "coordinates": [ { "latitude", "longitude" }, ... ] }` with at least two points.
  - **Auth:** currently optional (temporary); re-enable customer ownership checks in kiddo-service before treating this as private data.

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

### Delivery service radius on app config

Include **`delivery.servicableDistance`** (number, km) on the same JSON (or the same field at the **root** of the app-config payload). The app compares it to **`distanceKm`** (and common aliases) from **`POST /eta`** when present; otherwise it derives km using ETA **`lat`/`lng`** vs the app’s **`DARK_STORE_LOCATION`** in `config/deliveryConfig.ts` — keep that coordinate aligned with your hub. Legacy threshold aliases: `serviceableDistance`, `maxServiceRadiusKm`, snake_case variants.

## Point the Kiddo app at localhost

1. Run kiddo-service locally so **GET** `http://<host>:<port>/api/v1/app/config` returns your JSON.
2. In the **kiddo-app** repo root, copy **`.env.example`** → **`.env`** and set **`EXPO_PUBLIC_BACKEND_API_BASE`**:
   - **Android emulator:** `http://10.0.2.2:<port>` (maps to your machine’s loopback).
   - **iOS simulator:** `http://127.0.0.1:<port>` or `http://localhost:<port>`.
3. Restart Metro. The app uses `getBackendApiPath('app/config')`, which becomes `<base>/api/v1/app/config` unless `base` already ends with `/api/v1`.
4. Include **`milestoneUI`** on the same JSON payload when you want the home/cart milestone strip to reflect your backend.
