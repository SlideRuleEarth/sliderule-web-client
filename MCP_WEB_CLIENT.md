# SlideRule Web Client — MCP Integration

## Context

MCP (Model Context Protocol) support for the SlideRule web client allows AI assistants (Claude Desktop, Claude.ai) to operate it. The system supports two deployment modes:

- **Local mode:** Both the MCP server and the browser run on the researcher's machine. Claude Desktop launches a small local MCP server process via stdio, the browser connects to it via WebSocket on localhost, and the researcher watches the app respond in real-time.
- **Cloud mode:** A remote MCP server runs on AWS ECS. Claude.ai connects via Streamable HTTP with JWT authentication, the browser connects via secure WebSocket, and a session router matches authenticated users to their browser sessions.

**What this looks like:** A researcher runs the web client in their browser and connects to an AI assistant. They say "Set up an ATL06 request for Greenland in 2023, submit it, then show me elevation statistics." The assistant calls MCP tools, the browser executes them against its Pinia stores, DuckDB, and OpenLayers map, and the researcher watches the UI update live.

---

## Architecture

### Local Mode (Claude Desktop)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Claude Desktop (MCP client)                                         │
│  LLM + agent loop + conversation UI                                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ stdio (JSON-RPC 2.0)
                           │ Claude Desktop launches this as a subprocess
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MCP Server  (server.py)                                             │
│  Small Python process — single user, no auth                         │
│                                                                      │
│  Speaks MCP (stdio) on one side, WebSocket on the other.             │
│  Fetches tool definitions from browser, caches + advertises them.    │
│  Forwards tool calls to the browser, returns results to Claude.      │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  MCP via stdio   │  │  WebSocket Server │  │  Pending         │  │
│  │  ← Claude Desktop│  │  ws://localhost   │  │  Requests        │  │
│  │                  │  │  :3002            │  │  dict[id, Future]│  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ WebSocket (localhost)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Browser  (Vue 3 SPA — the existing web client)                      │
│                                                                      │
│  ┌──────────────┐    ┌────────────────┐    ┌──────────────────────┐ │
│  │ MCP Client   │───→│ MCP Handler    │───→│ Tool Executor        │ │
│  │ (WebSocket)  │    │ (JSON-RPC      │    │ (22 tools against    │ │
│  └──────────────┘    │  router)       │    │  Pinia/DuckDB/OL)    │ │
│                      └────────────────┘    └──────────────────────┘ │
│                                                                      │
│  ┌──────────────────┐                                                │
│  │ Activity Panel   │  Shows connection status + tool call log       │
│  └──────────────────┘                                                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  Pinia Stores │ DuckDB WASM │ OpenLayers │ Deck.gl │ OPFS    │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### Cloud Mode (Claude.ai)

```
┌─────────────────────────────────────────────────────────────────────┐
│  Claude.ai / AI SDK (MCP client)                                     │
│  Connects via Streamable HTTP with Bearer JWT                        │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ HTTPS (Streamable HTTP, JSON-RPC 2.0)
                           │ Bearer JWT authentication
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Remote MCP Server  (server_remote.py — AWS ECS)                     │
│  Starlette app — multi-user with JWT auth                            │
│                                                                      │
│  /mcp          Streamable HTTP endpoint (MCP clients)                │
│  /ws           WebSocket endpoint (browsers, first-message JWT auth) │
│  /health       ALB health check                                      │
│  /.well-known/oauth-protected-resource/mcp   RFC 9728 metadata       │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Session Router  │  │  JWT Verifier    │  │  Per-user state:  │  │
│  │  Maps users to   │  │  RS256 via JWKS  │  │  pending, tools,  │  │
│  │  browser sessions│  │  5-min cache     │  │  token expiry     │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ Secure WebSocket (wss://)
                           │ JWT via first-message auth
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  Browser  (same Vue 3 SPA, cloud mode enabled)                       │
└─────────────────────────────────────────────────────────────────────┘
```

### How a tool call flows

```
1. Claude decides to call set_mission({ mission: "ICESat-2" })
2. Claude Desktop sends tools/call via stdio to the MCP server
3. MCP server wraps it as JSON-RPC, assigns an ID, sends via WebSocket to browser
4. Browser MCP Handler routes to Tool Executor
5. Tool Executor calls reqParamsStore.setMissionValue("ICESat-2")
6. Browser UI updates the mission selector in real-time
7. Tool Executor returns { content: [{ type: "text", text: "Mission set to ICESat-2" }] }
8. Browser sends JSON-RPC response via WebSocket to MCP server
9. MCP server returns the result via stdio to Claude Desktop
10. Claude sees the result, decides next action
```

### Design decisions

**Hybrid tool definitions (bootstrap + dynamic):** The server has static `BOOTSTRAP_TOOLS` so Claude Desktop sees tools immediately on startup. When the browser connects, the server fetches live definitions from `toolDefinitions.ts` via `tools/list` and overrides the bootstrap list. When the browser disconnects, tools revert to the bootstrap set. Tool calls always forward to the browser — if the browser isn't connected, the server returns "Browser not connected." The browser's `toolDefinitions.ts` is the authoritative source; the bootstrap list is a fallback needed because Claude Desktop doesn't re-fetch tools after `notifications/tools/list_changed`.

---

## MCP Server

A Python process that bridges MCP clients and the browser. All tool logic and definitions live in the browser — the server is a transparent bridge. Two entry points serve different deployment modes.

### Package structure

```
sliderule-mcp-server/
├── pyproject.toml
└── src/
    └── sliderule_mcp/
        ├── __init__.py
        ├── common.py          # Shared: bootstrap tools, prompts, server instructions
        ├── server.py          # Local mode: stdio + WebSocket (single user, no auth)
        ├── server_remote.py   # Cloud mode: Streamable HTTP + WebSocket (multi-user, JWT auth)
        ├── jwt_verifier.py    # RS256 JWT verification via JWKS (cloud mode)
        └── session_router.py  # Per-user session routing + lifecycle (cloud mode)
```

### `server.py` (local mode)

Local stdio server for Claude Desktop. Single browser connection, no authentication. See `sliderule-mcp-server/src/sliderule_mcp/server.py`.

### `server_remote.py` (cloud mode)

Starlette-based cloud server for Claude.ai and AI SDK clients. Multi-user via `SessionRouter`, JWT authentication via `JwtVerifier`. Deployed on AWS ECS behind an ALB. See `sliderule-mcp-server/src/sliderule_mcp/server_remote.py`.

### `common.py`

Shared code between both modes: `BOOTSTRAP_TOOLS` (22 tools), `PROMPTS`, `SERVER_INSTRUCTIONS`, and the `analyze-region` prompt template.

### `pyproject.toml`

See `sliderule-mcp-server/pyproject.toml`. Runtime dependencies: `mcp>=1.0.0`, `websockets>=12.0`, `pyjwt[crypto]>=2.8.0`, `httpx>=0.27.0`, `uvicorn>=0.30.0`. Two entry points: `sliderule-mcp` (local) and `sliderule-mcp-remote` (cloud).

### Distribution

Published to PyPI as [`sliderule-mcp`](https://pypi.org/project/sliderule-mcp/). Users install nothing manually — `uvx` downloads, isolates, and runs it automatically.

**Build and publish:** Use the Makefile targets:

```bash
make mcp-build     # Build wheel + sdist
make mcp-publish   # Build + upload to PyPI
make mcp-release   # Publish + refresh local uvx cache
```

**Version:** Bump `version` in `pyproject.toml` before each upload — PyPI rejects duplicate versions.

**Docker (cloud mode):** The remote server is deployed as a Docker container on AWS ECS:

```bash
make mcp-docker-build            # Build Docker image (arm64)
make mcp-docker-push             # Build + push to ECR + trigger ECS redeploy
make mcp-push-testsliderule      # Build + push to testsliderule ECR
```

### Claude Desktop Configuration

Config file location:
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**For end users** (zero-install via PyPI + `uvx`):

```json
{
  "mcpServers": {
    "sliderule": {
      "command": "uvx",
      "args": ["sliderule-mcp"]
    }
  }
}
```

Requires `uv` installed (`brew install uv` on macOS).

**For developers** (run from source + PyPI side-by-side):

```json
{
  "mcpServers": {
    "sliderule": {
      "command": "uvx",
      "args": ["sliderule-mcp"]
    },
    "sliderule-local-dev": {
      "command": "/path/to/python",
      "args": ["/path/to/sliderule-mcp-server/src/sliderule_mcp/server.py"],
      "env": { "SR_MCP_PORT": "3003" }
    }
  }
}
```

Toggle between them in Claude Desktop via **+** > **Connectors**. Only enable one at a time (they bind different WebSocket ports: 3002 default, 3003 for local dev).

---

## Browser Components

All tool logic lives in the browser, executing against the existing Pinia stores, DuckDB WASM, and OpenLayers map. The MCP server process has no knowledge of SlideRule — it is a transparent bridge.

### 1. MCP Client (`src/services/mcpClient.ts`)

Browser-side WebSocket client that connects to the MCP server (local or cloud).

**Lifecycle:**
- Connects automatically on app load (or manually via the activity indicator toggle)
- **Local mode:** Opens WebSocket to `ws://localhost:3002` (port configurable via `mcpStore.wsPort`)
- **Cloud mode:** Opens WebSocket to configured `mcpWsUrl` (e.g., `wss://mcp.slideruleearth.io/ws`), sends JWT as first message `{type: "auth", token: "..."}`, waits for auth acknowledgment
- Receives JSON-RPC requests, routes to MCP Handler
- Sends JSON-RPC responses back
- On disconnect: exponential backoff reconnect with jitter (1s, 2s, 4s, 8s, max 30s)
- Manual disconnect suppresses auto-reconnect
- Handles `mcp/sessionChanged` notifications (alerts user to token refresh or AI client switch)

**State (reactive, for UI):**

```typescript
// src/stores/mcpStore.ts
interface McpState {
  status: "disconnected" | "connecting" | "connected" | "reconnecting"
  activityLog: {
    timestamp: number
    direction: "inbound" | "outbound"
    method: string
    toolName?: string
    summary: string
    durationMs?: number
    isError?: boolean
  }[]
  reconnectAttempts: number
  lastError: string | null
  lastWarning: string | null  // session conflicts
  wsPort: number              // default 3002, configurable via VITE_MCP_WS_PORT
  mcpWsUrl: string            // cloud mode URL (stored in localStorage)
  isCloudMode: boolean        // computed: true when mcpWsUrl is set
}
```

### 2. MCP Handler (`src/services/mcpHandler.ts`)

Routes incoming JSON-RPC messages to the appropriate handler:

| Method | Handler |
|---|---|
| `tools/list` | Return tool definitions from bundled catalog |
| `tools/call` | Dispatch to Tool Executor, return result |
| `resources/list` | Return resource definitions from Resource Resolver |
| `resources/read` | Dispatch to Resource Resolver, return content |
| `prompts/list` | Return prompt template catalog |
| `prompts/get` | Return a filled prompt template with arguments |
| `ping` | Return pong (keepalive) |

Tool and resource definitions are **bundled in the SPA**. The browser is where all the knowledge lives — the MCP server is just a pipe.

### 3. Tool Executor (`src/services/toolExecutor.ts`)

Registry mapping tool names to async functions that operate on the existing app state.

**Structure:**

```typescript
type ToolResult = {
  content: Array<{ type: "text"; text: string } | { type: "resource"; resource: any }>
  isError?: boolean
}
type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>

const tools: Map<string, { definition: ToolDefinition; handler: ToolHandler }>
```

**Pattern:** Import store → call setter/action → return confirmation + relevant state.

**Destructive tool handling:** Tools marked destructive (`reset_params`) show a PrimeVue `ConfirmDialog` in the browser. The tool handler returns a Promise that resolves after the user confirms or rejects in the browser. If rejected, returns `{ isError: true, content: [{ type: "text", text: "User denied this action" }] }`.

**Input validation:** Each tool definition includes a JSON Schema. The executor validates args before calling the handler. Invalid args return an error result describing what's wrong.

### 4. Activity Indicator (`src/components/SrMcpActivityIndicator.vue`)

Small indicator in `SrAppBar.vue` — a colored dot + expandable dropdown.

**What it shows:**
- Connection status: disconnected (grey), connecting (yellow), connected (green)
- Cloud/Dev mode toggles (switch between local and cloud server)
- "Connect" / "Disconnect" toggle button
- Error/warning banners (e.g., session conflicts, token expiration)
- Recent tool calls (scrolling log): `set_mission → ICESat-2`, `get_current_params`, etc.
- Duration metrics and direction indicators (→ inbound, ← outbound) for each activity

---

## Tool Definitions

All tools execute in the browser against existing stores and utilities. All tools are implemented and working. The tool set is intentionally focused on the core workflow: configure → submit → analyze → document.

### Parameter Tools (12)

| Tool | Backing Code | Description |
|---|---|---|
| `set_mission` | `reqParamsStore.setMissionValue()` | Set mission to ICESat-2 or GEDI. Auto-resets API to mission default. |
| `set_api` | `reqParamsStore.setIceSat2API()` / `setGediAPI()` | Set the processing API (atl03x, atl06, atl08p, gedi02ap, etc.). Auto-enables API-specific flags. |
| `set_general_preset` | `reqParamsStore` preset setter | Apply a named preset configuration (e.g., quick_icesat2, thorough_gedi). |
| `set_surface_fit` | `reqParamsStore.setUseSurfaceFitAlgorithm()`, `setMaxIterations()`, etc. | Enable/configure ATL06-SR surface fitting (maxi, h_win, sigma_r). |
| `set_photon_params` | `reqParamsStore.setLengthValue()`, `setStepValue()`, etc. | Set photon-level processing parameters (length, step, along-track spread, min photon count). |
| `set_yapc` | `reqParamsStore.enableYAPC`, `setYAPCScore()`, etc. | Enable/configure YAPC photon classifier (score, knn, window height/width, version). |
| `set_region` | `reqParamsStore.setPoly()` | Set the geographic region via bounding box or polygon coordinates. Computes convex hull and area. |
| `set_atl13_point` | `reqParamsStore` point setter | Set a point location for ATL13 inland water body analysis. |
| `zoom_to_location` | OpenLayers map view | Zoom/pan the map to a named location or coordinates. |
| `get_area_thresholds` | Area limit config | Get the current area size thresholds and limits for region selection. |
| `get_current_params` | `reqParamsStore` (reads state) | Return the complete current parameter state as JSON. |
| `reset_params` | `reqParamsStore.reset()` | Reset all parameters to defaults. **Destructive — requires browser confirmation.** |

### Request Lifecycle Tools (3)

| Tool | Backing Code | Description |
|---|---|---|
| `submit_request` | `workerDomUtils.processRunSlideRuleClicked()` | Submit the current parameters as a SlideRule processing request. Spawns a Web Worker, streams Parquet results to OPFS, loads into DuckDB. |
| `get_request_status` | `requestsStore.getReqById()` | Get status of a request: pending, running, success, error. Includes elapsed time, row count, granule count. |
| `list_requests` | `requestsStore.fetchReqs()` | List all requests in the session with their status. |

### Data Analysis Tools (3)

| Tool | Backing Code | Description |
|---|---|---|
| `run_sql` | `DuckDBClient.query()` | Execute SQL against in-memory results. DuckDB WASM with spatial extension. Read-only, single statement only, 30s timeout, max 10k rows. Rejects INSERT/UPDATE/DELETE/DROP/CREATE. |
| `describe_data` | `DuckDBClient.queryForColNames()`, `queryColumnTypes()` | Get schema, column types, row count for a result set. |
| `get_elevation_stats` | `SrDuckDbUtils.readOrCacheSummary()`, `getAllColumnMinMax()` | Compute elevation statistics: min, max, percentiles for all numeric columns. |

### Documentation Tools (4)

| Tool | Backing Code | Description |
|---|---|---|
| `search_docs` | DuckDB FTS query on `sr_docs` table | Full-text search across indexed SlideRule documentation. Returns ranked results with snippets. |
| `fetch_docs` | Browser `fetch()` + DOMParser + DuckDB insert | Fetch a ReadTheDocs page, parse to text, index into DuckDB for future searches. URL validated: must be HTTPS under `slideruleearth.io`. |
| `get_param_help` | Tooltip text + `defaultsStore` + docs index | Get help for a specific parameter: description, valid values, defaults, linked documentation. |
| `initialize` | Session setup | Returns session instructions, preset list, scientific transparency rules, and server version. **Must be called first.** |

### Summary

- 12 parameter tools
- 3 request lifecycle tools
- 3 data analysis tools
- 4 documentation tools
- **22 tools total — all implemented**

---

## Resource Definitions

Resources are read-only data that the MCP client can access. Resolved from Pinia stores, DuckDB, and IndexedDB via `resourceResolver.ts`. All resources are implemented.

### App Resources (10)

| URI | Resolves To |
|---|---|
| `sliderule://params/current` | Full current parameter state from `reqParamsStore` |
| `sliderule://requests/history` | All request records from Dexie DB |
| `sliderule://requests/{id}/summary` | Status, timing, row count, parameters for a request |
| `sliderule://data/{id}/schema` | Column names and types for a result set |
| `sliderule://data/{id}/sample` | First 20 rows of a result set |
| `sliderule://map/viewport` | Current map center, zoom, projection, visible extent |
| `sliderule://catalog/products` | Available missions and APIs |
| `sliderule://catalog/fields/{api}` | Available data fields for a specific API |
| `sliderule://auth/status` | Current auth state: username, org membership |
| `sliderule://app/current-view` | Current Vue Router route (name, path, params) + list of available views |

### Documentation Resources (5)

| URI | Resolves To |
|---|---|
| `sliderule://docs/index` | All indexed doc sections with titles, chunk counts, URLs |
| `sliderule://docs/section/{section}` | All chunks for a doc section (e.g., `api/icesat2`) |
| `sliderule://docs/param/{name}` | Parameter help: tooltip + defaults + valid values + doc URL |
| `sliderule://docs/tooltips` | All in-app tooltip text organized by component/parameter |
| `sliderule://docs/defaults/{mission}` | Server defaults for a mission (ICESat-2, GEDI, etc.) |

**15 resource URIs total — all implemented.**

---

## Prompt Templates

Prompt templates appear in the MCP client's interface and guide the assistant through common workflows.

### Server-registered (available via MCP)

| Prompt | Description | Arguments |
|---|---|---|
| `analyze-region` | Full workflow: set region, configure params, submit, analyze results | `location`, `science_goal?` |

**1 prompt registered in the server** (`common.py`). The server's `get_prompt` handler only supports `analyze-region`.

### Browser-defined (available when browser connects)

The browser's `promptTemplates.ts` defines 5 templates. These are returned via the browser's `prompts/list` and `prompts/get` handlers but are only available when the browser is connected:

| Prompt | Description | Arguments |
|---|---|---|
| `analyze-region` | Full workflow: set region, configure params, submit, analyze results | `region_description`, `api?`, `time_range?` |
| `elevation-change` | Compare elevation data between two time periods | `region_description`, `period_1`, `period_2` |
| `vegetation-analysis` | Analyze canopy height using ATL08/PhoREAL | `region_description` |
| `data-quality` | Assess data coverage and quality for a region | `region_description`, `api` |
| `explore-data` | Submit a request and interactively explore the results with SQL | `region_description` |

---

## Documentation Search Engine (`src/services/docSearchEngine.ts`)

Indexes SlideRule documentation into DuckDB for full-text search. Uses the DuckDB WASM instance already running in the browser — no new infrastructure.

### Documentation Sources

| Tier | Source | When Loaded | Content |
|---|---|---|---|
| **Bundled** | Static JSON shipped with SPA | App startup | Core docs: API reference, user guides, parameter descriptions (~50-100 chunks) |
| **Defaults** | `https://sliderule.slideruleearth.io/source/defaults` | App startup (already fetched by `defaultsStore`) | Parameter valid values, ranges, descriptions per mission |
| **Live** | `https://slideruleearth.io/web/rtd/*` | On demand via `fetch_docs` tool | Any ReadTheDocs page, parsed to text, indexed into DuckDB |

### DuckDB Schema

```sql
CREATE TABLE sr_docs (
  id          INTEGER PRIMARY KEY,
  source      VARCHAR,    -- 'bundled' | 'defaults' | 'live' | 'tooltip'
  section     VARCHAR,    -- e.g. 'api/icesat2', 'guide/beams', 'params/atl06'
  title       VARCHAR,
  content     VARCHAR,    -- plain text content
  url         VARCHAR,    -- link back to ReadTheDocs or null
  tags        VARCHAR[],  -- e.g. ['icesat2', 'atl06', 'beams']
  indexed_at  TIMESTAMP
);

PRAGMA create_fts_index('sr_docs', 'id', 'title', 'content', 'tags');
```

### Bundled Documentation (build-time)

A build script (`scripts/build-docs-index.ts`) scrapes ReadTheDocs pages referenced by the app's tooltip URLs, chunks each page into ~500-token sections, and outputs `src/assets/docs-index.json`. Also extracts tooltip text from the app's 46+ components. Re-run when documentation is updated.

### Live Fetch Flow

1. Claude calls `fetch_docs({ url: "https://slideruleearth.io/web/rtd/user_guide/icesat2.html" })`
2. Browser fetches the URL, strips HTML to plain text via `DOMParser`
3. Chunks the text into ~500-token sections
4. Inserts into `sr_docs` table with `source: 'live'`
5. Returns confirmation with chunk count and section titles
6. Subsequent `search_docs` queries include the new content

### Initialization

- After DuckDB is ready: create `sr_docs` table, load bundled `docs-index.json`
- After `defaultsStore` fetches defaults: extract parameter descriptions, insert into `sr_docs`

---

## MCP Client Compatibility

| Client | Works? | Notes |
|---|---|---|
| **Claude Desktop — Chat mode** | Yes | Local mode via stdio. Primary local target. |
| **Claude Desktop — Cowork mode** | No | Known bug: local stdio MCP servers not loaded in Cowork. |
| **Claude.ai (web/mobile)** | Yes | Cloud mode via ECS relay server. Streamable HTTP + JWT auth. |
| **ChatGPT Desktop** | No | Requires remote HTTPS + OAuth — not compatible with current auth model. |

Cross-platform research is documented in `MCP_SERVER_CROSS_CHAT_PLATFORMS.md`.

---

## Security

### Both Modes

1. **User is present** — the researcher has the browser open and sees every tool call in the activity indicator. Nothing happens silently.
2. **Destructive actions require confirmation** — `reset_params` shows a `ConfirmDialog` in the browser. The assistant waits for the user to approve or deny. Denial returns an error.
3. **Input validation** — every tool has a JSON Schema. Arguments are validated before execution. Invalid args return a descriptive error.
4. **Request timeout** — the MCP server times out any browser call after 30 seconds, preventing hung connections.
5. **Browser-controlled tool surface** — tool definitions come from the browser's bundled `toolDefinitions.ts`. The server caches them and notifies the MCP client when they change. New tools can only be added by updating the deployed SPA.
6. **SQL sandboxing** — DuckDB WASM operates on read-only in-memory data with a 30s timeout, single statement only. INSERT/UPDATE/DELETE/DROP/CREATE are rejected at the parser level. No access to the local filesystem or external databases.
7. **Domain-restricted fetch** — `fetch_docs` validates URLs with proper `URL` parsing: hostname must be exactly `slideruleearth.io` or a subdomain, and protocol must be HTTPS. No arbitrary URL access.
8. **WebSocket origin checking** — the MCP server validates the `Origin` header on WebSocket connections against an allowlist (localhost dev ports, `testsliderule.org`, `client.slideruleearth.io`). Connections from unknown origins are rejected with code 4003.

### Local Mode Only

9. **Localhost only** — the local MCP server's WebSocket binds to `localhost`, unreachable from the network. Only processes on the same machine can connect.

### Cloud Mode Only

10. **JWT authentication** — MCP clients must provide a Bearer JWT. The server verifies RS256 signatures via JWKS fetched from the authenticator. JWKS is cached for 5 minutes.
11. **Audience validation** — MCP client JWTs are validated against the expected audience claim. Browser tokens skip audience validation (provisioner tokens use `sub` only).
12. **Session isolation** — `SessionRouter` maps each authenticated user to their own browser session. Users cannot see or interact with other users' sessions.
13. **Rate limiting** — WebSocket connections are rate-limited to 30 per IP per minute.
14. **Message size limits** — Maximum WebSocket message size is 10 MB.
15. **Session cleanup** — Idle sessions are cleaned up after 1 hour. Sessions with expired tokens are cleaned immediately. Cleanup runs every 5 minutes.
16. **MCP session change detection** — The server detects when a new AI client connects (token refresh or different client) and notifies the browser.

---

## Files

### Server Files

| File | Purpose |
|---|---|
| `sliderule-mcp-server/pyproject.toml` | Python package config with two entry points (`sliderule-mcp`, `sliderule-mcp-remote`) |
| `sliderule-mcp-server/src/sliderule_mcp/common.py` | Shared: bootstrap tools (22), prompts, server instructions |
| `sliderule-mcp-server/src/sliderule_mcp/server.py` | Local mode: stdio + WebSocket bridge (single user, no auth) |
| `sliderule-mcp-server/src/sliderule_mcp/server_remote.py` | Cloud mode: Streamable HTTP + WebSocket (multi-user, JWT auth, AWS ECS) |
| `sliderule-mcp-server/src/sliderule_mcp/jwt_verifier.py` | RS256 JWT verification via JWKS (cloud mode) |
| `sliderule-mcp-server/src/sliderule_mcp/session_router.py` | Per-user session routing + lifecycle management (cloud mode) |

### Browser Files

| File | Purpose |
|---|---|
| `web-client/src/services/mcpClient.ts` | Browser-side WebSocket client (local + cloud mode, first-message JWT auth) |
| `web-client/src/services/mcpHandler.ts` | JSON-RPC message router (tools/list, tools/call, resources/list, resources/read, prompts/list, prompts/get, ping) |
| `web-client/src/services/toolExecutor.ts` | Tool execution registry (22 tools) |
| `web-client/src/services/toolDefinitions.ts` | Tool schemas (names, descriptions, JSON Schemas) |
| `web-client/src/services/resourceResolver.ts` | Resource URI → Pinia/DuckDB/IndexedDB resolution (15 resources) |
| `web-client/src/services/promptTemplates.ts` | Prompt template catalog (5 guided workflows) |
| `web-client/src/stores/mcpStore.ts` | Connection status, activity log, cloud mode state |
| `web-client/src/components/SrMcpActivityIndicator.vue` | App bar indicator (dot + popover with cloud/dev toggles) |
| `web-client/src/assets/docs-index.json` | Bundled documentation chunks (generated at build time) |
| `web-client/scripts/build-docs-index.ts` | Build script: scrape ReadTheDocs + extract tooltips → `docs-index.json` |

### Modified Files

| File | Change |
|---|---|
| `web-client/src/components/SrAppBar.vue` | Added MCP activity indicator |

### Existing Code Reused

| Existing | Used By |
|---|---|
| `src/stores/reqParamsStore.ts` | `toolExecutor.ts` — 12 parameter tools |
| `src/stores/requestsStore.ts` | `toolExecutor.ts` — request lifecycle tools |
| `src/utils/SrDuckDb.ts` + `SrDuckDbUtils.ts` | `toolExecutor.ts` — SQL + data analysis tools |
| `src/utils/workerDomUtils.ts` | `toolExecutor.ts` — request submission |
| `src/db/SlideRuleDb.ts` | `resourceResolver.ts` — request history |
| `src/stores/mapStore.ts` | `toolExecutor.ts` — zoom_to_location |
| `src/stores/fieldNameStore.ts` | `resourceResolver.ts` — field catalog |
| `src/stores/defaultsStore.ts` | `toolExecutor.ts` + `resourceResolver.ts` — parameter defaults + descriptions |
| `src/router/index.ts` | `resourceResolver.ts` — current view |
| PrimeVue `ConfirmDialog` | `toolExecutor.ts` — destructive action confirmations |

---

## Milestones

### MVP 0: Connection + First Tools ✓ COMPLETE

**Goal:** Prove the full round-trip: Claude Desktop → MCP server → browser → tool executes → result returns.

**Deliverables:**
- `sliderule-mcp-server/` — Python MCP server published to PyPI as `sliderule-mcp`
- `mcpClient.ts` + `mcpStore.ts` — WebSocket client with auto-connect and exponential backoff
- `mcpHandler.ts` — handles `tools/list`, `tools/call`, `ping`
- `toolExecutor.ts` + `toolDefinitions.ts` — first tools: `set_mission`, `get_current_params`, `reset_params`
- `SrMcpActivityIndicator.vue` — connection status dot + activity log in app bar
- Claude Desktop config documented for both end users (`uvx`) and developers (local source)
- Published to PyPI — end users install with `uvx sliderule-mcp` (zero manual setup)

---

### MVP 1: Parameter Control ✓ COMPLETE

**Goal:** Fully configure a SlideRule request via Claude.

**Deliverables:**
- Parameter tools: `set_mission`, `get_current_params`, `reset_params`, `set_api`, `set_general_preset`, `set_region`, `set_atl13_point`, `set_surface_fit`, `set_photon_params`, `set_yapc`, `zoom_to_location`, `get_area_thresholds`
- `sliderule://params/current` resource

---

### MVP 2: Request Execution + Data Analysis ✓ COMPLETE

**Goal:** Submit a request and analyze results without touching the browser.

**Deliverables:**
- Request lifecycle tools (3): `submit_request`, `get_request_status`, `list_requests`
- Data analysis tools (3): `run_sql`, `describe_data`, `get_elevation_stats`
- Resources: `sliderule://requests/history`, `sliderule://requests/{id}/summary`, `sliderule://data/{id}/schema`, `sliderule://data/{id}/sample`

---

### MVP 3: Cloud Mode (Claude.ai Support) ✓ COMPLETE

**Goal:** Support remote MCP clients (Claude.ai) via a cloud-hosted server.

**Deliverables:**
- `server_remote.py` — Starlette app with Streamable HTTP + WebSocket endpoints
- `jwt_verifier.py` — RS256 JWT verification via JWKS
- `session_router.py` — Multi-user session routing and lifecycle management
- `common.py` — Shared bootstrap tools and prompts between local and cloud modes
- Docker build + ECR push + ECS deployment via Makefile targets
- Browser cloud mode: `mcpWsUrl` in mcpStore, first-message JWT auth in mcpClient
- RFC 9728 OAuth-protected resource metadata endpoint

---

### MVP 4: Documentation Search ✓ COMPLETE

**Goal:** Claude answers questions about SlideRule by searching indexed documentation.

**Deliverables:**
- `scripts/build-docs-index.ts` — scrapes ReadTheDocs + extracts tooltips
- `src/assets/docs-index.json` — bundled doc chunks
- DuckDB FTS table, index loading, live fetch + parse
- Documentation tools (4): `search_docs`, `fetch_docs`, `get_param_help`, `initialize`
- Documentation resources (5)
- Server prompt: `analyze-region` (browser has 5 additional templates available when connected)

---

### Milestone summary

```
MVP 0: Connection + First Tools  ✓ COMPLETE
  │
  ├──► MVP 1: Parameter Control  ✓ COMPLETE (12 tools)
  │      │
  │      └──► MVP 2: Request Execution + Data Analysis  ✓ COMPLETE (6 tools)
  │
  ├──► MVP 3: Cloud Mode  ✓ COMPLETE (server_remote + jwt + sessions)
  │
  └──► MVP 4: Documentation Search  ✓ COMPLETE (4 tools + 5 prompts)

  ALL MILESTONES COMPLETE — 22 tools, 15 resources, 1 server prompt (+ 5 browser prompts)
```

**Adding new tools only requires browser-side changes:** Add a definition to `toolDefinitions.ts`, add a handler to `toolExecutor.ts`, and register it. The MCP server is a transparent bridge — no server-side changes needed for new tools. The bootstrap tool list in `common.py` should be updated periodically to match, but it's not strictly required (tools will be fetched dynamically when the browser connects).

---

## Dependency Graph

```
┌──────────────────────────────────────────────────────────────┐
│  sliderule-mcp-server/                                        │
│  ┌──────────┐  ┌───────────────┐  ┌────────────────────────┐ │
│  │ common.py│  │ server.py     │  │ server_remote.py       │ │
│  │ (shared) │  │ (local/stdio) │  │ (cloud/HTTP+WS)        │ │
│  └──────────┘  └───────────────┘  │ + jwt_verifier.py      │ │
│                                    │ + session_router.py    │ │
│                                    └────────────────────────┘ │
└──────────────────────┬───────────────────────────────────────┘
                       │ WebSocket (local: ws://localhost:3002)
                       │           (cloud: wss://mcp.*.io/ws)
┌──────────────────────▼───────────────────────────────────────┐
│  mcpClient.ts       │──────────────────────────────────┐     │
│  + mcpStore.ts      │                                   │     │
└─────────┬───────────┘                                   │     │
          │                                               │     │
┌─────────▼───────────┐                                   │     │
│  mcpHandler.ts      │  (routes JSON-RPC to handlers)    │     │
└─────────┬───────────┘                                   │     │
          │                                               │     │
  ┌───────┼───────────────────┬────────────────┐          │     │
  ▼       ▼                   ▼                ▼          │     │
┌──────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐    │     │
│tool  │ │resource  │ │ prompt     │ │ Activity     │◄───┘     │
│Exec  │ │Resolver  │ │ Templates  │ │ Indicator    │          │
│.ts   │ │.ts       │ │ .ts        │ │ .vue         │          │
└──┬───┘ └────┬─────┘ └────────────┘ └──────────────┘          │
   │          │                                                 │
   │  (both consume stores/DuckDB)                              │
   │          │                                                 │
   ├──────────┤                                                 │
   ▼          ▼                                                 │
┌─────────────────────────────────────────────────────┐         │
│  Existing: Pinia stores, DuckDB WASM, fetchUtils,   │         │
│  workerDomUtils, Dexie DB, OpenLayers, Deck.gl      │         │
└─────────────────────────────────────────────────────┘         │
```

### Key dependency rules

| Before | After | Why |
|---|---|---|
| `mcpClient.ts` | `mcpHandler.ts` | Handler receives messages from client |
| `mcpHandler.ts` | `toolExecutor.ts` | Handler dispatches to executor |
| `toolExecutor.ts` (any tool) | `resourceResolver.ts` | Resources read from same stores tools write to |
| `defaultsStore` loads | `docSearchEngine.ts` init | Doc engine indexes parameter defaults |
| DuckDB WASM ready | `docSearchEngine.ts` init | Doc engine creates FTS table in DuckDB |
| `build-docs-index.ts` | `docs-index.json` | Build script produces the bundled index |

---

## Environment Variables

### Server

| Variable | Default | Description |
|---|---|---|
| `SR_MCP_PORT` | `3002` | WebSocket port (local mode) |
| `SR_DOMAIN` | `slideruleearth.io` | Base domain (cloud mode) |
| `SR_AUTH_HOSTNAME` | `login.{SR_DOMAIN}` | Auth provider hostname (cloud mode) |
| `SR_MCP_HOSTNAME` | `mcp.{SR_DOMAIN}` | MCP server hostname (cloud mode) |

### Browser

| Variable | Default | Description |
|---|---|---|
| `VITE_MCP_WS_PORT` | `3002` | WebSocket port for local mode |

---

## Verification Plan

1. **Unit tests:** Tool Executor — each tool tested against mock stores
2. **Integration tests:** MCP Handler — mock WebSocket messages in, verify tool calls and responses out
3. **E2E (Playwright):** Browser loads → MCP client connects → simulate tool call → verify store state changed
4. **Claude Desktop test:** Real Claude Desktop connects, discovers tools, executes multi-tool workflow
5. **Claude.ai test:** Claude.ai connects via cloud mode, discovers tools, executes workflow with JWT auth
6. **Destructive test:** `reset_params` → ConfirmDialog appears → user approves → tool completes. User denies → tool returns error.
7. **Reconnection test:** Kill WebSocket → browser reconnects → tools work again
8. **No-browser test:** Claude calls a tool when no browser is connected → gets clear error message with `isError: true`
9. **SQL test:** `run_sql` with valid query returns results. Invalid query returns error. Query exceeding 30s times out. Multi-statement rejected.
10. **Doc search test:** `search_docs({ query: "photon classification" })` returns relevant chunks. `fetch_docs` fetches, parses, indexes, and subsequent searches include the new content.
11. **Cloud auth test:** Invalid JWT → rejected. Expired JWT → session cleaned up. Valid JWT → session created and routed.
