#!/usr/bin/env python3
"""SlideRule MCP Server — bridges MCP clients to the SlideRule web client over local/stdio."""

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
from importlib.metadata import version as pkg_version

from .common import BOOTSTRAP_TOOLS, PROMPTS, SERVER_INSTRUCTIONS, TIMEOUT_S, _ANALYZE_REGION_TEMPLATE

log = logging.getLogger("sliderule-mcp")

# ── State ────────────────────────────────────────────────────────
browser_ws = None
pending: dict[str, asyncio.Future] = {}
_mcp_write_stream = None
_background_tasks: set[asyncio.Task] = set()  # prevent GC of fire-and-forget tasks
PORT = int(os.environ.get("SR_MCP_PORT", "3002"))

cached_tools: list[types.Tool] = list(BOOTSTRAP_TOOLS)

# ── MCP Server ───────────────────────────────────────────────────
mcp_server = Server("sliderule-web", instructions=SERVER_INSTRUCTIONS)


@mcp_server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    return cached_tools


@mcp_server.list_prompts()
async def handle_list_prompts() -> list[types.Prompt]:
    return list(PROMPTS)


@mcp_server.get_prompt()
async def handle_get_prompt(name: str, arguments: dict[str, str] | None = None) -> types.GetPromptResult:
    if name == "analyze-region":
        args = arguments or {}
        location = args.get("location", "not specified")
        science_goal = args.get("science_goal", "not specified — ask the user")
        return types.GetPromptResult(
            description="Analyze a geographic region with SlideRule",
            messages=[
                types.PromptMessage(
                    role="user",
                    content=types.TextContent(
                        type="text",
                        text=_ANALYZE_REGION_TEMPLATE.format(
                            location=location,
                            science_goal=science_goal,
                        ),
                    ),
                )
            ],
        )
    raise ValueError(f"Unknown prompt: {name}")


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

    if name == "initialize":
        try:
            arguments["_server_version"] = pkg_version("sliderule-mcp")
        except Exception:
            arguments["_server_version"] = "unknown"

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


# ── Notify MCP client that the tool list changed ─────────────────
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
    "https://client.testsliderule.org",     # Deployed test client
    "https://ai.testsliderule.org",         # Deployed AI client
    "https://client.slideruleearth.io",     # Deployed production site
}


async def _ws_handler(websocket):
    global browser_ws, cached_tools

    origin = websocket.request.headers.get("Origin", "")
    if not origin or origin not in ALLOWED_ORIGINS:
        log.warning("Rejected WebSocket from origin: %r", origin or "(missing)")
        await websocket.close(4003, "Origin not allowed")
        return

    if browser_ws is not None:
        await browser_ws.close(4000, "Replaced by new connection")

    browser_ws = websocket
    log.info("Browser connected on ws://localhost:%d (origin: %s)", PORT, origin or "none")

    # Fetch definitions in background tasks so the message loop
    # can process the responses (avoids deadlock).
    task = asyncio.create_task(_fetch_and_cache_tools())
    _background_tasks.add(task)
    task.add_done_callback(_background_tasks.discard)

    try:
        async for raw in websocket:
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                log.warning("Malformed JSON from browser, dropping message (%d bytes)", len(raw))
                continue

            msg_id = msg.get("id")
            if msg_id is None:
                log.warning("Browser message missing JSON-RPC id, ignoring")
                continue

            future = pending.pop(msg_id, None)
            if future is None:
                log.debug("No pending request for message id=%s (may have timed out)", msg_id)
                continue

            if not future.done():
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
