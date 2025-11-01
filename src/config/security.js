const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { StatusCodes } = require('http-status-codes');
const createError = require('http-errors');

// Configuración de rate limiting
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutos por defecto
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10), // 100 peticiones por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Demasiadas peticiones desde esta IP. Por favor, inténtalo de nuevo más tarde.',
  handler: (req, res, next) => {
    next(createError(
      StatusCodes.TOO_MANY_REQUESTS,
      'Has excedido el límite de peticiones. Por favor, inténtalo de nuevo más tarde.'
    ));
  }
});

// Configuración de cabeceras de seguridad
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", process.env.N8N_WEBHOOK_URL],
    },
  },
  hsts: {
    maxAge: 31536000, // 1 año
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true
});

// Middleware para validar el content-type
const validateContentType = (req, res, next) => {
  if (req.method === 'POST' && !req.is('application/json')) {
    return next(createError(
      StatusCodes.UNSUPPORTED_MEDIA_TYPE,
      'Content-Type debe ser application/json'
    ));
  }
  next();
};

module.exports = {
  apiLimiter,
  securityHeaders,
  validateContentType
};