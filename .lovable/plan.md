
## Prediction Markets Trading Integration

### 1. Database: `user_market_credentials` table
- Store encrypted API keys per user per platform (Polymarket, Kalshi, PredictIt)
- Columns: user_id, platform, encrypted_key, encrypted_secret, label, is_active, created_at
- RLS: users can only CRUD their own credentials

### 2. Edge Function: `market-trading`
- Proxy trading requests to each platform's API
- Decrypt user credentials server-side using existing `INTEGRATION_ENCRYPTION_KEY`
- Endpoints:
  - `GET /portfolio` — fetch positions/holdings
  - `POST /order` — place buy/sell orders  
  - `DELETE /order` — cancel orders
  - `GET /orders` — list open orders
- Input validation with Zod, JWT auth required

### 3. UI: Trading Dashboard Component
- API key management section in user profile/settings
- Add/remove keys for each platform
- Portfolio view showing current positions & P&L
- Order placement form integrated into PredictionMarketsPanel
- Order history table

### 4. Security
- Keys encrypted at rest (AES-256-GCM) reusing existing vault pattern
- Server-side only decryption — keys never sent back to client
- Rate limiting on order placement
