const { StatusCodes } = require('http-status-codes');
const createError = require('http-errors');

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