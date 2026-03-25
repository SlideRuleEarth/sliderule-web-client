# SlideRule Web Client

Vue 3 SPA for the SlideRule Earth science data processing platform, with an integrated MCP server for AI assistant connectivity.

**Prefer Makefile targets over raw npm commands.** The Makefile is the canonical way to build, test, lint, and deploy — using it keeps these targets exercised and tested.

## Quick Reference — Makefile Targets

All `make` commands run from the **project root** (not `web-client/`).

### Development

```bash
make run                 # Dev server on localhost:5173 (sets build env vars)
make preview             # Build then preview production bundle locally
make build               # Full production build (icons + docs index + vite)
make build-docs          # Rebuild docs search index only
make convert-icons       # Convert Maki SVG icons to PNGs
make clean               # Remove web-client/dist
make clean-all           # Remove dist, node_modules, and package-lock
make reinstall           # clean-all + npm install
```

### Quality & Testing

```bash
make typecheck           # vue-tsc type checking
make lint                # ESLint check
make lint-fix            # ESLint fix + Prettier
make test-unit           # Vitest unit tests (single run)
make test-unit-watch     # Vitest in watch mode
make coverage-unit       # Unit tests with coverage report
make test-e2e            # Playwright E2E tests
make test-e2e-headed     # Playwright in headed browser
make test-e2e-ui         # Playwright interactive UI
make test-e2e-debug      # Playwright debug mode
make test-all            # typecheck + lint + unit + e2e
make ci-check            # Full CI gate (npm ci + types + lint + unit + e2e)
make pre-commit-check    # Manually run pre-commit checks
make pw-report           # Open last Playwright HTML report
```

### Deployment (requires DOMAIN, S3_BUCKET, DOMAIN_APEX)

```bash
make live-update-client-testsliderule    # Build + deploy to client.testsliderule.org
make live-update-client-slideruleearth   # Build + deploy to client.slideruleearth.io
make deploy-client-to-testsliderule      # Terraform deploy + live update (testsliderule)
make deploy-client-to-slideruleearth     # Terraform deploy + live update (production)
make verify-s3-assets S3_BUCKET=...      # Verify index assets exist in S3
make src-tag-and-push                    # Tag + push (needs VERSION)
```

### MCP Server

```bash
make mcp-build                    # Build Python wheel + sdist
make mcp-publish                  # Build + upload to PyPI
make mcp-release                  # Publish + refresh local uvx cache
make mcp-docker-build             # Build Docker image (arm64)
make mcp-docker-push              # Build + push to ECR + trigger ECS redeploy
make mcp-deploy-testsliderule     # Terraform deploy MCP to testsliderule.org
make mcp-destroy-testsliderule    # Remove MCP from testsliderule.org
make mcp-push-testsliderule       # Build + push Docker to testsliderule ECR
make mcp-logs-testsliderule       # Tail MCP server logs
make mcp-shell-testsliderule      # Shell into running MCP container
make mcp-status-testsliderule     # Show ECS service status
```

### Keycloak (local OAuth2.1 testing)

```bash
make keycloak-up         # Start local Keycloak server (localhost:8080)
make keycloak-down       # Stop and remove Keycloak
make keycloak-run        # Build + preview against local Keycloak
```

Run `make help` for a full list of targets with descriptions.

Node version: **v24.4.1** (see `.nvmrc`). Use `nvm use` before running commands.

## Project Structure

```
web-client/src/
├── components/       # ~165 Vue components (Sr* prefix convention)
├── stores/           # ~53 Pinia stores (sessionStorage persistence)
├── services/         # MCP client/handler/executor, tool definitions, search engine
├── composables/      # ~21 reusable composition functions
├── utils/            # Helpers (logger, plot, map, data processing)
├── types/            # TypeScript type definitions
├── db/               # DuckDB WASM client initialization
├── sliderule/        # SlideRule API core client
├── assets/           # Static assets including docs-index.json
└── router/           # Vue Router config

sliderule-mcp-server/ # Python MCP server (stdio + WebSocket bridge)
terraform/            # Infrastructure as Code
keycloak/             # OAuth2.1 local testing setup
```

## Code Style

- **Formatter**: Prettier — 2 spaces, no tabs, single quotes
- **Linter**: ESLint 9 in legacy config mode (`ESLINT_USE_FLAT_CONFIG=false`)
- **Key lint rules**:
  - `@typescript-eslint/no-floating-promises: error` — always await or handle promises
  - `@typescript-eslint/promise-function-async: warn` — mark promise-returning functions async
  - Unused vars prefixed with `_` are allowed
- **Pre-commit hook**: Husky runs lint-staged (eslint --fix + prettier) on staged files
- **Path alias**: `@/` maps to `web-client/src/`

## Tech Stack

- **Framework**: Vue 3 + TypeScript + Vite
- **State**: Pinia (sessionStorage, per-tab)
- **UI**: PrimeVue + PrimeFlex
- **Maps**: OpenLayers + Deck.gl
- **Data**: DuckDB WASM + Apache Arrow
- **Charts**: ECharts + echarts-gl (3D)
- **Testing**: Vitest (unit, jsdom) + Playwright (E2E)

## Testing

Unit tests are in `web-client/tests/unit/` (`.spec.ts` files). E2E tests are in `web-client/tests/e2e/` (`.e2e.spec.ts` files).

Run a single unit test file:
```bash
cd web-client && npx vitest --run tests/unit/someFile.spec.ts
```

Run a single E2E test:
```bash
cd web-client && npx playwright test tests/e2e/someFile.e2e.spec.ts
```

## MCP Server

> **Status**: In active development on the `carlos-dev-mcp` branch. Not expected to merge to main for production until late April 2026.

The MCP integration connects AI assistants (Claude Desktop) to the browser-based web client.

- **Server**: `sliderule-mcp-server/src/sliderule_mcp/server.py` (Python, stdio transport)
- **Browser services**: `web-client/src/services/mcp*.ts`, `toolDefinitions.ts`, `toolExecutor.ts`
- **WebSocket port**: localhost:3002 (configurable via `VITE_MCP_WS_PORT`)
- **Tool definitions**: `toolDefinitions.ts` is the authoritative source of truth for tool schemas
- **Architecture**: Server is a transparent bridge — all tool logic lives in the browser (Pinia stores, DuckDB, OpenLayers)
- **Design doc**: `MCP_WEB_CLIENT.md` (contains planned features — do NOT remove unimplemented sections)

## Deployment

Production deploys to AWS S3 + CloudFront. Use the Makefile convenience targets:
- `make live-update-client-testsliderule` — staging
- `make live-update-client-slideruleearth` — production

## Environment Variables

- `VITE_BUILD_ENV` — build version tag (set automatically from git describe)
- `VITE_BUILD_SOURCEMAP` — set to `true` for source maps in production
- `VITE_MCP_WS_PORT` — MCP WebSocket port (default: 3002)
- `VITE_LOGIN_BASE_URL` — override login URL for local OAuth testing
- `VITE_OAUTH_CLIENT_ID` — static OAuth client ID (when AS doesn't support DCR)
