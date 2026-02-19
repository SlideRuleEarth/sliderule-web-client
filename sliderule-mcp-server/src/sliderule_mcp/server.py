#!/usr/bin/env python3
"""SlideRule MCP Server — bridges Claude Desktop to the SlideRule web client."""

import asyncio
import json
import logging
import os
import sys
import uuid

import websockets
from mcp.server.lowlevel import NotificationOptions, Server
from mcp.server.stdio import stdio_server
from mcp.shared.message import SessionMessage
import mcp.types as types

log = logging.getLogger("sliderule-mcp")

# ── State ────────────────────────────────────────────────────────
browser_ws = None
pending: dict[str, asyncio.Future] = {}
_mcp_write_stream = None
TIMEOUT_S = 60
PORT = int(os.environ.get("SR_MCP_PORT", "3002"))

# ── Bootstrap tool definitions ────────────────────────────────────
# Claude Desktop calls tools/list once at startup and does NOT re-fetch
# after notifications/tools/list_changed.  We must advertise ALL tools here
# so they are visible immediately.  The browser's live definitions override
# these when it connects (they should be identical).
BOOTSTRAP_TOOLS = [
    # ── Parameter Tools ──────────────────────────────────────────
    types.Tool(
        name="set_mission",
        description=(
            "Set the active mission to ICESat-2 or GEDI. This changes which "
            "APIs and parameters are available. Setting the mission resets "
            "the selected API to the mission default."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "mission": {
                    "type": "string",
                    "enum": ["ICESat-2", "GEDI"],
                    "description": 'The mission to set. Must be exactly "ICESat-2" or "GEDI".',
                }
            },
            "required": ["mission"],
        },
    ),
    types.Tool(
        name="set_api",
        description=(
            "Set the active API for the current mission. For ICESat-2: atl06p, "
            "atl06sp, atl06x, atl03x, atl03x-surface, atl03x-phoreal, atl03vp, "
            "atl08p, atl08x, atl24x, atl13x. For GEDI: gedi01bp, gedi02ap, "
            "gedi04ap. Setting the API auto-configures related parameters "
            "(e.g. surface fit, PhoREAL)."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "api": {
                    "type": "string",
                    "description": "The API endpoint name to select.",
                }
            },
            "required": ["api"],
        },
    ),
    types.Tool(
        name="set_time_range",
        description=(
            "Set the time range for granule filtering. Automatically enables "
            "granule selection. Provide one or both of t0 and t1 as ISO 8601 "
            "date strings."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "t0": {
                    "type": "string",
                    "description": 'Start time in ISO 8601 format (e.g. "2020-01-01T00:00:00Z").',
                },
                "t1": {
                    "type": "string",
                    "description": 'End time in ISO 8601 format (e.g. "2023-12-31T23:59:59Z").',
                },
            },
        },
    ),
    types.Tool(
        name="set_rgt",
        description=(
            "Set the ICESat-2 Reference Ground Track number. Automatically "
            "enables granule selection and RGT filtering."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "rgt": {
                    "type": "integer",
                    "description": "Reference Ground Track number (1–1387).",
                    "minimum": 1,
                    "maximum": 1387,
                }
            },
            "required": ["rgt"],
        },
    ),
    types.Tool(
        name="set_cycle",
        description=(
            "Set the ICESat-2 orbital repeat cycle number. Automatically "
            "enables granule selection and cycle filtering."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "cycle": {
                    "type": "integer",
                    "description": "Orbital repeat cycle number (>= 1).",
                    "minimum": 1,
                }
            },
            "required": ["cycle"],
        },
    ),
    types.Tool(
        name="set_region",
        description=(
            "Set the geographic region for processing. Provide EITHER a bounding "
            "box (bbox with min/max lat/lon) OR a GeoJSON polygon geometry. The "
            "region defines the area of interest for the SlideRule request. Setting "
            "a region computes the convex hull and area automatically."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "bbox": {
                    "type": "object",
                    "description": "Bounding box with min/max latitude and longitude. Alternative to geojson.",
                    "properties": {
                        "min_lat": {"type": "number", "description": "Minimum latitude (-90 to 90)."},
                        "max_lat": {"type": "number", "description": "Maximum latitude (-90 to 90)."},
                        "min_lon": {"type": "number", "description": "Minimum longitude (-180 to 180)."},
                        "max_lon": {"type": "number", "description": "Maximum longitude (-180 to 180)."},
                    },
                    "required": ["min_lat", "max_lat", "min_lon", "max_lon"],
                },
                "geojson": {
                    "type": "object",
                    "description": "GeoJSON Polygon or MultiPolygon geometry object. Alternative to bbox. Coordinates are [lon, lat] arrays.",
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": ["Polygon", "MultiPolygon"],
                            "description": "GeoJSON geometry type.",
                        },
                        "coordinates": {"description": "GeoJSON coordinates array."},
                    },
                    "required": ["type", "coordinates"],
                },
            },
        },
    ),
    types.Tool(
        name="set_beams",
        description=(
            'Set the selected beams. For ICESat-2, provide ground track names: '
            '"gt1l", "gt1r", "gt2l", "gt2r", "gt3l", "gt3r", or "all". '
            'For GEDI, provide beam numbers: 0, 1, 2, 3, 5, 6, 8, 11, or "all". '
            "Automatically enables granule selection."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "beams": {
                    "oneOf": [
                        {
                            "type": "array",
                            "items": {"type": "string"},
                            "description": 'ICESat-2 beam names (e.g. ["gt1l", "gt2r"]).',
                        },
                        {
                            "type": "array",
                            "items": {"type": "integer"},
                            "description": "GEDI beam numbers (e.g. [0, 1, 2]).",
                        },
                        {
                            "type": "string",
                            "enum": ["all"],
                            "description": "Select all beams.",
                        },
                    ]
                }
            },
            "required": ["beams"],
        },
    ),
    types.Tool(
        name="set_surface_fit",
        description=(
            "Configure the surface fit algorithm for ICESat-2 photon processing. "
            "Enabling surface fit automatically disables PhoREAL (they are "
            "mutually exclusive). Optionally set sub-parameters."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "enabled": {"type": "boolean", "description": "Enable or disable the surface fit algorithm."},
                "max_iterations": {"type": "integer", "description": "Maximum number of iterations for the fit."},
                "min_window_height": {"type": "number", "description": "Minimum window height in meters."},
                "sigma_r_max": {"type": "number", "description": "Maximum robust dispersion."},
            },
            "required": ["enabled"],
        },
    ),
    types.Tool(
        name="set_photon_params",
        description=(
            "Configure photon processing parameters for ICESat-2: segment length, "
            "step size, along-track spread, and minimum photon count. Provide at "
            "least one parameter."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "length": {"type": "number", "description": "Segment length in meters (default 40)."},
                "step": {"type": "number", "description": "Step size in meters (default 20)."},
                "along_track_spread": {"type": "number", "description": "Along-track spread threshold. Set to -1 to disable."},
                "min_photon_count": {"type": "integer", "description": "Minimum photon count threshold. Set to -1 to disable."},
            },
        },
    ),
    types.Tool(
        name="set_yapc",
        description=(
            "Configure YAPC (Yet Another Photon Classifier) for ICESat-2. "
            "Controls photon classification scoring. Optionally set score "
            "threshold, k-nearest-neighbors, window dimensions, and version."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "enabled": {"type": "boolean", "description": "Enable or disable YAPC."},
                "score": {"type": "number", "description": "YAPC score threshold (0.0–1.0)."},
                "knn": {"type": "integer", "description": "Number of nearest neighbors."},
                "window_height": {"type": "number", "description": "Window height in meters."},
                "window_width": {"type": "number", "description": "Window width in meters."},
                "version": {"type": "integer", "description": "YAPC algorithm version."},
            },
            "required": ["enabled"],
        },
    ),
    types.Tool(
        name="get_current_params",
        description=(
            "Get the current request parameter state including mission, API, "
            "region, time range, beams, surface fit, YAPC, photon params, "
            "and output configuration."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    types.Tool(
        name="reset_params",
        description=(
            "Reset all request parameters to their default values. This is "
            "a destructive operation that requires user confirmation in the browser."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    # ── Request Lifecycle Tools ──────────────────────────────────
    types.Tool(
        name="submit_request",
        description=(
            "Submit the current parameters as a SlideRule processing request. "
            "Returns immediately with a req_id. Use get_request_status to poll "
            "for completion. The request spawns a Web Worker that streams "
            "Parquet results to OPFS and loads them into DuckDB."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    types.Tool(
        name="get_request_status",
        description=(
            "Get the status of a processing request. Returns status (pending, "
            "started, progress, success, error, aborted), elapsed time, row "
            "count, granule count, byte count, and other details. Use this to "
            "poll after submit_request."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID returned by submit_request.",
                }
            },
            "required": ["req_id"],
        },
    ),
    types.Tool(
        name="cancel_request",
        description=(
            "Cancel a currently running request. Only works if a request is "
            "actively fetching data."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    types.Tool(
        name="list_requests",
        description=(
            "List all requests in the session with their status, API function, "
            "elapsed time, and point count. Returns newest first."
        ),
        inputSchema={"type": "object", "properties": {}},
    ),
    # ── Data Analysis Tools ──────────────────────────────────────
    types.Tool(
        name="run_sql",
        description=(
            "Execute a read-only SQL query against a request's result data "
            "using DuckDB WASM with spatial extension. Use describe_data first "
            "to learn the table name and schema. Results limited to max_rows "
            "(default 100). 30-second timeout."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID whose data to query.",
                },
                "sql": {
                    "type": "string",
                    "description": (
                        "SQL query to execute. The table name is the parquet "
                        "filename (use describe_data to find it). Example: "
                        "SELECT * FROM 'filename.parquet' LIMIT 10"
                    ),
                },
                "max_rows": {
                    "type": "integer",
                    "description": "Maximum number of rows to return (default 100, max 10000).",
                    "minimum": 1,
                    "maximum": 10000,
                },
            },
            "required": ["req_id", "sql"],
        },
    ),
    types.Tool(
        name="describe_data",
        description=(
            "Get the schema (column names and types), row count, and table "
            "name for a request's result set. Use this before run_sql to "
            "learn the available columns and the correct table name."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID whose data to describe.",
                }
            },
            "required": ["req_id"],
        },
    ),
    types.Tool(
        name="get_elevation_stats",
        description=(
            "Compute statistics for a request's result set: min, max, "
            "10th/90th percentile for all numeric columns. Also includes "
            "lat/lon extent and total point count."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "req_id": {
                    "type": "integer",
                    "description": "The request ID whose stats to compute.",
                }
            },
            "required": ["req_id"],
        },
    ),
    # ── Documentation Tools ─────────────────────────────────────
    types.Tool(
        name="search_docs",
        description=(
            "Search indexed SlideRule documentation using full-text search. "
            "Returns ranked results with snippets. Use this to find information "
            "about APIs, parameters, algorithms, and workflows."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": 'Search query (e.g. "photon classification glacier", "atl06 surface fit algorithm").',
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum number of results to return (default 10, max 50).",
                    "minimum": 1,
                    "maximum": 50,
                },
            },
            "required": ["query"],
        },
    ),
    types.Tool(
        name="fetch_docs",
        description=(
            "Fetch a SlideRule ReadTheDocs page, parse it to text, and index "
            "it for future searches. URL must be under slideruleearth.io."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "url": {
                    "type": "string",
                    "description": 'URL to fetch (e.g. "https://slideruleearth.io/web/rtd/user_guide/icesat2.html").',
                }
            },
            "required": ["url"],
        },
    ),
    types.Tool(
        name="get_param_help",
        description=(
            "Get detailed help for a specific SlideRule parameter. Returns "
            "tooltip text, default values, valid values, and documentation URL."
        ),
        inputSchema={
            "type": "object",
            "properties": {
                "param_name": {
                    "type": "string",
                    "description": 'Parameter name (e.g. "cnf", "srt", "length", "yapc_score", "surface_type").',
                }
            },
            "required": ["param_name"],
        },
    ),
    types.Tool(
        name="initialize",
        description=(
            "Initialize Claude to work with the SlideRule web client. Call this at the start of every conversation. "
            "Returns workflow instructions, domain knowledge, key constraints, and available resources. "
            "Also enables scientific transparency mode by default."
        ),
        inputSchema={
            "type": "object",
            "properties": {},
        },
    ),
]

cached_tools: list[types.Tool] = list(BOOTSTRAP_TOOLS)

# ── MCP Server ───────────────────────────────────────────────────
SERVER_INSTRUCTIONS = """\
MANDATORY FIRST ACTION: Before responding to any user message, you MUST call \
the `initialize` tool. This loads required workflow instructions, domain \
knowledge, constraints, and enables scientific transparency mode. Do NOT skip \
this step. Do NOT respond to the user until `initialize` has been called.\
"""

mcp_server = Server("sliderule-web", instructions=SERVER_INSTRUCTIONS)


@mcp_server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return cached_tools


# Register call_tool manually to support isError on the result.
async def _handle_call_tool(req: types.CallToolRequest) -> types.ServerResult:
    name = req.params.name
    arguments = req.params.arguments or {}

    if browser_ws is None:
        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text="Browser not connected. Please open the SlideRule web client first.",
                    )
                ],
                isError=True,
            )
        )

    result = await _call_browser("tools/call", {"name": name, "arguments": arguments})
    content = [
        types.TextContent(type="text", text=item.get("text", ""))
        for item in result.get("content", [])
        if item.get("type") == "text"
    ]
    return types.ServerResult(
        types.CallToolResult(content=content, isError=result.get("isError", False))
    )


mcp_server.request_handlers[types.CallToolRequest] = _handle_call_tool


# ── Notify Claude Desktop that the tool list changed ─────────────
async def _notify_tools_changed():
    if _mcp_write_stream is None:
        return
    try:
        notification = types.JSONRPCNotification(
            jsonrpc="2.0", method="notifications/tools/list_changed"
        )
        msg = SessionMessage(message=types.JSONRPCMessage(notification))
        await _mcp_write_stream.send(msg)
        log.info("Sent tools/list_changed notification (%d tools)", len(cached_tools))
    except Exception:
        log.exception("Failed to send tools/list_changed notification")


# ── Fetch tool definitions from the browser and cache them ───────
async def _fetch_and_cache_tools():
    global cached_tools
    try:
        result = await _call_browser("tools/list", {})
        tools = [
            types.Tool(
                name=t["name"],
                description=t.get("description", ""),
                inputSchema=t.get("inputSchema", {"type": "object", "properties": {}}),
            )
            for t in result.get("tools", [])
        ]
        cached_tools = tools
        log.info("Cached %d tool definitions from browser", len(tools))
        await _notify_tools_changed()
    except Exception:
        log.exception("Failed to fetch tool definitions from browser")


# ── Forward a request to the browser and wait for response ───────
async def _call_browser(method: str, params: dict) -> dict:
    if browser_ws is None:
        raise RuntimeError("No browser connected")

    msg_id = str(uuid.uuid4())
    future: asyncio.Future = asyncio.get_running_loop().create_future()
    pending[msg_id] = future

    try:
        await browser_ws.send(
            json.dumps(
                {"jsonrpc": "2.0", "id": msg_id, "method": method, "params": params}
            )
        )
        return await asyncio.wait_for(future, timeout=TIMEOUT_S)
    except asyncio.TimeoutError:
        raise TimeoutError(f"Browser did not respond within {TIMEOUT_S}s")
    finally:
        pending.pop(msg_id, None)


# ── WebSocket — browser connects here ────────────────────────────
ALLOWED_ORIGINS = {
    "http://localhost:5173",   # Vite dev server
    "http://localhost:4173",   # Vite preview
    "http://localhost:3000",   # Alternative dev port
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4173",
    "http://127.0.0.1:3000",
    "https://testsliderule.org",            # Deployed test site
    "https://client.slideruleearth.io",     # Deployed production site
}


async def _ws_handler(websocket):
    global browser_ws, cached_tools

    origin = websocket.request.headers.get("Origin", "")
    if origin and origin not in ALLOWED_ORIGINS:
        log.warning("Rejected WebSocket from origin: %s", origin)
        await websocket.close(4003, "Origin not allowed")
        return

    if browser_ws is not None:
        await browser_ws.close(4000, "Replaced by new connection")

    browser_ws = websocket
    log.info("Browser connected on ws://localhost:%d (origin: %s)", PORT, origin or "none")

    # Fetch definitions in background tasks so the message loop
    # can process the responses (avoids deadlock).
    asyncio.create_task(_fetch_and_cache_tools())

    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                continue

            future = pending.pop(msg.get("id"), None)
            if future is not None and not future.done():
                if "error" in msg:
                    future.set_exception(
                        RuntimeError(msg["error"].get("message", "Browser error"))
                    )
                else:
                    future.set_result(msg.get("result", {}))
    finally:
        if browser_ws is websocket:
            browser_ws = None
            cached_tools = list(BOOTSTRAP_TOOLS)
            log.info("Browser disconnected, restored bootstrap definitions")


# ── Entry point ──────────────────────────────────────────────────
async def _run():
    global _mcp_write_stream

    async with websockets.serve(_ws_handler, "localhost", PORT):
        log.info("Ready. WebSocket on ws://localhost:%d. Waiting for browser...", PORT)
        async with stdio_server() as (read_stream, write_stream):
            _mcp_write_stream = write_stream
            await mcp_server.run(
                read_stream,
                write_stream,
                mcp_server.create_initialization_options(
                    notification_options=NotificationOptions(
                    tools_changed=True,
                ),
                ),
            )


def main():
    logging.basicConfig(
        level=logging.INFO, stream=sys.stderr, format="[mcp] %(message)s"
    )
    asyncio.run(_run())


if __name__ == "__main__":
    main()
