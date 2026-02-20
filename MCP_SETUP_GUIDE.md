# Using Claude Desktop with SlideRule

This guide explains how to connect [Claude Desktop](https://claude.ai/download) to the [SlideRule](https://slideruleearth.io) web client so you can control satellite data processing through a natural-language conversation.

## What This Does

Once set up, you can ask Claude things like:

- "Show me ice sheet elevations in Greenland"
- "Get canopy heights for the Amazon rainforest"
- "What's the average elevation in this region?"

Claude sends your requests to the SlideRule web client running in your browser. The web client handles all the satellite data processing, mapping, and analysis — Claude provides the conversational interface and an interactive UI/UX experience for analysis.

## Prerequisites

- **macOS or Windows** computer
- A **Claude Pro, Team, or Enterprise** subscription (required for Claude Desktop with MCP)
- A modern web browser (Chrome, Firefox, Safari, or Edge)

## Step 1: Install Claude Desktop

Download and install Claude Desktop from [claude.ai/download](https://claude.ai/download).

## Step 2: Install uv (Python package runner)

The MCP server is a small Python package. Claude Desktop uses a tool called `uv` to run it automatically — you don't need to manage Python environments yourself.

**macOS** (open Terminal and paste):

```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

**Windows** (open PowerShell and paste):

```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

After installing, close and reopen your terminal, then verify it works:

```bash
uv --version
```

You should see a version number like `uv 0.x.x`.

## Step 3: Configure Claude Desktop

You need to tell Claude Desktop about the SlideRule MCP server by editing a configuration file.

### Find the config file

**macOS:**

1. Open Claude Desktop
2. From the menu bar, click **Claude > Settings** (or press `Cmd + ,`)
3. Click **Developer** in the sidebar
4. Click **Edit Config**

This opens the file `~/Library/Application Support/Claude/claude_desktop_config.json` in your text editor.

**Windows:**

The config file is located at `%APPDATA%\Claude\claude_desktop_config.json`. You can open it with Notepad.

### Add the SlideRule server

Replace the contents of the config file with:

```json
{
  "mcpServers": {
    "sliderule": {
      "command": "uvx",
      "args": [
        "sliderule-mcp"
      ]
    }
  }
}
```

Save the file and **restart Claude Desktop** (quit fully and reopen).

## Step 4: Open the SlideRule Web Client

Open your browser and go to:

**[https://testsliderule.org](https://testsliderule.org)**

You should see the SlideRule map interface. In the top navigation bar, look for the **MCP** indicator. Click it and verify it shows **Connected**. If it shows disconnected, click **Connect**.

## Step 5: Start a Conversation

Back in Claude Desktop, start a new conversation. Claude will automatically detect the SlideRule tools are available.

Begin by asking Claude to initialize:

> "Initialize the SlideRule web client"

Claude will call the `initialize` tool and respond with a summary of available capabilities. From there, you can ask Claude to:

- **Set a region**: "Set the region to the Jakobshavn Glacier in Greenland"
- **Choose a preset**: "I want to look at ICESat-2 surface elevations"
- **Run a request**: "Submit the request and show me the results"
- **Analyze data**: "What's the elevation range? Show me a histogram."
- **Query data**: "How many points are below sea level?"

## Troubleshooting

### MCP indicator shows "Disconnected" in the browser

- Make sure Claude Desktop is running and you've restarted it after editing the config
- Click the MCP indicator in the browser and click **Connect**
- Check that the "dev" checkbox is **unchecked** (it should be off for normal use)

### Claude doesn't see the SlideRule tools

- Make sure you saved the config file and fully restarted Claude Desktop (Cmd+Q on macOS, not just closing the window)
- Check that `uv` is installed by running `uv --version` in your terminal
- In Claude Desktop, go to **Settings > Developer** and verify "sliderule" appears in the MCP servers list

### "Browser not connected" errors in Claude

- Make sure the SlideRule web client is open in your browser
- Check the MCP indicator shows **Connected** (green dot)
- Try refreshing the browser page

### Tools seem outdated

If Claude's tools don't match what you expect, the cached version may be stale. Run this in your terminal to clear the cache:

```bash
uv cache clean sliderule-mcp --force
```

Then restart Claude Desktop.

## How It Works

```
Claude Desktop  <-- stdio -->  MCP Server  <-- WebSocket -->  Browser (SlideRule)
  (conversation)               (sliderule-mcp              (map, data processing,
                                via uvx)                     DuckDB analysis)
```

1. You type a message in Claude Desktop
2. Claude decides which SlideRule tool to call (e.g., `set_region`, `submit_request`)
3. The MCP server forwards the tool call to the SlideRule web client over a local WebSocket
4. The web client executes the action (updates the map, runs a query, etc.) and returns the result
5. Claude receives the result and responds to you in natural language

All data processing happens in your browser — the MCP server is just a lightweight bridge.
