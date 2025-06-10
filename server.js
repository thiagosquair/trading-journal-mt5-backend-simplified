// server.js
const express = require('express');
const cors = require('cors');
const MetaApi = require('metaapi.cloud-sdk').default;
require('dotenv').config();

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Initialize MetaAPI
const token = process.env.META_API_TOKEN;
const api = new MetaApi(token);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'MT5 Backend Service is running' });
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
      // Try to find existing account
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
      account = await api.metatraderAccountApi.createAccount({
        name: `MT5 Account ${login}`,
        type: 'cloud',
        login: login.toString(),
        password,
        server,
        platform: 'mt5'
      });
      console.log(`Created new account with id: ${account.id}`);
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
        error: connectionError.message || 'Failed to connect to MT5 account' 
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

// Get account information endpoint
app.get('/api/mt5/account-info/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }
    
    console.log(`Getting account info for: ${accountId}`);
    
    // Get the account
    const account = await api.metatraderAccountApi.getAccount(accountId);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Check if account is connected
    if (!account.connected) {
      return res.status(400).json({ error: 'Account is not connected' });
    }
    
    // Get account information
    const connection = account.getRPCConnection();
    const accountInfo = await connection.getAccountInformation();
    
    return res.json({
      success: true,
      ...accountInfo,
      message: 'Account information retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting account info:', error);
    return res.status(500).json({ error: error.message || 'An unexpected error occurred' });
  }
});

// Get trading history endpoint
app.get('/api/mt5/history/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    const { startTime, endTime, limit } = req.query;
    
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }
    
    console.log(`Getting trading history for: ${accountId}`);
    
    // Get the account
    const account = await api.metatraderAccountApi.getAccount(accountId);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Check if account is connected
    if (!account.connected) {
      return res.status(400).json({ error: 'Account is not connected' });
    }
    
    // Get trading history
    const connection = account.getRPCConnection();
    const history = await connection.getHistoryOrdersByTimeRange({
      startTime: startTime ? new Date(startTime) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Default to last 30 days
      endTime: endTime ? new Date(endTime) : new Date(),
      limit: limit ? parseInt(limit) : 1000
    });
    
    return res.json({
      success: true,
      history,
      message: 'Trading history retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting trading history:', error);
    return res.status(500).json({ error: error.message || 'An unexpected error occurred' });
  }
});

// Disconnect from MT5 account endpoint
app.post('/api/mt5/disconnect/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    if (!accountId) {
      return res.status(400).json({ error: 'Account ID is required' });
    }
    
    console.log(`Disconnecting account: ${accountId}`);
    
    // Get the account
    const account = await api.metatraderAccountApi.getAccount(accountId);
    
    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }
    
    // Undeploy the account
    await account.undeploy();
    
    return res.json({
      success: true,
      message: 'Disconnected from MT5 account successfully'
    });
  } catch (error) {
    console.error('Error disconnecting account:', error);
    return res.status(500).json({ error: error.message || 'An unexpected error occurred' });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`MT5 Backend Service running on port ${PORT}`);
});
