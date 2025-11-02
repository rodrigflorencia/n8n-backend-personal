const express = require('express');
const { getUserAccessToken } = require('../services/googleOAuth');
const { getInvoicePrefs } = require('../services/preferences');

const router = express.Router();

// Lista los workflows disponibles para el usuario autenticado
router.get('/workflows', async (req, res) => {
  try {
    const userId = req.user.id;

    // Conexiones disponibles
    let googleConnected = false;
    try {
      const token = await getUserAccessToken(userId);
      googleConnected = !!token;
    } catch (_) {
      googleConnected = false;
    }

    // Preferencias del workflow de facturas
    let invoicePrefs = null;
    try {
      invoicePrefs = await getInvoicePrefs(userId);
    } catch (_) {
      invoicePrefs = null;
    }

    const workflows = [
      {
        key: 'invoice_ocr',
        name: 'Invoice to Google Sheets',
        description: 'Lee facturas desde una carpeta de Google Drive y las registra en una hoja de Google Sheets',
        requires: ['google_drive', 'google_sheets'],
        connected: googleConnected,
        prefs: {
          drive_folder_id: invoicePrefs?.drive_folder_id || null,
          spreadsheet_id: invoicePrefs?.spreadsheet_id || null,
          range: invoicePrefs?.range || null,
        },
        actions: !googleConnected
          ? { connect_google_url_endpoint: '/api/oauth/google/url' }
          : undefined,
      },
      // Aquí podrían agregarse más workflows según configuración
    ];

    res.json({ workflows });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list workflows' });
  }
});

module.exports = router;
