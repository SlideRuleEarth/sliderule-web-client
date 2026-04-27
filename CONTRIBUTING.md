# Contributing

## Setting up your environment

This repo pins the Node and npm toolchain so every developer (and CI) builds
against identical versions. Please do not skip these steps — drift here is the
number-one cause of "works on my machine" bugs.

1. **Install a Node version manager that reads `.nvmrc`.** [fnm](https://github.com/Schniz/fnm)
   is recommended (faster than nvm, auto-switches on `cd`). Homebrew Node works
   too but will not respect Corepack's `packageManager` enforcement.
   ```bash
   brew install fnm
   # Add to ~/.zshrc:
   #   eval "$(fnm env --use-on-cd --shell zsh)"
   ```

2. **Install the pinned Node version.** The version is in [`.nvmrc`](.nvmrc).
   ```bash
   fnm install   # installs the pinned version
   fnm use       # activates it in the current shell
   ```

3. **Enable Corepack.** This lets Node fetch the exact npm version specified by
   the `packageManager` field in [`package.json`](package.json):
   ```bash
   corepack enable
   corepack enable npm   # Corepack doesn't shim npm by default — this opts in
   ```

4. **Install npm dependencies via the Makefile**:
   ```bash
   make install-deps
   ```

   This runs `npm ci` at both the **repo root** and inside **`web-client/`**.
   Both installs are required — the root owns husky git hooks and Playwright
   orchestration; `web-client/` owns the actual Vue app.

## Why two `package.json`s?

- **Root `package.json`** — git hooks (husky), Playwright runner, environment
  tooling. Must live at the git root because husky installs hooks into `.git/`.
- **`web-client/package.json`** — the Vue 3 app: runtime dependencies, build
  tooling (Vite, TypeScript, ESLint), all the things you'd expect.

## Use the Makefile for everything

The Makefile is the canonical interface. Prefer it over raw `npm`/`vite`
commands so your local workflow matches CI.

| Task | Command |
|---|---|
| Fresh-clone install of npm deps | `make install-deps` |
| Clean + reinstall npm deps (preserves lockfiles) | `make reinstall-deps` |
| Full rebuild from scratch (wipe + reinstall + build) | `make rebuild-all` |
| Regenerate lockfiles from scratch (rare) | `make regen-lockfiles` |
| Verify your Node/npm versions | `make doctor` |
| Verify lockfiles are in sync (CI guardrail) | `make verify-lockfiles` |
| Run dev server | `make run` |
| Production build | `make build` |
| Preview production build | `make preview` |
| TypeScript check | `make typecheck` |
| Lint / lint-fix | `make lint` / `make lint-fix` |
| Unit tests | `make test-unit` |
| E2E tests | `make test-e2e` |
| Run everything CI runs | `make ci-check` |
| Full help | `make help` |

## The `npm ci` vs `npm install` rule

- **`make install-deps` (wraps `npm ci`)** — installs exactly what is in the
  lockfiles. Never modifies `package.json` or the lockfiles. **Use this for
  every fresh clone, every branch switch, and in CI.**
- **`npm install`** — re-resolves dependencies and may rewrite both
  `package.json` and `package-lock.json`. **Only use this when you are
  intentionally adding or upgrading a dependency**, and commit both files
  together in the same commit.

If a PR diff shows large, unexpected changes to either `package-lock.json`,
something is wrong — usually a wrong Node/npm version, or `npm install` was run
by accident. Revert the lockfile changes, run `make install-deps`, and try again.

## Adding or upgrading a dependency

Decide which `package.json` the dep belongs in (root vs `web-client/`), then:

```bash
cd web-client                  # or stay at root, depending on target
npm install <pkg>@<version>    # or: npm install <pkg> for latest compatible
```

Commit both `package.json` and `package-lock.json` from that directory in the
same commit.

## CI guardrails

The Playwright workflow calls the same Make targets you use locally:

- **`make verify-lockfiles`** — fails if `npm ci` produces a diff against
  committed `package.json`/`package-lock.json` in either location.
- **`engine-strict=true`** in both `.npmrc` files — blocks Node/npm versions
  below the `engines` range.
- **`make test-e2e`** — the same Playwright command you can run locally.

If CI fails on lockfile drift, running `make verify-lockfiles` on your branch
will reproduce the failure.

## Line endings and binary files

Line-ending and binary-file rules live in [`.gitattributes`](.gitattributes).
If you are adding a new binary asset type (e.g. a new font or image format)
not already listed, add an explicit `binary` rule there so cross-platform
checkouts don't corrupt it.
