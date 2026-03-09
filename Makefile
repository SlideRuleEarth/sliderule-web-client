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
DISTRIBUTION_ID = $(shell aws cloudfront list-distributions --query "DistributionList.Items[?contains(Aliases.Items,'$(DOMAIN)')].Id" --output text)
BUILD_ENV = $(shell git --git-dir .git --work-tree . describe --abbrev --dirty --always --tags --long)
VERSION ?= latest
BANNER_TEXT ?=
CREATE_APEX_REDIRECT ?= true


clean-all: # Clean up the web client dependencies 
	rm -rf *.zip web-client/dist web-client/node_modules web-client/package-lock.json

clean: ## Clean only the build artifacts
	rm -rf web-client/dist

reinstall: clean-all ## Reinstall the web client dependencies
	cd web-client && npm install

src-tag-and-push: ## Tag and push the web client source code to the repository
	$(ROOT)/VITE_VERSION.sh $(VERSION) && git push --tags; git push

upload-assets: ## Upload hashed JS/CSS assets with long cache duration
	export AWS_MAX_ATTEMPTS=10 AWS_RETRY_MODE=standard && \
	echo "Uploading /assets with long cache duration..." && \
	aws s3 sync web-client/dist/assets/ s3://$(S3_BUCKET)/assets/ \
		--delete \
		--cache-control "max-age=31536000, immutable"

upload-static: ## Upload static files like favicon, logos (excluding index.html and assets)
	export AWS_MAX_ATTEMPTS=5 AWS_RETRY_MODE=standard && \
	echo "Uploading static files (excluding assets/ and index.html)..." && \
	aws s3 sync web-client/dist/ s3://$(S3_BUCKET)/ \
		--exclude "index.html" \
		--exclude "assets/*"

upload-index: ## Upload index.html with no-cache headers
	export AWS_MAX_ATTEMPTS=5 AWS_RETRY_MODE=standard && \
	echo "Uploading index.html with no-cache headers..." && \
	aws s3 cp web-client/dist/index.html s3://$(S3_BUCKET)/index.html \
		--cache-control "no-cache, no-store, must-revalidate" \
		--content-type "text/html"

live-update: check-vars build upload-assets upload-static upload-index ## Build and deploy all files
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

live-update-client-testsliderule: ## Update the web client at client.testsliderule.org with new build
	$(MAKE) live-update S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org DOMAIN=client.testsliderule.org 

live-update-ai-testsliderule: ## Update the web client at ai.testsliderule.org with new build
	$(MAKE) live-update S3_BUCKET=testsliderule-ai-webclient DOMAIN_APEX=testsliderule.org DOMAIN=ai.testsliderule.org

live-update-client-slideruleearth: ## Update the web client at client.slideruleearth.io with new build
	$(MAKE) live-update S3_BUCKET=slideruleearth-webclient DOMAIN_APEX=slideruleearth.io DOMAIN=client.slideruleearth.io 

convert-icons: ## Convert Maki SVG icons in src/assets/maki-svg to PNGs in public/icons
	@echo "🔄 Converting Maki SVG icons to PNGs..."
	node ./web-client/convert-maki-icons.js

build-docs: ## Scrape ReadTheDocs and extract tooltips into docs-index.json
	cd web-client && npm run build:docs

build: convert-icons build-docs ## Build the web client and update the dist folder
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
	mkdir -p terraform/ && cd terraform/ && terraform init && \
	(terraform workspace select $(DOMAIN)-web-client 2>/dev/null || terraform workspace new $(DOMAIN)-web-client) && \
	terraform validate && \
	terraform apply -var domainName=$(DOMAIN) -var domainApex=$(DOMAIN_APEX) -var domain_root=$(DOMAIN_ROOT) -var s3_bucket_name=$(S3_BUCKET) -var create_apex_redirect=$(CREATE_APEX_REDIRECT)

destroy: # Destroy the web client
	mkdir -p terraform/ && cd terraform/ && terraform init && \
	(terraform workspace select $(DOMAIN)-web-client 2>/dev/null || terraform workspace new $(DOMAIN)-web-client) && \
	terraform validate && \
	terraform destroy -var domainName=$(DOMAIN) -var domainApex=$(DOMAIN_APEX) -var domain_root=$(DOMAIN_ROOT) -var s3_bucket_name=$(S3_BUCKET) -var create_apex_redirect=$(CREATE_APEX_REDIRECT)

deploy-client-to-testsliderule: ## Deploy the web client to the testsliderule.org cloudfront and update the s3 bucket
	$(MAKE) deploy DOMAIN=client.testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org && \
	$(MAKE) live-update DOMAIN=client.testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org 

destroy-client-testsliderule: ## Destroy the web client from the testsliderule.org cloudfront and remove the S3 bucket
	$(MAKE) destroy DOMAIN=client.testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org

release-live-update-to-testsliderule: src-tag-and-push ## Release the web client to the live environment NEEDS VERSION
	$(MAKE) live-update DOMAIN=client.testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org 

# deploy-client-to-demo-dot-slideruleearth: ## Deploy the web client to the demo.slideruleearth.io cloudfront and update the s3 bucket
# 	$(MAKE) deploy DOMAIN=demo.slideruleearth.io S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io && \
# 	$(MAKE) live-update DOMAIN=demo.slideruleearth.io S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io

destroy-demo-dot-slideruleearth: ## Destroy the web client from the demo.slideruleearth.io cloudfront and remove the S3 bucket
	$(MAKE) destroy DOMAIN=demo.slideruleearth.io S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io

release-live-update-to-demo-dot-slideruleearth: src-tag-and-push ## Release the web client to the live environment NEEDS VERSION
	$(MAKE) live-update DOMAIN=demo.slideruleearth.io S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io

deploy-client-to-slideruleearth: ## Deploy the web client to the slideruleearth.io cloudfront and update the s3 bucket
	$(MAKE) deploy DOMAIN=client.slideruleearth.io S3_BUCKET=slideruleearth-webclient DOMAIN_APEX=slideruleearth.io && \
	$(MAKE) live-update DOMAIN=client.slideruleearth.io S3_BUCKET=slideruleearth-webclient DOMAIN_APEX=slideruleearth.io

destroy-client-slideruleearth: ## Destroy the web client from the slideruleearth.io cloudfront and remove the S3 bucket
	$(MAKE) destroy DOMAIN=client.slideruleearth.io S3_BUCKET=slideruleearth-webclient DOMAIN_APEX=slideruleearth.io

deploy-ai-client-to-testsliderule: ## Deploy the web client to the testsliderule.org cloudfront and update the s3 bucket
	$(MAKE) deploy DOMAIN=ai.testsliderule.org S3_BUCKET=testsliderule-ai-webclient DOMAIN_APEX=testsliderule.org CREATE_APEX_REDIRECT=false && \
	$(MAKE) live-update DOMAIN=ai.testsliderule.org S3_BUCKET=testsliderule-ai-webclient DOMAIN_APEX=testsliderule.org

destroy-ai-client-testsliderule: ## Destroy the web client from the testsliderule.org cloudfront and remove the S3 bucket
	$(MAKE) destroy DOMAIN=ai.testsliderule.org S3_BUCKET=testsliderule-ai-webclient DOMAIN_APEX=testsliderule.org CREATE_APEX_REDIRECT=false


MCP_SERVER_DIR = sliderule-mcp-server
MCP_VERSION = $(shell grep '^version' $(MCP_SERVER_DIR)/pyproject.toml | sed 's/.*"\(.*\)"/\1/')

mcp-build: ## Build the MCP server wheel and sdist
	@echo "Building sliderule-mcp v$(MCP_VERSION)..."
	cd $(MCP_SERVER_DIR) && rm -rf dist && python -c "\
	import os; \
	from hatchling.builders.wheel import WheelBuilder; \
	from hatchling.builders.sdist import SdistBuilder; \
	os.makedirs('dist', exist_ok=True); \
	[print('wheel:', a) for a in WheelBuilder('.').build(directory='dist', versions=['standard'])]; \
	[print('sdist:', a) for a in SdistBuilder('.').build(directory='dist', versions=['standard'])]"

mcp-publish: mcp-build ## Build and upload the MCP server to PyPI
	@echo "Uploading sliderule-mcp v$(MCP_VERSION) to PyPI..."
	cd $(MCP_SERVER_DIR) && python -m twine upload dist/*
	@echo "✅ Published sliderule-mcp v$(MCP_VERSION) — run 'make mcp-refresh' to update local uvx cache"

mcp-refresh: ## Clear uvx cache so Claude Desktop picks up the latest PyPI version
	@echo "Refreshing uvx cache for sliderule-mcp..."
	uv cache clean sliderule-mcp --force 2>/dev/null || true
	@echo "✅ uvx cache cleared — restart Claude Desktop to use v$(MCP_VERSION)"

mcp-release: mcp-publish mcp-refresh ## Publish to PyPI and refresh local uvx cache

CREATE_MCP_SERVER ?= true
MCP_AWS_REGION = us-west-2
MCP_ECR_REPO = $(shell aws ecr describe-repositories --repository-names "$$(echo $(DOMAIN_APEX) | tr '.' '-')-mcp-server" --query 'repositories[0].repositoryUri' --output text --region $(MCP_AWS_REGION) 2>/dev/null)
MCP_ECR_ACCOUNT = $(shell echo $(MCP_ECR_REPO) | cut -d. -f1)

mcp-docker-build: ## Build the MCP server Docker image
	@echo "Building MCP server Docker image..."
	docker build --platform linux/arm64 -t sliderule-mcp-remote $(MCP_SERVER_DIR)

mcp-docker-push: mcp-docker-build ## Build and push MCP server image to ECR
	@test -n "$(MCP_ECR_REPO)" || (echo "ECR repo not found. Run 'make mcp-deploy' first."; exit 1)
	aws ecr get-login-password --region $(MCP_AWS_REGION) | docker login --username AWS --password-stdin $(MCP_ECR_ACCOUNT).dkr.ecr.$(MCP_AWS_REGION).amazonaws.com
	docker tag sliderule-mcp-remote:latest $(MCP_ECR_REPO):latest
	docker push $(MCP_ECR_REPO):latest
	@echo "Forcing new ECS deployment..."
	aws ecs update-service --cluster $$(echo $(DOMAIN_APEX) | tr '.' '-')-mcp --service $$(echo $(DOMAIN_APEX) | tr '.' '-')-mcp-server --force-new-deployment --region $(MCP_AWS_REGION) > /dev/null
	@echo "Pushed $(MCP_ECR_REPO):latest and triggered ECS redeployment"

mcp-deploy: ## Deploy MCP server infrastructure via Terraform (requires DOMAIN, DOMAIN_APEX, S3_BUCKET)
	mkdir -p terraform/ && cd terraform/ && terraform init && \
	(terraform workspace select $(DOMAIN)-web-client 2>/dev/null || terraform workspace new $(DOMAIN)-web-client) && \
	terraform validate && \
	terraform apply -var domainName=$(DOMAIN) -var domainApex=$(DOMAIN_APEX) -var domain_root=$(DOMAIN_ROOT) -var s3_bucket_name=$(S3_BUCKET) -var create_apex_redirect=$(CREATE_APEX_REDIRECT) -var create_mcp_server=$(CREATE_MCP_SERVER)

mcp-destroy: ## Destroy MCP server infrastructure (requires DOMAIN, DOMAIN_APEX, S3_BUCKET)
	mkdir -p terraform/ && cd terraform/ && terraform init && \
	(terraform workspace select $(DOMAIN)-web-client 2>/dev/null || terraform workspace new $(DOMAIN)-web-client) && \
	terraform validate && \
	terraform destroy -var domainName=$(DOMAIN) -var domainApex=$(DOMAIN_APEX) -var domain_root=$(DOMAIN_ROOT) -var s3_bucket_name=$(S3_BUCKET) -var create_apex_redirect=$(CREATE_APEX_REDIRECT) -var create_mcp_server=$(CREATE_MCP_SERVER)

mcp-deploy-testsliderule: ## Deploy MCP server to testsliderule.org
	$(MAKE) mcp-deploy DOMAIN=client.testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org

mcp-push-testsliderule: ## Build and push MCP server image to testsliderule.org ECR
	$(MAKE) mcp-docker-push DOMAIN_APEX=testsliderule.org

MCP_ECS_CLUSTER = $(shell echo $(DOMAIN_APEX) | tr '.' '-')-mcp
MCP_ECS_SERVICE = $(MCP_ECS_CLUSTER)-server
MCP_LOG_GROUP = /ecs/$(MCP_ECS_CLUSTER)-server

mcp-logs: ## Tail MCP server logs (requires DOMAIN_APEX)
	aws logs tail $(MCP_LOG_GROUP) --follow --region $(MCP_AWS_REGION)

mcp-logs-recent: ## Show last 30 minutes of MCP server logs (requires DOMAIN_APEX)
	aws logs tail $(MCP_LOG_GROUP) --since 30m --region $(MCP_AWS_REGION)

mcp-shell: ## Shell into running MCP server container (requires DOMAIN_APEX)
	@TASK_ARN=$$(aws ecs list-tasks --cluster $(MCP_ECS_CLUSTER) --service-name $(MCP_ECS_SERVICE) --region $(MCP_AWS_REGION) --query 'taskArns[0]' --output text); \
	test "$$TASK_ARN" != "None" || (echo "No running tasks found"; exit 1); \
	echo "Connecting to $$TASK_ARN..."; \
	aws ecs execute-command --cluster $(MCP_ECS_CLUSTER) --task $$TASK_ARN --container mcp-server --interactive --command /bin/sh --region $(MCP_AWS_REGION)

mcp-status: ## Show MCP server ECS service status (requires DOMAIN_APEX)
	@aws ecs describe-services --cluster $(MCP_ECS_CLUSTER) --services $(MCP_ECS_SERVICE) --region $(MCP_AWS_REGION) \
		--query 'services[0].{status:status,desired:desiredCount,running:runningCount,pending:pendingCount,taskDef:taskDefinition}' --output table

mcp-logs-testsliderule: ## Tail MCP server logs for testsliderule.org
	$(MAKE) mcp-logs DOMAIN_APEX=testsliderule.org

mcp-shell-testsliderule: ## Shell into MCP server container for testsliderule.org
	$(MAKE) mcp-shell DOMAIN_APEX=testsliderule.org

mcp-status-testsliderule: ## Show MCP server status for testsliderule.org
	$(MAKE) mcp-status DOMAIN_APEX=testsliderule.org

.PHONY: clean-all clean reinstall src-tag-and-push upload-assets upload-static upload-index \
	live-update verify-s3-assets verify-s3-assets-testsliderule \
	live-update-client-testsliderule live-update-ai-testsliderule live-update-client-slideruleearth \
	convert-icons build-docs build keycloak-up keycloak-down keycloak-run run preview \
	deploy destroy deploy-client-to-testsliderule destroy-client-testsliderule \
	release-live-update-to-testsliderule destroy-demo-dot-slideruleearth \
	release-live-update-to-demo-dot-slideruleearth deploy-client-to-slideruleearth \
	destroy-client-slideruleearth deploy-ai-client-to-testsliderule destroy-ai-client-testsliderule \
	mcp-build mcp-publish mcp-refresh mcp-release mcp-docker-build mcp-docker-push \
	mcp-deploy mcp-destroy mcp-deploy-testsliderule mcp-push-testsliderule \
	mcp-logs mcp-logs-recent mcp-shell mcp-status \
	mcp-logs-testsliderule mcp-shell-testsliderule mcp-status-testsliderule \
	check-vars typecheck lint lint-fix lint-staged pre-commit-check \
	test-unit test-unit-watch coverage-unit test-e2e test-all ci-check pw-report help
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

pre-commit-check: ## Manually run pre-commit checks without committing
	cd web-client && npx lint-staged && npm run typecheck && npm run test:unit
	@echo "✅ Pre-commit checks passed!"

test-unit: ## Run Vitest unit tests (CI-friendly)
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

ci-check: ## CI gate: clean install + types + lint + unit + e2e
	cd web-client && npm ci
	cd web-client && npm run typecheck
	cd web-client && npm run lint
	cd web-client && npm run test:unit
	cd web-client && npm run test:e2e

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