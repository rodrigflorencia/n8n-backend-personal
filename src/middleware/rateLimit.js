const rateLimit = require('express-rate-limit');

// Rate limiting por cliente
const createClientRateLimit = (windowMs = 15 * 60 * 1000, max = 50) => {
  return rateLimit({
    windowMs,
    max,
    keyGenerator: (req) => {
      // Usar client ID del JWT si está disponible
      return req.client?.id || req.user?.id || req.ip;
    },
    message: {
      error: "Too many requests",
      message: "You've exceeded the demo limit. Please wait before trying again.",
      retryAfter: Math.ceil(windowMs / 1000),
      upgrade_info: {
        message: "Upgrade for unlimited access",
        contact_url: "https://contact"
      }
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: "Rate limit exceeded",
        client_id: req.client?.id,
        limit_info: {
          requests_made: req.rateLimit.used,
          requests_left: req.rateLimit.remaining,
          reset_time: new Date(req.rateLimit.resetTime).toISOString()
        }
      });
    }
  });
};

// Rate limiting específico para demos
const demoWindowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000; // 15 minutos
const demoMax = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 10; // 10 requests por demo client
const demoRateLimit = createClientRateLimit(demoWindowMs, demoMax);

module.exports = { createClientRateLimit, demoRateLimit };
