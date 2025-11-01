const { StatusCodes } = require('http-status-codes');
const createError = require('http-errors');
// middleware/auth.js
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');


const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);


async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token de acceso requerido' });
  }

  try {
    // Verificar token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Error de autenticación' });
  }
}

// Middleware para verificar la API Key
const apiKeyAuth = (req, res, next) => {
  try {
    // Obtener la API Key del header
    const apiKey = req.headers['x-api-key'];
    
    if (!apiKey) {
      throw createError(
        StatusCodes.UNAUTHORIZED,
        'API Key es requerida. Por favor, incluye x-api-key en el header.'
      );
    }

    // Verificar si la API Key es válida
    const validApiKeys = process.env.API_KEYS.split(',').reduce((acc, pair) => {
      const [clientId, key] = pair.split(':');
      acc[clientId] = key;
      return acc;
    }, {});

    // Buscar el cliente por API Key
    const clientId = Object.keys(validApiKeys).find(
      id => validApiKeys[id] === apiKey
    );

    if (!clientId) {
      throw createError(
        StatusCodes.UNAUTHORIZED,
        'API Key inválida o expirada.'
      );
    }

    // Agregar el ID del cliente al request para uso posterior
    req.clientId = clientId;
    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { apiKeyAuth };

module.exports = { authenticateToken };