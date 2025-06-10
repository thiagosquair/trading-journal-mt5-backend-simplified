// server.js - Alternative version without dotenv dependency
const express = require('express');
const cors = require('cors');
const MetaApi = require('metaapi.cloud-sdk').default;

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Enhanced logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`, {
    query: req.query,
    body: req.method !== 'GET' ? req.body : undefined
  });
  next();
});

// Initialize MetaAPI - Railway provides environment variables directly
const token = process.env.META_API_TOKEN;

if (!token) {
  console.error('ERROR: META_API_TOKEN environment variable is not set');
  process.exit(1);
}

console.log('Initializing MetaApi with token:', token.substring(0, 10) + '...');
const api = new MetaApi(token);

// Enhanced health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      hasMetaApiToken: !!token
    },
    services: {}
  };
  
  // Check MetaApi connectivity
  try {
    const accounts = await api.metatraderAccountApi.getAccounts();
    health.services.metaapi = {
      status: 'connected',
      accountCount: accounts.length
    };
  } catch (error) {
    console.error('MetaApi health check failed:', error);
    health.services.metaapi = {
      status: 'error',
      message: error.message
    };
  }
  
  const hasErrors = Object.values(health.services).some(service => service.status === 'error');
  
  res.status(hasErrors ? 503 : 200).json(health);
});

// Connect to MT5 account endpoint
app.post('/api/mt5/connect', async (req, res) => {
  try {
    const { server, login, password } = req.body;
    
    if (!server || !login || !password) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: server, login, and password are required' 
      });
    }
    
    console.log(`Connecting to MT5 account: ${login}@${server}`);
    
    // Check if account already exists
    let account;
    try {
      const accounts = await api.metatraderAccountApi.getAccounts();
      account = accounts.find(acc => 
        acc.login === login.toString() && 
        acc.server.toLowerCase() === server.toLowerCase()
      );
      
      if (account) {
        console.log(`Found existing account with id: ${account.id}`);
      }
    } catch (error) {
      console.error('Error finding existing account:', error);
    }
    
    // If account doesn't exist, create it
    if (!account) {
      console.log('Creating new MT5 account connection');
      try {
        account = await api.metatraderAccountApi.createAccount({
          name: `MT5 Account ${login}`,
          type: 'cloud',
          login: login.toString(),
          password,
          server,
          platform: 'mt5'
        });
        console.log(`Created new account with id: ${account.id}`);
      } catch (createError) {
        console.error('Error creating account:', createError);
        return res.status(500).json({ 
          success: false, 
          error: `Failed to create account: ${createError.message}` 
        });
      }
    }
    
    // Deploy and connect to the account
    try {
      if (!account.deployed) {
        console.log('Deploying account');
        await account.deploy();
      } else {
        console.log('Account already deployed');
      }
      
      console.log('Waiting for account to connect');
      await account.waitConnected(60);
      
      // Get account information
      console.log('Getting account information');
      const connection = account.getRPCConnection();
      const accountInfo = await connection.getAccountInformation();
      
      return res.json({
        success: true,
        accountId: account.id,
        ...accountInfo,
        message: 'Connected to MT5 account successfully'
      });
    } catch (connectionError) {
      console.error('Error connecting to account:', connectionError);
      return res.status(500).json({ 
        success: false, 
        error: `Connection failed: ${connectionError.message}` 
      });
    }
  } catch (error) {
    console.error('Error in MT5 connect API:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'An unexpected error occurred' 
    });
  }
});

// Get account information endpoint with enhanced error handling
app.get('/api/mt5/account-info', async (req, res) => {
  try {
    const { accountId } = req.query;
    
    if (!accountId) {
      return res.status(400).json({ 
        success: false,
        error: 'Account ID is required as query parameter' 
      });
    }
    
    console.log(`Getting account info for: ${accountId}`);
    
    // Get the account with detailed error logging
    let account;
    try {
      account = await api.metatraderAccountApi.getAccount(accountId);
    } catch (apiError) {
      console.error('MetaApi getAccount error:', {
        message: apiError.message,
        stack: apiError.stack
      });
      return res.status(500).json({ 
        success: false,
        error: `Failed to retrieve account: ${apiError.message}` 
      });
    }
    
    if (!account) {
      return res.status(404).json({ 
        success: false,
        error: 'Account not found' 
      });
    }
    
    // Check connection status
    if (!account.connected) {
      console.log('Account not connected, attempting to connect...');
      try {
        if (!account.deployed) {
          await account.deploy();
        }
        await account.waitConnected(30);
      } catch (connectionError) {
        console.error('Connection timeout:', connectionError);
        return res.status(400).json({ 
          success: false,
          error: `Account connection failed: ${connectionError.message}` 
        });
      }
    }
    
    // Get account information
    let accountInfo;
    try {
      const connection = account.getRPCConnection();
      accountInfo = await connection.getAccountInformation();
    } catch (infoError) {
      console.error('Account info retrieval error:', {
        message: infoError.message,
        stack: infoError.stack
      });
      return res.status(500).json({ 
        success: false,
        error: `Failed to get account information: ${infoError.message}` 
      });
    }
    
    return res.json({
      success: true,
      ...accountInfo,
      message: 'Account information retrieved successfully'
    });
    
  } catch (error) {
    console.error('Unexpected error in account-info endpoint:', {
      message: error.message,
      stack: error.stack
    });
    return res.status(500).json({ 
      success: false,
      error: 'An unexpected error occurred' 
    });
  }
});

// Get trading history endpoint with enhanced error handling
app.get('/api/mt5/history', async (req, res) => {
  try {
    const { accountId, startDate, endDate } = req.query;
    
    if (!accountId) {
      return res.status(400).json({ 
        success: false,
        error: 'Account ID is required as query parameter' 
      });
    }
    
    console.log(`Getting trading history for: ${accountId}`);
    
    // Get the account
    let account;
    try {
      account = await api.metatraderAccountApi.getAccount(accountId);
    } catch (apiError) {
      console.error('MetaApi getAccount error:', apiError);
      return res.status(500).json({ 
        success: false,
        error: `Failed to retrieve account: ${apiError.message}` 
      });
    }
    
    if (!account) {
      return res.status(404).json({ 
        success: false,
        error: 'Account not found' 
      });
    }
    
    // Check if account is connected
    if (!account.connected) {
      console.log('Account not connected, attempting to connect...');
      try {
        if (!account.deployed) {
          await account.deploy();
        }
        await account.waitConnected(30);
      } catch (connectionError) {
        console.error('Connection timeout:', connectionError);
        return res.status(400).json({ 
          success: false,
          error: `Account connection failed: ${connectionError.message}` 
        });
      }
    }
    
    // Get trading history
    let history;
    try {
      const connection = account.getRPCConnection();
      history = await connection.getHistoryOrdersByTimeRange({
        startTime: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endTime: endDate ? new Date(endDate) : new Date(),
        limit: 1000
      });
    } catch (historyError) {
      console.error('History retrieval error:', historyError);
      return res.status(500).json({ 
        success: false,
        error: `Failed to get trading history: ${historyError.message}` 
      });
    }
    
    return res.json({
      success: true,
      history,
      message: 'Trading history retrieved successfully'
    });
  } catch (error) {
    console.error('Unexpected error in history endpoint:', error);
    return res.status(500).json({ 
      success: false,
      error: 'An unexpected error occurred' 
    });
  }
});

// Disconnect from MT5 account endpoint
app.post('/api/mt5/disconnect', async (req, res) => {
  try {
    const { accountId } = req.body;
    
    if (!accountId) {
      return res.status(400).json({ 
        success: false,
        error: 'Account ID is required' 
      });
    }
    
    console.log(`Disconnecting account: ${accountId}`);
    
    // Get the account
    let account;
    try {
      account = await api.metatraderAccountApi.getAccount(accountId);
    } catch (apiError) {
      console.error('MetaApi getAccount error:', apiError);
      return res.status(500).json({ 
        success: false,
        error: `Failed to retrieve account: ${apiError.message}` 
      });
    }
    
    if (!account) {
      return res.status(404).json({ 
        success: false,
        error: 'Account not found' 
      });
    }
    
    // Undeploy the account
    try {
      await account.undeploy();
    } catch (undeployError) {
      console.error('Undeploy error:', undeployError);
      return res.status(500).json({ 
        success: false,
        error: `Failed to disconnect: ${undeployError.message}` 
      });
    }
    
    return res.json({
      success: true,
      message: 'Disconnected from MT5 account successfully'
    });
  } catch (error) {
    console.error('Unexpected error in disconnect endpoint:', error);
    return res.status(500).json({ 
      success: false,
      error: 'An unexpected error occurred' 
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`MT5 Backend Service running on port ${PORT}`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
});

