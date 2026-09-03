####################################################################################################
#
# SlideRule Web-Client specific targets are located here
#
####################################################################################################

SHELL := /bin/bash
ROOT = $(shell pwd)
DOMAIN ?=
DOMAIN_ROOT = $(firstword $(subst ., ,$(DOMAIN)))
DOMAIN_APEX ?= $(DOMAIN)
S3_BUCKET ?=
DISTRIBUTION_ID = $(shell aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[0]=='$(DOMAIN)'].Id" --output text)
APEX_DISTRIBUTION_ID = $(shell aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[0]=='$(DOMAIN_APEX)'].Id" --output text)
BUILD_ENV = $(shell git --git-dir .git --work-tree . describe --abbrev --dirty --always --tags --long)
VERSION ?= latest
BANNER_TEXT ?=


clean-all: ## Remove node_modules and build artifacts (preserves package-lock.json files)
	rm -rf *.zip web-client/dist web-client/node_modules node_modules

clean: ## Remove only the build artifacts (web-client/dist)
	rm -rf web-client/dist

regen-lockfiles: ## DESTRUCTIVE: delete and regenerate package-lock.json files via `npm install` (only for intentional dep upgrades)
	rm -f package-lock.json web-client/package-lock.json
	npm install
	cd web-client && npm install

install-deps: ## Install npm dependencies (runs `npm ci` at root AND in web-client/ — use this on a fresh clone)
	npm ci
	cd web-client && npm ci

reinstall-deps: clean-all install-deps ## Wipe node_modules then re-run `npm ci` (committed lockfiles are respected)

rebuild-all: reinstall-deps build ## Full refresh: wipe node_modules + dist, reinstall npm deps, and rebuild the web client

LOCKFILES = package.json package-lock.json \
            web-client/package.json web-client/package-lock.json

# `npm ci` is itself the drift check: it fails with EUSAGE when package.json
# and package-lock.json disagree. The hash comparison catches the only other
# failure mode — an install that rewrites either file — without also tripping
# on ordinary uncommitted edits, which is what `git diff --exit-code` did.
verify-lockfiles: ## Run `npm ci` and fail if it rewrites package.json/package-lock.json (mirrors the CI guardrail)
	@set -e; \
	before=$$(git hash-object $(LOCKFILES)); \
	npm ci; \
	(cd web-client && npm ci); \
	after=$$(git hash-object $(LOCKFILES)); \
	if [ "$$before" != "$$after" ]; then \
	  echo "❌ npm ci rewrote package.json/package-lock.json — regenerate with 'make regen-lockfiles'"; \
	  exit 1; \
	fi; \
	echo "✅ lockfiles in sync and unmodified by npm ci"

# Validates the STAGED content, not the working tree. A commit ships what is in
# the index, so reading package.json off disk would pass a commit whose staged
# files disagree -- stage a dependency without its lockfile entry, then restore
# the working copy, and `git status` shows MM while the on-disk pair is
# consistent. Both files are extracted from the index into a temp dir instead.
#
# --ignore-scripts because `npm ci --dry-run` still executes `prepare`, and on
# a checkout with no node_modules that fails with "husky: command not found" --
# an error about lifecycle scripts, reported as if the lockfiles were broken.
check-lockfiles: ## Fast lockfile sync check on the staged files — no node_modules reinstall
	@set -e; \
	tmp=$$(mktemp -d); \
	trap 'rm -rf "$$tmp"' EXIT INT TERM; \
	for prefix in "" "web-client/"; do \
		out="$$tmp/$${prefix:-root}"; \
		mkdir -p "$$out"; \
		git show ":$${prefix}package.json"      > "$$out/package.json"; \
		git show ":$${prefix}package-lock.json" > "$$out/package-lock.json"; \
		if [ -f "$(ROOT)/$${prefix}.npmrc" ]; then cp "$(ROOT)/$${prefix}.npmrc" "$$out/.npmrc"; fi; \
		(cd "$$out" && npm ci --dry-run --ignore-scripts >/dev/null 2>&1) || { \
			echo "❌ staged package.json and package-lock.json disagree in $${prefix:-repo root}"; \
			echo "   run 'npm install' there, then stage BOTH files"; \
			exit 1; \
		}; \
	done; \
	echo "✅ staged package.json and package-lock.json are in sync (root and web-client)"

audit-deps: ## Run `npm audit` at root AND in web-client/ (read-only — reports vulnerabilities, does not modify anything)
	@echo "=== ROOT ==="
	-npm audit
	@echo ""
	@echo "=== web-client ==="
	-cd web-client && npm audit

audit-fix-deps: ## Apply `npm audit fix` at root AND in web-client/ (rewrites package-lock.json — review and commit the diff)
	npm audit fix
	cd web-client && npm audit fix

doctor: ## Check that your Node/npm versions match .nvmrc and the packageManager pin
	@echo "Expected Node: $$(cat .nvmrc)"
	@echo "Actual Node:   $$(node --version)"
	@echo "Expected npm:  $$(node -p "require('./package.json').packageManager")"
	@echo "Actual npm:    npm@$$(npm --version)"

src-tag-and-push: ## Tag and push the web client source code to the repository
	$(ROOT)/VITE_VERSION.sh $(VERSION) && git push --tags; git push
	$(ROOT)/publish-gh-release.sh $(VERSION)

gen-release-notes: ## Generate web-client release notes draft from git log NEEDS VERSION
	$(ROOT)/gen-release-notes.sh $(VERSION)

upload-assets: ## Upload hashed JS/CSS assets with long cache duration
	export AWS_MAX_ATTEMPTS=10 AWS_RETRY_MODE=standard && \
	echo "Uploading /assets with long cache duration..." && \
	aws s3 sync web-client/dist/assets/ s3://$(S3_BUCKET)/assets/ \
		--delete \
		--cache-control "max-age=31536000, immutable"

upload-static: ## Upload static files like favicon, logos (excluding index.html, assets and robots.txt)
	export AWS_MAX_ATTEMPTS=5 AWS_RETRY_MODE=standard && \
	echo "Uploading static files (excluding assets/, index.html and robots.txt)..." && \
	aws s3 sync web-client/dist/ s3://$(S3_BUCKET)/ \
		--exclude "index.html" \
		--exclude "assets/*" \
		--exclude "robots.txt" \
		--exclude "*.DS_Store"

# robots.txt is the only crawler-facing file this repo publishes, and it
# publishes it for the web client host only -- the apex hosts nothing and 404s
# every path but /. upload-robots is its SOLE publisher: upload-static excludes
# it deliberately. If both uploaded it, a failure of the second would leave the
# first one's file in place, which on a staging bucket means the crawlable
# production robots.txt stays live.
#
# The re-upload also sets an explicit Content-Type (`aws s3 sync` guesses from
# the extension and never sets a charset) and a short max-age, so edits
# propagate without an invalidation.
#
# Only the production web client may invite crawlers. The discriminator is
# DOMAIN, the client host -- NOT DOMAIN_APEX: a non-production client can sit
# under the production apex, and keying on the apex would publish the crawlable
# file to it. Anything that is not exactly the production client host gets
# robots.noindex.txt, so an unrecognised or mistyped DOMAIN fails safe
# (noindex) rather than open.
PROD_DOMAIN = client.slideruleearth.io
ROBOTS_SRC = $(if $(filter $(PROD_DOMAIN),$(DOMAIN)),web-client/dist/robots.txt,robots.noindex.txt)

upload-robots: ## Upload robots.txt with an explicit content type (noindex variant off production)
	export AWS_MAX_ATTEMPTS=5 AWS_RETRY_MODE=standard && \
	if [ "$(DOMAIN)" != "$(PROD_DOMAIN)" ]; then \
		echo "  ⚠️  non-production host ($(DOMAIN)) — substituting robots.noindex.txt (Disallow: /)"; \
	fi && \
	test -f "$(ROBOTS_SRC)" || { echo "❌ missing $(ROBOTS_SRC)"; exit 1; } && \
	echo "Uploading $(ROBOTS_SRC) -> robots.txt (text/plain; charset=utf-8)..." && \
	aws s3 cp "$(ROBOTS_SRC)" "s3://$(S3_BUCKET)/robots.txt" \
		--content-type "text/plain; charset=utf-8" \
		--cache-control "public, max-age=300"

upload-index: ## Upload index.html with no-cache headers
	export AWS_MAX_ATTEMPTS=5 AWS_RETRY_MODE=standard && \
	echo "Uploading index.html with no-cache headers..." && \
	aws s3 cp web-client/dist/index.html s3://$(S3_BUCKET)/index.html \
		--cache-control "no-cache, no-store, must-revalidate" \
		--content-type "text/html"

live-update: check-vars build upload-assets upload-static upload-robots upload-index ## Build and deploy all files
	export VITE_LIVE_UPDATE_DATE=$$(date +"%Y-%m-%d %T"); \
	echo "VITE_LIVE_UPDATE_DATE=$$VITE_LIVE_UPDATE_DATE" && \
	echo "S3_BUCKET=$(S3_BUCKET)" && \
	export AWS_MAX_ATTEMPTS=5 AWS_RETRY_MODE=standard && \
	echo "Invalidating CloudFront distribution $(DISTRIBUTION_ID)..." && \
	aws cloudfront create-invalidation --distribution-id $(DISTRIBUTION_ID) --paths "/*"
	$(MAKE) verify-s3-assets S3_BUCKET=$(S3_BUCKET)

verify-s3-assets: ## Check that all index-*.js and index-*.css files referenced in index.html exist in S3
	@echo "🔍 Verifying index.* assets in S3..."
	@grep -oE 'assets/index-[a-zA-Z0-9_\-]+\.(js|css)' web-client/dist/index.html | sort -u | while read -r asset; do \
		if aws s3 ls "s3://$(S3_BUCKET)/$$asset" >/dev/null; then \
			echo "✅ Found: $$asset"; \
		else \
			echo "❌ MISSING: $$asset"; \
		fi; \
	done
	@echo ""
	@echo "📅 Verified: $$(date +"%Y-%m-%d %T") (scroll up for exact Build Date/Time)"

verify-s3-assets-testsliderule:
	$(MAKE) verify-s3-assets S3_BUCKET=testsliderule-webclient

live-update-testsliderule: ## Update the web client at testsliderule.org with new build
	$(MAKE) live-update S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org DOMAIN=client.testsliderule.org

live-update-slideruleearth: ## Update the web client at slideruleearth.io with new build
	$(MAKE) live-update S3_BUCKET=slideruleearth-webclient DOMAIN_APEX=slideruleearth.io DOMAIN=client.slideruleearth.io

convert-icons: ## Convert Maki SVG icons in src/assets/maki-svg to PNGs in public/icons
	@echo "🔄 Converting Maki SVG icons to PNGs..."
	node ./web-client/convert-maki-icons.js

build: convert-icons ## Build the web client and update the dist folder
	export VITE_BUILD_ENV=$(BUILD_ENV); \
	export VITE_APP_BUILD_DATE=$$(date +"%Y-%m-%d %T"); \
	export VITE_APP_VERSION=$$(git describe --tags --abbrev=0); \
	export VITE_BANNER_TEXT='$(BANNER_TEXT)'; \
	cd web-client && \
	echo "VITE_APP_BUILD_DATE=$$VITE_APP_BUILD_DATE" && \
	echo "VITE_APP_VERSION=$$VITE_APP_VERSION" && \
	echo "VITE_BUILD_ENV=$$VITE_BUILD_ENV" && \
	echo "VITE_BANNER_TEXT=$$VITE_BANNER_TEXT" && \
	npm run build

keycloak-up: ## Start local Keycloak OAuth2.1 test server
	docker compose -f keycloak/docker-compose.yml up -d
	@echo "Waiting for Keycloak to be ready..."
	@until curl -sf http://localhost:8080/realms/sliderule/.well-known/openid-configuration > /dev/null 2>&1; do sleep 2; done
	@echo "Keycloak is ready at http://localhost:8080 (admin/admin)"
	@echo "Copy env override: cp keycloak/env.keycloak web-client/.env.local"

keycloak-down: ## Stop and remove local Keycloak
	docker compose -f keycloak/docker-compose.yml down -v

keycloak-run: keycloak-up ## Build and preview web client against local Keycloak
	export VITE_LOGIN_BASE_URL=http://localhost:8080/realms/sliderule; \
	export VITE_OAUTH_CLIENT_ID=sliderule-web-client-static; \
	export VITE_BUILD_ENV=$(BUILD_ENV); \
	export VITE_APP_BUILD_DATE=$$(date +"%Y-%m-%d %T"); \
	export VITE_APP_VERSION=$$(git describe --tags --abbrev=0); \
	export VITE_BANNER_TEXT='$(BANNER_TEXT)'; \
	cd web-client && \
	echo "VITE_LOGIN_BASE_URL=$$VITE_LOGIN_BASE_URL" && \
	npm run build && \
	npm run preview

run: ## Run the web client locally for development
	export VITE_BUILD_ENV=$(BUILD_ENV); \
	export VITE_RUN_DEV_DATE=$$(date +"%Y-%m-%d %T"); \
	export VITE_APP_VERSION=$$(git describe --tags --abbrev=0); \
	export VITE_BANNER_TEXT='$(BANNER_TEXT)'; \
	cd web-client && \
	echo "VITE_RUN_DEV_DATE=$$VITE_RUN_DEV_DATE" && \
	echo "VITE_APP_VERSION=$$VITE_APP_VERSION" && \
	echo "VITE_BUILD_ENV=$$VITE_BUILD_ENV" && \
	echo "VITE_BANNER_TEXT=$$VITE_BANNER_TEXT" && \
	npm run dev

preview: build ## Preview the web client production build locally for development 
	cd web-client && npm run preview

deploy: # Deploy the web client to the S3 bucket
	cd terraform && \
	terraform init && \
	terraform workspace select -or-create "$(DOMAIN)-web-client" && \
	terraform validate && \
	terraform apply \
		-var="domainName=$(DOMAIN)" \
		-var="domainApex=$(DOMAIN_APEX)" \
		-var="domain_root=$(DOMAIN_ROOT)" \
		-var="s3_bucket_name=$(S3_BUCKET)"

destroy: # Destroy the web client
	cd terraform && \
	terraform init && \
	terraform workspace select "$(DOMAIN)-web-client" && \
	terraform validate && \
	terraform destroy \
		-var="domainName=$(DOMAIN)" \
		-var="domainApex=$(DOMAIN_APEX)" \
		-var="domain_root=$(DOMAIN_ROOT)" \
		-var="s3_bucket_name=$(S3_BUCKET)"

deploy-client-to-testsliderule: ## Deploy the web client to the testsliderule.org cloudfront and update the s3 bucket
	$(MAKE) deploy DOMAIN=client.testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org && \
	$(MAKE) live-update DOMAIN=client.testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org

destroy-client-testsliderule: ## Destroy the web client from the testsliderule.org cloudfront and remove the S3 bucket
	$(MAKE) destroy DOMAIN=client.testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org

release-live-update-to-testsliderule: src-tag-and-push ## Release the web client to the live environment NEEDS VERSION
	$(MAKE) live-update DOMAIN=client.testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org

release-live-update-to-slideruleearth: src-tag-and-push ## Release the web client to the live environment NEEDS VERSION
	$(MAKE) live-update DOMAIN=client.slideruleearth.io S3_BUCKET=slideruleearth-webclient DOMAIN_APEX=slideruleearth.io

deploy-client-to-slideruleearth: ## Deploy the web client to the slideruleearth.io cloudfront and update the s3 bucket
	$(MAKE) deploy DOMAIN=client.slideruleearth.io S3_BUCKET=slideruleearth-webclient DOMAIN_APEX=slideruleearth.io && \
	$(MAKE) live-update DOMAIN=client.slideruleearth.io S3_BUCKET=slideruleearth-webclient DOMAIN_APEX=slideruleearth.io

destroy-client-slideruleearth: ## Destroy the web client from the slideruleearth.io cloudfront and remove the S3 bucket
	$(MAKE) destroy DOMAIN=client.slideruleearth.io S3_BUCKET=slideruleearth-webclient DOMAIN_APEX=slideruleearth.io

.PHONY: check-lockfiles typecheck-tests upload-robots install-deps reinstall-deps rebuild-all regen-lockfiles verify-lockfiles audit-deps audit-fix-deps doctor check-vars typecheck lint lint-fix lint-staged pre-commit-check test-unit test-unit-watch coverage-unit test-e2e test-all ci-check keycloak-up keycloak-down keycloak-run
# =========================
# Testing / Quality targets
# =========================

typecheck: ## Run TypeScript type checking
	cd web-client && npm run typecheck

lint: ## Run ESLint
	cd web-client && npm run lint

lint-fix: ## Run ESLint with auto-fix
	cd web-client && npm run lint:fix

lint-staged: ## Run lint-staged on staged files (used by pre-commit hook)
	cd web-client && npx lint-staged

# Goes through the make targets rather than the npm scripts, so prerequisites
# (test-unit -> typecheck-tests) are honored instead of silently skipped.
pre-commit-check: check-lockfiles lint-staged typecheck test-unit ## Run the same checks the pre-commit hook runs, without committing
	@echo "✅ Pre-commit checks passed!"

typecheck-tests: ## Typecheck the test sources (tsconfig.vitest.json)
	cd web-client && npm run typecheck:tests

test-unit: typecheck-tests ## Run Vitest unit tests (CI-friendly), type-checking tests first
	cd web-client && npm run test:unit

test-unit-watch: ## Run Vitest in watch mode (local dev)
	cd web-client && npm run test:unit:watch

coverage-unit: ## Run unit tests with coverage report
	cd web-client && npm run coverage:unit

test-e2e: ## Run Playwright E2E tests
	cd web-client && npm run test:e2e

test-e2e-headed: ## Run Playwright tests in headed mode
	cd web-client && npm run test:e2e:headed

test-e2e-ui: ## Open the Playwright Test UI (Explorer)
	cd web-client && npm run test:e2e:ui

test-e2e-debug: ## Run Playwright in debug mode (PWDEBUG=1)
	cd web-client && npm run test:e2e:debug

test-all: typecheck lint test-unit test-e2e ## Run all checks

pw-report: ## Open the last Playwright HTML report
	cd web-client && npm run pw:report

ci-check: verify-lockfiles typecheck lint test-unit test-e2e ## CI gate: lockfile drift + types + lint + unit + e2e

check-vars:
	@test -n "$(DOMAIN)" || (echo "❌ DOMAIN is not set"; exit 1)
	@test -n "$(S3_BUCKET)" || (echo "❌ S3_BUCKET is not set"; exit 1)
	@test -n "$(DOMAIN_APEX)" || (echo "❌ DOMAIN_APEX is not set"; exit 1)
	@test -n "$(DISTRIBUTION_ID)" || (echo "❌ DISTRIBUTION_ID could not be resolved for DOMAIN=$(DOMAIN)"; exit 1)
	@echo "✅ All required variables are set:"
	@echo "   DOMAIN          = $(DOMAIN)"
	@echo "   DOMAIN_APEX     = $(DOMAIN_APEX)"
	@echo "   S3_BUCKET       = $(S3_BUCKET)"
	@echo "   DISTRIBUTION_ID = $(DISTRIBUTION_ID)"


help: ## That's me!
	@printf "\033[37m%-30s\033[0m %s\n" "#-----------------------------------------------------------------------------------------"
	@printf "\033[37m%-30s\033[0m %s\n" "# Makefile Help       "
	@printf "\033[37m%-30s\033[0m %s\n" "#-----------------------------------------------------------------------------------------"
	@printf "\033[37m%-30s\033[0m %s\n" "#----target--------------------description------------------------------------------------"
	@grep -E '^[a-zA-Z_-].+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
	@echo BUILD_ENV: $(BUILD_ENV)
	@echo DOMAIN: $(DOMAIN)	
	@echo DOMAIN_ROOT: $(DOMAIN_ROOT)
	@echo DOMAIN_APEX: $(DOMAIN_APEX)
	@echo S3_BUCKET: $(S3_BUCKET)
	@echo DISTRIBUTION_ID: $(DISTRIBUTION_ID)