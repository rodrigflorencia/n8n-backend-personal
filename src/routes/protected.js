// routes/protected.js
const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Aplicar middleware a todas las rutas protegidas
router.use(authenticateToken);

router.get('/user-data', (req, res) => {
  // Solo usuarios autenticados pueden acceder
  res.json({ user: req.user });
});

module.exports = router;
