# Feature: API Access

## Description

OppoDB provides a public REST API and MCP (Model Context Protocol) server that allow authenticated users to programmatically access the database. API access is available to premium users and above, enabling integration with external tools, scripts, and AI agents.

---

## API Key Management (`ApiPage`)

### Access Control
- **User**: No API access (sees "Premium Access Required" message)
- **Premium+**: Full API access

### Create API Key
Users can generate named API keys:
1. Click "Generate New API Key"
2. Enter a descriptive key name (e.g., "Production Bot", "Claude Desktop")
3. Click "Create"
4. **Critical**: The full key is shown ONCE — users must copy it immediately (yellow warning banner)
5. Key is stored hashed in the database (only prefix visible afterward)

### Key Management
For each key, users can:
- View key name and creation date
- See request count and last used timestamp
- **Revoke** — disables the key (soft delete via `revoked_at` timestamp)
- **Delete** — permanently removes the key

### Active vs Revoked Keys
- Active keys shown at top with full functionality
- Revoked keys shown separately (grayed out) for historical reference

---

## API Key Data Model

```typescript
interface ApiKey {
  id: string;
  user_id: string;
  name: string;
  key_prefix: string;        // First 8 chars visible (e.g., "opdb_sk_...")
  key_hash: string;          // SHA-256 hashed value stored in DB
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  request_count: number;
}
```

### Database Functions
```sql
-- Validate API key by hash lookup
validate_api_key(p_key_hash text) RETURNS TABLE(user_id uuid, key_id uuid)

-- Increment usage counter atomically
increment_api_key_usage(p_key_id uuid) RETURNS void

-- Log API request with full audit trail
log_api_request(p_key_id uuid, p_user_id uuid, p_endpoint text, p_status integer)
```

---

## Public REST API

### Base URL
```
https://yysbtxpupmwkxovgkama.supabase.co/functions/v1/public-api
```

### Authentication
All API requests require the `X-API-Key` header:
```bash
curl -H "X-API-Key: YOUR_API_KEY" \
  https://[base-url]/public-api/candidates
```

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates` | All candidate profiles |
| GET | `/districts` | All congressional district profiles |
| GET | `/state-legislative` | All state legislative district profiles |
| GET | `/election-results` | Congressional election results |
| GET | `/polling` | Polling data |
| GET | `/maga-files` | MAGA files |
| GET | `/narrative-reports` | Narrative reports |
| GET | `/local-impacts` | Local impact reports |
| GET | `/campaign-finance` | Campaign finance records |
| GET | `/congress-members` | Congress.gov member data |
| GET | `/congress-bills` | Federal bill data |

### Response Format
All endpoints return JSON:
```json
{
  "data": [...],
  "count": 123,
  "source": "OppoDB"
}
```

### Error Responses
```json
// 401 Unauthorized
{ "error": "Invalid or missing API key" }

// 429 Too Many Requests
{ "error": "Rate limit exceeded" }

// 500 Internal Server Error
{ "error": "Internal server error" }
```

---

## MCP Server (Model Context Protocol)

### Description
OppoDB exposes an MCP server endpoint that allows AI agents (like Claude Desktop, GPT agents) to access the database directly using structured tool calls.

### MCP URL
```
https://yysbtxpupmwkxovgkama.supabase.co/functions/v1/mcp-server
```

Requires `X-API-Key` header.

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "ordb": {
      "type": "streamable-http",
      "url": "https://[base-url]/mcp-server",
      "headers": {
        "X-API-Key": "YOUR_API_KEY"
      }
    }
  }
}
```

### MCP Capabilities
- Query candidates by name, state, category
- Search district profiles by state or district ID
- Fetch polling data for specific candidates or topics
- Get campaign finance summaries
- Cross-reference candidates with districts
- Search MAGA files and narrative reports
- Look up congressional voting records

---

## API Analytics (`ApiAnalytics`)

Dashboard component showing API usage metrics:
- Total requests (all time)
- Requests by endpoint breakdown
- Key usage statistics per API key
- Error rate tracking
- Request timeline

Data sourced from `api_request_logs` table.

---

## Security Features

### Key Hashing
- API keys are stored as SHA-256 hashes
- Only the key prefix (first 8 chars) is ever shown to users
- Keys cannot be recovered once lost — must be regenerated

### Request Validation
- `validate_api_key()` SECURITY DEFINER function checks hash
- Returns `user_id` and `key_id` for authorization
- Revoked keys (`revoked_at IS NOT NULL`) are rejected

### Request Logging
- All API requests logged via `log_api_request()` function
- Logs include: endpoint, timestamp, key ID, user ID, response status
- Atomic counter increment via `increment_api_key_usage()`
- Stored in `api_request_logs` table

### Rate Limiting
- Configurable rate limits per key
- Tracks request count per key
- Excess requests return 429 status

### Revocation
- Users can revoke their own API keys
- Admins can revoke any API key
- Revoked keys immediately lose access

---

## Library Functions (`lib/apiKeys.ts`)

```typescript
createApiKey(name: string): Promise<{ id: string; key: string }>  // Returns plain key ONCE
listApiKeys(): Promise<ApiKey[]>                                    // Lists user's keys
revokeApiKey(keyId: string): Promise<boolean>                       // Soft-disable
deleteApiKey(keyId: string): Promise<boolean>                       // Hard delete
getApiBaseUrl(): string                                             // Current API base URL
```

---

## Use Cases

### External Research Tools
Integrate OppoDB data into external research workflows, spreadsheets, or databases.

### AI Agent Access
AI agents (Claude, GPT, etc.) can use the MCP server or REST API to answer political research questions using OppoDB's database.

### Data Journalism
Journalists can pull live data for stories, visualizations, or interactive graphics.

### Campaign Operations
Campaigns can sync OppoDB data with their own CRM or targeting tools.

### Automated Monitoring
Set up scripts to monitor for changes in polling, forecasts, or campaign finance data.
