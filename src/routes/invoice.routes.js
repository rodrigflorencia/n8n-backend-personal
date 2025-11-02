const express = require('express');
const { body, header } = require('express-validator');
const axios = require('axios');


const router = express.Router();

// Validación de campos
const validateRequest = [
];

// Endpoint para procesar facturas
router.post('/process-invoice', validateRequest, async (req, res) => {
  try {
    const { invoiceImageUrl } = req.body;
  }}
