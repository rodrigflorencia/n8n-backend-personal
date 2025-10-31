const express = require('express');
const { body, header } = require('express-validator');
const axios = require('axios');
const router = express.Router();

// Validación de campos
const validateRequest = [
  header('x-tenant-id').notEmpty().withMessage('x-tenant-id header is required'),
  body('invoiceImageUrl')
    .notEmpty().withMessage('invoiceImageUrl is required')
    .isURL().withMessage('invoiceImageUrl must be a valid URL')
    .matches(/\.(jpg|jpeg|png|gif|bmp|webp|pdf)$/i)
    .withMessage('URL must point to a valid image or PDF file')
];

// Endpoint para procesar facturas
router.post('/process-invoice', validateRequest, async (req, res) => {
  try {
    const tenantId = req.headers['x-tenant-id'];
    const { invoiceImageUrl } = req.body;

    // Validar que la URL sea accesible
    try {
      const response = await axios.head(invoiceImageUrl, {
        timeout: 5000 // 5 segundos de timeout
      });
      
      if (!response.headers['content-type'] || 
          !response.headers['content-type'].match(/(image|application\/pdf)/)) {
        return res.status(400).json({ 
          success: false, 
          error: 'URL does not point to a valid image or PDF file' 
        });
      }
    } catch (error) {
      console.error('Error al validar la URL de la imagen:', error.message);
      return res.status(400).json({ 
        success: false, 
        error: 'Could not access the provided URL. Please check if the URL is correct and accessible.' 
      });
    }

    // Enviar a n8n
    const n8nResponse = await axios.post(process.env.N8N_WEBHOOK_URL, {
      tenant_id: tenantId,
      invoice_image_url: invoiceImageUrl,
      timestamp: new Date().toISOString()
    });

    // Devolver la respuesta de n8n
    res.status(n8nResponse.status).json({
      success: true,
      data: n8nResponse.data
    });

  } catch (error) {
    console.error('Error al procesar la factura:', error.message);
    
    if (error.response) {
      // Error de respuesta de n8n
      res.status(error.response.status).json({
        success: false,
        error: error.response.data || 'Error al procesar la factura en el servidor remoto'
      });
    } else if (error.request) {
      // No se recibió respuesta del servidor n8n
      res.status(502).json({
        success: false,
        error: 'No se pudo conectar con el servicio de procesamiento. Por favor, intente más tarde.'
      });
    } else {
      // Error en la configuración de la solicitud
      res.status(500).json({
        success: false,
        error: 'Error interno del servidor al procesar la solicitud'
      });
    }
  }
});

module.exports = router;
