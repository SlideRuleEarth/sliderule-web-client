# SlideRule Web Client — MCP Integration

## Context

MCP (Model Context Protocol) support for the SlideRule web client allows Claude Desktop to operate it. Both the MCP server and the browser run on the researcher's own machine. Claude Desktop launches a small local MCP server process, the browser connects to it via WebSocket on localhost, and the researcher watches the app respond in real-time as Claude configures parameters, submits requests, and analyzes data.

**What this looks like:** A researcher runs the web client in their browser and starts Claude Desktop. They say "Set up an ATL06 request for Greenland in 2023, submit it, then show me elevation statistics." Claude calls MCP tools, the browser executes them against its Pinia stores, DuckDB, and OpenLayers map, and the researcher watches the UI update live.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Claude Desktop (MCP client)                                         │
│  LLM + agent loop + conversation UI                                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ stdio (JSON-RPC 2.0)
                           │ Claude Desktop launches this as a subprocess
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│  MCP Server  (sliderule-mcp-server)                                  │
│  Small Python process                                                │
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
│  │ (WebSocket)  │    │ (JSON-RPC      │    │ (3 tools against     │ │
│  └──────────────┘    │  router)       │    │  Pinia stores)       │ │
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

A small Python process. Its main job: forward tool definitions and tool calls between Claude Desktop (stdio) and the browser (WebSocket). All tool logic and definitions live in the browser — the server is a transparent bridge.

### Package structure

```
sliderule-mcp-server/
├── pyproject.toml
└── src/
    └── sliderule_mcp/
        ├── __init__.py
        └── server.py
```

### `server.py`

See `sliderule-mcp-server/src/sliderule_mcp/server.py` for the full source.

### `pyproject.toml`

See `sliderule-mcp-server/pyproject.toml` for the full file. Two runtime dependencies: `mcp>=1.0.0` and `websockets>=12.0`. No infrastructure. No auth layer. No database.

### Distribution

Published to PyPI as [`sliderule-mcp`](https://pypi.org/project/sliderule-mcp/). Users install nothing manually — `uvx` downloads, isolates, and runs it automatically.

**Build:** The wheel must be built via the Python API (not `hatchling build` CLI, which has a bug with `src/` layout in subdirectories of a git repo). A build script is provided:

```bash
cd sliderule-mcp-server
python -c "
import os
from hatchling.builders.wheel import WheelBuilder
from hatchling.builders.sdist import SdistBuilder
os.makedirs('dist', exist_ok=True)
for a in WheelBuilder('.').build(directory='dist', versions=['standard']): print('wheel:', a)
for a in SdistBuilder('.').build(directory='dist', versions=['standard']): print('sdist:', a)
"
```

**Upload:** `python -m twine upload dist/*` (requires PyPI API token in `~/.pypirc`).

**Version:** Bump `version` in `pyproject.toml` before each upload — PyPI rejects duplicate versions.

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

Browser-side WebSocket client that connects to the local MCP server.

**Lifecycle:**
- Connects automatically on app load (or manually via the activity indicator toggle)
- Opens WebSocket to `ws://localhost:3002` (port configurable via `mcpStore.wsPort`)
- Receives JSON-RPC requests, routes to MCP Handler
- Sends JSON-RPC responses back
- On disconnect: exponential backoff reconnect with jitter (1s, 2s, 4s, 8s, max 30s)
- Manual disconnect suppresses auto-reconnect

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
  wsPort: number  // default 3002, configurable via VITE_MCP_WS_PORT
}
```

### 2. MCP Handler (`src/services/mcpHandler.ts`)

Routes incoming JSON-RPC messages to the appropriate handler:

| Method | Handler |
|---|---|
| `tools/list` | Return tool definitions from bundled catalog |
| `tools/call` | Dispatch to Tool Executor, return result |
| `ping` | Return pong (keepalive) |

Tool definitions are **bundled in the SPA**. The browser is where all the knowledge lives — the MCP server is just a pipe.

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
- "Connect to MCP" / "Disconnect" toggle button
- Recent tool calls (scrolling log): `set_mission → ICESat-2`, `get_current_params`, etc.
- Duration metrics for each activity

---

## Tool Definitions

All tools execute in the browser against existing stores and utilities. Tools marked with **[implemented]** are working. All others are planned.

### Parameter Tools (12)

| Tool | Status | Backing Code | Description |
|---|---|---|---|
| `set_mission` | **[implemented]** | `reqParamsStore.setMissionValue()` | Set mission to ICESat-2 or GEDI. Auto-resets API to mission default. |
| `get_current_params` | **[implemented]** | `reqParamsStore` (reads state) | Return the complete current parameter state as JSON. |
| `reset_params` | **[implemented]** | `reqParamsStore.reset()` | Reset all parameters to defaults. **Destructive — requires browser confirmation.** |
| `set_api` | **[implemented]** | `reqParamsStore.setIceSat2API()` / `setGediAPI()` | Set the processing API (atl03x, atl06, atl08p, gedi02ap, etc.). Auto-enables API-specific flags. |
| `set_region` | **[implemented]** | `reqParamsStore.setPoly()` | Set the geographic region via bounding box or GeoJSON polygon. Computes convex hull and area. |
| `set_time_range` | **[implemented]** | `reqParamsStore.setT0()`, `setT1()` | Set start/end time filter. Auto-enables granule selection. |
| `set_rgt` | **[implemented]** | `reqParamsStore.setRgt()` | Set reference ground track filter. Auto-enables granule selection. |
| `set_cycle` | **[implemented]** | `reqParamsStore.setCycle()` | Set 91-day repeat cycle filter. Auto-enables granule selection. |
| `set_beams` | **[implemented]** | `reqParamsStore.setSelectedGtOptions()` / `gediBeams` | Select which beams/ground tracks to process. Supports ICESat-2 GT names and GEDI beam numbers. |
| `set_surface_fit` | **[implemented]** | `reqParamsStore.setUseSurfaceFitAlgorithm()`, `setMaxIterations()`, etc. | Enable/configure ATL06-SR surface fitting (maxi, h_win, sigma_r). Auto-disables PhoREAL. |
| `set_photon_params` | **[implemented]** | `reqParamsStore.setLengthValue()`, `setStepValue()`, etc. | Set photon-level processing parameters (length, step, along-track spread, min photon count). |
| `set_yapc` | **[implemented]** | `reqParamsStore.enableYAPC`, `setYAPCScore()`, etc. | Enable/configure YAPC photon classifier (score, knn, window height/width, version). |
| `set_output_config` | **[implemented]** | `reqParamsStore` output settings | Set file output mode, GeoParquet format, checksum. |

### Request Lifecycle Tools (5, planned)

| Tool | Backing Code | Description |
|---|---|---|
| `submit_request` | `workerDomUtils.processRunSlideRuleClicked()` | Submit the current parameters as a SlideRule processing request. Spawns a Web Worker, streams Parquet results to OPFS, loads into DuckDB. |
| `get_request_status` | `requestsStore.getReqById()` | Get status of a request: pending, running, success, error. Includes elapsed time, row count, granule count. |
| `cancel_request` | `workerDomUtils.processAbortClicked()` | Cancel a running request. |
| `list_requests` | `requestsStore.fetchReqs()` | List all requests in the session with their status. |
| `delete_request` | `requestsStore.deleteReq()` | Delete a request and its data. **Destructive — requires browser confirmation.** |

### Data Analysis Tools (5, planned)

| Tool | Backing Code | Description |
|---|---|---|
| `run_sql` | `DuckDBClient.query()` | Execute SQL against in-memory results. DuckDB WASM with spatial extension. Read-only, 30s timeout. |
| `describe_data` | `DuckDBClient.queryForColNames()`, `queryColumnTypes()` | Get schema, column types, row count, and Parquet metadata for a result set. |
| `get_elevation_stats` | `SrDuckDbUtils.readOrCacheSummary()`, `getAllColumnMinMax()` | Compute elevation statistics: min, max, percentiles, per-beam breakdowns. |
| `get_sample_data` | `DuckDBClient.queryChunkSampled()` | Retrieve a random sample of rows from a result set. |
| `export_data` | `DuckDBClient.copyQueryToParquet()` | Export query results as GeoParquet or other formats for download. |

### Map Tools (6, planned)

| Tool | Backing Code | Description |
|---|---|---|
| `zoom_to_bbox` | OpenLayers `map.getView().fit()` | Zoom the map to a bounding box. |
| `zoom_to_point` | OpenLayers `map.getView().setCenter()` | Center the map on a point with optional zoom level. |
| `set_base_layer` | `mapStore.setSelectedBaseLayer()` | Change the base layer (imagery, terrain, etc.). |
| `set_map_view` | `mapStore.setSrView()` | Switch map projection (Arctic EPSG:5936, Antarctic EPSG:3031, Web Mercator EPSG:3857, etc.). |
| `toggle_graticule` | `mapStore.toggleGraticule()` | Show/hide the latitude/longitude grid. |
| `set_draw_mode` | `mapStore.setDrawType()` | Set the region drawing mode (polygon, box, or none). |

### Visualization Tools (5, planned)

| Tool | Backing Code | Description |
|---|---|---|
| `set_chart_field` | `chartStore.setYDataOptions()` | Set which fields to plot on the elevation chart. |
| `set_x_axis` | `chartStore.setXDataForChart()` | Set the X-axis field (default: along-track distance). |
| `set_color_map` | `colorMapStore.setNamedColorPalette()` | Set the color palette for track/beam coloring. |
| `set_3d_config` | `deck3DConfigStore` properties | Configure 3D view: vertical exaggeration, point size, axes, field of view. |
| `set_plot_options` | `chartStore` actions | Configure plot options: axis ranges, legend, symbol encoding, track selection. |

### Documentation Tools (4, planned)

| Tool | Backing Code | Description |
|---|---|---|
| `search_docs` | DuckDB FTS query on `sr_docs` table | Full-text search across indexed SlideRule documentation. Returns ranked results with snippets. |
| `fetch_docs` | Browser `fetch()` + DOMParser + DuckDB insert | Fetch a ReadTheDocs page, parse to text, index into DuckDB for future searches. URL must be under `slideruleearth.io`. |
| `get_param_help` | Tooltip text + `defaultsStore` + docs index | Get help for a specific parameter: description, valid values, defaults, linked documentation. |
| `list_doc_sections` | Query `sr_docs` table | List all indexed documentation sections with titles and chunk counts. |

### Summary

- 12 parameter tools (12 implemented)
- 5 request lifecycle tools (planned)
- 5 data analysis tools (planned)
- 6 map tools (planned)
- 5 visualization tools (planned)
- 4 documentation tools (planned)
- **39 tools total (39 implemented)**

---

## Resource Definitions (planned)

Resources are read-only data that the MCP client can access. Resolved from Pinia stores, DuckDB, and IndexedDB.

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

### Documentation Resources (5)

| URI | Resolves To |
|---|---|
| `sliderule://docs/index` | All indexed doc sections with titles, chunk counts, URLs |
| `sliderule://docs/section/{section}` | All chunks for a doc section (e.g., `api/icesat2`) |
| `sliderule://docs/param/{name}` | Parameter help: tooltip + defaults + valid values + doc URL |
| `sliderule://docs/tooltips` | All in-app tooltip text organized by component/parameter |
| `sliderule://docs/defaults/{mission}` | Server defaults for a mission (ICESat-2, GEDI, etc.) |

**14 resource URIs total.**

---

## Prompt Templates (planned)

Prompt templates appear in Claude Desktop's interface and guide Claude through common workflows.

| # | Prompt | Description | Arguments |
|---|---|---|---|
| 1 | `analyze-region` | Full workflow: set region, configure params, submit, analyze results | `region_description`, `api?`, `time_range?` |
| 2 | `elevation-change` | Compare elevation data between two time periods | `region_description`, `period_1`, `period_2` |
| 3 | `vegetation-analysis` | Analyze canopy height using ATL08/PhoREAL | `region_description` |
| 4 | `data-quality` | Assess data coverage and quality for a region | `region_description`, `api` |
| 5 | `explore-data` | Submit a request and interactively explore the results with SQL | `region_description` |

**5 prompt templates.**

---

## Documentation Search Engine (planned — `src/services/docSearchEngine.ts`)

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
| **Claude Desktop — Chat mode** | Yes | Primary target. Local stdio MCP servers fully supported. |
| **Claude Desktop — Cowork mode** | No | Known bug: local stdio MCP servers not loaded in Cowork. |
| **claude.ai (web/mobile)** | No | Requires remote HTTPS + OAuth. Incompatible with localhost architecture. |
| **ChatGPT Desktop** | No | Same — requires remote HTTPS endpoint for MCP servers. |

The current architecture is designed for local use with Claude Desktop Chat mode. Supporting remote clients (claude.ai, ChatGPT) would require a fundamentally different server architecture with HTTPS, authentication, and a remote WebSocket relay.

---

## Security

Items marked **[active]** are enforced today. Others will be enforced when the corresponding tools are implemented.

1. **[active]** **Localhost only** — the MCP server's WebSocket binds to `localhost`, unreachable from the network. Only processes on the same machine can connect.
2. **[active]** **User is present** — the researcher has the browser open and sees every tool call in the activity indicator. Nothing happens silently.
3. **[active]** **Destructive actions require confirmation** — `reset_params` (and future `delete_request`) show a `ConfirmDialog` in the browser. Claude waits for the user to approve or deny. Denial returns an error to Claude.
4. **[active]** **Input validation** — every tool has a JSON Schema. Arguments are validated before execution. Invalid args return a descriptive error.
5. **[active]** **Request timeout** — the MCP server times out any browser call after 30 seconds, preventing hung connections.
6. **[active]** **Browser-controlled tool surface** — tool definitions come from the browser's bundled `toolDefinitions.ts`. The server caches them and notifies Claude Desktop when they change. New tools can only be added by updating the deployed SPA.
7. **SQL sandboxing** — DuckDB WASM operates on read-only in-memory data with a 30s timeout. No access to the local filesystem or external databases.
8. **Domain-restricted fetch** — `fetch_docs` will only fetch URLs under `slideruleearth.io`. No arbitrary URL access.

---

## Files

### Implemented Files

| File | Purpose |
|---|---|
| `sliderule-mcp-server/pyproject.toml` | Python package config with entry point |
| `sliderule-mcp-server/src/sliderule_mcp/server.py` | MCP server process (~229 lines) |
| `web-client/src/services/mcpClient.ts` | Browser-side WebSocket client |
| `web-client/src/services/mcpHandler.ts` | JSON-RPC message router (tools/list, tools/call, ping) |
| `web-client/src/services/toolExecutor.ts` | Tool execution registry (13 tools) |
| `web-client/src/services/toolDefinitions.ts` | Tool schemas (names, descriptions, JSON Schemas) |
| `web-client/src/stores/mcpStore.ts` | Connection status, activity log |
| `web-client/src/components/SrMcpActivityIndicator.vue` | App bar indicator (dot + dropdown) |

### Planned Files

| File | Purpose |
|---|---|
| `web-client/src/services/resourceResolver.ts` | Resource URI → Pinia/DuckDB/IndexedDB resolution |
| `web-client/src/services/promptTemplates.ts` | Prompt template catalog |
| `web-client/src/services/docSearchEngine.ts` | Documentation indexing + DuckDB FTS |
| `web-client/src/assets/docs-index.json` | Bundled documentation chunks |
| `web-client/scripts/build-docs-index.ts` | Build script: scrape ReadTheDocs + extract tooltips |

### Modified Files

| File | Change |
|---|---|
| `web-client/src/components/SrAppBar.vue` | Added MCP activity indicator |

### Existing Code Reused

| Existing | Used By |
|---|---|
| `src/stores/reqParamsStore.ts` | `toolExecutor.ts` — all 13 parameter tools |
| `src/stores/mapStore.ts` | `toolExecutor.ts` — 6 map tools |
| `src/stores/chartStore.ts` / `globalChartStore.ts` | `toolExecutor.ts` — chart tools |
| `src/stores/colorMapStore.ts` | `toolExecutor.ts` — color palette tool |
| `src/stores/deckStore.ts` + `deck3DConfigStore.ts` | `toolExecutor.ts` — 3D config tool |
| `src/stores/requestsStore.ts` | `toolExecutor.ts` — request lifecycle tools |
| `src/utils/SrDuckDb.ts` + `SrDuckDbUtils.ts` | `toolExecutor.ts` — SQL + data analysis tools |
| `src/utils/workerDomUtils.ts` | `toolExecutor.ts` — request submission |
| `src/db/SlideRuleDb.ts` | `resourceResolver.ts` — request history |
| `src/stores/fieldNameStore.ts` | `resourceResolver.ts` — field catalog |
| `src/stores/defaultsStore.ts` | `docSearchEngine.ts` — parameter defaults + descriptions |
| PrimeVue `ConfirmDialog` | `toolExecutor.ts` — destructive action confirmations |

---

## Milestones

### MVP 0: Connection + First Tools — COMPLETE

**Goal:** Prove the full round-trip: Claude Desktop → MCP server → browser → tool executes → result returns.

**Deliverables:**
- `sliderule-mcp-server/` — Python MCP server published to PyPI as `sliderule-mcp`
- `mcpClient.ts` + `mcpStore.ts` — WebSocket client with auto-connect and exponential backoff
- `mcpHandler.ts` — handles `tools/list`, `tools/call`, `ping`
- `toolExecutor.ts` + `toolDefinitions.ts` — **3 tools**: `set_mission`, `get_current_params`, `reset_params`
- `SrMcpActivityIndicator.vue` — connection status dot + activity log in app bar
- Claude Desktop config documented for both end users (`uvx`) and developers (local source)
- Published to PyPI — end users install with `uvx sliderule-mcp` (zero manual setup)

**Verified:** Claude Desktop connects, discovers tools, calls `set_mission({ mission: "ICESat-2" })`, browser UI updates the mission selector in real-time, `get_current_params` returns current state, `reset_params` shows confirmation dialog, activity indicator logs all calls.

**Known limitations:**
- Claude Desktop does not re-fetch tools after `notifications/tools/list_changed` — this is why the server has static bootstrap tools as a fallback
- Claude Desktop Cowork mode does not support local stdio MCP servers (known bug)
- claude.ai and ChatGPT Desktop require remote HTTPS + OAuth, incompatible with the local server architecture

---

### MVP 1: Parameter Control — COMPLETE

**Depends on:** MVP 0

**Goal:** Fully configure a SlideRule request via Claude Desktop.

**Deliverables:**
- All 12 parameter tools implemented: `set_mission`, `get_current_params`, `reset_params`, `set_api`, `set_region`, `set_time_range`, `set_rgt`, `set_cycle`, `set_beams`, `set_surface_fit`, `set_photon_params`, `set_yapc`, `set_output_config`
- `sliderule://params/current` resource

**Done when:** Claude says "Set up an ATL06 request for Greenland, January–March 2023, beams 1 and 3, with surface fitting enabled" and the browser shows all parameters correctly configured.

---

### MVP 2: Request Execution + Data Analysis

**Depends on:** MVP 1

**Goal:** Submit a request and analyze results without touching the browser.

**Deliverables:**
- Request lifecycle tools (5): `submit_request`, `get_request_status`, `cancel_request`, `list_requests`, `delete_request`
- Data analysis tools (5): `run_sql`, `describe_data`, `get_elevation_stats`, `get_sample_data`, `export_data`
- Resources: `sliderule://requests/history`, `sliderule://requests/{id}/summary`, `sliderule://data/{id}/schema`, `sliderule://data/{id}/sample`
- Destructive action confirmations (`delete_request` → ConfirmDialog)

**Done when:** Claude configures parameters, submits a request, polls until complete, runs SQL to compute elevation statistics by beam, and exports results as GeoParquet — all without the researcher touching the browser.

---

### MVP 3: Map + Visualization ✓ COMPLETE

**Depends on:** MVP 0 (parallel with MVP 1–2)

**Goal:** Claude controls what the researcher sees on the map and in charts.

**Deliverables:**
- Map tools (6): `zoom_to_bbox`, `zoom_to_point`, `set_base_layer`, `set_map_view`, `toggle_graticule`, `set_draw_mode` ✓
- Visualization tools (5): `set_chart_field`, `set_x_axis`, `set_color_map`, `set_3d_config`, `set_plot_options` ✓
- Resources: `sliderule://map/viewport`, `sliderule://catalog/products`, `sliderule://catalog/fields/{api}`

**Done when:** Claude zooms to a region, switches to Arctic projection, sets up an elevation chart colored by beam, and configures 3D exaggeration — the researcher watches it happen in real-time.

---

### MVP 4: Documentation Search

**Depends on:** MVP 0 (parallel with MVP 1–3)

**Goal:** Claude answers questions about SlideRule by searching indexed documentation.

**Deliverables:**
- `scripts/build-docs-index.ts` — scrapes ReadTheDocs + extracts tooltips
- `src/assets/docs-index.json` — bundled doc chunks
- `docSearchEngine.ts` — DuckDB FTS table, index loading, live fetch + parse
- Documentation tools (4): `search_docs`, `fetch_docs`, `get_param_help`, `list_doc_sections`
- Documentation resources (5)

**Done when:** Claude answers "What photon classification should I use for glaciers?" by searching the docs, reading the relevant chunks, and synthesizing a contextual answer.

---

### Milestone dependency map

```
MVP 0: Connection + First Tools  ✓ COMPLETE (verified with Claude Desktop)
  │
  ├──► MVP 1: Parameter Control  ✓ COMPLETE (12/12 tools)
  │      │
  │      └──► MVP 2: Request Execution + Data Analysis  ✓ COMPLETE
  │
  ├──► MVP 3: Map + Visualization  ✓ COMPLETE (11/11 tools)
  │
  └──► MVP 4: Documentation Search  ✓ COMPLETE (4/4 tools)
```

**Critical path:** MVP 0 → MVP 1 → MVP 2. This is the shortest path to a researcher running a full workflow through Claude Desktop.

**Parallel:** MVP 3 and 4 only depend on MVP 0. They can proceed alongside MVP 1–2. Within each MVP, tool groups are independent and can be built in any order.

**Adding new tools only requires browser-side changes:** Add a definition to `toolDefinitions.ts`, add a handler to `toolExecutor.ts`, and register it. The MCP server is a transparent bridge — no server-side changes needed for new tools. The bootstrap tool list in `server.py` should be updated periodically to match, but it's not strictly required (tools will be fetched dynamically when the browser connects).

---

## Dependency Graph

```
┌─────────────────────┐
│  sliderule-mcp-     │
│  server/server.py   │  (MCP server process, standalone)
│  + pyproject.toml   │
└─────────┬───────────┘
          │
          │ WebSocket (localhost:3002)
          │
┌─────────▼───────────┐
│  mcpClient.ts       │──────────────────────────────────┐
│  + mcpStore.ts      │                                   │
└─────────┬───────────┘                                   │
          │                                               │
┌─────────▼───────────┐                                   │
│  mcpHandler.ts      │  (routes JSON-RPC to handlers)    │
└─────────┬───────────┘                                   │
          │                                               │
  ┌───────┼───────────────────┬────────────────┐          │
  ▼       ▼                   ▼                ▼          │
┌──────┐ ┌──────────┐ ┌────────────┐ ┌──────────────┐    │
│tool  │ │resource  │ │ prompt     │ │ Activity     │◄───┘
│Exec  │ │Resolver  │ │ Templates  │ │ Indicator    │
│.ts   │ │.ts       │ │ .ts        │ │ .vue         │
└──┬───┘ └────┬─────┘ └────────────┘ └──────────────┘
   │          │
   │  (both consume stores/DuckDB)
   │          │
   ├──────────┤
   ▼          ▼
┌─────────────────────────────────────────────────────┐
│  Existing: Pinia stores, DuckDB WASM, fetchUtils,   │
│  workerDomUtils, Dexie DB, OpenLayers, Deck.gl      │
└─────────────────────────────────────────────────────┘

                  INDEPENDENT TRACKS
                  (can be built in parallel)

Track A: Tool groups        Track B: Doc search
─────────────────           ─────────────────
Parameter tools ◄─ first    build-docs-index.ts
      │                          │
      ▼                          ▼
Request lifecycle           docs-index.json
+ Data analysis                  │
      │                          ▼
      ▼                     docSearchEngine.ts
Map tools                        │
      │                          ▼
      ▼                     Doc tools + resources
Visualization tools

                  FUTURE (separate effort)
                  ──────────────────────
                  Built-in Chat UI
                  (reuses toolExecutor.ts)
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
| Parameter tools working | All other tool groups | Validates the full pipeline end-to-end first |

### What can be parallelized

- **Track A** (tool groups) and **Track B** (doc search) are independent once the base pipeline works
- Tool groups within Track A are independent — parameter tools go first to validate the pipeline, then data/map/viz tools can be added in any order
- `build-docs-index.ts` has no runtime dependencies — it can be developed any time
- The MCP server process (`server.py`) is feature-complete for tool forwarding — new tools only require browser-side changes

---

## Verification Plan

1. **Unit tests:** Tool Executor — each tool tested against mock stores
2. **Integration tests:** MCP Handler — mock WebSocket messages in, verify tool calls and responses out
3. **E2E (Playwright):** Browser loads → MCP client connects → simulate tool call → verify store state changed
4. **Claude Desktop test:** Real Claude Desktop connects, discovers tools, executes multi-tool workflow
5. **Destructive test:** `reset_params` → ConfirmDialog appears → user approves → tool completes. User denies → tool returns error.
6. **Reconnection test:** Kill WebSocket → browser reconnects → tools work again
7. **No-browser test:** Claude calls a tool when no browser is connected → gets clear error message with `isError: true`
8. **SQL test:** `run_sql` with valid query returns results. Invalid query returns error. Query exceeding 30s times out.
10. **Doc search test:** `search_docs({ query: "photon classification" })` returns relevant chunks. `fetch_docs` fetches, parses, indexes, and subsequent searches include the new content.
