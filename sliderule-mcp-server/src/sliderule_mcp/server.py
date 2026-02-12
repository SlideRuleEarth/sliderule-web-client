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
TIMEOUT_S = 30
PORT = int(os.environ.get("SR_MCP_PORT", "3002"))

# ── Bootstrap tool definitions ────────────────────────────────────
# Advertised immediately so Claude Desktop sees tools on startup.
# Overridden by the browser's live definitions when it connects.
BOOTSTRAP_TOOLS = [
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
        name="get_current_params",
        description=(
            "Get the current request parameter state including mission, "
            "selected API, server URL, and key configuration values."
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
]

cached_tools: list[types.Tool] = list(BOOTSTRAP_TOOLS)

# ── MCP Server ───────────────────────────────────────────────────
mcp_server = Server("sliderule-web")


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
async def _ws_handler(websocket):
    global browser_ws, cached_tools

    if browser_ws is not None:
        await browser_ws.close(4000, "Replaced by new connection")

    browser_ws = websocket
    log.info("Browser connected on ws://localhost:%d", PORT)

    # Fetch tool definitions in a background task so the message loop
    # can process the response (avoids deadlock).
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
            log.info("Browser disconnected, restored %d bootstrap tools", len(cached_tools))


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
                    notification_options=NotificationOptions(tools_changed=True),
                ),
            )


def main():
    logging.basicConfig(
        level=logging.INFO, stream=sys.stderr, format="[mcp] %(message)s"
    )
    asyncio.run(_run())


if __name__ == "__main__":
    main()
