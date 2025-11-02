// backend/middleware/auth.js
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Para el backend usamos service key
);
const REQUIRE_DB_USER = process.env.REQUIRE_DB_USER === 'true';

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Token de autorización requerido',
        code: 'MISSING_TOKEN'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Validar token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return res.status(403).json({ 
        error: 'Token inválido o expirado',
        code: 'INVALID_TOKEN'
      });
    }

    // Verificar que el usuario existe en nuestra base de datos (opcional)
    let userData = null;
    if (REQUIRE_DB_USER) {
      const { data, error: dbError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (dbError) {
        // Si se requiere la verificación, advertimos y continuamos con 403 si no existe
        console.warn('Aviso: fallo al consultar tabla usuarios:', dbError.message);
      }

      if (!data) {
        return res.status(403).json({ 
          error: 'Usuario no encontrado',
          code: 'USER_NOT_FOUND'
        });
      }
      userData = data;
    }

    req.user = user;
    req.userData = userData;
    next();
  } catch (error) {
    console.error('Error en autenticación:', error);
    return res.status(500).json({ 
      error: 'Error interno de autenticación',
      code: 'AUTH_ERROR'
    });
  }
};

const attachDemoClient = (req, res, next) => {
  try {
    const headerToken = req.header('x-demo-token') || req.header('X-Demo-Token');
    if (headerToken) {
      const secret = process.env.DEMO_JWT_SECRET || process.env.JWT_SECRET || 'change-me';
      try {
        const decoded = jwt.verify(headerToken, secret);
        req.client = {
          id: decoded.id || 'demo',
          type: decoded.type || 'demo',
          workflows: Array.isArray(decoded.workflows) ? decoded.workflows : ['all'],
          createdAt: decoded.createdAt || Math.floor(Date.now() / 1000),
          expiresAt: decoded.exp || null
        };
      } catch (_) {
        req.client = {
          id: req.user?.id || 'anonymous',
          type: req.user ? 'user' : 'anonymous',
          workflows: ['all'],
          createdAt: Math.floor(Date.now() / 1000),
          expiresAt: null
        };
      }
    } else {
      req.client = {
        id: req.user?.id || 'anonymous',
        type: req.user ? 'user' : 'anonymous',
        workflows: ['all'],
        createdAt: Math.floor(Date.now() / 1000),
        expiresAt: null
      };
    }
    next();
  } catch (e) {
    next(e);
  }
};

// exports at end of file

// Generar token de demo por 7 días
function generateDemoToken(clientId, workflow_interests = ['all']) {
  const payload = {
    id: clientId,
    type: 'demo',
    workflows: workflow_interests,
    createdAt: Math.floor(Date.now() / 1000)
  };

  const secret = process.env.DEMO_JWT_SECRET || process.env.JWT_SECRET || 'change-me';
  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

module.exports = { authenticateToken, generateDemoToken, attachDemoClient };
