/**
 * Example route for kiddo-service: GET /api/v1/app/config
 * Copy this into your kiddo-service app and mount at /api/v1.
 *
 * Usage (Express):
 *   const appConfigRouter = require('./routes/app-config');
 *   app.use('/api/v1', appConfigRouter);
 */

const express = require('express');
const router = express.Router();
const appConfig = require('../app-config.json');

router.get('/app/config', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(appConfig);
});

module.exports = router;
