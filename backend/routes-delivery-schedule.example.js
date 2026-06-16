/**
 * kiddo-service: PATCH /api/v1/orders/:shopifyOrderId/delivery-schedule
 *
 * Request body (required):
 *   - scheduledDate: string (DD/MM/YYYY format, e.g. "18/06/2026")
 *   - scheduledTime: string (HH:MM AM/PM format, e.g. "02:00 PM")
 *
 * Response JSON (200):
 *   { "success": true }
 *
 * Response JSON (error):
 *   { "error": "error_message" }
 *
 * This endpoint is used by the mobile app when editing a demo order to update
 * the delivery schedule. The backend should:
 * 1. Validate the shopifyOrderId exists
 * 2. Update the delivery partner service with the new scheduledDate and scheduledTime
 * 3. Return success if the update was successful
 *
 * Usage (Express):
 *   const deliveryScheduleRouter = require('./routes/delivery-schedule');
 *   app.use('/api/v1', deliveryScheduleRouter);
 */

const express = require('express');
const router = express.Router();

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
async function updateDeliveryScheduleHandler(req, res) {
  const shopifyOrderId = String(req.params.shopifyOrderId || '').trim();
  const { scheduledDate, scheduledTime } = req.body;

  if (!shopifyOrderId) {
    return res.status(400).json({ error: 'missing_shopify_order_id' });
  }

  if (!scheduledDate || !scheduledTime) {
    return res.status(400).json({ error: 'missing_scheduled_date_or_time' });
  }

  // Validate date format (DD/MM/YYYY)
  const dateRegex = /^\d{2}\/\d{2}\/\d{4}$/;
  if (!dateRegex.test(scheduledDate)) {
    return res.status(400).json({ error: 'invalid_date_format_expected_dd_mm_yyyy' });
  }

  // Validate time format (HH:MM AM/PM)
  const timeRegex = /^\d{2}:\d{2} (AM|PM)$/i;
  if (!timeRegex.test(scheduledTime)) {
    return res.status(400).json({ error: 'invalid_time_format_expected_hh_mm_am_pm' });
  }

  try {
    // TODO: Implement the actual delivery partner service update
    // This should call the delivery-partner-service API to update the schedule
    // Example:
    // const deliveryPartnerResponse = await fetch(
    //   `https://delivery-partner-service-874125225773.asia-south1.run.app/api/v1/orders/${deliveryPartnerOrderId}`,
    //   {
    //     method: 'PATCH',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ shopifyOrderId, scheduledDate, scheduledTime })
    //   }
    // );

    // For now, return success (replace with actual implementation)
    console.log(`[delivery-schedule] Updating order ${shopifyOrderId} to ${scheduledDate} at ${scheduledTime}`);
    
    return res.json({ success: true });
  } catch (error) {
    console.error('[delivery-schedule] Update failed:', error);
    return res.status(500).json({ error: 'failed_to_update_delivery_schedule' });
  }
}

router.patch('/orders/:shopifyOrderId/delivery-schedule', updateDeliveryScheduleHandler);

module.exports = router;
