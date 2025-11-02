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
