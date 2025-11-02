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

  async (req, res, next) => {
    try {
   
      const { invoiceImageUrl } = req.body;
   
      const strictCheck = process.env.STRICT_URL_CHECK === 'true';

      // Validar que la URL sea accesible (opcional). Si STRICT_URL_CHECK === 'true', forzar verificación remota.
      if (strictCheck) {
        try {
          const tryHead = async () => {
            return axios.head(invoiceImageUrl, {
              timeout: 5000,
              headers: {
                'User-Agent': 'InvoiceProcessor/1.0',
             
              },
              validateStatus: () => true // queremos leer headers aunque sea 4xx
            });
          };

          const tryGetHeaders = async () => {
            const resp = await axios.get(invoiceImageUrl, {
              timeout: 7000,
              headers: {
                'User-Agent': 'InvoiceProcessor/1.0',
              },
              responseType: 'stream',
              maxBodyLength: 1024 * 1024,
              validateStatus: () => true
            });
            if (resp.data && typeof resp.data.destroy === 'function') {
              // Liberar el stream inmediatamente; sólo necesitamos los headers
              resp.data.destroy();
            }
            return resp;
          };

          let response;
          try {
            response = await tryHead();
          } catch (e) {
            response = null;
          }
          if (!response || !response.headers || !response.headers['content-type']) {
            try {
              response = await tryGetHeaders();
            } catch (e2) {
              response = null;
            }
          }

          if (!response || !response.headers) {
            return next(createError(
              StatusCodes.BAD_REQUEST,
              'No se pudo acceder a la URL proporcionada. Por favor, verifica que sea correcta y esté accesible.'
            ));
          }

          const contentType = response.headers['content-type'] || '';
          if (!contentType.match(/(image\/?|application\/pdf)/)) {
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
      }

      // Enviar a n8n
      const n8nResponse = await axios.post(process.env.N8N_WEBHOOK_URL, {
        
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
