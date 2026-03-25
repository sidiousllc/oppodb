# Feature: API Access

## Description

OppoDB provides a public API that allows authenticated users to programmatically access the database. API access is available to premium users and above, enabling integration with external tools, scripts, and AI agents.

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
- See request count
- **Revoke** — disables the key (can be re-enabled)
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
  key_hash: string;         // Hashed value stored in DB
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  request_count: number;
}
```

---

## API Endpoints

### Base URL
```
https://[deployment-url]/public-api
```

### Authentication
All API requests require the `X-API-Key` header:
```bash
curl -H "X-API-Key: YOUR_API_KEY" https://[url]/public-api/candidates
```

### Available Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/candidates` | All candidate profiles |
| GET | `/districts` | All congressional districts |
| GET | `/state-legislative` | All state legislative districts |
| GET | `/election-results` | Election results |
| GET | `/polling` | Polling data |
| GET | `/maga-files` | MAGA files |
| GET | `/narrative-reports` | Narrative reports |
| GET | `/local-impacts` | Local impact reports |

### Response Format
All endpoints return JSON:
```json
{
  "data": [...],
  "count": 123,
  "source": "OppoDB"
}
```

---

## MCP Server (Model Context Protocol)

### Description
OppoDB exposes an MCP server endpoint that allows AI agents (like Claude Desktop) to access the database directly using natural language.

### MCP URL
```
https://[deployment-url]/mcp-server
```

Requires `X-API-Key` header as well.

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "ordb": {
      "type": "streamable-http",
      "url": "https://[deployment-url]/mcp-server",
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
- Fetch polling data for specific candidates
- Get campaign finance summaries
- Cross-reference candidates with districts

---

## API Analytics (`ApiAnalytics`)

Dashboard component showing API usage metrics:
- Total requests (all time)
- Requests by endpoint
- Key usage statistics
- Error rate tracking

---

## Security Features

### Key Hashing
- API keys are stored as bcrypt hashes
- Only the key prefix (first 8 chars) is ever shown to users
- Keys cannot be recovered once lost — must be regenerated

### Rate Limiting
- Configurable rate limits per key
- Tracks request count per key
- Excess requests return 429 status

### Request Logging
- All API requests are logged
- Logs include: endpoint, timestamp, key ID, response status
- Viewable in Supabase dashboard

### Revocation
- Admins can revoke any API key
- Revoked keys immediately lose access
- All active sessions using the key are terminated

---

## Library Functions (`lib/apiKeys.ts`)

```typescript
createApiKey(name: string): Promise<{ id, key }>  // Returns plain key ONCE
listApiKeys(): Promise<ApiKey[]>                   // Lists user's keys
revokeApiKey(keyId: string): Promise<boolean>      // Soft-disable
deleteApiKey(keyId: string): Promise<boolean>      // Hard delete
getApiBaseUrl(): string                            // Current API base URL
```

---

## Use Cases

### External Research Tools
Integrate OppoDB data into external research workflows, spreadsheets, or databases.

### AI Agent Access
AI agents (Claude, GPT-4, etc.) can use the MCP server or REST API to answer political research questions using OppoDB's database.

### Data Journalism
Journalists can pull live data for stories, visualizations, or interactive graphics.

### Campaign Operations
Campaigns can sync OppoDB data with their own CRM or targeting tools.
