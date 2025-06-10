// test-mt5-connection.js
const fetch = require('node-fetch');

async function testConnection() {
  try {
    console.log('Testing MT5 backend connection...');
    
    const response = await fetch('http://localhost:3001/api/mt5/connect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        server: "InterTrader-Server",
        login: "536407",
        password: "-8XfDpHg"
      })
    });
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ Successfully connected to MT5 account!');
      console.log('Account ID:', data.accountId);
      console.log('Balance:', data.balance);
      console.log('Equity:', data.equity);
    } else {
      console.log('❌ Failed to connect to MT5 account');
      console.log('Error:', data.error);
    }
  } catch (error) {
    console.error('Error testing connection:', error);
  }
}

testConnection();
