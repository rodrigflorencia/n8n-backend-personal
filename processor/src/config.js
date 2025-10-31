require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL,
  environment: process.env.NODE_ENV || 'development'
};