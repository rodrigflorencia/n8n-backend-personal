const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
require('dotenv').config();
const helmet = require('helmet');

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const path = require('path');

const openapiPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
let openapiDocument;
try {
  openapiDocument = YAML.load(openapiPath);
} catch (e) {
  console.error('Failed to load OpenAPI spec:', e.message);
  openapiDocument = { openapi: '3.0.0', info: { title: 'API', version: '0.0.0' } };
}

/***Revisar si va bien
const winston = require('winston');
const { apiLimiter, securityHeaders, validateContentType } = require('./config/security');
***/
const { authenticateToken } = require('./middleware/auth');
const { demoRateLimit } = require('./middleware/rateLimit');
const { createDemoAccess, executeWorkflow, getClientInfo } = require('./controllers/workflows');
const { registerUser, loginUser } = require('./controllers/auth');
const invoiceRoutes = require('./routes/invoice.routes');
const oauthRoutes = require('./routes/oauth.routes');
const workflowsRoutes = require('./routes/workflows.routes');

const PORT = process.env.PORT || 3000;
const app = express();

// Security middleware
//app.use(securityHeaders);
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://consulor-ia.web.app'
    : '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-tenant-id', 'x-api-key', 'x-demo-token', 'x-client-id', 'x-request-source']
}));

// Logging middleware
app.use(morgan('combined', { 
  stream: { 
    write: (message) => console.log(message.trim()) 
  } 
}));

// Parse middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  req.clientId = req.headers['x-tenant-id'] || 'anonymous';
  if (!req.logger) req.logger = console;
  next();
});

/** Configuración del logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});*/ 


// Validación de content-type
//app.use(validateContentType);

// Ruta de prueba (sin autenticación)
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    message: 'Servicio en funcionamiento',
    timestamp: new Date().toISOString()
  });
});

// OpenAPI/Swagger docs
app.get('/openapi.json', (req, res) => res.json(openapiDocument));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

app.post('/api/demo/create', createDemoAccess);
app.use('/api', authenticateToken, demoRateLimit);
app.use('/api', invoiceRoutes);
// Rutas OAuth: '/api/oauth/*' requieren auth a nivel de ruta o por este middleware global.
// '/oauth/google/callback' es pública.
app.use(oauthRoutes);
app.use('/api', workflowsRoutes);
app.post('/api/execute-workflow', executeWorkflow);
app.get('/api/client-info', getClientInfo);

app.post('/api/auth/register', registerUser);
app.post('/api/auth/login', loginUser);
// Aplicar rate limiting a todas las rutas
//app.use(apiLimiter);

// Aplicar autenticación a las rutas de la API

//app.use('/api', validateToken , demoRateLimit);

// Ejecutar workflow
//app.post('/api/execute-workflow', executeWorkflow);

// Información del cliente
//app.get('/api/client-info', getClientInfo);

// Información de workflows disponibles
/*app.get('/api/workflows', (req, res) => {
  const N8nClient = require('./utils/n8nClient');
  const n8nClient = new N8nClient();
  
  res.json({
    available_workflows: n8nClient.getAvailableWorkflows(req.client),
    client_access: req.client.workflows
  });
});*/





// Error handling middleware
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) {
    console.error('Unhandled error:', err);
  }
  res.status(status).json({ 
    error: status >= 500 ? 'Internal server error' : err.message,
    message: status >= 500 ? 'Something went wrong processing your request' : err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    available_endpoints: [
      'POST /api/demo/create',
      'POST /api/execute-workflow',
      'GET /api/client-info',
      'GET /api/workflows'
    ]
  });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  logger.error('Error no manejado:', { 
    error: err.message, 
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    clientId: req.clientId || 'no-autenticado'
  });

  // Si el error ya tiene un código de estado, usarlo; de lo contrario, 500
  const statusCode = err.statusCode || 500;
  
  res.status(statusCode).json({
    success: false,
    error: process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Error interno del servidor'
      : err.message
  });
});

// Iniciar el servidor


app.listen(PORT, () => {
  console.log(`🚀 Nexus AutoMate Backend running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
});


module.exports = app;
