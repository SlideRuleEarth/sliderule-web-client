# SlideRule Web Client — AI Assistant Setup Guide

## What This Does

MCP (Model Context Protocol) lets you control the SlideRule web client through Claude Desktop using natural language. You open the web client in your browser, start a conversation in Claude Desktop, and Claude operates the app for you — setting parameters, submitting requests, analyzing data, and navigating the map — while you watch the UI update in real-time.

**Example:** You say "Set up an ATL06 request for Greenland in 2023, submit it, then show me elevation statistics by beam." Claude configures the parameters, submits the processing request, waits for results, runs SQL to compute statistics, and presents the findings — all without you touching the browser.

---

## Prerequisites

1. **Claude Desktop** — download from [claude.ai/download](https://claude.ai/download)
2. **uv** (Python package runner) — install with:
   ```bash
   # macOS
   brew install uv

   # Windows
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

   # Linux
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

---

## Setup (One-Time)

### 1. Configure Claude Desktop

Open the Claude Desktop configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add the SlideRule MCP server:

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

Save the file and restart Claude Desktop.

### 2. Verify the Server is Running

In Claude Desktop, go to **Settings > Developer**. You should see `sliderule` listed with a green **running** badge. If it shows an error, check that `uv` is installed and on your PATH.

### 3. Open the Web Client

Open the SlideRule web client in your browser: [https://ai.testsliderule.org](https://ai.testsliderule.org)

### 4. Confirm the Connection

In the web client's top navigation bar, look for the **MCP** indicator (a colored dot next to "MCP"):

- **Green dot** — Connected. Claude Desktop and the browser are linked.
- **Yellow dot** — Connecting or reconnecting.
- **Grey dot** — Disconnected. Click **Connect** to retry.

Click the MCP indicator to expand the activity panel and see the connection status and tool call log.

---

## How to Use

Once connected, switch to Claude Desktop and start a conversation. Claude has access to 42 tools that control the web client. Here are some things you can ask:

### Configure a Request

> "Set up an ATL06 request for the Jakobshavn glacier region in Greenland, January through March 2023, using beams 1 and 3 with surface fitting enabled."

Claude will set the mission, API, region, time range, beam selection, and surface fitting parameters. You'll see each parameter update in the browser.

### Submit and Analyze

> "Submit the request and let me know when it's done. Then show me elevation statistics."

Claude submits the processing request, polls for completion, and runs SQL queries to compute statistics on the results.

### Explore Data with SQL

> "Run a SQL query to find the mean and standard deviation of elevation grouped by ground track."

Claude executes SQL against the in-memory DuckDB results and returns a formatted table.

### Control the Map

> "Zoom to the Greenland ice sheet, switch to Arctic projection, and turn on the graticule."

Claude adjusts the map view, changes the projection, and toggles overlays.

### Customize Visualizations

> "Set the elevation chart to color by beam, increase the symbol size, and enable the photon cloud overlay."

Claude configures the chart and plot settings.

### Get Help

> "What photon classification parameters should I use for glacier studies?"

Claude searches the indexed SlideRule documentation and synthesizes an answer with relevant context.

### Multi-Step Workflows

> "Compare elevation data for this glacier between 2019 and 2023. Set up both requests, analyze the differences, and show me a summary."

Claude orchestrates the full workflow across multiple requests and analysis steps.

---

## Available Capabilities

### Parameter Configuration (13 tools)
Set mission (ICESat-2, GEDI), processing API, geographic region, time range, ground tracks, beams, surface fitting, photon parameters, YAPC classifier, and output format.

### Request Management (5 tools)
Submit processing requests, check status, cancel running requests, list all requests, and delete completed ones.

### Data Analysis (5 tools)
Run SQL queries, describe data schemas, compute elevation statistics, retrieve data samples, and export results as GeoParquet.

### Map Control (6 tools)
Zoom to bounding boxes or points, change base layers, switch map projections (Arctic, Antarctic, Web Mercator), toggle the graticule, and set drawing modes.

### Visualization (6 tools)
Configure chart fields, axes, color palettes, 3D view settings, plot options (symbol size, photon cloud, slope lines), and read current plot configuration.

### Documentation (4 tools)
Search indexed SlideRule documentation, fetch and index new documentation pages, get help for specific parameters, and list available doc sections.

### Navigation (3 tools)
Navigate between views, start guided tours of the UI, and check the current page.

---

## Security

- **Everything runs locally.** The MCP server is a small process on your machine. It communicates with the browser over `localhost` only — nothing is sent to external servers (beyond the normal SlideRule API requests the web client already makes).
- **You see everything.** Every tool call appears in the MCP activity panel in the browser. Nothing happens silently.
- **Destructive actions require your approval.** Resetting parameters or deleting requests shows a confirmation dialog in the browser. Claude waits for you to approve or deny.
- **SQL is read-only.** Queries run against in-memory data with a 30-second timeout. No access to your filesystem.

---

## Troubleshooting

### MCP indicator shows "Reconnecting"

1. **Is Claude Desktop running?** The MCP server only runs while Claude Desktop is open.
2. **Is the server running?** Check **Settings > Developer** in Claude Desktop. The `sliderule` entry should show a green "running" badge.
3. **Restart Claude Desktop.** Quit and reopen it. The MCP server restarts automatically.

### Server shows an error in Claude Desktop

1. **Is `uv` installed?** Run `uv --version` in your terminal. If not found, install it (see Prerequisites).
2. **Check the logs:**
   - macOS: `~/Library/Logs/Claude/mcp-server-sliderule.log`
   - Also: `~/Library/Logs/Claude/mcp.log`

### Claude doesn't see the tools

1. Make sure the `sliderule` entry in your config file is correct (check for JSON syntax errors).
2. Restart Claude Desktop after editing the config.
3. Start a **new conversation** — Claude discovers tools at the start of each conversation.

### "Browser not connected" error in Claude

The web client isn't open or the WebSocket connection dropped. Open the web client in your browser and check that the MCP indicator shows a green dot.

### Tools execute but nothing happens in the browser

Make sure you're looking at the correct browser tab. The web client must be the active SlideRule tab connected to the MCP server.

---

## Compatibility

| Client | Supported | Notes |
|---|---|---|
| Claude Desktop (Chat mode) | Yes | Fully supported. This is the primary interface. |
| Claude Desktop (Cowork mode) | No | Known limitation — local MCP servers are not loaded in Cowork mode. |
| claude.ai (web/mobile) | No | Requires a remote server architecture not yet available. |

---

## Updating

The MCP server updates automatically. When a new version is published, `uvx` downloads it the next time Claude Desktop restarts the server. To force an update:

```bash
uv cache clean sliderule-mcp --force
```

Then restart Claude Desktop.
