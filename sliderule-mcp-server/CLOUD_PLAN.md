# Cloud MCP Server — Implementation Plan

## Status: ✅ Implemented and deployed to staging

All planned components have been built and deployed to `testsliderule.org`. Production deployment to `slideruleearth.io` infrastructure is ready but not yet enabled.

## Context

The SlideRule MCP server runs in two modes: **local** (Claude Desktop via stdio + browser WebSocket on localhost) and **cloud** (Streamable HTTP for AI clients + WebSocket for browsers, deployed on ECS Fargate). The existing OAuth 2.1 authenticator at `login.{domain}` handles authorization, JWT issuance, PKCE, DCR, and JWKS — the MCP server only **verifies tokens**, not issues them.

## Architecture

```
Claude.ai ──Streamable HTTP──→  Cloud MCP Server  ←──WebSocket──── User's Browser
            (Bearer JWT)        (ECS Fargate)       (first-message JWT)
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
- Browser connects via `wss://mcp.slideruleearth.io/ws` and authenticates with a first-message JWT: `{"type": "auth", "token": "<JWT>"}`
- Both sides authenticate with the same `sub` (GitHub username) — that's the session routing key

## OAuth Flow (Claude.ai perspective)

1. Claude.ai discovers OAuth metadata at `https://login.slideruleearth.io/.well-known/oauth-authorization-server`
2. Claude.ai registers dynamically via `/auth/github/register` (RFC 7591)
3. User authenticates via GitHub (existing flow, PKCE with S256)
4. Claude.ai receives JWT with `aud` including `https://mcp.slideruleearth.io`
5. Claude.ai calls `/mcp` with `Authorization: Bearer <JWT>`
6. MCP server verifies JWT via JWKS, extracts username, routes to browser

**OAuth metadata proxying**: The MCP server serves `/.well-known/oauth-protected-resource/mcp` (RFC 9728) which points Claude.ai to the authenticator as the Authorization Server.

## Implemented Files

### Server-side (`sliderule-mcp-server/src/sliderule_mcp/`)

| File | Purpose | Status |
|------|---------|--------|
| `common.py` | Shared `BOOTSTRAP_TOOLS`, `SERVER_INSTRUCTIONS`, `TIMEOUT_S` | ✅ Done |
| `server.py` | Local stdio mode — imports from `common.py` | ✅ Refactored |
| `server_remote.py` | Cloud entry point — Starlette ASGI app with `/mcp`, `/ws`, `/health`, RFC 9728 metadata | ✅ Done |
| `session_router.py` | Multi-user session management with per-user tool caches | ✅ Done |
| `jwt_verifier.py` | JWT verification via JWKS (RS256, 5-min cache, `TokenVerifier` protocol) | ✅ Done |

### `server_remote.py` endpoints

| Endpoint | Purpose |
|----------|---------|
| `/mcp` | MCP Streamable HTTP (Claude.ai connects here, requires Bearer JWT) |
| `/ws` | WebSocket (browser connects here, first-message JWT auth) |
| `/health` | ALB health check |
| `/.well-known/oauth-protected-resource/mcp` | RFC 9728 metadata pointing to authenticator as AS |

### `session_router.py` capabilities

- Per-user sessions mapping authenticated users to browser WebSocket connections
- Routes tool calls to the correct user's browser (multi-tenant)
- Token expiration cleanup (closes WebSocket when JWT expires)
- Per-user tool definition cache
- Origin validation (allowlist: `https://client.{DOMAIN}`, `https://ai.{DOMAIN}`, `https://{DOMAIN}`, plus localhost dev)
- Rate limiting: max 30 WebSocket connections per IP per minute
- Message size validation: 10 MB max per message
- One browser per user — latest wins, previous closed with code 4000

### `jwt_verifier.py` capabilities

- Implements MCP SDK's `TokenVerifier` protocol
- Fetches JWKS from `https://login.{DOMAIN}/.well-known/jwks.json` (5-min cache)
- Verifies RS256 signature, expiry, audience, issuer
- Extracts `sub` (GitHub username) as user identity and expiration time for lifecycle management

### Browser-side changes

| File | Changes | Status |
|------|---------|--------|
| `mcpClient.ts` | Two connection modes: local (`ws://localhost:{port}`) and cloud (`wss://{url}`). Cloud mode sends JWT as first WebSocket message. Validates `wss://` protocol. | ✅ Done |
| `mcpStore.ts` | `mcpWsUrl` from localStorage (`mcp-cloud-url`), `isCloudMode` computed, `setCloudUrl()` setter | ✅ Done |
| `githubAuthStore.ts` | Full OAuth 2.1 + PKCE flow with DCR (RFC 7591), resource indicators (RFC 8707), JWKS discovery | ✅ Done |

### Infrastructure

| File | Purpose | Status |
|------|---------|--------|
| `sliderule-mcp-server/Dockerfile` | Python 3.13-slim, port 8000, `sliderule-mcp-remote` entry point | ✅ Done |
| `terraform/modules/mcp_server.tf` | ECS Fargate + ALB + Route53 + ECR + security groups + IAM | ✅ Done |
| `pyproject.toml` | Dependencies (`pyjwt[crypto]`, `uvicorn`, `starlette`, `httpx`) + `sliderule-mcp-remote` entry point | ✅ Done |

### Terraform resources (gated by `var.create_mcp_server`)

| Resource | Purpose |
|----------|---------|
| ECS Fargate service + task definition | Run MCP server container (256 CPU, 512 MB, ARM64) |
| ALB with HTTPS listener | TLS termination, 1-hour idle timeout for WebSocket |
| Target group | Sticky sessions (1-day cookie), health check on `/health` |
| Route53 A record | `mcp.{domain}` → ALB |
| ECR repository | Docker image storage (5-image lifecycle, scan-on-push) |
| Security groups | ALB: 443 inbound; ECS: 8000 from ALB only |
| IAM roles | Task execution role + task role with ECS Exec |
| ACM certificate | Auto-validated DNS for `mcp.{domain}` |
| CloudWatch logs | 30-day retention in `/ecs/{cluster}-server` |

### Test suite

| File | Coverage |
|------|----------|
| `test_jwt_verifier.py` | Valid/expired/tampered tokens, wrong audience/issuer/kid, JWKS caching, fetch failures |
| `test_session_router.py` | Multi-user routing, tab replacement (4000), token expiry cleanup, oversized messages, timeouts |

## Key Design Decisions

1. **No OAuth AS in MCP server** — The existing authenticator handles all OAuth flows. The MCP server only verifies JWTs via JWKS. Claude.ai's OAuth discovery points to `login.slideruleearth.io`.

2. **Session routing by GitHub username** — Both Claude.ai (via OAuth) and the browser (via JWT) authenticate with the same GitHub identity. The `sub` claim is the routing key.

3. **Stateless JWT verification** — No DynamoDB needed. Public key fetched from JWKS endpoint and cached. Keeps the server simple and cheap.

4. **One browser per user** — Same as local mode. If a second tab connects, the first is closed with code 4000. Multiple Claude.ai sessions for the same user share the same browser WebSocket.

5. **Separate entry points** — `server.py` (local/stdio) and `server_remote.py` (cloud/HTTP) share common code via `common.py` but run independently.

6. **First-message auth** — Browser authenticates via `{"type": "auth", "token": "<JWT>"}` as the first WebSocket message (not query parameter), keeping tokens out of URL logs.

7. **Cloud URL in localStorage** — `mcp-cloud-url` key, not an env var, so users can switch modes at runtime via `mcpStore.setCloudUrl()`.

## Environment Variables

### Server-side (ECS task)

| Variable | Purpose | Example |
|----------|---------|---------|
| `SR_DOMAIN` | Domain apex | `testsliderule.org` |
| `SR_MCP_HOSTNAME` | Full MCP hostname | `mcp.testsliderule.org` |
| `SR_AUTH_HOSTNAME` | Login server hostname | `login.testsliderule.org` |
| `SR_MCP_PORT` | Server port (default 8000) | `8000` |

Derived values:
- `JWKS_URL = https://{SR_AUTH_HOSTNAME}/.well-known/jwks.json`
- `AUDIENCE = https://{SR_MCP_HOSTNAME}/mcp`
- `ISSUER = https://{SR_AUTH_HOSTNAME}`

### Browser-side

| Variable | Purpose | Default |
|----------|---------|---------|
| `VITE_MCP_WS_PORT` | Local WebSocket port | `3002` |
| `VITE_LOGIN_BASE_URL` | Override login URL (Keycloak testing) | — |
| `VITE_OAUTH_CLIENT_ID` | Static OAuth client ID | — |
| localStorage `mcp-cloud-url` | Remote cloud server WebSocket URL | — |

## Security

All 9 security mechanisms are actively enforced:

1. **Localhost-only WebSocket** (local mode) — unreachable from network
2. **User presence** — activity visible in browser via MCP activity indicator
3. **Destructive action confirmation** — `reset_params`, `cancel_request` require browser dialog
4. **Input validation** — JSON Schema validation on all tool arguments
5. **Request timeout** — 30-second timeout on browser calls
6. **Browser-controlled tool surface** — definitions from bundled `toolDefinitions.ts`
7. **SQL sandboxing** — DuckDB WASM read-only with 30s timeout
8. **Domain-restricted fetch** — `fetch_docs` validates HTTPS + `slideruleearth.io`
9. **WebSocket origin checking** — validates `Origin` header against domain allowlist
10. **Rate limiting** — max 30 WebSocket connections per IP per minute
11. **Message size limits** — 10 MB max per WebSocket message

## Deployment

### Staging (testsliderule.org) — ✅ Deployed

```bash
make mcp-deploy-testsliderule     # Terraform apply
make mcp-docker-build             # Build ARM64 Docker image
make mcp-push-testsliderule       # Push to ECR + trigger ECS redeploy
make mcp-logs-testsliderule       # Tail CloudWatch logs
make mcp-shell-testsliderule      # Shell into running container
make mcp-status-testsliderule     # ECS service status
```

- MCP endpoint: `https://mcp.testsliderule.org/mcp`
- Browser WebSocket: `wss://mcp.testsliderule.org/ws`

### Production (slideruleearth.io) — Infrastructure ready, not yet enabled

Set `create_mcp_server = true` in the production Terraform workspace to deploy.

- MCP endpoint: `https://mcp.slideruleearth.io/mcp`
- Browser WebSocket: `wss://mcp.slideruleearth.io/ws`

## Scaling Notes

- Single Fargate task is sufficient for MVP. The server is I/O-bound (WebSocket relay), not CPU-bound.
- For horizontal scaling later: move `sessions` dict to Redis/ElastiCache, use ALB sticky sessions (already configured).
- If the Fargate task restarts, browsers auto-reconnect (existing exponential backoff logic). Claude.ai sessions get "Browser not connected" until browser reconnects.

## Remaining Work

- **Scopes in JWT**: The authenticator does not yet embed scopes in the JWT payload (returns them in the OAuth response body instead). When added, the server can enforce `required_scopes=["mcp:tools"]` instead of relying solely on audience matching.
- **Production deployment**: Enable `create_mcp_server` in production Terraform and push Docker image to production ECR.
- **CSP header**: Add `wss://mcp.slideruleearth.io` to `connect-src` in `cloudfront.tf` when deploying to production.
