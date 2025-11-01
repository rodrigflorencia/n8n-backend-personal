const axios = require('axios');
require('dotenv').config();

class N8nClient {
  constructor() {
    this.baseURL = process.env.N8N_WEBHOOK_BASE_URL;
    this.demoTokens = {
      'social_media': process.env.DEMO_TOKEN_SOCIAL,
      'invoice_ocr': process.env.DEMO_TOKEN_OCR,
      'contracts': process.env.DEMO_TOKEN_CONTRACTS,
      'lead_generation': process.env.DEMO_TOKEN_LEADS
    };
  }

  // Ejecutar workflow específico
  async executeWorkflow(workflowType, data, clientInfo) {
    const workflowConfig = this.getWorkflowConfig(workflowType);
    
    if (!workflowConfig) {
      throw new Error(`Unknown workflow type: ${workflowType}`);
    }

    // Verificar si el cliente tiene acceso a este workflow
    if (!this.hasWorkflowAccess(clientInfo, workflowType)) {
      throw new Error(`No access to workflow: ${workflowType}`);
    }

    try {
      const response = await axios.post(workflowConfig.url, data, {
        headers: {
          'Content-Type': 'application/json',
          'X-Demo-Token': workflowConfig.token,
          'X-Client-ID': clientInfo.id,
          'User-Agent': 'Nexus-AutoMate-Backend/1.0'
        },
        timeout: 30000 // 30 segundos timeout
      });

      return {
        success: true,
        data: response.data,
        workflow_type: workflowType,
        client_id: clientInfo.id,
        execution_time: new Date().toISOString()
      };

    } catch (error) {
      // Manejar errores específicos de n8n
      if (error.response) {
        if (error.response.status === 403) {
          throw new Error('Demo access expired or invalid');
        }
        if (error.response.status === 429) {
          throw new Error('Workflow rate limit exceeded');
        }
        throw new Error(`Workflow execution failed: ${error.response.data?.message || error.message}`);
      }
      
      throw new Error(`Network error executing workflow: ${error.message}`);
    }
  }

  // Configuraciones de workflows
  getWorkflowConfig(workflowType) {
    const configs = {
      'social_media': {
        url: `${this.baseURL}/demo/social-media`,
        token: this.demoTokens.social_media,
        description: 'Automated social media posting'
      },
      'invoice_ocr': {
        url: `${this.baseURL}/demo/invoice-ocr`, 
        token: this.demoTokens.invoice_ocr,
        description: 'Extract data from invoice images'
      },
      'contracts': {
        url: `${this.baseURL}/demo/contract-fill`,
        token: this.demoTokens.contracts,
        description: 'Automated contract completion'
      },
      'lead_generation': {
        url: `${this.baseURL}/demo/lead-generation`,
        token: this.demoTokens.lead_generation,
        description: 'Find leads with Apify integration'
      }
    };

    return configs[workflowType];
  }

  // Verificar acceso del cliente al workflow
  hasWorkflowAccess(clientInfo, workflowType) {
    if (!clientInfo.workflows || clientInfo.workflows.includes('all')) {
      return true;
    }
    return clientInfo.workflows.includes(workflowType);
  }

  // Obtener workflows disponibles para el cliente
  getAvailableWorkflows(clientInfo) {
    const allWorkflows = Object.keys(this.demoTokens);
    
    if (!clientInfo.workflows || clientInfo.workflows.includes('all')) {
      return allWorkflows.map(type => ({
        type,
        ...this.getWorkflowConfig(type)
      }));
    }

    return clientInfo.workflows
      .filter(type => allWorkflows.includes(type))
      .map(type => ({
        type,
        ...this.getWorkflowConfig(type)
      }));
  }
}

module.exports = N8nClient;
