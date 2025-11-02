const express = require('express');
const axios = require('axios');
const router = express.Router();

// Validaciones deshabilitadas: se reenvía el payload tal cual al webhook

// Endpoint simple: reenvía el payload al webhook sin validaciones
router.post('/process-invoice', async (req, res, next) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.status(500).json({ error: 'N8N_WEBHOOK_URL is not configured' });
    }

    const payload = {
      tenant_id: req.headers['x-tenant-id'] || req.clientId || 'anonymous',
      ...req.body,
      timestamp: new Date().toISOString()
    };

    const n8nResponse = await axios.post(webhookUrl, payload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Source': 'invoice-processor'
      },
      timeout: 15000
    });

    return res.status(200).json({ success: true, data: n8nResponse.data });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;