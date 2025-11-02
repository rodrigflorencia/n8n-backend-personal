const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/process-invoice', authenticateToken, async (req, res) => {
  try {
    const webhookUrl = 'https://n8n-service-la6u.onrender.com/webhook/demo/social-media';

    const headers = {
      'Content-Type': 'application/json',
      'X-Request-Source': 'invoice-processor'
    };

    const demoToken = req.header('x-demo-token') || req.header('X-Demo-Token');
    if (demoToken) headers['X-Demo-Token'] = demoToken;

    const payload = { ...req.body };

    const upstream = await axios.post(webhookUrl, payload, { headers, timeout: 15000 });
    return res.status(upstream.status).send(upstream.data);
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).send(error.response.data);
    }
    return res.status(502).send('Webhook request failed');
  }
});

module.exports = router;
