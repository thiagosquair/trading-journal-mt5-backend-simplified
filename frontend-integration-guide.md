# Frontend Integration Guide

## Overview
This document explains how to integrate your Next.js frontend with the MT5 backend service.

## Architecture
The new architecture uses a two-tier approach:
- **Backend Service**: Handles all MT5 connections and MetaAPI SDK interactions
- **Frontend**: Makes HTTP requests to the backend service via API routes

## Environment Variables

### Frontend (.env.local)
```
# MT5 Backend Service URL
MT5_BACKEND_URL=http://localhost:3001

# For production deployment, use your backend service URL
# MT5_BACKEND_URL=https://your-backend-service.com
```

### Backend (.env)
```
META_API_TOKEN=your_metaapi_token_here
PORT=3001
```

## API Endpoints

### 1. Connect to MT5 Account
**POST** `/api/mt5/connect`

Request body:
```json
{
  "name": "Account Name",
  "server": "InterTrader-Server",
  "login": "536407",
  "password": "your_password",
  "saveCredentials": true
}
```

Response:
```json
{
  "success": true,
  "accountId": "account_id",
  "balance": 27544.7,
  "equity": 12759.73,
  "currency": "GBP",
  "leverage": "1:30",
  "margin": 1500.25,
  "freeMargin": 11259.48,
  "marginLevel": 850.5,
  "message": "Connected to MT5 account successfully"
}
```

### 2. Get Account Information
**GET** `/api/mt5/account-info?accountId=account_id`

Response:
```json
{
  "balance": 27544.7,
  "equity": 12759.73,
  "currency": "GBP",
  "leverage": "1:30",
  "margin": 1500.25,
  "freeMargin": 11259.48,
  "marginLevel": 850.5,
  "server": "InterTrader-Server",
  "message": "Account information retrieved successfully"
}
```

### 3. Get Trade History
**GET** `/api/mt5/history?accountId=account_id`

Response:
```json
{
  "deals": [
    {
      "id": "1",
      "symbol": "GBPUSD",
      "type": "BUY",
      "openTime": "2025-05-20T10:30:00Z",
      "closeTime": "2025-05-20T14:45:00Z",
      "openPrice": 1.265,
      "closePrice": 1.268,
      "volume": 0.5,
      "profit": 150.0,
      "commission": 5.0,
      "swap": -2.5,
      "pips": 30,
      "status": "CLOSED"
    }
  ],
  "message": "Trade history retrieved successfully"
}
```

### 4. Disconnect Account
**POST** `/api/mt5/disconnect`

Request body:
```json
{
  "accountId": "account_id"
}
```

Response:
```json
{
  "success": true,
  "message": "Account disconnected successfully"
}
```

## Error Handling

All endpoints return appropriate HTTP status codes and error messages:

- **400**: Bad Request (missing required fields)
- **404**: Not Found (account not found)
- **500**: Internal Server Error
- **503**: Service Unavailable (backend service not running)

Example error response:
```json
{
  "error": "MT5 backend service is not available. Please ensure the backend server is running on port 3001."
}
```

## Testing the Integration

1. Start the backend service:
```bash
cd /path/to/trading-journal-mt5-backend
node server.js
```

2. Start your Next.js frontend:
```bash
cd /path/to/your-frontend
npm run dev
```

3. Test the connection through your frontend UI or directly via API calls.

## Deployment Considerations

### Development
- Backend runs on `http://localhost:3001`
- Frontend connects to backend via `MT5_BACKEND_URL` environment variable

### Production
- Deploy backend service to a cloud provider (Heroku, Railway, etc.)
- Update `MT5_BACKEND_URL` in your Vercel environment variables
- Ensure CORS is properly configured in the backend for your frontend domain

## Benefits of This Architecture

1. **SSR Compatibility**: No more "window is not defined" errors
2. **Serverless Friendly**: Works with Vercel's serverless functions
3. **Separation of Concerns**: MT5 logic is isolated from frontend
4. **Scalability**: Backend can be scaled independently
5. **Security**: MetaAPI token is only stored in backend environment

