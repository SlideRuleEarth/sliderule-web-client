# SlideRule Web Client — Claude Code guide

Guidance for Claude Code sessions working in this repo. Read this before making
changes.

## Repo layout

This is a **two-level npm project**:

```
sliderule-web-client/                  ← git root, outer wrapper
├── package.json                       ← husky, Playwright orchestration
├── package-lock.json
├── Makefile                           ← canonical interface (use this!)
├── web-client/                        ← the Vue 3 app
│   ├── package.json                   ← runtime deps, Vite, TypeScript, ESLint
│   ├── package-lock.json
│   ├── src/                           ← all app source
│   ├── tests/                         ← Vitest unit + Playwright E2E
│   └── playwright.config.mts
├── sliderule-mcp-server/              ← Python MCP server (separate project)
├── terraform/                         ← infra (CloudFront + S3)
├── keycloak/                          ← local OAuth dev harness
├── lambda/                            ← AWS Lambda code
└── docs/
```

Both `package.json`s require installs. Both are guarded with `engines` +
`packageManager` + `.npmrc` (`engine-strict=true`).

## Use the Makefile, not raw commands

The Makefile is the single source of truth. CI calls it; local dev should too.
Prefer `make <target>` over `npm run ...` / `vite ...` / `npx ...` directly.

Key targets:

| Task | Command | Notes |
|---|---|---|
| Install npm deps | `make install-deps` | Runs `npm ci` at root **and** `web-client/` |
| Reinstall npm deps (clean) | `make reinstall-deps` | `clean-all` + `install-deps` |
| Full rebuild from scratch | `make rebuild-all` | `reinstall-deps` + `build` |
| Regenerate lockfiles | `make regen-lockfiles` | Destructive, rarely needed |
| Verify env | `make doctor` | Shows Node/npm vs pinned versions |
| Verify lockfiles | `make verify-lockfiles` | Mirrors the CI drift check |
| Dev server | `make run` | NOT `npm run dev` |
| Production build | `make build` | NOT `vite build` — Makefile injects VITE_APP_VERSION etc. |
| Preview build | `make preview` | |
| Typecheck | `make typecheck` | |
| Lint / fix | `make lint` / `make lint-fix` | |
| Unit tests | `make test-unit` | Vitest |
| E2E tests | `make test-e2e` | Playwright (runs from web-client/) |
| All CI checks | `make ci-check` | |
| Full list | `make help` | |

## Toolchain (strict)

- **Node** — version pinned in [`.nvmrc`](.nvmrc). Enforced via `engines` +
  `engine-strict=true`. Use fnm or nvm; Homebrew Node works but doesn't respect
  Corepack.
- **npm** — version pinned in `packageManager` field (both package.json files).
  Corepack fetches the exact version on contributors' machines. Requires
  `corepack enable && corepack enable npm`.
- **Never** run `npm install` without intent. `make install-deps` (which wraps
  `npm ci`) is the default. `npm install` re-resolves and rewrites lockfiles —
  CI will catch this via the drift check.

## Line endings and binaries

[`.gitattributes`](.gitattributes) normalizes line endings to LF and marks
images/fonts/wasm/parquet as binary. When adding a new binary asset type, add
an explicit rule there.

## Domains

**`sliderule.slideruleearth.io` is hardcoded intentionally** as the permanent
public API server. Do not parameterize or "generalize" it without discussing
the architectural implications first.

## MCP integration

A Model Context Protocol bridge exposes web-client state/actions to LLMs:

- **Browser side** (authoritative): [`web-client/src/services/mcpClient.ts`](web-client/src/services/mcpClient.ts),
  [`mcpHandler.ts`](web-client/src/services/mcpHandler.ts),
  [`toolExecutor.ts`](web-client/src/services/toolExecutor.ts),
  [`toolDefinitions.ts`](web-client/src/services/toolDefinitions.ts)
- **Pinia store**: [`web-client/src/stores/mcpStore.ts`](web-client/src/stores/mcpStore.ts)
- **UI**: [`web-client/src/components/SrMcpActivityIndicator.vue`](web-client/src/components/SrMcpActivityIndicator.vue)
- **Server side**: [`sliderule-mcp-server/`](sliderule-mcp-server/) (Python;
  stdio for Claude Desktop, HTTP/SSE for Claude.ai/ChatGPT via ECS relay)

`toolDefinitions.ts` is the authoritative source of tool schemas. Server is a
transparent bridge — tool logic lives in the browser (Pinia stores, DuckDB,
OpenLayers).

## Build / deploy

- `make build` produces `web-client/dist/`
- Deploy targets like `make deploy-client-to-slideruleearth` handle S3 upload
  and CloudFront invalidation via Terraform (`terraform/`)
- `make keycloak-up`/`keycloak-down` spin up a local OAuth server for auth dev

## Lint config quirk

ESLint flat config is explicitly **disabled** in the lint scripts:
`ESLINT_USE_FLAT_CONFIG=false`. Do not "fix" this by migrating to flat config
without coordinating — the legacy config is intentional here.

## Testing

- **Unit**: Vitest, `make test-unit`, sources in `web-client/tests/`
- **E2E**: Playwright, `make test-e2e`, config in
  [`web-client/playwright.config.mts`](web-client/playwright.config.mts). The
  CI workflow runs E2E against the production build.
- Pre-commit hook runs `lint-staged` + typecheck + unit tests. Manual
  equivalent: `make pre-commit-check`.

## Reproducibility guardrails (what's enforced)

1. `engines` + `engine-strict=true` in both `.npmrc` files → wrong Node/npm
   versions fail install outright
2. `packageManager: npm@<pinned>` in both `package.json` files + Corepack →
   exact npm version fetched and used
3. `make verify-lockfiles` (local + CI) → `npm ci` must not rewrite
   `package.json` or `package-lock.json` in either location
4. [`.gitattributes`](.gitattributes) → no line-ending corruption of binaries
   across platforms

If you see a large, unexplained lockfile diff or a package version change that
nobody intended, treat it as a bug — don't rubber-stamp the PR.
