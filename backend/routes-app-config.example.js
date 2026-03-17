/**
 * Example route for kiddo-service: GET /api/v1/app/config
 * Copy this into your kiddo-service app and mount at /api/v1.
 *
 * Query params (optional, for offer visibility):
 *   - cartSubtotal: number (cart subtotal in INR)
 *   - cartCategories: string (comma-separated category/tag strings from cart items)
 *
 * When present, the backend computes freeShoesOffer.visible from showWhen rules
 * and returns it in the response. The app uses visible to show/hide the offer.
 *
 * Usage (Express):
 *   const appConfigRouter = require('./routes/app-config');
 *   app.use('/api/v1', appConfigRouter);
 */

const express = require('express');
const router = express.Router();
const appConfig = require('../app-config.json');

/**
 * Evaluate showWhen rules against cart context. Returns true if offer should be visible.
 * All specified conditions are ANDed. Add new keys here when you add new rules.
 * @param {Object} showWhen - from freeShoesOffer.showWhen in config
 * @param {string[]} cartCategoryTags - lowercase category/tag strings from cart
 * @param {number} cartSubtotal - cart subtotal (INR)
 */
function evaluateShowWhen(showWhen, cartCategoryTags, cartSubtotal) {
  if (!showWhen) return true;

  if (showWhen.cartHasAnyCategory && showWhen.cartHasAnyCategory.length > 0) {
    const hasCategory = showWhen.cartHasAnyCategory.some((cat) =>
      cartCategoryTags.includes(String(cat).trim().toLowerCase())
    );
    if (!hasCategory) return false;
  }

  if (showWhen.cartMinValue != null && showWhen.cartMinValue > 0) {
    if (cartSubtotal < showWhen.cartMinValue) return false;
  }

  if (showWhen.cartHasAnyProductType && showWhen.cartHasAnyProductType.length > 0) {
    const hasType = showWhen.cartHasAnyProductType.some((t) =>
      cartCategoryTags.includes(String(t).trim().toLowerCase())
    );
    if (!hasType) return false;
  }

  return true;
}

router.get('/app/config', (req, res) => {
  // Cart context: app sends these so backend is the only place that decides offer visibility
  const cartSubtotal = req.query.cartSubtotal != null ? Number(req.query.cartSubtotal) : 0;
  const cartCategoriesRaw = req.query.cartCategories;
  const cartCategoryTags =
    typeof cartCategoriesRaw === 'string' && cartCategoriesRaw.length > 0
      ? cartCategoriesRaw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
      : [];

  // Deep clone so we don't mutate the base config
  const response = JSON.parse(JSON.stringify(appConfig));

  // All offer visibility logic lives in backend only: compute visible from showWhen rules
  const freeShoes = response.cart && response.cart.freeShoesOffer;
  if (freeShoes && freeShoes.enabled) {
    freeShoes.visible = evaluateShowWhen(freeShoes.showWhen, cartCategoryTags, cartSubtotal);
  }

  res.set('Cache-Control', 'public, max-age=300');
  res.json(response);
});

module.exports = router;
