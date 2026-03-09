# Cloud MCP Server — Implementation Plan

## Context

The SlideRule MCP server currently runs locally: Claude Desktop talks to it via stdio, and the browser connects via WebSocket on localhost. The goal is to deploy a cloud version so that **Claude.ai users can add it as a remote MCP server**, with tool calls routed through to their browser session. The existing OAuth 2.1 authenticator at `sliderule/applications/authenticator/` already handles authorization, JWT issuance, PKCE, DCR, and JWKS — so the MCP server only needs to **verify tokens**, not issue them.

## Architecture

```
Claude.ai ──Streamable HTTP──→  Cloud MCP Server  ←──WebSocket──── User's Browser
            (Bearer JWT)        (ECS Fargate)       (Bearer JWT)
                                      │
                                      │ verify JWT via JWKS
                                      ▼
                              Authenticator Lambda
                              (login.slideruleearth.io)
                              /.well-known/jwks.json
```

- Claude.ai discovers the server at `https://mcp.slideruleearth.io/mcp`
- OAuth 2.1 flow is handled entirely by the existing authenticator (`login.slideruleearth.io`)
- The MCP server validates Bearer tokens by fetching the public key from the authenticator's JWKS endpoint and verifying JWT signatures locally
- Browser connects via `wss://mcp.slideruleearth.io/ws?token=<JWT>` using the same GitHub JWT it already has
- Both sides authenticate with the same `sub` (GitHub username) — that's the session routing key

## OAuth Flow (Claude.ai perspective)

1. Claude.ai discovers OAuth metadata at `https://login.slideruleearth.io/.well-known/oauth-authorization-server`
2. Claude.ai registers dynamically via `/auth/github/register`
3. User authenticates via GitHub (existing flow)
4. Claude.ai receives JWT with `aud` including `https://mcp.slideruleearth.io`
5. Claude.ai calls `/mcp` with `Authorization: Bearer <JWT>`
6. MCP server verifies JWT via JWKS, extracts username, routes to browser

**OAuth metadata proxying (Option A)**: The MCP SDK expects the MCP server itself to advertise OAuth metadata. `server_remote.py` serves `/.well-known/oauth-protected-resource/mcp` (RFC 9728) which points Claude.ai to the authenticator as the Authorization Server. This way Claude.ai discovers everything it needs from the MCP server URL itself.

## File Changes

### New Files (in `sliderule-mcp-server/src/sliderule_mcp/`)

### 1. `common.py` — Shared code extracted from server.py

- `BOOTSTRAP_TOOLS` list (moved from server.py)
- `SERVER_INSTRUCTIONS` constant (moved from server.py)

### 2. `server_remote.py` — Cloud entry point (Streamable HTTP + WebSocket)

Starlette/ASGI app with these endpoints:

| Endpoint | Purpose |
|----------|---------|
| `/mcp` | MCP Streamable HTTP (Claude.ai connects here, requires Bearer JWT) |
| `/ws` | WebSocket (browser connects here with `?token=<JWT>`) |
| `/health` | ALB health check |
| `/.well-known/oauth-protected-resource/mcp` | RFC 9728 metadata pointing to authenticator as AS |

- Uses MCP SDK's `StreamableHTTPSessionManager` for the `/mcp` endpoint
- Uses the SDK's `BearerAuthBackend` + custom `TokenVerifier` for JWT validation
- Overrides `call_tool` handler to route through `SessionRouter`
- Runs via uvicorn on port 8000

### 3. `session_router.py` — Multi-user session management

```python
@dataclass
class UserSession:
    user_id: str
    browser_ws: WebSocket | None = None
    pending: dict[str, asyncio.Future] = field(default_factory=dict)
    cached_tools: list[types.Tool] = field(default_factory=lambda: list(BOOTSTRAP_TOOLS))

class SessionRouter:
    sessions: dict[str, UserSession] = {}  # user_id → UserSession

    def register_browser(user_id: str, ws) -> None
    def unregister_browser(ws) -> None
    def get_session(user_id: str) -> UserSession | None
    async def call_browser(user_id: str, method: str, params: dict) -> dict
```

- `call_browser` reuses the same JSON-RPC + pending futures pattern from current server.py
- One browser per user (latest wins, close previous with code 4000)
- When browser connects, fetch tool definitions from it (same as current `_fetch_and_cache_tools`)

### 4. `jwt_verifier.py` — JWT verification via JWKS

**Why JWT verification is needed:**
Two different clients connect to the cloud MCP server, and the server needs to know **who** each one is to route tool calls to the right browser:

- **Claude.ai** (`/mcp`): Sends `Authorization: Bearer <JWT>`. The server verifies this to extract the GitHub username (`sub` claim), which is the key to look up which browser WebSocket to forward tool calls to.
- **Browser** (`/ws`): Sends JWT as `?token=<JWT>`. The server verifies this to know which user this browser belongs to, and registers it in the session map: `username -> WebSocket`.

Verification works by fetching the public key from the authenticator's JWKS endpoint and checking the RS256 signature locally -- no per-request network call to the authenticator. Without verification, anyone could craft a fake JWT with another user's username and hijack their browser session.

**Implementation:**
- Implements MCP SDK's `TokenVerifier` protocol (`verify_token(token) -> AccessToken | None`)
- Fetches public key from `https://login.slideruleearth.io/.well-known/jwks.json` (cached with 5-minute TTL)
- Verifies JWT signature (RS256), expiry, audience (`https://mcp.slideruleearth.io`), issuer
- Extracts `sub` (GitHub username) as user identity
- Same verifier used for both the `/mcp` Bearer token and the `/ws` query param token

### Modified Files

### 5. `server.py` — Refactor to import from common.py

- Move `BOOTSTRAP_TOOLS` and `SERVER_INSTRUCTIONS` to `common.py`, import them
- No behavioral changes — local stdio mode continues to work identically

### 6. `pyproject.toml` — New dependencies and entry point

- Add dependencies: `pyjwt[crypto]`, `uvicorn`, `starlette`, `httpx` (for JWKS fetch)
- Add entry point: `sliderule-mcp-remote = "sliderule_mcp.server_remote:main"`
- Most of these are already transitive deps of `mcp>=1.26.0`

### 7. `web-client/src/services/mcpClient.ts` — Cloud WebSocket URL + auth token

- Read `VITE_MCP_WS_URL` env var (e.g., `wss://mcp.slideruleearth.io/ws`)
- If set, use it instead of `ws://localhost:${port}`
- Append `?token=<JWT>` from `githubAuthStore.authToken` when connecting
- Require valid auth before connecting in cloud mode
- ~15 lines changed

### 8. `web-client/src/stores/mcpStore.ts` — Add cloud mode state

- Add `mcpWsUrl` ref (from `VITE_MCP_WS_URL` env var)
- Add `isCloudMode` computed (true when `mcpWsUrl` is set)
- ~5 lines added

### 9. `terraform/modules/cloudfront.tf` — CSP header update

- Add `wss://mcp.slideruleearth.io` to `connect-src` directive

### New Infrastructure Files

### 10. `sliderule-mcp-server/Dockerfile`

```dockerfile
FROM python:3.13-slim
COPY . /app
WORKDIR /app
RUN pip install .
EXPOSE 8000
CMD ["sliderule-mcp-remote"]
```

### 11. `terraform/modules/mcp-server/` — New Terraform module

| Resource | Purpose |
|----------|---------|
| ECS Fargate cluster + service + task | Run the MCP server container |
| ALB with HTTPS listener | TLS termination, WebSocket support |
| Route53 A record | `mcp.slideruleearth.io` → ALB |
| ECR repository | Docker image storage |
| Security groups | ALB: 443 inbound; ECS: 8000 from ALB only |
| IAM task role | Minimal permissions (no DynamoDB needed) |

- ACM cert: reuse existing `*.slideruleearth.io` wildcard
- ALB idle timeout: 3600s (for long WebSocket connections)
- Health check: `GET /health` on port 8000
- Initial desired count: 1 (scale later if needed)

## Key Design Decisions

1. **No OAuth AS in MCP server** — The existing authenticator handles all OAuth flows. The MCP server only verifies JWTs via JWKS. Claude.ai's OAuth discovery points to `login.slideruleearth.io`.

2. **Session routing by GitHub username** — Both Claude.ai (via OAuth) and the browser (via JWT) authenticate with the same GitHub identity. The `sub` claim is the routing key.

3. **Stateless JWT verification** — No DynamoDB needed in the MCP server. Public key fetched from JWKS endpoint and cached. This keeps the server simple and cheap.

4. **One browser per user** — Same as current behavior. If a second tab connects, the first is closed with code 4000. Multiple Claude.ai sessions for the same user share the same browser WebSocket.

5. **Separate entry points** — `server.py` (local/stdio) and `server_remote.py` (cloud/HTTP) share common code but run independently.

## Implementation Order

1. **Extract shared code** → `common.py` (refactor server.py)
2. **JWT verifier** → `jwt_verifier.py` (can test independently against JWKS endpoint)
3. **Session router** → `session_router.py` (unit testable with mock WebSockets)
4. **Remote server** → `server_remote.py` (wire it all together)
5. **Browser changes** → `mcpClient.ts`, `mcpStore.ts` (small changes)
6. **Docker + Terraform** → Dockerfile, ECS/ALB/Route53
7. **CSP update** → `cloudfront.tf`

## Verification

1. **Local mode regression**: Run existing `server.py` with Claude Desktop — confirm all 39 tools still work
2. **JWT verification**: Unit test `jwt_verifier.py` against the real JWKS endpoint with a valid/expired/invalid token
3. **Session routing**: Unit test `SessionRouter` — register two mock browsers, verify tool calls route correctly
4. **Remote server locally**: Run `server_remote.py` locally, connect browser via `ws://localhost:8000/ws?token=<JWT>`, use MCP Inspector to call tools via `http://localhost:8000/mcp`
5. **Cloud E2E**: Deploy to ECS, add `https://mcp.slideruleearth.io/mcp` as remote MCP server in Claude.ai, authenticate via GitHub, open web client, verify tool calls flow through

## Scaling Notes

- Single Fargate task is sufficient for MVP. The server is I/O-bound (WebSocket relay), not CPU-bound.
- For horizontal scaling later: move `sessions` dict to Redis/ElastiCache, use ALB sticky sessions.
- If the Fargate task restarts, browsers auto-reconnect (existing exponential backoff logic). Claude.ai sessions get "Browser not connected" until browser reconnects.
