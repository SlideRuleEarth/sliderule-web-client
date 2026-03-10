#!/usr/bin/env python3
"""SlideRule Remote MCP Server — cloud-hosted bridge for MCP clients to browser.

This is the cloud entry point. It exposes:
  - /mcp              Streamable HTTP (MCP clients connect here with Bearer JWT)
  - /ws               WebSocket (browser connects here, JWT via first-message auth)
  - /health           ALB health check
  - /.well-known/oauth-protected-resource/mcp   RFC 9728 metadata (points to authenticator)
"""

import asyncio
import collections
import contextlib
import json
import logging
import os
import sys
import time
from collections.abc import AsyncIterator

import uvicorn
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.middleware.authentication import AuthenticationMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.routing import Route, WebSocketRoute
from starlette.websockets import WebSocket, WebSocketDisconnect

import mcp.types as types
from mcp.server.auth.middleware.auth_context import AuthContextMiddleware, get_access_token
from mcp.server.auth.middleware.bearer_auth import BearerAuthBackend, RequireAuthMiddleware
from mcp.server.auth.routes import create_protected_resource_routes
from mcp.server.lowlevel import Server
from mcp.server.streamable_http_manager import StreamableHTTPSessionManager

from importlib.metadata import version as pkg_version
from pydantic import AnyHttpUrl

from .common import BOOTSTRAP_TOOLS, SERVER_INSTRUCTIONS
from .jwt_verifier import JwtVerifier
from .session_router import SessionRouter

log = logging.getLogger("sliderule-mcp")

# ── Configuration ─────────────────────────────────────────────────
DOMAIN = os.environ.get("SR_DOMAIN", "slideruleearth.io")
AUTH_HOSTNAME = os.environ.get("SR_AUTH_HOSTNAME", f"login.{DOMAIN}")
MCP_HOSTNAME = os.environ.get("SR_MCP_HOSTNAME", f"mcp.{DOMAIN}")
PORT = int(os.environ.get("SR_MCP_PORT", "8000"))

JWKS_URL = f"https://{AUTH_HOSTNAME}/.well-known/jwks.json"
AUDIENCE = f"https://{MCP_HOSTNAME}"
ISSUER = f"https://{AUTH_HOSTNAME}"
AUTH_SERVER_URL = f"https://{AUTH_HOSTNAME}"

# ── Security ─────────────────────────────────────────────────────
ALLOWED_WS_ORIGINS = {
    f"https://client.{DOMAIN}",
    f"https://ai.{DOMAIN}",
    f"https://{DOMAIN}",
    "http://localhost:5173",   # local dev
    "http://localhost:4173",   # local preview
}
WS_MAX_MESSAGE_SIZE = 10_485_760  # 10 MB (run_sql results can be several MB)
WS_RATE_LIMIT_PER_MINUTE = 30   # max WebSocket connections per IP per minute

# Simple per-IP rate limiter for WebSocket connections
_ws_conn_times: dict[str, collections.deque] = collections.defaultdict(
    lambda: collections.deque(maxlen=WS_RATE_LIMIT_PER_MINUTE)
)

# ── Shared instances ──────────────────────────────────────────────
jwt_verifier = JwtVerifier(jwks_url=JWKS_URL, audience=AUDIENCE, issuer=ISSUER)
router = SessionRouter()

# ── MCP Server (low-level) ───────────────────────────────────────
mcp_server = Server("sliderule-web", instructions=SERVER_INSTRUCTIONS)


@mcp_server.list_tools()
async def handle_list_tools() -> list[types.Tool]:
    # Return tools for the authenticated user's session if available,
    # otherwise return bootstrap tools.
    token = get_access_token()
    if token:
        session = router.get_session(token.client_id)
        if session:
            return session.cached_tools
    return list(BOOTSTRAP_TOOLS)


async def _handle_call_tool(req: types.CallToolRequest) -> types.ServerResult:
    """Route tool calls to the authenticated user's browser."""
    token = get_access_token()
    if token is None:
        return types.ServerResult(
            types.CallToolResult(
                content=[types.TextContent(type="text", text="Authentication required.")],
                isError=True,
            )
        )

    user_id = token.client_id  # This is the GitHub username (sub claim)
    session = router.get_session(user_id)

    if session is None or session.browser_ws is None:
        return types.ServerResult(
            types.CallToolResult(
                content=[
                    types.TextContent(
                        type="text",
                        text="Browser not connected. Please open the SlideRule web client and connect to MCP.",
                    )
                ],
                isError=True,
            )
        )

    name = req.params.name
    arguments = dict(req.params.arguments or {})

    if name == "initialize":
        try:
            arguments["_server_version"] = pkg_version("sliderule-mcp")
        except Exception:
            arguments["_server_version"] = "unknown"
        arguments["_server_mode"] = "remote"

    try:
        result = await router.call_browser(user_id, "tools/call", {"name": name, "arguments": arguments})
    except RuntimeError as e:
        return types.ServerResult(
            types.CallToolResult(
                content=[types.TextContent(type="text", text=str(e))],
                isError=True,
            )
        )

    content = [
        types.TextContent(type="text", text=item.get("text", ""))
        for item in result.get("content", [])
        if item.get("type") == "text"
    ]
    return types.ServerResult(
        types.CallToolResult(content=content, isError=result.get("isError", False))
    )


mcp_server.request_handlers[types.CallToolRequest] = _handle_call_tool


# ── Streamable HTTP session manager ──────────────────────────────
session_manager = StreamableHTTPSessionManager(app=mcp_server)


class _MCPEndpoint:
    """ASGI app that delegates to the session manager."""

    async def __call__(self, scope, receive, send):
        await session_manager.handle_request(scope, receive, send)


# ── WebSocket endpoint (browser connects here) ──────────────────
def _check_ws_rate_limit(client_ip: str) -> bool:
    """Return True if the IP is within the connection rate limit."""
    now = time.time()
    times = _ws_conn_times[client_ip]
    # Remove entries older than 60 seconds
    while times and times[0] < now - 60:
        times.popleft()
    if len(times) >= WS_RATE_LIMIT_PER_MINUTE:
        return False
    times.append(now)
    return True


async def ws_endpoint(websocket: WebSocket):
    """Handle browser WebSocket connections with JWT authentication.

    The JWT is sent as the first message after the WebSocket is accepted,
    rather than as a query parameter, to avoid leaking tokens in logs.
    """
    # Origin validation
    origin = websocket.headers.get("origin", "")
    if origin and origin not in ALLOWED_WS_ORIGINS:
        log.warning("Rejected WebSocket from disallowed origin: %s", origin)
        await websocket.close(4003, "Origin not allowed")
        return

    # Rate limiting per real client IP (ALB appends the true client IP as the last entry)
    forwarded = websocket.headers.get("x-forwarded-for", "")
    client_ip = forwarded.split(",")[-1].strip() if forwarded else (
        websocket.client.host if websocket.client else "unknown"
    )
    if not _check_ws_rate_limit(client_ip):
        log.warning("Rate limited WebSocket connection from %s", client_ip)
        await websocket.close(4029, "Too many connections")
        return

    await websocket.accept()

    # First message must be a JSON auth payload: {"type": "auth", "token": "<JWT>"}
    try:
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        if len(raw) > WS_MAX_MESSAGE_SIZE:
            await websocket.close(4008, "Message too large")
            return
        msg = json.loads(raw)
    except (asyncio.TimeoutError, json.JSONDecodeError):
        await websocket.close(4001, "Expected auth message")
        return

    if msg.get("type") != "auth" or not msg.get("token"):
        await websocket.close(4001, "Expected auth message with token")
        return

    access_token = await jwt_verifier.verify_token(msg["token"])
    if access_token is None:
        await websocket.close(4001, "Invalid or expired token")
        return

    user_id = access_token.client_id  # GitHub username
    await websocket.send_text(json.dumps({"type": "auth", "status": "ok"}))

    await router.register_browser(user_id, websocket, token_expires_at=access_token.expires_at)
    log.info("Browser connected for user %s", user_id)

    try:
        while True:
            raw = await websocket.receive_text()
            if len(raw) > WS_MAX_MESSAGE_SIZE:
                log.warning("Oversized message from user %s (%d bytes)", user_id, len(raw))
                router.handle_browser_message(websocket, raw, oversized=True)
                continue
            router.handle_browser_message(websocket, raw)
    except WebSocketDisconnect:
        pass
    finally:
        router.unregister_browser(websocket)
        log.info("Browser disconnected for user %s", user_id)


# ── Health check ─────────────────────────────────────────────────
async def health_endpoint(request: Request) -> JSONResponse:
    return JSONResponse({"status": "ok"})


# ── Starlette app assembly ───────────────────────────────────────
@contextlib.asynccontextmanager
async def lifespan(app: Starlette) -> AsyncIterator[None]:
    async with session_manager.run():
        router.start_cleanup()
        log.info("Remote MCP server started on port %d", PORT)
        yield


def create_app() -> Starlette:
    mcp_app = _MCPEndpoint()

    # Protected resource metadata (RFC 9728) — tells Claude.ai where the OAuth AS is
    resource_url = AnyHttpUrl(f"https://{MCP_HOSTNAME}/mcp")
    auth_server_url = AnyHttpUrl(AUTH_SERVER_URL)
    pr_routes = create_protected_resource_routes(
        resource_url=resource_url,
        authorization_servers=[auth_server_url],
        scopes_supported=["mcp:tools"],
    )

    # MCP endpoint with auth middleware
    # Scopes are not currently embedded in the JWT payload — the authenticator
    # returns them in the OAuth response body instead. Access control relies on
    # the audience claim: only users with https://mcp.{DOMAIN} in their aud
    # list pass JWT verification. When the authenticator adds scopes to the JWT,
    # change this to required_scopes=["mcp:tools"].
    resource_metadata_url = AnyHttpUrl(f"https://{MCP_HOSTNAME}/.well-known/oauth-protected-resource/mcp")
    mcp_route = Route(
        "/mcp",
        endpoint=RequireAuthMiddleware(mcp_app, required_scopes=[], resource_metadata_url=resource_metadata_url),
    )

    routes = [
        *pr_routes,
        mcp_route,
        WebSocketRoute("/ws", ws_endpoint),
        Route("/health", health_endpoint, methods=["GET"]),
    ]

    middleware = [
        Middleware(
            AuthenticationMiddleware,
            backend=BearerAuthBackend(jwt_verifier),
        ),
        Middleware(AuthContextMiddleware),
    ]

    return Starlette(
        debug=False,
        routes=routes,
        middleware=middleware,
        lifespan=lifespan,
    )


app = create_app()


def main():
    logging.basicConfig(
        level=logging.INFO, stream=sys.stderr, format="[mcp-remote] %(message)s"
    )
    uvicorn.run(
        "sliderule_mcp.server_remote:app",
        host="0.0.0.0",
        port=PORT,
        log_level="info",
    )


if __name__ == "__main__":
    main()
