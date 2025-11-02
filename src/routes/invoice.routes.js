const express = require('express');
const axios = require('axios');
const { getUserAccessToken } = require('../services/googleOAuth');
const { getInvoicePrefs, upsertInvoicePrefs } = require('../services/preferences');

const router = express.Router();

router.post('/process-invoice', async (req, res) => {
  try {
    const webhookUrl = process.env.N8N_WEBHOOK_URL || 'https://n8n-service-la6u.onrender.com/webhook/demo/social-media';

    const headers = {
      'Content-Type': 'application/json',
      'X-Request-Source': 'invoice-processor'
    };

    const demoToken = req.header('x-demo-token') || req.header('X-Demo-Token');
    if (demoToken) headers['X-Demo-Token'] = demoToken;

    const googleAccessToken = await getUserAccessToken(req.user.id);
    if (!googleAccessToken) {
      return res.status(412).json({
        error: 'GOOGLE_NOT_CONNECTED',
        message: 'Conecta tu cuenta de Google para ejecutar este workflow.'
      });
    }

    // Preferencias: tomar del body o de las prefs guardadas
    const prefs = await getInvoicePrefs(req.user.id);
    const drive_folder_id = req.body.drive_folder_id ?? prefs?.drive_folder_id ?? null;
    const spreadsheet_id = req.body.spreadsheet_id ?? prefs?.spreadsheet_id ?? null;
    const range = req.body.range ?? prefs?.range ?? null;

    const payload = {
      ...req.body,
      google_access_token: googleAccessToken,
      drive_folder_id,
      spreadsheet_id,
      range
    };

    const upstream = await axios.post(webhookUrl, payload, { headers, timeout: 20000 });
    return res.status(upstream.status).send(upstream.data);
  } catch (error) {
    if (error.response) {
      return res.status(error.response.status).json({
        error: 'WEBHOOK_RESPONSE_ERROR',
        status: error.response.status,
        data: error.response.data
      });
    }
    if (error.request) {
      return res.status(502).json({
        error: 'WEBHOOK_NO_RESPONSE',
        message: error.code || 'No response from webhook'
      });
    }
    return res.status(502).json({
      error: 'WEBHOOK_REQUEST_FAILED',
      message: error.message
    });
  }
});

// Leer preferencias del workflow de facturas
router.get('/invoice/prefs', async (req, res) => {
  try {
    const prefs = await getInvoicePrefs(req.user.id);
    return res.json({
      drive_folder_id: prefs?.drive_folder_id || null,
      spreadsheet_id: prefs?.spreadsheet_id || null,
      range: prefs?.range || null
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to load preferences' });
  }
});

// Guardar/actualizar preferencias del workflow de facturas
router.post('/invoice/prefs', async (req, res) => {
  try {
    const { drive_folder_id, spreadsheet_id, range } = req.body;
    await upsertInvoicePrefs(req.user.id, { drive_folder_id, spreadsheet_id, range });
    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to save preferences' });
  }
});

module.exports = router;
