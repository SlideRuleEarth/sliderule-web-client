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
| Verify lockfiles (fast) | `make check-lockfiles` | `npm ci --dry-run`; no reinstall, ~1s |
| Verify lockfiles (full) | `make verify-lockfiles` | Mirrors CI; reinstalls both node_modules |
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

## The apex, the client, and crawlers

Three hosts, with different jobs:

| Host | Serves | Repo |
|---|---|---|
| `slideruleearth.io` | nothing — 301s `/` to the client, 404s everything else | this one (`terraform/`) |
| `client.slideruleearth.io` | the Vue SPA | this one |
| `docs.slideruleearth.io` | the documentation | a different one |

**The apex hosts nothing.** A viewer-request CloudFront function in
[`terraform/modules/cloudfront.tf`](terraform/modules/cloudfront.tf) answers
every request at the edge: `/` gets a 301 to `<domainName>/landing`, and every
other path gets a plain-text 404. The distribution's S3 origin exists only
because CloudFront requires one; it is never reached.

Do not add an allowlist of paths that pass through to the origin. That was
tried (PR #1094, first revision) and reverted: the apex has no content to
describe, so anything published there would be describing the client or the
docs from a host that serves neither.

**Machine-readable files for agents belong on `docs.slideruleearth.io`**,
which is where the actual content is and is maintained in a separate
repository. The web client is a single-page app — `client.slideruleearth.io`
returns a 385-byte empty shell, versus ~115 KB of rendered prose from the docs
site — so a sitemap or an `llms.txt` pointing at it would index nothing.
`llms.txt` is not implemented on any SlideRule host, and adding one here is
not a pending task.

### robots.txt

[`web-client/public/robots.txt`](web-client/public/robots.txt) is the one
crawler-facing file this repo publishes, and it answers for
`client.slideruleearth.io` only (the apex 404s its own `/robots.txt`). Vite
copies `public/` into `dist/` verbatim, so editing the file and deploying is
the whole workflow:

```bash
make live-update DOMAIN=client.slideruleearth.io \
                 S3_BUCKET=slideruleearth-webclient \
                 DOMAIN_APEX=slideruleearth.io
```

Its `Disallow` rules mirror the router. Adding a per-session route (something
under `/analyze/`, `/request/<id>`, `/auth/`) means adding it there too.

`make upload-robots`, which `live-update` runs, is the **sole publisher** of
this file — `upload-static` excludes it deliberately. `dist/robots.txt` is
always the production, crawlable file, so without that exclusion every deploy
would publish it first and only then have `upload-robots` overwrite it. On a
staging bucket that puts the production policy live for the length of the
deploy, and leaves it live if the second upload fails.

The exclusion does **not** make a failed `upload-robots` harmless. A failed
`aws s3 cp` leaves whatever the bucket already had: the previous deploy's
noindex file, or nothing at all on a fresh bucket. Nothing is not safe either
— the client distribution answers a missing key with `/index.html` at status
**200** (the 403→200 `custom_error_response`), so a crawler asking for
`robots.txt` gets HTML with no `Disallow` in it. After a first deploy to a new
bucket, check that `robots.txt` actually landed.

`upload-robots` also sets an explicit `Content-Type` and a 300-second
`max-age`, because `aws s3 sync` guesses types from the extension and never
sets a charset.

Off production it substitutes [`robots.noindex.txt`](robots.noindex.txt) — a
bare `Disallow: /`. **The discriminator is `DOMAIN`, the client host, not
`DOMAIN_APEX`**, because a non-production client can sit under the production
apex and keying on the apex would publish the crawlable file to it. Anything
that is not exactly `client.slideruleearth.io` gets the noindex file, so an
unrecognised or mistyped `DOMAIN` fails safe. The deploy log says which file
it used.

### Nothing else goes in `public/`

`public/` is copied into `dist/` verbatim, dot-directories included, and
`upload-static` syncs `dist/` to the bucket. A `.DS_Store` that reached
`public/` was publicly served until 2026-09-02; `upload-static` now excludes
`*.DS_Store`, but the real fix is not to put anything there that is not meant
to be a public URL.

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
- **Typecheck**: `make typecheck` covers `tsconfig.app.json` **and**
  `tsconfig.node.json`. It does not cover `tsconfig.vitest.json` — the app
  project excludes `tests/**`, so test sources are type-checked by
  `make typecheck-tests`, which `make test-unit` runs first. Between the two
  targets all three projects are covered; neither one covers all three alone.

### What actually runs automatically

The pre-commit hook is one line: `make pre-commit-check`, which runs
`check-lockfiles`, `lint-staged`, `typecheck`, then `test-unit` (which
type-checks the tests first) — about 15 seconds. The hook delegates to the
target deliberately, so the two cannot drift apart; run the target directly to
reproduce the hook without committing.

CI ([`.github/workflows/playwright.yml`](.github/workflows/playwright.yml))
runs `verify-lockfiles`, `typecheck`, `test-unit`, then `test-e2e`. The fast
checks sit ahead of the Playwright browser install on purpose, so a type error
fails in seconds instead of minutes.

`make ci-check` bundles the same set plus `lint` for local use. Note the
workflow invokes the individual targets rather than calling `ci-check`, so
adding a target to `ci-check` does **not** add it to CI — edit the workflow too.

## Reproducibility guardrails (what's enforced)

1. `engines` + `engine-strict=true` in both `.npmrc` files → wrong Node/npm
   versions fail install outright
2. `packageManager: npm@<pinned>` in both `package.json` files + Corepack →
   exact npm version fetched and used
3. `npm ci` refuses to install (EUSAGE) when `package.json` and
   `package-lock.json` disagree — that refusal *is* the drift check.
   `make check-lockfiles` surfaces it in ~1s via `--dry-run`, reading both
   files **from the index** rather than from disk, because a commit ships the
   index and the two can differ. `make verify-lockfiles` additionally does the
   real install and fails if it rewrites either file; it reads the working
   tree, and hashes the files around the install so uncommitted edits do not
   trip it.
4. [`.gitattributes`](.gitattributes) → no line-ending corruption of binaries
   across platforms

If you see a large, unexplained lockfile diff or a package version change that
nobody intended, treat it as a bug — don't rubber-stamp the PR.
