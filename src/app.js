const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const invoiceRoutes = require('./routes/invoice.routes');

// Inicializar la aplicación Express
const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
const axios = require('axios');


app.use(express.json());

app.post('/process-invoice', async (req, res) => {
  const tenant_id = req.headers['x-tenant-id']; // Recibe tenant_id en header
  const invoiceImageUrl = req.body.invoiceImageUrl;

  if (!tenant_id || !invoiceImageUrl) {
    return res.status(400).json({ error: 'tenant_id and invoiceImageUrl required' });
  }

  try {
    // Llamada al webhook de n8n con tenant_id y datos
    const response = await axios.post('https://tu-n8n-url/webhook/tu-webhook-id', {
      tenant_id: tenant_id,
      invoice_image_url: invoiceImageUrl,
      // otros datos si quieres
    });

    res.json({ message: 'Invoice sent to processing', n8nResponse: response.data });
  } catch (error) {
    res.status(500).json({ error: 'Error calling n8n webhook', details: error.message });
  }
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    message: 'Bienvenido al servicio de procesamiento de facturas',
    environment: config.environment
  });
});

// Rutas de la API
app.use('/api', invoiceRoutes);

// Manejador de errores 404
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Ruta no encontrada' 
  });
});

// Manejador de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ 
    success: false, 
    error: 'Error interno del servidor' 
  });
});

// Iniciar el servidor
const PORT = config.port || 3000;
app.listen(PORT, () => {
  console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`Modo: ${config.environment}`);
});

module.exports = app; // Para pruebas
