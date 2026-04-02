/**
 * kiddo-service: GET /api/v1/orders/:shopifyOrderId/delivery-route
 *
 * Query params (required):
 *   - access_token: same customer auth as live-location WebSocket
 *   - rider_lat, rider_lng: current delivery partner position (live updates)
 *
 * Response JSON (200):
 *   { "coordinates": [ { "latitude": number, "longitude": number }, ... ] }
 *
 * Minimum 2 points: road-snapped path from rider → customer drop (and optionally via store).
 * Call Google Routes API, Directions API, or Mapbox Directions **only on the server** (API keys in env).
 *
 * The mobile app only renders this polyline; it does not decode polylines or hold routing keys.
 */

// Example shape — replace with your auth, order lookup, geocoding, and provider client.

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function getDeliveryRouteHandler(req, res) {
  const shopifyOrderId = String(req.params.shopifyOrderId || '').trim();
  const accessToken = String(req.query.access_token || '').trim();
  const riderLat = parseFloat(String(req.query.rider_lat ?? ''));
  const riderLng = parseFloat(String(req.query.rider_lng ?? ''));

  if (!shopifyOrderId || !accessToken) {
    return res.status(400).json({ error: 'missing_order_or_token' });
  }
  if (!Number.isFinite(riderLat) || !Number.isFinite(riderLng)) {
    return res.status(400).json({ error: 'invalid_rider_coordinates' });
  }

  // 1) Validate access_token for this order (same rules as GET .../delivery-status).
  // 2) Load order shipping destination coordinates (geocode on server if needed).
  // 3) Optionally include dark-store / pickup as a waypoint from your DB/config.

  // 4) const route = await directionsClient.route({ origin: { lat, lng }, destination: ... });
  // 5) Decode overview polyline to [{ latitude, longitude }, ...]

  const coordinates = [
    { latitude: riderLat, longitude: riderLng },
    // ... all intermediate + destination from Directions response
  ];

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return res.status(404).json({ error: 'route_not_available' });
  }

  return res.json({ coordinates });
}

// router.get('/orders/:shopifyOrderId/delivery-route', getDeliveryRouteHandler);

module.exports = { getDeliveryRouteHandler };
