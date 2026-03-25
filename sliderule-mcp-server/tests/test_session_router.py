"""Tests for SessionRouter — multi-user session management."""

import asyncio
import json
import time

import pytest

from sliderule_mcp.session_router import SessionRouter
from sliderule_mcp.common import BOOTSTRAP_TOOLS


# ── Helpers ───────────────────────────────────────────────────────
async def _simulate_browser(ws, router):
    """Background task that watches sent_messages and echoes JSON-RPC responses."""
    seen = 0
    while not ws.closed:
        await asyncio.sleep(0.01)
        while seen < len(ws.sent_messages):
            raw = ws.sent_messages[seen]
            seen += 1
            msg = json.loads(raw)
            if "method" not in msg:
                continue  # skip non-requests
            response = {
                "jsonrpc": "2.0",
                "id": msg["id"],
                "result": {
                    "content": [{"type": "text", "text": f"OK from {msg['params']['name']}"}],
                    "isError": False,
                },
            }
            router.handle_browser_message(ws, json.dumps(response))


async def _wait_for_tools_cached(session, expected_count, timeout=2.0):
    """Wait until cached_tools reaches expected_count or timeout."""
    deadline = time.time() + timeout
    while len(session.cached_tools) != expected_count and time.time() < deadline:
        await asyncio.sleep(0.05)


@pytest.fixture
def MockWebSocket():
    """Import MockWebSocket from conftest."""
    from tests.conftest import MockWebSocket

    return MockWebSocket


# ── Registration ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_register_browser(MockWebSocket):
    """Registering a browser creates a session and fetches tools."""
    router = SessionRouter()
    ws = MockWebSocket()

    # Respond to the tools/list request that register_browser fires in background
    async def _respond_tools_list():
        # Wait for the request to appear in sent_messages
        while not ws.sent_messages:
            await asyncio.sleep(0.01)
        msg = json.loads(ws.sent_messages[-1])
        response = {
            "jsonrpc": "2.0",
            "id": msg["id"],
            "result": {"tools": [{"name": "test_tool", "description": "A test tool"}]},
        }
        router.handle_browser_message(ws, json.dumps(response))

    task = asyncio.create_task(_respond_tools_list())
    await router.register_browser("alice", ws)

    # Wait for the background _fetch_and_cache_tools to complete
    session = router.get_session("alice")
    await task
    await _wait_for_tools_cached(session, 1)

    assert session is not None
    assert session.browser_ws is ws
    assert len(session.cached_tools) == 1
    assert session.cached_tools[0].name == "test_tool"


@pytest.mark.asyncio
async def test_second_tab_replaces_first(MockWebSocket):
    """A second browser connection for the same user replaces the first."""
    router = SessionRouter()
    ws1 = MockWebSocket()
    ws2 = MockWebSocket()

    # Register first browser (skip tool fetch by pre-populating)
    session = router.get_or_create_session("alice")
    session.browser_ws = ws1

    # Register second — should close first with code 4000
    async def _respond():
        while not ws2.sent_messages:
            await asyncio.sleep(0.01)
        msg = json.loads(ws2.sent_messages[-1])
        router.handle_browser_message(
            ws2,
            json.dumps({"jsonrpc": "2.0", "id": msg["id"], "result": {"tools": []}}),
        )

    task = asyncio.create_task(_respond())
    await router.register_browser("alice", ws2)
    await task

    assert ws1.closed
    assert ws1.close_code == 4000
    assert session.browser_ws is ws2


# ── Unregistration ────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_unregister_clears_pending(MockWebSocket):
    """Unregistering a browser cancels pending futures."""
    router = SessionRouter()
    ws = MockWebSocket()
    session = router.get_or_create_session("bob")
    session.browser_ws = ws

    # Create a pending future
    future = asyncio.get_running_loop().create_future()
    session.pending["req-1"] = future

    router.unregister_browser(ws)

    assert session.browser_ws is None
    assert len(session.pending) == 0
    assert future.done()
    with pytest.raises(RuntimeError, match="Browser disconnected"):
        future.result()


# ── Routing ───────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_call_routes_to_correct_user(MockWebSocket):
    """Tool calls are routed to the correct user's browser."""
    router = SessionRouter()
    ws_alice = MockWebSocket()
    ws_bob = MockWebSocket()

    # Set up sessions directly
    for name, ws in [("alice", ws_alice), ("bob", ws_bob)]:
        session = router.get_or_create_session(name)
        session.browser_ws = ws

    # Start browser simulators
    task_a = asyncio.create_task(_simulate_browser(ws_alice, router))
    task_b = asyncio.create_task(_simulate_browser(ws_bob, router))

    try:
        result = await router.call_browser("alice", "tools/call", {"name": "set_mission", "arguments": {}})
        assert "OK from set_mission" in result["content"][0]["text"]

        # Verify the message went to Alice's WebSocket, not Bob's
        assert len(ws_alice.sent_messages) == 1
        assert len(ws_bob.sent_messages) == 0
    finally:
        task_a.cancel()
        task_b.cancel()


@pytest.mark.asyncio
async def test_call_browser_no_session(MockWebSocket):
    """call_browser raises RuntimeError when no session exists."""
    router = SessionRouter()
    with pytest.raises(RuntimeError, match="No browser connected"):
        await router.call_browser("nobody", "tools/call", {"name": "foo", "arguments": {}})


@pytest.mark.asyncio
async def test_call_browser_no_ws(MockWebSocket):
    """call_browser raises RuntimeError when session exists but browser disconnected."""
    router = SessionRouter()
    session = router.get_or_create_session("alice")
    session.browser_ws = None

    with pytest.raises(RuntimeError, match="No browser connected"):
        await router.call_browser("alice", "tools/call", {"name": "foo", "arguments": {}})


# ── Browser message handling ─────────────────────────────────────
@pytest.mark.asyncio
async def test_handle_browser_error(MockWebSocket):
    """Browser error responses resolve the future with an exception."""
    router = SessionRouter()
    ws = MockWebSocket()
    session = router.get_or_create_session("alice")
    session.browser_ws = ws

    future = asyncio.get_running_loop().create_future()
    session.pending["req-1"] = future

    router.handle_browser_message(
        ws,
        json.dumps({"jsonrpc": "2.0", "id": "req-1", "error": {"message": "Tool failed"}}),
    )

    assert future.done()
    with pytest.raises(RuntimeError, match="Tool failed"):
        future.result()


@pytest.mark.asyncio
async def test_handle_oversized_message(MockWebSocket):
    """Oversized messages resolve with an error instead of timing out."""
    router = SessionRouter()
    ws = MockWebSocket()
    session = router.get_or_create_session("alice")
    session.browser_ws = ws

    future = asyncio.get_running_loop().create_future()
    session.pending["req-1"] = future

    big_response = json.dumps({"jsonrpc": "2.0", "id": "req-1", "result": {"data": "x" * 1000}})
    router.handle_browser_message(ws, big_response, oversized=True)

    assert future.done()
    with pytest.raises(RuntimeError, match="Response too large"):
        future.result()


@pytest.mark.asyncio
async def test_handle_malformed_json(MockWebSocket):
    """Malformed JSON is dropped without crashing."""
    router = SessionRouter()
    ws = MockWebSocket()
    session = router.get_or_create_session("alice")
    session.browser_ws = ws

    # Should not raise
    router.handle_browser_message(ws, "not json at all")


@pytest.mark.asyncio
async def test_handle_missing_id(MockWebSocket):
    """Messages without a JSON-RPC id are ignored."""
    router = SessionRouter()
    ws = MockWebSocket()
    session = router.get_or_create_session("alice")
    session.browser_ws = ws

    router.handle_browser_message(ws, json.dumps({"jsonrpc": "2.0", "method": "notify"}))


# ── Cleanup ───────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_unregister_restores_bootstrap_tools(MockWebSocket):
    """After browser disconnect, cached_tools revert to bootstrap."""
    router = SessionRouter()
    ws = MockWebSocket()
    session = router.get_or_create_session("alice")
    session.browser_ws = ws
    # Simulate having fetched custom tools
    session.cached_tools = []

    router.unregister_browser(ws)

    assert len(session.cached_tools) == len(BOOTSTRAP_TOOLS)


@pytest.mark.asyncio
async def test_timeout_on_no_response(MockWebSocket):
    """call_browser raises TimeoutError if browser doesn't respond."""
    router = SessionRouter()
    ws = MockWebSocket()
    session = router.get_or_create_session("alice")
    session.browser_ws = ws

    # Patch TIMEOUT_S to be very short for this test
    import sliderule_mcp.session_router as sr_module
    original_timeout = sr_module.TIMEOUT_S
    sr_module.TIMEOUT_S = 0.1

    try:
        with pytest.raises(TimeoutError):
            await router.call_browser("alice", "tools/call", {"name": "slow_tool", "arguments": {}})
    finally:
        sr_module.TIMEOUT_S = original_timeout

    # Pending should be cleaned up
    assert len(session.pending) == 0
