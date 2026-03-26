"""Multi-user session routing for the remote MCP server.

Maps authenticated users to their browser WebSocket connections and forwards
JSON-RPC tool calls to the correct browser.
"""

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field

import mcp.types as types

from .common import BOOTSTRAP_TOOLS, TIMEOUT_S

log = logging.getLogger("sliderule-mcp")

SESSION_IDLE_TTL = 3600  # Remove disconnected sessions after 1 hour
SESSION_CLEANUP_INTERVAL = 300  # Run cleanup every 5 minutes


MCP_CLIENT_IDLE_TTL = 300  # Consider an MCP client inactive after 5 minutes of silence


@dataclass
class UserSession:
    """State for a single authenticated user."""

    user_id: str
    browser_ws: object | None = None  # starlette WebSocket
    pending: dict[str, asyncio.Future] = field(default_factory=dict)
    cached_tools: list[types.Tool] = field(default_factory=lambda: list(BOOTSTRAP_TOOLS))
    last_active: float = field(default_factory=time.time)
    token_expires_at: int | None = None  # JWT exp claim (Unix timestamp)
    active_mcp_session: str | None = None  # Streamable HTTP session ID of active MCP client
    active_mcp_last_seen: float = 0  # Last time the active MCP client made a request


class SessionRouter:
    """Routes tool calls to the correct user's browser WebSocket."""

    def __init__(self) -> None:
        self.sessions: dict[str, UserSession] = {}  # user_id → UserSession
        self._cleanup_task: asyncio.Task | None = None
        self._background_tasks: set[asyncio.Task] = set()  # prevent GC of fire-and-forget tasks

    def start_cleanup(self) -> None:
        """Start the periodic session cleanup task."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def _cleanup_loop(self) -> None:
        """Periodically remove idle disconnected sessions and close expired tokens."""
        while True:
            await asyncio.sleep(SESSION_CLEANUP_INTERVAL)
            now = time.time()

            # Close WebSockets whose JWT has expired
            for session in self.sessions.values():
                if (
                    session.browser_ws is not None
                    and session.token_expires_at is not None
                    and now > session.token_expires_at
                ):
                    log.info("Closing expired session for user %s", session.user_id)
                    try:
                        await session.browser_ws.close(4001, "Token expired")
                    except Exception:
                        log.debug("Failed to close expired WebSocket for user %s", session.user_id)
                    session.browser_ws = None
                    session.cached_tools = list(BOOTSTRAP_TOOLS)
                    for future in session.pending.values():
                        if not future.done():
                            future.set_exception(RuntimeError("Token expired"))
                    session.pending.clear()

            # Remove disconnected sessions idle longer than TTL
            expired = [
                uid for uid, s in self.sessions.items()
                if s.browser_ws is None and (now - s.last_active) > SESSION_IDLE_TTL
            ]
            for uid in expired:
                del self.sessions[uid]
            if expired:
                log.info("Cleaned up %d idle sessions", len(expired))

    def get_or_create_session(self, user_id: str) -> UserSession:
        if user_id not in self.sessions:
            self.sessions[user_id] = UserSession(user_id=user_id)
        return self.sessions[user_id]

    async def register_browser(self, user_id: str, ws: object, *, token_expires_at: int | None = None) -> None:
        """Register a browser WebSocket for a user. Closes previous connection."""
        session = self.get_or_create_session(user_id)

        if session.browser_ws is not None:
            try:
                await session.browser_ws.close(4000, "Replaced by new connection")
            except Exception:
                log.debug("Failed to close previous WebSocket for user %s (already closed?)", user_id)

        session.browser_ws = ws
        session.last_active = time.time()
        session.token_expires_at = token_expires_at
        log.info("Browser registered for user %s", user_id)

        # Fetch tool definitions from the browser in the background
        task = asyncio.create_task(self._fetch_and_cache_tools(session))
        self._background_tasks.add(task)
        task.add_done_callback(self._background_tasks.discard)

    def unregister_browser(self, ws: object) -> None:
        """Remove a browser WebSocket (called on disconnect)."""
        for session in self.sessions.values():
            if session.browser_ws is ws:
                session.browser_ws = None
                session.last_active = time.time()
                session.cached_tools = list(BOOTSTRAP_TOOLS)
                # Cancel any pending futures
                for future in session.pending.values():
                    if not future.done():
                        future.set_exception(RuntimeError("Browser disconnected"))
                session.pending.clear()
                log.info("Browser unregistered for user %s", session.user_id)
                return

    def get_session(self, user_id: str) -> UserSession | None:
        return self.sessions.get(user_id)

    def track_mcp_client(self, user_id: str, mcp_session_id: str) -> str | None:
        """Track which MCP client is active for this user.

        Returns a log message if the session ID changed (e.g. token refresh
        or a different AI client), None if unchanged.
        Always allows the request through.
        """
        if not mcp_session_id:
            return None

        session = self.sessions.get(user_id)
        if session is None:
            return None

        now = time.time()
        prev = session.active_mcp_session

        session.active_mcp_session = mcp_session_id
        session.active_mcp_last_seen = now

        if prev is not None and prev != mcp_session_id:
            idle = now - session.active_mcp_last_seen
            return (
                f"MCP session changed for user {user_id} "
                f"(prev={prev}, new={mcp_session_id}, idle={idle:.0f}s)"
            )
        return None

    async def notify_browser(self, user_id: str, method: str, params: dict) -> None:
        """Send a one-way notification to the user's browser (no response expected)."""
        session = self.sessions.get(user_id)
        if session is None or session.browser_ws is None:
            return

        try:
            await session.browser_ws.send_text(
                json.dumps({"jsonrpc": "2.0", "method": method, "params": params})
            )
        except Exception:
            log.debug("Failed to send notification to browser for user %s", user_id)

    async def call_browser(self, user_id: str, method: str, params: dict) -> dict:
        """Forward a JSON-RPC request to the user's browser and wait for response."""
        session = self.sessions.get(user_id)
        if session is None or session.browser_ws is None:
            raise RuntimeError("No browser connected")

        session.last_active = time.time()
        msg_id = str(uuid.uuid4())
        future: asyncio.Future = asyncio.get_running_loop().create_future()
        session.pending[msg_id] = future

        try:
            await session.browser_ws.send_text(
                json.dumps(
                    {"jsonrpc": "2.0", "id": msg_id, "method": method, "params": params}
                )
            )
            return await asyncio.wait_for(future, timeout=TIMEOUT_S)
        except asyncio.TimeoutError:
            raise TimeoutError(f"Browser did not respond within {TIMEOUT_S}s")
        finally:
            session.pending.pop(msg_id, None)

    def handle_browser_message(self, ws: object, raw: str, *, oversized: bool = False) -> None:
        """Process a message from a browser WebSocket (resolves pending futures).

        If oversized=True, the message exceeded the size limit. We still parse it
        to extract the JSON-RPC id and resolve the Future with an error, rather
        than letting it silently timeout.
        """
        try:
            msg = json.loads(raw)
        except json.JSONDecodeError:
            log.warning("Malformed JSON from browser, dropping message (%d bytes)", len(raw))
            return

        # Find the session for this WebSocket
        session = None
        for s in self.sessions.values():
            if s.browser_ws is ws:
                session = s
                break
        if session is None:
            log.warning("Received message from unregistered WebSocket, ignoring")
            return

        msg_id = msg.get("id")
        if msg_id is None:
            log.warning("Browser message missing JSON-RPC id from user %s, ignoring", session.user_id)
            return

        future = session.pending.pop(msg_id, None)
        if future is None:
            log.debug("No pending request for message id=%s (may have timed out)", msg_id)
            return

        if not future.done():
            if oversized:
                future.set_exception(
                    RuntimeError(
                        f"Response too large ({len(raw):,} bytes). "
                        "Try limiting your query with LIMIT, selecting fewer columns, or filtering."
                    )
                )
            elif "error" in msg:
                future.set_exception(
                    RuntimeError(msg["error"].get("message", "Browser error"))
                )
            else:
                future.set_result(msg.get("result", {}))

    async def _fetch_and_cache_tools(self, session: UserSession) -> None:
        """Fetch tool definitions from the browser and cache them."""
        try:
            result = await self.call_browser(session.user_id, "tools/list", {})
            tools = [
                types.Tool(
                    name=t["name"],
                    description=t.get("description", ""),
                    inputSchema=t.get("inputSchema", {"type": "object", "properties": {}}),
                )
                for t in result.get("tools", [])
            ]
            session.cached_tools = tools
            log.info("Cached %d tools for user %s", len(tools), session.user_id)
        except Exception:
            log.exception("Failed to fetch tools for user %s", session.user_id)
