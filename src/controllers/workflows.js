const N8nClient = require('../utils/n8nClient');
const { generateDemoToken } = require('../middleware/auth');

const n8nClient = new N8nClient();

// Generar token de demo para nuevos clientes
const createDemoAccess = async (req, res) => {
  try {
    const { email, company, workflow_interests = ['all'] } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: "Email required",
        message: "Please provide your email to start the demo"
      });
    }

    // Generar ID único para el cliente
    const clientId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generar token JWT para 7 días
    const demoToken = generateDemoToken(clientId, workflow_interests);
    
    // Aquí podrías guardar el cliente en Supabase
    // await saveClientToDatabase({ clientId, email, company, workflow_interests });

    res.json({
      success: true,
      message: "Demo access created successfully!",
      demo_token: demoToken,
      client_id: clientId,
      expires_in: "7 days",
      available_workflows: n8nClient.getAvailableWorkflows({ workflows: workflow_interests }),
      instructions: "Use this token in the Authorization header: Bearer [token]"
    });

  } catch (error) {
    console.error('Error creating demo access:', error);
    res.status(500).json({ 
      error: "Internal server error",
      message: "Could not create demo access. Please try again."
    });
  }
};

// Ejecutar workflow específico
const executeWorkflow = async (req, res) => {
  try {
    const { workflow_type, data } = req.body;
    const clientInfo = req.client; // Del middleware de auth

    if (!workflow_type) {
      return res.status(400).json({
        error: "Workflow type required",
        available_workflows: n8nClient.getAvailableWorkflows(clientInfo)
      });
    }

    // Ejecutar workflow en n8n
    const result = await n8nClient.executeWorkflow(workflow_type, data, clientInfo);
    
    // Log de uso (aquí podrías guardar en Supabase)
    console.log(`Workflow executed: ${workflow_type} by client: ${clientInfo.id}`);

    res.json(result);

  } catch (error) {
    console.error('Workflow execution error:', error);
    
    if (error.message.includes('No access')) {
      return res.status(403).json({
        error: "Access denied",
        message: error.message,
        available_workflows: n8nClient.getAvailableWorkflows(req.client)
      });
    }

    if (error.message.includes('expired')) {
      return res.status(401).json({
        error: "Demo expired", 
        message: error.message,
        upgrade_url: "https://contact"
      });
    }

    res.status(500).json({
      error: "Execution failed",
      message: error.message
    });
  }
};

// Obtener información del cliente y workflows disponibles
const getClientInfo = async (req, res) => {
  try {
    const clientInfo = req.client;
    const availableWorkflows = n8nClient.getAvailableWorkflows(clientInfo);
    
    res.json({
      client_id: clientInfo.id,
      type: clientInfo.type,
      created_at: new Date(clientInfo.createdAt * 1000).toISOString(),
      expires_at: new Date(clientInfo.expiresAt * 1000).toISOString(),
      available_workflows: availableWorkflows,
      usage_info: {
        demo_period_remaining: Math.max(0, clientInfo.expiresAt * 1000 - Date.now()),
        workflows_accessible: availableWorkflows.length
      }
    });
  } catch (error) {
    console.error('Error getting client info:', error);
    res.status(500).json({ error: "Could not retrieve client information" });
  }
};

module.exports = {
  createDemoAccess,
  executeWorkflow, 
  getClientInfo
};
