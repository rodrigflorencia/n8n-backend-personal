const express = require('express');
const { body, header } = require('express-validator');
const axios = require('axios');
const createError = require('http-errors');
const { StatusCodes } = require('http-status-codes');
const router = express.Router();

// Validación de campos
const validateRequest = [
  header('x-tenant-id')
    .notEmpty()
    .withMessage('x-tenant-id header es requerido')
    .isAlphanumeric()
    .withMessage('x-tenant-id debe contener solo caracteres alfanuméricos'),
  body('invoiceImageUrl')
    .notEmpty().withMessage('invoiceImageUrl es requerido')
    .isURL().withMessage('invoiceImageUrl debe ser una URL válida')
    .matches(/\.(jpg|jpeg|png|gif|bmp|webp|pdf)$/i)
    .withMessage('La URL debe apuntar a un archivo de imagen o PDF válido')
];

// Middleware para validar que el tenant-id del header coincida con el del body
const validateTenantId = (req, res, next) => {
  const tenantIdHeader = req.headers['x-tenant-id'];
  const tenantIdBody = req.body.tenantId; // Si también lo envías en el body
  
  if (tenantIdBody && tenantIdHeader !== tenantIdBody) {
    return next(createError(
      StatusCodes.BAD_REQUEST,
      'El tenant-id del header no coincide con el del cuerpo de la solicitud'
    ));
  }
  
  next();
};

// Endpoint para procesar facturas
router.post('/process-invoice', 
  validateRequest,
  validateTenantId,
  async (req, res, next) => {
    try {
      const tenantId = req.headers['x-tenant-id'];
      const { invoiceImageUrl } = req.body;
      const clientId = req.clientId; // Obtenido del middleware de autenticación

      // Validar que la URL sea accesible
      try {
        const response = await axios.head(invoiceImageUrl, {
          timeout: 5000,
          headers: {
            'User-Agent': 'InvoiceProcessor/1.0'
          }
        });
        
        const contentType = response.headers['content-type'] || '';
        if (!contentType.match(/(image\/|application\/pdf)/)) {
          return next(createError(
            StatusCodes.BAD_REQUEST,
            'La URL no apunta a un archivo de imagen o PDF válido'
          ));
        }
      } catch (error) {
        return next(createError(
          StatusCodes.BAD_REQUEST,
          'No se pudo acceder a la URL proporcionada. Por favor, verifica que sea correcta y esté accesible.'
        ));
      }

      // Enviar a n8n
      const n8nResponse = await axios.post(process.env.N8N_WEBHOOK_URL, {
        tenant_id: tenantId,
        client_id: clientId,
        invoice_image_url: invoiceImageUrl,
        timestamp: new Date().toISOString()
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-Request-Source': 'invoice-processor'
        },
        timeout: 10000 // 10 segundos de timeout
      });

      // Registrar la solicitud exitosa
      req.logger.info('Factura procesada exitosamente', {
        clientId,
        tenantId,
        url: invoiceImageUrl
      });

      // Devolver la respuesta de n8n
      res.status(StatusCodes.OK).json({
        success: true,
        data: n8nResponse.data
      });

    } catch (error) {
      // Pasar el error al manejador de errores
      next(error);
    }
  }
);

module.exports = router;