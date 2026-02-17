# MCP Server Cross-Platform Strategy — Research & Architecture

## Status: Browser Tools Complete — Next Phase Pending

All 42 browser tools (MVPs 0–4) are implemented, verified, and published to PyPI as `sliderule-mcp`. The pending decision is the **next phase**: desktop Python tools, ChatGPT/remote support, or both.

### Current Implementation Summary

| Category | Tools | Examples |
|----------|-------|---------|
| Parameter configuration | 13 | `set_mission`, `set_region`, `set_yapc`, `get_current_params` |
| Request lifecycle | 5 | `submit_request`, `get_request_status`, `cancel_request` |
| Data analysis | 5 | `run_sql`, `describe_data`, `get_elevation_stats`, `export_data` |
| Documentation | 4 | `search_docs`, `fetch_docs`, `get_param_help` |
| Map control | 6 | `zoom_to_bbox`, `set_base_layer`, `set_map_view`, `set_draw_mode` |
| Visualization | 6 | `set_chart_field`, `set_color_map`, `set_3d_config`, `set_plot_options` |
| UI & navigation | 3 | `start_tour`, `navigate`, `get_current_view` |
| **Total** | **42** | |

Additionally: 15 resource URIs + 7 resource templates defined in the server.

**Architecture:** stdio (Claude Desktop) + WebSocket (browser on localhost:3002). Server is a transparent bridge — all tool logic lives in the browser (Pinia stores, DuckDB, OpenLayers).

---

## Research Summary

### Transport Requirements by Client

| Client | Transport | Auth | Localhost? |
|--------|-----------|------|------------|
| Claude Desktop | stdio (local) OR streamable HTTP | None needed | Yes |
| ChatGPT | Streamable HTTP (HTTPS only) | OAuth 2.1 + DCR (mandatory) | **No** — blocks all private IPs |
| Cursor / VS Code | stdio (local) OR streamable HTTP | None needed | Yes |

### ChatGPT OAuth 2.1 Requirements

ChatGPT enforces the strictest requirements of any MCP client:

- **Public HTTPS URL** — no localhost, no self-signed certs, no private IPs
- **Dynamic Client Registration** (RFC 7591) — ChatGPT auto-registers as an OAuth client
- **Authorization Code Flow with PKCE** — user must authenticate via browser
- **Protected Resource Metadata** — `/.well-known/oauth-protected-resource` (RFC 9728)
- **Authorization Server Metadata** — `/.well-known/oauth-authorization-server` (RFC 8414)
- **Bearer token** in Authorization header on every tool call

### MCP Streamable HTTP Transport

Streamable HTTP (MCP spec 2025-03-26) is the modern unified transport replacing SSE:
- Single endpoint (e.g., `/mcp`) handles POST (tool calls) and GET (server notifications)
- Supports session management via `Mcp-Session-Id` header
- Python MCP SDK has full support: `mcp.run(transport="streamable-http")`
- Can be mounted on Starlette/FastAPI apps

### Existing SlideRule Auth Infrastructure

SlideRule already has a complete JWT authentication system:

- **Lambda:** `sliderule/applications/authenticator/github_oauth.py` — GitHub OAuth, RS256 JWTs via KMS
- **CloudFormation:** `authenticator.yml` — deploys Lambda + API Gateway + KMS key
- **Deployed at:** `https://login.slideruleearth.io`
- **JWKS:** `/.well-known/jwks.json` — standard key discovery endpoint
- **OpenID:** `/.well-known/openid-configuration` — discovery endpoint
- **JWT claims:** `sub` (GitHub user), `org_roles`, `aud`, `iss`, `exp`
- **Validation:** HAProxy verifies RS256 signature + issuer + audience + expiration
- **KMS:** RSA_2048 asymmetric key for signing

### AWS Cognito Assessment

Evaluated and **ruled out** for this project:
- Does NOT natively support Dynamic Client Registration (needs Lambda workaround)
- Does NOT natively support GitHub as identity provider (needs OIDC wrapper Lambda)
- Would require 3+ Lambda workarounds to meet ChatGPT requirements
- **Decision:** Build a parallel MCP authenticator Lambda reusing existing KMS keys + JWT format instead

---

## Architecture Options

### Option A: Local Server + Tunnel

```
Claude Desktop → stdio → local server.py → WebSocket → browser
                                    └→ local Python tools (sliderule package)

ChatGPT → HTTPS (ngrok/CF tunnel) → streamable HTTP → local server.py
                                          ↑
                                    JWT validated via remote JWKS
```

| Aspect | Assessment |
|--------|------------|
| Desktop Python tools | Yes — full local file/package access |
| Browser control | Yes — WebSocket on localhost |
| ChatGPT support | Yes — via tunnel |
| Infrastructure | OAuth Lambda on AWS only |
| User setup for ChatGPT | Must install + run tunnel |
| Cost | ~$5/mo (Lambda + DynamoDB) |

### Option B: Remote Server on AWS

```
Claude Desktop ──┐
                  ├─ streamable HTTP → API Gateway → ECS Fargate (server.py) → WebSocket → browser
ChatGPT ─────────┘                        ↑
                                    JWT authorizer (native)
```

| Aspect | Assessment |
|--------|------------|
| Desktop Python tools | **No** — cannot access user's local files/packages |
| Browser control | Yes — WebSocket over internet |
| ChatGPT support | Yes — native HTTPS via API Gateway |
| Infrastructure | ECS + API Gateway + Lambda + ECR |
| Multi-user | Yes — one container per user |
| Cost | ~$30-100/mo (Fargate + API Gateway) |

### Option C: Hybrid (Local + Remote)

- **Local MCP server:** Desktop Python tools + Claude Desktop (stdio)
- **Remote MCP server:** Browser tools + ChatGPT (streamable HTTP, HTTPS)
- Two separate servers with different tool sets

| Aspect | Assessment |
|--------|------------|
| Desktop Python tools | Yes (local server) |
| Browser control | Yes (remote server) |
| ChatGPT support | Yes (remote server) |
| Complexity | Highest — two servers to maintain |

### Option D: Phased Approach (chosen strategy)

1. **Phase 1:** Finish browser tools for Claude Desktop — **done ✓** (42 tools, all MVPs complete)
2. **Phase 2:** Add SlideRule Python client tools for Claude Desktop (stdio, zero infra)
3. **Phase 3:** Add streamable HTTP transport (prepares for ChatGPT)
4. **Phase 4:** Build OAuth Lambda + ChatGPT support (once tool set is mature)

---

## Trade-off Tables

### Transport Strategy

| | **stdio only** | **Streamable HTTP only** | **Both (stdio + HTTP)** |
|---|---|---|---|
| Claude Desktop | Works (current) | Works (localhost HTTP) | Works (either) |
| ChatGPT | No | Yes (with HTTPS + OAuth) | Yes (HTTP path) |
| Cursor / VS Code | Works | Works | Works (either) |
| Code paths to maintain | 1 | 1 | 2 |
| User install complexity | `uvx sliderule-mcp` → done | Need to start HTTP server + know port | stdio is zero-config; HTTP needs port |
| Network exposure | None (pipes) | localhost socket (or remote) | Depends on mode |
| Auth needed | Never | Only for remote/ChatGPT | Only on HTTP path |

### Deployment Strategy

| | **Local only** | **Remote only (AWS)** | **Hybrid (local + remote)** |
|---|---|---|---|
| Desktop Python tools | Yes | **No** — can't access user's files | Yes (local) |
| Browser control tools | Yes (WebSocket localhost) | Yes (WebSocket internet) | Yes (both) |
| ChatGPT support | Needs tunnel + OAuth | Native HTTPS, API GW auth | ChatGPT → remote; Claude → local |
| Infrastructure to build | None (user's machine) | ECS + API GW + Lambda + ECR | Both |
| Infrastructure cost | $0 | ~$30-100/mo (Fargate + API GW) | Same as remote |
| Latency (browser ↔ server) | <1ms (localhost) | 20-100ms (internet) | Depends on path |
| Multi-user | No (single desktop) | Yes (one container/user) | Remote: yes; Local: no |
| User setup burden | Install + run server | Just configure URL | Most complex |

### OAuth Strategy

| | **No OAuth** | **Existing auth Lambda** | **Cognito + workarounds** | **Auth0** |
|---|---|---|---|---|
| ChatGPT compatible | No | Yes (with new endpoints) | Yes | Yes |
| DCR support | N/A | Must build | Must build | Native |
| GitHub login | N/A | Already built | Must build (2 Lambdas) | Native |
| Reuses existing KMS/JWT | N/A | Yes | No (new tokens) | No |
| New infrastructure | None | 1 Lambda + DynamoDB + API GW | Cognito + 3 Lambdas + DDB + API GW | Auth0 account |
| Implementation effort | Zero | Medium | High | Low |
| Ongoing cost | $0 | ~$5/mo | ~$5/mo + Cognito | Free 25k MAUs |
| Vendor dependency | None | AWS (already there) | AWS | Auth0/Okta |

### Phasing Strategy

| | **Phase A: Tools first** | **Phase B: ChatGPT first** | **Phase C: All at once** |
|---|---|---|---|
| Immediate value | High (Python tools for Claude users) | Low (infra before tools) | High but slow to ship |
| Time to first result | Days | Weeks | Weeks |
| Risk | May rework if transport changes | Over-engineering before proven | Scope creep |
| Recommended order | 1. Python tools → 2. HTTP → 3. OAuth | 1. HTTP → 2. OAuth → 3. Tools | All parallel |

---

## Reference Repos

| Repository | Description | Language | Relevance |
|---|---|---|---|
| `stache-ai/agentcore-dcr` | DCR Lambda for Cognito | Python | DCR pattern (Jan 2026) |
| `empires-security/mcp-oauth2-aws-cognito` | Complete Cognito OAuth MCP example | JavaScript | Full OAuth flow reference |
| `aws-samples/sample-multi-tenant-saas-mcp-server` | Production ECS MCP deployment | TypeScript | Multi-user ECS pattern |
| `scenario-labs/cdk-user-pool-identity-provider-github` | GitHub OIDC wrapper for Cognito | TypeScript | GitHub IdP pattern (archived) |
| `mcp-auth/python` | Plug-and-play OAuth for Python MCP | Python | Token validation middleware |
| `modelcontextprotocol/python-sdk` `examples/servers/simple-auth/` | Official OAuth example | Python | SDK auth patterns |

---

## Key Design Decisions

1. ~~**Local-first vs remote-first** deployment?~~ **Decided — local-first.** Claude Desktop + stdio is the primary target.
2. **Priority:** desktop Python tools vs ChatGPT support? *(open)*
3. ~~**Transport:** stdio only, HTTP only, or both?~~ **Current — stdio only.** HTTP transport deferred to Phase 3.
4. **OAuth:** extend existing auth Lambda vs Cognito vs Auth0? *(open — deferred to Phase 4)*
5. **Infrastructure as code:** CloudFormation (matches existing authenticator) vs Terraform? *(open — deferred to Phase 4)*
6. **Domain:** mcp.slideruleearth.io or other? *(open — deferred to Phase 4)*

---

*Research conducted February 2026. Implementation status updated February 2026. Based on MCP specification 2025-03-26, ChatGPT Developer Mode (Sept 2025), and Claude Desktop streamable HTTP support.*
