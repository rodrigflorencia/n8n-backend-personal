const express = require('express');
const { buildAuthUrl, exchangeCode, getUserAccessToken } = require('../services/googleOAuth');

const router = express.Router();

function getBaseUrl(req) {
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0];
  const host = req.headers['x-forwarded-host'] || req.get('host');
  return `${proto}://${host}`;
}

// 1) Obtener URL de autorización de Google (usuario logueado)
router.get('/api/oauth/google/url', async (req, res) => {
  try {
    const baseUrl = getBaseUrl(req);
    const authUrl = buildAuthUrl(baseUrl, req.user.id);
    res.json({ auth_url: authUrl });
  } catch (e) {
    res.status(500).json({ error: 'Failed to build Google auth URL' });
  }
});

// 2) Callback de Google (no requiere autenticación, Google redirige aquí)
router.get('/oauth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code || !state) return res.status(400).send('Missing code or state');
    const baseUrl = getBaseUrl(req);
    await exchangeCode(baseUrl, code, state);

    const successRedirect = process.env.OAUTH_SUCCESS_REDIRECT;
    if (successRedirect) {
      return res.redirect(successRedirect);
    }
    return res.send('Google conectado correctamente. Ya puedes cerrar esta pestaña.');
  } catch (e) {
    const failRedirect = process.env.OAUTH_FAIL_REDIRECT;
    if (failRedirect) {
      return res.redirect(failRedirect);
    }
    return res.status(500).send('Error conectando con Google.');
  }
});

// 3) Estado de conexión (usuario logueado)
router.get('/api/oauth/google/status', async (req, res) => {
  try {
    const token = await getUserAccessToken(req.user.id);
    res.json({ connected: !!token });
  } catch (e) {
    res.status(500).json({ error: 'Failed to retrieve Google connection status' });
  }
});

module.exports = router;
