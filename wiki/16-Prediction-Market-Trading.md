# Feature: Prediction Market Trading

## Description

OppoDB integrates with multiple prediction market platforms (Kalshi, Polymarket, PredictIt) to provide real-time market data viewing **and** active trading capabilities. Users can store encrypted API credentials, view their portfolio positions, manage open orders, and place new trades — all from within the application.

---

## Architecture Overview

```
┌──────────────────────┐     ┌─────────────────────────────┐
│  MarketCredentials    │────►│  market-trading Edge Fn     │
│  Manager (Profile)    │     │  ┌─────────────────────┐    │
└──────────────────────┘     │  │ AES-256-GCM Encrypt │    │
                              │  └─────────────────────┘    │
┌──────────────────────┐     │  ┌─────────────────────┐    │
│  MarketTradingPanel   │────►│  │ Platform Routers:   │    │
│  (Prediction Markets) │     │  │ ├── Kalshi API      │    │
└──────────────────────┘     │  │ ├── Polymarket CLOB │    │
                              │  │ └── PredictIt       │    │
                              │  └─────────────────────┘    │
                              │           │                  │
                              │  ┌────────▼──────────┐      │
                              │  │ user_market_       │      │
                              │  │ credentials (DB)   │      │
                              │  └───────────────────┘      │
                              └─────────────────────────────┘
```

---

## Database: `user_market_credentials`

Stores encrypted API credentials per user per platform.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Owner (references auth.users) |
| `platform` | TEXT | `polymarket`, `kalshi`, or `predictit` |
| `encrypted_key` | TEXT | AES-256-GCM encrypted API key/email |
| `encrypted_secret` | TEXT | AES-256-GCM encrypted secret/password (nullable) |
| `encrypted_passphrase` | TEXT | AES-256-GCM encrypted passphrase (nullable) |
| `label` | TEXT | User-defined label (default: "Default") |
| `is_active` | BOOLEAN | Whether credentials are active |
| `created_at` | TIMESTAMPTZ | Record creation time |
| `updated_at` | TIMESTAMPTZ | Last update time |

**Constraints:**
- `UNIQUE (user_id, platform)` — One credential set per platform per user
- `CHECK (platform IN ('polymarket', 'kalshi', 'predictit'))`

### Row-Level Security

All policies scoped to `auth.uid() = user_id`:
- **SELECT**: Users can only read their own credentials
- **INSERT**: Users can only create credentials for themselves
- **UPDATE**: Users can only modify their own credentials
- **DELETE**: Users can only remove their own credentials

Credentials are **never** returned in decrypted form to the client.

---

## Edge Function: `market-trading`

### Endpoint
```
POST/GET /functions/v1/market-trading?action=<action>&platform=<platform>
```

### Authentication
All requests require a valid JWT via `Authorization: Bearer <token>`. The function verifies the token using `getClaims()` for cryptographic signature validation.

### Actions

#### Credential Management

| Action | Method | Description |
|--------|--------|-------------|
| `save-credentials` | POST | Encrypt and store/upsert API credentials |
| `list-credentials` | GET | List platforms with active credentials (no secrets returned) |
| `delete-credentials` | POST | Remove credentials for a platform |

#### Trading Operations

| Action | Method | Description |
|--------|--------|-------------|
| `portfolio` | GET | Fetch positions and balance |
| `orders` | GET | List open/pending orders |
| `place-order` | POST | Submit a new order |
| `cancel-order` | POST | Cancel an open order (requires `order_id` param) |

### Encryption

Uses the same AES-256-GCM encryption as the existing `credential-vault` function:

```typescript
// Encryption flow
1. getEncryptionKey() — Derives CryptoKey from INTEGRATION_ENCRYPTION_KEY (64-char hex)
2. encryptValue(plaintext) — Generates random 12-byte IV, encrypts, returns base64(iv + ciphertext)
3. decryptValue(encrypted) — Extracts IV, decrypts, returns plaintext
```

The `INTEGRATION_ENCRYPTION_KEY` environment variable (256-bit hex string) is shared with the credential vault.

---

## Platform-Specific API Integration

### Kalshi

**Authentication**: Email + password login → session token
```
Base URL: https://api.elections.kalshi.com/trade-api/v2
```

| Credential Field | Maps To |
|-----------------|---------|
| `api_key` | Kalshi account email |
| `api_secret` | Kalshi account password |

**Endpoints Used:**
- `POST /login` — Authenticate and obtain bearer token
- `GET /portfolio/positions` — Current market positions
- `GET /portfolio/balance` — Account balance (in cents)
- `GET /portfolio/orders` — Open orders
- `POST /portfolio/orders` — Place new order
- `DELETE /portfolio/orders/{order_id}` — Cancel order

**Order Schema (Kalshi):**
```json
{
  "ticker": "PRES-2026-DEM",
  "action": "buy",
  "side": "yes",
  "type": "limit",
  "count": 10,
  "yes_price": 50
}
```

### Polymarket

**Authentication**: API key (wallet address or CLOB key)
```
Base URL: https://clob.polymarket.com
```

| Credential Field | Maps To |
|-----------------|---------|
| `api_key` | CLOB API key or wallet address |
| `api_secret` | Optional API secret |

**Endpoints Used:**
- `GET /orders?owner={apiKey}` — Portfolio positions and open orders
- `POST /order` — Place new order
- `DELETE /order/{order_id}` — Cancel order

**Order Schema (Polymarket):**
```json
{
  "tokenID": "0x...",
  "side": "BUY",
  "price": 0.50,
  "size": 10
}
```

### PredictIt

**Authentication**: Session cookie from browser login
```
Base URL: https://www.predictit.org/api
```

| Credential Field | Maps To |
|-----------------|---------|
| `api_key` | Browser session cookie string |

**Endpoints Used:**
- `GET /Profile/Shares` — Current share holdings
- `GET /Profile/MyOffers` — Open buy/sell offers
- `POST /Trade/SubmitTrade` — Submit a trade
- `POST /Trade/CancelOffer/{offerId}` — Cancel an offer

---

## UI Components

### `MarketCredentialsManager` (Profile Page)

Located in the user Profile page under "Prediction Market API Keys".

**Features:**
- List connected platforms with status indicators (green dot = connected)
- Add new platform credentials with per-platform form fields
- Show/hide secret field values (eye toggle)
- Remove platform credentials
- Visual feedback for save/delete operations

**Platform Form Fields:**

| Platform | Field 1 | Field 2 |
|----------|---------|---------|
| Kalshi | Email | Password |
| Polymarket | API Key / Wallet Address | API Secret (optional) |
| PredictIt | Session Cookie | — |

### `MarketTradingPanel` (Prediction Markets Section)

Embedded at the bottom of the Prediction Markets panel, below the market data tables.

**Features:**
- **Platform Tabs**: Switch between connected platforms (Kalshi, Polymarket, PredictIt)
- **Portfolio Tab**: View current positions with market ticker, quantity, and price; account balance display (Kalshi)
- **Orders Tab**: View open orders with side (YES/NO color-coded), price, quantity; cancel individual orders
- **Trade Tab**: Order placement form with ticker/token input, YES/NO side selector, price input (cents for Kalshi, dollars for Polymarket), quantity input, and real-time order result feedback
- **Refresh Button**: Re-fetch portfolio or orders on demand
- **Empty State**: Shows prompt to add API keys when no platforms are connected

---

## Security Considerations

1. **Encryption at Rest**: All API keys encrypted with AES-256-GCM before database storage
2. **Server-Side Only Decryption**: Credentials are only decrypted within the edge function — never sent back to the client
3. **RLS Isolation**: Users can only access their own credentials via row-level security
4. **JWT Authentication**: All trading operations require valid, signature-verified JWT tokens
5. **No Credential Leakage**: The `list-credentials` endpoint returns only metadata (platform, label, dates) — never encrypted values
6. **Service Role for Upsert**: Credential upserts use service-role client to handle the `ON CONFLICT` clause reliably

---

## Data Flow: Placing an Order

```
1. User fills order form in MarketTradingPanel
2. Client sends POST to market-trading?action=place-order&platform=kalshi
3. Edge function validates JWT via getClaims()
4. Fetches encrypted credentials from user_market_credentials (service role)
5. Decrypts API key and secret using AES-256-GCM
6. Authenticates with platform API (e.g., Kalshi login)
7. Submits order to platform API
8. Logs trade to `trade_history` table (service role insert)
9. Returns order confirmation or error to client
10. Credentials are never cached — decrypted fresh per request
```

---

## Trade History & P&L Tracking

### Database: `trade_history`

Stores every trade placed through the platform for auditing and P&L tracking.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | Trader |
| `platform` | TEXT | `polymarket`, `kalshi`, or `predictit` |
| `market_id` | TEXT | Platform-specific market identifier |
| `market_title` | TEXT | Human-readable market name |
| `side` | TEXT | Trade direction (buy_yes, buy_no, sell, etc.) |
| `price` | NUMERIC | Price per contract/share |
| `quantity` | NUMERIC | Number of contracts |
| `total_cost` | NUMERIC | price × quantity |
| `order_type` | TEXT | `limit` (default) or `market` |
| `order_id` | TEXT | Platform-assigned order ID |
| `status` | TEXT | `submitted`, `filled`, `cancelled` |
| `pnl` | NUMERIC | Realized profit/loss (updated on settlement) |
| `fees` | NUMERIC | Platform fees |
| `raw_response` | JSONB | Full API response from platform |
| `created_at` | TIMESTAMPTZ | When the trade was placed |
| `settled_at` | TIMESTAMPTZ | When the trade settled (nullable) |

### Row-Level Security

- **SELECT**: All authenticated users can read all trades (public trade feed)
- **INSERT/UPDATE**: Service role only — trades are logged server-side by the edge function

### UI: `TradeHistoryPanel`

Embedded in the Prediction Markets section with two viewing modes:
- **All Trades**: Public feed showing recent trades across all users (anonymized)
- **My Trades**: Filtered to show only the current user's trade history

### Edge Function Actions

| Action | Method | Description |
|--------|--------|-------------|
| `trade-history` | GET | Fetch authenticated user's own trades |
| `public-trade-feed` | GET | Fetch recent trades (all users, limited fields) |

---

## Prediction Market Data Sync

In addition to trading, the `prediction-markets-sync` edge function fetches public market data from multiple sources:

| Source | Markets Synced | Method |
|--------|---------------|--------|
| Polymarket | ~50 | REST API (Gamma endpoint) |
| Kalshi | ~109 | REST API (events endpoint) |
| PredictIt | ~252 | REST API (all markets) |
| Manifold | ~337 | REST API (politics group) |
| Metaculus | Requires API token | REST API v2 |

This data populates the `prediction_markets` table for the read-only market data display (charts, tables, filters) shown above the trading panel.
