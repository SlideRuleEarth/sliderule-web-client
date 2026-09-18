####################################################################################################
#
# SlideRule Web-Client specific targets are located here
#
####################################################################################################

SHELL := /bin/bash
ROOT = $(shell pwd)

# No target here should ever drop the operator into `less`: the AWS CLI pages any
# output taller than the terminal (create-invalidation, describe-stack-events), and
# during the first cutover that trapped the operator twice mid-runbook.
export AWS_PAGER :=

# A bare `make` runs the first target, which used to be clean-all — i.e. it
# deleted node_modules and dist/. Show help instead.
.DEFAULT_GOAL := help

# Every target here orchestrates npm, Vite and aws; none gains anything from
# `make -j`, and the deploy path is unsafe under it: uploads could race the
# build, and index.html could land before the assets it names.
.NOTPARALLEL:

# DOMAIN_APEX is the ONE per-environment input. The client host is always
# client.<apex>, so DOMAIN is derived. Plain `=`, not `?=`: a DOMAIN sitting
# in the environment (some shells export DOMAIN=localhost) must not win over
# the derivation, but an explicit `DOMAIN=...` on the command line still
# does — and check-derived (which every deploy, destroy and live-update path
# runs first) refuses it if it disagrees with DOMAIN_APEX, so a stale
# invocation fails loudly rather than deploying somewhere unexpected.
DOMAIN_APEX ?=
DOMAIN = client.$(DOMAIN_APEX)
DOMAIN_ROOT = $(firstword $(subst ., ,$(DOMAIN)))
DISTRIBUTION_ID = $(shell aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[0]=='$(DOMAIN)'].Id" --output text)
BUILD_ENV = $(shell git --git-dir .git --work-tree . describe --abbrev --dirty --always --tags --long)
# The CloudFormation template and its lint toolchain (docs/cloudformation-migration-plan.md §5.5).
# `override`: the template is one file and the lint lock names the only cfn-lint we run.
override CFN_TEMPLATE = cloudformation/web-client.yaml
override CFN_LINT_REQUIREMENTS = cloudformation/requirements-lint.txt

# --- CloudFormation stack variables (plan §5.4) -------------------------------
# Everything derived from DOMAIN, and everything fixed by an external constraint,
# is `override`: no command line or environment variable can decouple the stack
# from the host it serves, move it out of us-east-1, or point it at another account.
override DOMAIN_SLUG = $(subst .,-,$(DOMAIN))
override STACK_NAME = $(DOMAIN_SLUG)-web-client
# Not a preference: CloudFront only accepts ACM certificates issued in us-east-1.
# Every ACM/CloudFormation call passes --region $(STACK_REGION) explicitly.
override STACK_REGION := us-east-1
# Every mutating stack target compares sts get-caller-identity against this (V5).
override EXPECTED_AWS_ACCOUNT_ID := 742127912612
# The bucket each environment's stack is built against: the origin in both
# distributions, what bucket-create creates, and the only bucket stack-destroy ever
# empties. Defaults to the stack name. Fill one of these in ONLY if that name turned
# out to be unavailable at bucket-create time -- a committed edit, never a command-line
# override, which is why these are `override` too.
override BUCKET_client-testsliderule-org-web-client =
override BUCKET_client-slideruleearth-io-web-client =
override STACK_BUCKET = $(or $(BUCKET_$(STACK_NAME)),$(STACK_NAME))
# The bucket UPLOADS go to. Overridable on purpose: until an environment's cutover
# its live-update-*/release-* wrappers point this at the Terraform-era bucket. After
# the cutover those wrappers call stack-upload, which forces STACK_BUCKET and ignores
# this variable entirely. No stack operation reads it.
S3_BUCKET ?= $(STACK_BUCKET)
# Escape hatch only: leave empty and the stack targets look the zone up (public
# zones only, exactly one match, resolved ONCE per invocation and the resolved value
# is the one used). Set it by hand only when that lookup cannot decide.
HOSTED_ZONE_ID ?=
# Typed by the operator, equal to the client host, on every target that deletes a stack
# or turns its termination protection off.
CONFIRM_DESTROY ?=
# Tags (plan D10). The three values live here once and are rendered twice, because
# `cloudformation deploy --tags` wants Key=Value and `s3api put-bucket-tagging` wants a TagSet.
TAG_OWNER = SlideRule
TAG_PROJECT = web-client-$(DOMAIN_APEX)
TAG_GROUP = web-client
STACK_TAGS = Owner=$(TAG_OWNER) Project=$(TAG_PROJECT) cost-grouping=$(TAG_GROUP)
S3_TAGSET = TagSet=[{Key=Owner,Value=$(TAG_OWNER)},{Key=Project,Value=$(TAG_PROJECT)},{Key=cost-grouping,Value=$(TAG_GROUP)}]
STACK_HEALTHY_STATUSES = CREATE_COMPLETE UPDATE_COMPLETE UPDATE_ROLLBACK_COMPLETE
STACK_FAILED_STATUSES = ROLLBACK_COMPLETE ROLLBACK_FAILED CREATE_FAILED DELETE_FAILED REVIEW_IN_PROGRESS
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

verify-s3-assets: ## Check that all index-*.js and index-*.css files referenced in index.html exist in S3 (fails if any is missing)
	@echo "🔍 Verifying index.* assets in S3..."
	@grep -oE 'assets/index-[a-zA-Z0-9_\-]+\.(js|css)' web-client/dist/index.html | sort -u | { \
		rc=0; n=0; \
		while read -r asset; do \
			n=$$((n+1)); \
			if aws s3 ls "s3://$(S3_BUCKET)/$$asset" >/dev/null; then \
				echo "✅ Found: $$asset"; \
			else \
				echo "❌ MISSING: $$asset"; rc=1; \
			fi; \
		done; \
		if [ "$$n" -eq 0 ]; then \
			echo "❌ No index-*.js/css references found in web-client/dist/index.html — is it built?"; rc=1; \
		fi; \
		exit $$rc; \
	}
	@echo ""
	@echo "📅 Verified: $$(date +"%Y-%m-%d %T") (scroll up for exact Build Date/Time)"

verify-s3-assets-testsliderule: ## verify-s3-assets against the testsliderule.org stack bucket
	$(MAKE) stack-verify DOMAIN_APEX=testsliderule.org

verify-s3-assets-slideruleearth: ## verify-s3-assets against the slideruleearth.io stack bucket
	$(MAKE) stack-verify DOMAIN_APEX=slideruleearth.io

live-update-testsliderule: ## Update the web client at testsliderule.org with new build
	$(MAKE) stack-upload DOMAIN_APEX=testsliderule.org

live-update-slideruleearth: ## Update the web client at slideruleearth.io with new build
	$(MAKE) stack-upload DOMAIN_APEX=slideruleearth.io

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

# =========================
# CloudFormation stack targets (docs/cloudformation-migration-plan.md §5.4, §7.2, §7.3)
# =========================
# From here on `deploy`/`destroy` mean the stack. The only Terraform target left is
# terraform-destroy, used once per environment at its cutover. There is deliberately
# no terraform-deploy: until an environment's cutover its infrastructure is frozen;
# an emergency Terraform change is run by hand from terraform/ with the workspace
# selected, never through make.

# Shell fragment: sets $status (NONE when there is no stack) and $protected. Only the
# specific "does not exist" error for THIS stack means "no stack"; any other failure --
# credentials, region, throttling -- aborts, so it can never pass a first-create guard.
define STACK_STATUS_SH
out=$$(aws cloudformation describe-stacks --region $(STACK_REGION) --stack-name "$(STACK_NAME)" \
        --query 'Stacks[0].[StackStatus,EnableTerminationProtection]' --output text 2>&1) && rc=0 || rc=$$?; \
if [ $$rc -ne 0 ]; then \
  case "$$out" in \
    *"Stack with id $(STACK_NAME) does not exist"*) status=NONE; protected=false;; \
    *) echo "❌ describe-stacks failed:"; echo "$$out"; exit 1;; \
  esac; \
else \
  set -- $$out; status=$${1:-}; protected=$${2:-}; \
  case "$$status" in *[!A-Z_]*|"") echo "❌ unexpected describe-stacks output: '$$out'"; exit 1;; esac; \
  case "$$protected" in True|true) protected=true;; False|false) protected=false;; \
    *) echo "❌ unexpected EnableTerminationProtection: '$$protected'"; exit 1;; esac; \
fi
endef

# Shell fragment: sets $hz to the hosted zone ID, resolved ONCE in the calling shell so
# the value that was checked is the value that is used. HOSTED_ZONE_ID, if set, wins.
define HOSTED_ZONE_SH
if [ -n "$(HOSTED_ZONE_ID)" ]; then hz="$(HOSTED_ZONE_ID)"; hz_src="HOSTED_ZONE_ID override"; else \
  hz=$$(aws route53 list-hosted-zones-by-name --dns-name "$(DOMAIN_APEX)" \
        --query "HostedZones[?Name=='$(DOMAIN_APEX).' && Config.PrivateZone==\`false\`].Id" --output text) \
    || { echo "❌ hosted zone lookup for $(DOMAIN_APEX) failed"; exit 1; }; \
  hz=$${hz//\/hostedzone\//}; hz_src="lookup"; \
fi; \
set -- $$hz; \
if [ $$# -ne 1 ] || [ "$$1" = "None" ]; then \
  echo "❌ HOSTED_ZONE_ID: expected exactly one public hosted zone for $(DOMAIN_APEX), got: '$$hz'"; \
  echo "   Establish which zone is right, then pass HOSTED_ZONE_ID=<id> explicitly"; exit 1; \
fi; hz=$$1
endef

# Shell fragment: the stack's S3BucketName PARAMETER (not the output) must equal $(STACK_BUCKET).
define STACK_BUCKET_PARAM_SH
param=$$(aws cloudformation describe-stacks --region $(STACK_REGION) --stack-name "$(STACK_NAME)" \
          --query "Stacks[0].Parameters[?ParameterKey=='S3BucketName'].ParameterValue" --output text) \
  || { echo "❌ could not read the stack's S3BucketName parameter"; exit 1; }; \
test "$$param" = "$(STACK_BUCKET)" \
  || { echo "❌ the stack's S3BucketName parameter is '$$param' but STACK_BUCKET is '$(STACK_BUCKET)': refusing"; exit 1; }
endef

define CONFIRM_DESTROY_SH
test "$(CONFIRM_DESTROY)" = "$(DOMAIN)" \
  || { echo "❌ pass CONFIRM_DESTROY=$(DOMAIN) to confirm (got '$(CONFIRM_DESTROY)')"; exit 1; }
endef

check-account: ## Assert the AWS caller is in the expected account (every mutating stack target runs this)
	@set -eu; \
	caller=$$(aws sts get-caller-identity --query '[Account,Arn]' --output text) \
	  || { echo "❌ sts get-caller-identity failed"; exit 1; }; \
	set -- $$caller; \
	test "$${1:-}" = "$(EXPECTED_AWS_ACCOUNT_ID)" \
	  || { echo "❌ AWS account is '$${1:-}', expected $(EXPECTED_AWS_ACCOUNT_ID): refusing"; exit 1; }; \
	echo "✅ AWS account $$1 ($${2:-})"

check-stack-vars: check-derived ## Check the create/update inputs: hosted zone resolves to exactly one ID and STACK_BUCKET exists (no DISTRIBUTION_ID needed)
	@set -eu; \
	aws s3api head-bucket --bucket "$(STACK_BUCKET)" >/dev/null 2>&1 \
	  || { echo "❌ bucket $(STACK_BUCKET) does not exist (or is not accessible): run make bucket-create DOMAIN_APEX=$(DOMAIN_APEX) first"; exit 1; }; \
	$(HOSTED_ZONE_SH); \
	echo "✅ Stack inputs:"; \
	echo "   STACK_NAME      = $(STACK_NAME)"; \
	echo "   STACK_REGION    = $(STACK_REGION)"; \
	echo "   STACK_BUCKET    = $(STACK_BUCKET)"; \
	echo "   HOSTED_ZONE_ID  = $$hz ($$hz_src)"; \
	echo "   STACK_TAGS      = $(STACK_TAGS)"

check-destroy-vars: check-derived check-account ## Run every destruction gate without touching anything (stack-destroy runs this first)
	@set -eu; \
	$(STACK_STATUS_SH); \
	test "$$status" != NONE || { echo "❌ no stack named $(STACK_NAME) in $(STACK_REGION)"; exit 1; }; \
	case " $(STACK_HEALTHY_STATUSES) " in *" $$status "*) ;; \
	  *) echo "❌ stack $(STACK_NAME) is $$status; stack-destroy only deletes a healthy stack (see plan §7.3, stack-delete-failed)"; exit 1;; esac; \
	test "$$protected" = false || { echo "❌ termination protection is on: run make stack-unprotect first, deliberately"; exit 1; }; \
	$(CONFIRM_DESTROY_SH); \
	$(STACK_BUCKET_PARAM_SH); \
	echo "✅ Destroy gates passed for $(STACK_NAME) ($$status), bucket $(STACK_BUCKET)"

bucket-configure: check-derived check-account ## Reassert the public-access block and tags on STACK_BUCKET (idempotent; also the recovery path if bucket-create died mid-way)
	@set -eu; \
	owned=$$(aws s3api list-buckets --query "Buckets[?Name=='$(STACK_BUCKET)'].Name" --output text) \
	  || { echo "❌ list-buckets failed"; exit 1; }; \
	test -n "$$owned" && test "$$owned" != None \
	  || { echo "❌ bucket $(STACK_BUCKET) is not owned by this account: refusing"; exit 1; }; \
	aws s3api put-public-access-block --bucket "$(STACK_BUCKET)" \
	  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true; \
	aws s3api put-bucket-tagging --bucket "$(STACK_BUCKET)" --tagging '$(S3_TAGSET)'; \
	echo "✅ bucket $(STACK_BUCKET): public access blocked, tagged"

# Only a confirmed 404 from head-bucket proceeds: a 403 (someone else's bucket, or no
# permission), a 5xx or a network error is not "does not exist", and create-bucket on a
# bucket this account already owns can succeed in us-east-1 and reset its ACL.
bucket-create: check-derived check-account ## Create STACK_BUCKET in us-east-1, once per environment; refuses if it already exists; never deleted by anything here
	@set -eu; \
	probe=$$(aws s3api head-bucket --bucket "$(STACK_BUCKET)" 2>&1) && rc=0 || rc=$$?; \
	if [ $$rc -eq 0 ]; then \
	  echo "❌ bucket $(STACK_BUCKET) already exists: refusing. To reassert its settings run make bucket-configure"; exit 1; \
	fi; \
	case "$$probe" in *"(404)"*|*"Not Found"*) ;; \
	  *) echo "❌ head-bucket on $(STACK_BUCKET) failed for a reason other than 'not found'; refusing to create:"; echo "$$probe"; exit 1;; esac; \
	aws s3api create-bucket --region $(STACK_REGION) --bucket "$(STACK_BUCKET)"; \
	echo "✅ created bucket $(STACK_BUCKET) in $(STACK_REGION)"
	$(MAKE) bucket-configure DOMAIN_APEX=$(DOMAIN_APEX)

stack-status: check-derived ## Print the stack's status and termination protection, or "no stack"
	@set -eu; $(STACK_STATUS_SH); \
	if [ "$$status" = NONE ]; then echo "no stack named $(STACK_NAME) in $(STACK_REGION)"; \
	else echo "$(STACK_NAME): $$status (termination protection: $$protected)"; fi

stack-outputs: check-derived ## Print the stack's outputs
	aws cloudformation describe-stacks --region $(STACK_REGION) --stack-name "$(STACK_NAME)" \
	  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' --output table

stack-events: check-derived ## Print the stack's events, newest first (watch a create, debug a failure)
	aws cloudformation describe-stack-events --region $(STACK_REGION) --stack-name "$(STACK_NAME)" \
	  --query 'StackEvents[].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' --output table

# Create or update. Refuses every status outside the healthy set, and on a FIRST create
# refuses if any distribution already carries either hostname (Terraform still owns the
# environment). The hosted zone is resolved once, here, and that value is what is passed.
stack-deploy: check-derived check-account lint-cfn ## Create or update the stack from the template (gated; plan §5.4)
	@set -eu; \
	aws s3api head-bucket --bucket "$(STACK_BUCKET)" >/dev/null 2>&1 \
	  || { echo "❌ bucket $(STACK_BUCKET) does not exist: run make bucket-create DOMAIN_APEX=$(DOMAIN_APEX) first"; exit 1; }; \
	$(HOSTED_ZONE_SH); \
	$(STACK_STATUS_SH); \
	case " NONE $(STACK_HEALTHY_STATUSES) " in *" $$status "*) ;; \
	  *) echo "❌ stack $(STACK_NAME) is $$status: refusing to deploy. See plan §7.3 for what to do in this state"; exit 1;; esac; \
	if [ "$$status" = NONE ]; then \
	  taken=$$(aws cloudfront list-distributions \
	    --query "DistributionList.Items[?contains(not_null(Aliases.Items, \`[]\`), '$(DOMAIN)') || contains(not_null(Aliases.Items, \`[]\`), '$(DOMAIN_APEX)')].Id" \
	    --output text) || { echo "❌ alias check failed (list-distributions): refusing to create"; exit 1; }; \
	  if [ -n "$$taken" ] && [ "$$taken" != None ]; then \
	    echo "❌ distribution(s) $$taken already carry $(DOMAIN) or $(DOMAIN_APEX): this environment is still on Terraform (plan §7.2 step 11)"; exit 1; \
	  fi; \
	  echo "▶ first create of $(STACK_NAME)"; \
	else echo "▶ updating $(STACK_NAME) ($$status)"; fi; \
	echo "   HostedZoneId=$$hz ($$hz_src)  S3BucketName=$(STACK_BUCKET)"; \
	aws cloudformation deploy --region $(STACK_REGION) \
	  --stack-name "$(STACK_NAME)" \
	  --template-file $(CFN_TEMPLATE) \
	  --parameter-overrides DomainName=$(DOMAIN) DomainApex=$(DOMAIN_APEX) S3BucketName=$(STACK_BUCKET) HostedZoneId=$$hz \
	  --tags $(STACK_TAGS) \
	  --no-fail-on-empty-changeset
	$(MAKE) stack-outputs DOMAIN_APEX=$(DOMAIN_APEX)

# Stack first, contents second: a failed stack delete (or waiter) stops before the
# first s3 rm, so the site's files stay where they were. The bucket itself is never deleted.
stack-destroy: check-destroy-vars ## Delete the stack, then empty STACK_BUCKET (NEEDS CONFIRM_DESTROY=<client host>)
	@set -eu; \
	aws cloudformation delete-stack --region $(STACK_REGION) --stack-name "$(STACK_NAME)"; \
	echo "▶ waiting for $(STACK_NAME) to delete..."; \
	aws cloudformation wait stack-delete-complete --region $(STACK_REGION) --stack-name "$(STACK_NAME)"; \
	echo "✅ stack deleted; emptying s3://$(STACK_BUCKET)"; \
	aws s3 rm "s3://$(STACK_BUCKET)" --recursive; \
	left=$$(aws s3api list-objects-v2 --bucket "$(STACK_BUCKET)" --max-keys 1 --query KeyCount --output text); \
	test "$$left" = 0 || { echo "❌ bucket $(STACK_BUCKET) is not empty after rm (KeyCount=$$left)"; exit 1; }; \
	echo "✅ bucket $(STACK_BUCKET) is empty (and still exists)"

stack-protect: check-derived check-account ## Turn termination protection on (production, right after the create)
	aws cloudformation update-termination-protection --region $(STACK_REGION) \
	  --enable-termination-protection --stack-name "$(STACK_NAME)"

stack-unprotect: check-derived check-account ## Turn termination protection off, deliberately (NEEDS CONFIRM_DESTROY=<client host>)
	@set -eu; $(CONFIRM_DESTROY_SH); \
	aws cloudformation update-termination-protection --region $(STACK_REGION) \
	  --no-enable-termination-protection --stack-name "$(STACK_NAME)"

# The recovery path out of a failed state, never a second way to delete a working stack.
# RETAIN='<logical ids>' and FORCE_DELETE=1 are accepted only in DELETE_FAILED, one at a time.
stack-delete-failed: check-derived check-account ## Delete a stack stuck in a failed state (NEEDS CONFIRM_DESTROY; RETAIN= / FORCE_DELETE=1 only from DELETE_FAILED)
	@set -eu; \
	$(STACK_STATUS_SH); \
	test "$$status" != NONE || { echo "❌ no stack named $(STACK_NAME)"; exit 1; }; \
	case " $(STACK_FAILED_STATUSES) " in *" $$status "*) ;; \
	  *) echo "❌ stack $(STACK_NAME) is $$status, not a failed state: this target refuses (healthy: stack-destroy; CREATE_IN_PROGRESS: stack-abort-create; see plan §7.3)"; exit 1;; esac; \
	extra=""; \
	case "$(FORCE_DELETE)" in ""|1) ;; *) echo "❌ FORCE_DELETE must be exactly 1 to enable forced deletion (got '$(FORCE_DELETE)')"; exit 1;; esac; \
	if [ -n "$(RETAIN)" ] && [ -n "$(FORCE_DELETE)" ]; then echo "❌ RETAIN and FORCE_DELETE are one escalation each; pass only one"; exit 1; fi; \
	if [ -n "$(RETAIN)" ] || [ -n "$(FORCE_DELETE)" ]; then \
	  test "$$status" = DELETE_FAILED || { echo "❌ RETAIN / FORCE_DELETE are only accepted from DELETE_FAILED (stack is $$status)"; exit 1; }; \
	fi; \
	if [ -n "$(RETAIN)" ]; then extra="--retain-resources $(RETAIN)"; fi; \
	if [ "$(FORCE_DELETE)" = 1 ]; then extra="--deletion-mode FORCE_DELETE_STACK"; fi; \
	$(CONFIRM_DESTROY_SH); \
	echo "▶ deleting $(STACK_NAME) ($$status) $$extra"; \
	aws cloudformation delete-stack --region $(STACK_REGION) --stack-name "$(STACK_NAME)" $$extra; \
	aws cloudformation wait stack-delete-complete --region $(STACK_REGION) --stack-name "$(STACK_NAME)"; \
	echo "✅ $(STACK_NAME) deleted (bucket untouched)"

# The only escape from a hung create. Run it only when plan §7.3's three conditions hold:
# no new event for 15+ minutes, the certificate is not merely waiting on DNS, budget exceeded.
stack-abort-create: check-derived check-account ## Delete a stack stuck in CREATE_IN_PROGRESS, after showing the evidence (NEEDS CONFIRM_DESTROY)
	@set -eu; \
	$(STACK_STATUS_SH); \
	test "$$status" = CREATE_IN_PROGRESS \
	  || { echo "❌ stack $(STACK_NAME) is $$status, not CREATE_IN_PROGRESS: this target refuses"; exit 1; }; \
	newest=$$(aws cloudformation describe-stack-events --region $(STACK_REGION) --stack-name "$(STACK_NAME)" \
	  --query 'StackEvents[0].[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' --output text) \
	  || { echo "❌ could not read the stack's events: refusing to abort blind"; exit 1; }; \
	echo "   newest event (UTC): $$newest"; \
	echo "   now          (UTC): $$(date -u +%Y-%m-%dT%H:%M:%SZ)"; \
	echo "   plan §7.3: abort only if the newest event is 15+ minutes old, the certificate is not waiting on DNS, and the budget is exceeded"; \
	$(CONFIRM_DESTROY_SH); \
	aws cloudformation delete-stack --region $(STACK_REGION) --stack-name "$(STACK_NAME)"; \
	aws cloudformation wait stack-delete-complete --region $(STACK_REGION) --stack-name "$(STACK_NAME)"; \
	echo "✅ $(STACK_NAME) deleted (bucket untouched)"

# Fill the permanent bucket BEFORE a window and prove it landed. One $(MAKE) per line:
# recipe lines are sequential whatever -j says. No invalidation and no DISTRIBUTION_ID:
# pre-cutover the alias still resolves to the distribution Terraform owns.
stack-prestage: check-derived check-account ## Build and upload to STACK_BUCKET, then verify; no invalidation (plan §7.2 step 9)
	$(MAKE) build DOMAIN_APEX=$(DOMAIN_APEX)
	$(MAKE) upload-assets DOMAIN_APEX=$(DOMAIN_APEX) S3_BUCKET=$(STACK_BUCKET)
	$(MAKE) upload-static DOMAIN_APEX=$(DOMAIN_APEX) S3_BUCKET=$(STACK_BUCKET)
	$(MAKE) upload-robots DOMAIN_APEX=$(DOMAIN_APEX) S3_BUCKET=$(STACK_BUCKET)
	$(MAKE) upload-index DOMAIN_APEX=$(DOMAIN_APEX) S3_BUCKET=$(STACK_BUCKET)
	$(MAKE) verify-s3-assets DOMAIN_APEX=$(DOMAIN_APEX) S3_BUCKET=$(STACK_BUCKET)
	@echo "✅ pre-staged into s3://$(STACK_BUCKET). Do NOT run make build until stack-activate has run."

# Post-create when the bucket was pre-staged: verify against the local dist/ and invalidate.
# No build, no upload -- a rebuild would change the hashed bundle and discard the staged set.
stack-activate: check-derived check-account ## Verify the pre-staged bucket against dist/ and invalidate the new distribution; no build (plan §7.2 step 12)
	$(MAKE) verify-s3-assets DOMAIN_APEX=$(DOMAIN_APEX) S3_BUCKET=$(STACK_BUCKET)
	@set -eu; \
	id="$(DISTRIBUTION_ID)"; \
	test -n "$$id" && test "$$id" != None || { echo "❌ no distribution carries $(DOMAIN) yet"; exit 1; }; \
	echo "▶ invalidating $$id"; \
	aws cloudfront create-invalidation --distribution-id "$$id" --paths "/*"

# Post-create when the bucket was NOT pre-staged, and the normal deploy path afterwards:
# the full live-update, forced to the stack's own bucket by a sub-make command-line
# assignment, which beats a stale S3_BUCKET in the environment AND one typed on the
# outer command line.
stack-upload: check-derived check-account ## Build, upload to STACK_BUCKET, invalidate and verify (live-update forced to the stack's bucket)
	$(MAKE) live-update DOMAIN_APEX=$(DOMAIN_APEX) S3_BUCKET=$(STACK_BUCKET)

stack-verify: check-derived ## verify-s3-assets forced to STACK_BUCKET (read-only)
	$(MAKE) verify-s3-assets DOMAIN_APEX=$(DOMAIN_APEX) S3_BUCKET=$(STACK_BUCKET)

deploy: stack-deploy ## Alias of stack-deploy

destroy: stack-destroy ## Alias of stack-destroy (NEEDS CONFIRM_DESTROY=<client host>)

# The Terraform-era destroy, run once per environment at its cutover (plan §7.2 step 11).
# Terraform's own plan-and-confirm prompt is the gate. Deleted in Phase 5.
terraform-destroy: check-terraform-vars ## Destroy the Terraform-managed infrastructure (NEEDS DOMAIN_APEX and the Terraform-era S3_BUCKET on the command line)
	cd terraform && \
	terraform init && \
	terraform workspace select "$(DOMAIN)-web-client" && \
	terraform validate && \
	terraform destroy \
		-var="domainName=$(DOMAIN)" \
		-var="domainApex=$(DOMAIN_APEX)" \
		-var="domain_root=$(DOMAIN_ROOT)" \
		-var="s3_bucket_name=$(S3_BUCKET)"

# Environment wrappers. deploy-* / destroy-* are CloudFormation-only from here on and
# refuse an environment that is still on Terraform (the alias check in stack-deploy).
# live-update-* / release-* keep S3_BUCKET pinned to the Terraform-era bucket until that
# environment's cutover; plan §7.2 step 16 then switches them to stack-upload / stack-verify,
# which FORCE the stack's bucket as a sub-make assignment -- the S3_BUCKET default alone would
# still yield to a stale S3_BUCKET= on the command line. Both environments have cut over
# (testsliderule.org 2026-09-15, slideruleearth.io 2026-09-18) and use the stack targets.
deploy-client-to-testsliderule: ## Create/update the testsliderule.org stack, then build and upload to its bucket
	$(MAKE) stack-deploy DOMAIN_APEX=testsliderule.org
	$(MAKE) stack-upload DOMAIN_APEX=testsliderule.org

destroy-client-testsliderule: ## Destroy the testsliderule.org stack and empty its bucket (NEEDS CONFIRM_DESTROY=client.testsliderule.org)
	$(MAKE) stack-destroy DOMAIN_APEX=testsliderule.org CONFIRM_DESTROY=$(CONFIRM_DESTROY)

release-live-update-to-testsliderule: src-tag-and-push ## Release the web client to the live environment NEEDS VERSION
	$(MAKE) stack-upload DOMAIN_APEX=testsliderule.org

release-live-update-to-slideruleearth: src-tag-and-push ## Release the web client to the live environment NEEDS VERSION
	$(MAKE) stack-upload DOMAIN_APEX=slideruleearth.io

deploy-client-to-slideruleearth: ## Create/update the slideruleearth.io stack, then build and upload to its bucket
	$(MAKE) stack-deploy DOMAIN_APEX=slideruleearth.io
	$(MAKE) stack-upload DOMAIN_APEX=slideruleearth.io

destroy-client-slideruleearth: ## Destroy the slideruleearth.io stack and empty its bucket (NEEDS CONFIRM_DESTROY=client.slideruleearth.io)
	$(MAKE) stack-destroy DOMAIN_APEX=slideruleearth.io CONFIRM_DESTROY=$(CONFIRM_DESTROY)

.PHONY: check-lockfiles typecheck-tests upload-robots install-deps reinstall-deps rebuild-all regen-lockfiles verify-lockfiles audit-deps audit-fix-deps doctor check-derived check-terraform-vars check-vars check-account check-stack-vars check-destroy-vars bucket-create bucket-configure stack-status stack-outputs stack-events stack-deploy stack-destroy stack-protect stack-unprotect stack-delete-failed stack-abort-create stack-prestage stack-activate stack-upload stack-verify deploy destroy terraform-destroy typecheck lint lint-fix lint-cfn validate-cfn lint-staged pre-commit-check test-unit test-unit-watch coverage-unit test-e2e test-all ci-check keycloak-up keycloak-down keycloak-run
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

ci-check: verify-lockfiles typecheck lint test-unit test-e2e lint-cfn ## CI gate: lockfile drift + types + lint + unit + e2e + CloudFormation lint

# Nothing is installed: uv resolves the pinned lock into a cache and runs cfn-lint from
# it. The interpreter is pinned too so local and CI take the same branch of the lock's
# markers. Regenerate the lock per the comment in cloudformation/requirements-lint.in.
lint-cfn: ## Lint the CloudFormation template with the pinned cfn-lint (needs uv, no AWS)
	uv run --no-project --python 3.13 \
	  --with-requirements $(CFN_LINT_REQUIREMENTS) \
	  cfn-lint $(CFN_TEMPLATE)

validate-cfn: ## Ask the CloudFormation API (us-east-1) whether the template is syntactically valid (needs AWS credentials, changes nothing)
	aws cloudformation validate-template --region $(STACK_REGION) --template-body file://$(CFN_TEMPLATE) --output text --query 'Description'

check-derived: ## Assert DOMAIN_APEX is set, DOMAIN is client.<apex> and STACK_NAME follows, offline — every deploy, destroy and live-update path runs this first
	@test -n "$(DOMAIN_APEX)" || (echo "❌ DOMAIN_APEX is not set"; exit 1)
	@test "$(DOMAIN)" = "client.$(DOMAIN_APEX)" || (echo "❌ DOMAIN=$(DOMAIN) does not match DOMAIN_APEX=$(DOMAIN_APEX): the client host is always client.<apex>, so pass DOMAIN_APEX only"; exit 1)
	@test "$(STACK_NAME)" = "$(subst .,-,$(DOMAIN))-web-client" || (echo "❌ STACK_NAME=$(STACK_NAME) is not derived from DOMAIN=$(DOMAIN)"; exit 1)

# The Terraform-era bucket must be TYPED on the command line: S3_BUCKET now defaults to
# the stack's bucket, and terraform-destroy must never inherit that.
check-terraform-vars: check-derived ## Check the Terraform inputs (terraform-destroy runs this first)
	@test "$(origin S3_BUCKET)" = "command line" || (echo "❌ S3_BUCKET must be given on the command line: the Terraform-era bucket, e.g. S3_BUCKET=testsliderule-webclient"; exit 1)
	@test -n "$(S3_BUCKET)" || (echo "❌ S3_BUCKET is empty"; exit 1)
	@test "$(S3_BUCKET)" != "$(STACK_BUCKET)" || (echo "❌ S3_BUCKET=$(S3_BUCKET) is the stack's bucket, not a Terraform-era one: refusing"; exit 1)
	@echo "✅ Terraform inputs:"
	@echo "   DOMAIN          = $(DOMAIN)"
	@echo "   DOMAIN_APEX     = $(DOMAIN_APEX)"
	@echo "   S3_BUCKET       = $(S3_BUCKET)"

check-vars: check-derived ## Check that DOMAIN_APEX, DOMAIN, S3_BUCKET and DISTRIBUTION_ID resolve (live-update runs this first)
	@test -n "$(S3_BUCKET)" || (echo "❌ S3_BUCKET is not set"; exit 1)
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
	@echo STACK_NAME: $(STACK_NAME)
	@echo STACK_BUCKET: $(STACK_BUCKET)
	@echo DISTRIBUTION_ID: $(DISTRIBUTION_ID)