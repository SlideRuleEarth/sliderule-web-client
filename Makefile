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
BUILD_ENV = $(shell git --git-dir .git --work-tree . describe --abbrev --dirty --always --tags --long)
VERSION ?= latest
BANNER_TEXT ?=

# GitHub OAuth Configuration (for organization membership verification)
# These are public Client IDs (not secrets) - safe to commit
VITE_GITHUB_CLIENT_ID_TEST ?= Ov23liTqpZCtvFofQEFE
VITE_GITHUB_OAUTH_API_URL_TEST ?= https://jvwvnlai64.execute-api.us-west-2.amazonaws.com
VITE_GITHUB_CLIENT_ID_PROD ?=
VITE_GITHUB_OAUTH_API_URL_PROD ?=

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
	make verify-s3-assets S3_BUCKET=$(S3_BUCKET)

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
	@echo "📅 Build date/time: $$(date +"%Y-%m-%d %T")"

verify-s3-assets-testsliderule:
	make verify-s3-assets S3_BUCKET=testsliderule-webclient


live-update-testsliderule: ## Update the web client at testsliderule.org with new build
	make live-update S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org DOMAIN=testsliderule.org \
		VITE_GITHUB_CLIENT_ID=$(VITE_GITHUB_CLIENT_ID_TEST) \
		VITE_GITHUB_OAUTH_API_URL=$(VITE_GITHUB_OAUTH_API_URL_TEST)

# live-update-demo-dot-slideruleearth: ## Update the web client at demo.slideruleearth.io with new build
# 	make live-update S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io DOMAIN=demo.slideruleearth.io

live-update-client-dot-slideruleearth: ## Update the web client at client.slideruleearth.io with new build
	make live-update S3_BUCKET=slideruleearth-webclient-dot DOMAIN_APEX=slideruleearth.io DOMAIN=client.slideruleearth.io \
		VITE_GITHUB_CLIENT_ID=$(VITE_GITHUB_CLIENT_ID_PROD) \
		VITE_GITHUB_OAUTH_API_URL=$(VITE_GITHUB_OAUTH_API_URL_PROD)

convert-icons: ## Convert Maki SVG icons in src/assets/maki-svg to PNGs in public/icons
	@echo "🔄 Converting Maki SVG icons to PNGs..."
	node ./web-client/convert-maki-icons.js

build: convert-icons ## Build the web client and update the dist folder
	export VITE_BUILD_ENV=$(BUILD_ENV); \
	export VITE_APP_BUILD_DATE=$$(date +"%Y-%m-%d %T"); \
	export VITE_APP_VERSION=$$(git describe --tags --abbrev=0); \
	export VITE_BANNER_TEXT='$(BANNER_TEXT)'; \
	export VITE_GITHUB_CLIENT_ID='$(VITE_GITHUB_CLIENT_ID)'; \
	export VITE_GITHUB_OAUTH_API_URL='$(VITE_GITHUB_OAUTH_API_URL)'; \
	cd web-client && \
	echo "VITE_APP_BUILD_DATE=$$VITE_APP_BUILD_DATE" && \
	echo "VITE_APP_VERSION=$$VITE_APP_VERSION" && \
	echo "VITE_BUILD_ENV=$$VITE_BUILD_ENV" && \
	echo "VITE_BANNER_TEXT=$$VITE_BANNER_TEXT" && \
	echo "VITE_GITHUB_CLIENT_ID=$$VITE_GITHUB_CLIENT_ID" && \
	echo "VITE_GITHUB_OAUTH_API_URL=$$VITE_GITHUB_OAUTH_API_URL" && \
	npm run build

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
	mkdir -p terraform/ && cd terraform/ && terraform init && terraform workspace select $(DOMAIN)-web-client || terraform workspace new $(DOMAIN)-web-client && terraform validate && \
	terraform apply -var domainName=$(DOMAIN) -var domainApex=$(DOMAIN_APEX) -var domain_root=$(DOMAIN_ROOT) -var s3_bucket_name=$(S3_BUCKET)

destroy: # Destroy the web client 
	mkdir -p terraform/ && cd terraform/ && terraform init && terraform workspace select $(DOMAIN)-web-client || terraform workspace new $(DOMAIN)-web-client && terraform validate && \
	terraform destroy -var domainName=$(DOMAIN) -var domainApex=$(DOMAIN_APEX) -var domain_root=$(DOMAIN_ROOT) -var s3_bucket_name=$(S3_BUCKET)

deploy-client-to-testsliderule: ## Deploy the web client to the testsliderule.org cloudfront and update the s3 bucket
	make deploy DOMAIN=testsliderule.org S3_BUCKET=testsliderule-webclient && \
	make live-update DOMAIN=testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org \
		VITE_GITHUB_CLIENT_ID=$(VITE_GITHUB_CLIENT_ID_TEST) \
		VITE_GITHUB_OAUTH_API_URL=$(VITE_GITHUB_OAUTH_API_URL_TEST)

destroy-client-testsliderule: ## Destroy the web client from the testsliderule.org cloudfront and remove the S3 bucket
	make destroy DOMAIN=testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org

release-live-update-to-testsliderule: src-tag-and-push ## Release the web client to the live environment NEEDS VERSION
	make live-update DOMAIN=testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org \
		VITE_GITHUB_CLIENT_ID=$(VITE_GITHUB_CLIENT_ID_TEST) \
		VITE_GITHUB_OAUTH_API_URL=$(VITE_GITHUB_OAUTH_API_URL_TEST)

# deploy-client-to-demo-dot-slideruleearth: ## Deploy the web client to the demo.slideruleearth.io cloudfront and update the s3 bucket
# 	make deploy DOMAIN=demo.slideruleearth.io S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io && \
# 	make live-update DOMAIN=demo.slideruleearth.io S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io

destroy-demo-dot-slideruleearth: ## Destroy the web client from the demo.slideruleearth.io cloudfront and remove the S3 bucket
	make destroy DOMAIN=demo.slideruleearth.io S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io

release-live-update-to-demo-dot-slideruleearth: src-tag-and-push ## Release the web client to the live environment NEEDS VERSION
	make live-update DOMAIN=demo.slideruleearth.io S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io

destroy-client-dot-testsliderule: ## Destroy the web client from the testsliderule.org cloudfront and remove the S3 bucket
	make destroy DOMAIN=client.testsliderule.org S3_BUCKET=testsliderule-webclient-dot DOMAIN_APEX=testsliderule.org

deploy-client-to-client-dot-slideruleearth: ## Deploy the web client to the client.slideruleearth.io cloudfront and update the s3 bucket
	make deploy DOMAIN=client.slideruleearth.io S3_BUCKET=slideruleearth-webclient-dot DOMAIN_APEX=slideruleearth.io && \
	make live-update DOMAIN=client.slideruleearth.io S3_BUCKET=slideruleearth-webclient-dot DOMAIN_APEX=slideruleearth.io

destroy-client-dot-slideruleearth: ## Destroy the web client from the client.slideruleearth.io cloudfront and remove the S3 bucket
	make destroy DOMAIN=client.slideruleearth.io S3_BUCKET=slideruleearth-webclient-dot DOMAIN_APEX=slideruleearth.io

deploy-docs-to-testsliderule: ## Deploy the docs to the testsliderule.org cloudfront and update the s3 bucket
	make deploy DOMAIN=docs.testsliderule.org S3_BUCKET=testsliderule-docs DOMAIN_APEX=testsliderule.org  

destroy-docs-testsliderule: ## Destroy the web client from the testsliderule.org cloudfront and remove the S3 bucket
	make destroy DOMAIN=docs.testsliderule.org S3_BUCKET=testsliderule-docs DOMAIN_APEX=testsliderule.org 

.PHONY: check-vars typecheck lint lint-fix lint-staged pre-commit-check test-unit test-unit-watch coverage-unit test-e2e test-all ci-check
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

# =========================
# GitHub OAuth Lambda
# =========================
LAMBDA_BUCKET ?= sliderule-lambda-deployments

package-github-oauth-lambda: ## Package the GitHub OAuth Lambda function
	cd lambda/github-oauth && \
	rm -rf package github-oauth.zip && \
	pip install -r requirements.txt -t package/ && \
	cp handler.py package/ && \
	cd package && zip -r ../github-oauth.zip . && \
	cd .. && rm -rf package
	@echo "✅ Lambda packaged: lambda/github-oauth/github-oauth.zip"

upload-github-oauth-lambda: package-github-oauth-lambda ## Upload Lambda zip to S3
	aws s3 cp lambda/github-oauth/github-oauth.zip s3://$(LAMBDA_BUCKET)/github-oauth.zip
	@echo "✅ Lambda uploaded to s3://$(LAMBDA_BUCKET)/github-oauth.zip"

deploy-github-oauth-test: upload-github-oauth-lambda ## Deploy GitHub OAuth stack to test environment
	@set -a && [ -f .env.test ] && . ./.env.test; set +a; \
	CLIENT_ID=$${VITE_GITHUB_CLIENT_ID:-$(VITE_GITHUB_CLIENT_ID_TEST)}; \
	if [ -z "$$CLIENT_ID" ]; then \
		echo "❌ Error: VITE_GITHUB_CLIENT_ID must be set in .env.test"; \
		exit 1; \
	fi; \
	echo "ℹ️  Note: GitHub Client Secret must exist in Secrets Manager:"; \
	echo "   aws secretsmanager create-secret --name sliderule/github-oauth-client-secret-test --secret-string 'YOUR_SECRET'"; \
	aws cloudformation deploy \
		--template-file cloudformation/github-oauth.yaml \
		--stack-name sliderule-github-oauth-test \
		--parameter-overrides \
			GitHubClientId=$$CLIENT_ID \
			Environment=test \
			FrontendUrl=https://testsliderule.org \
			LambdaS3Bucket=$(LAMBDA_BUCKET) \
		--capabilities CAPABILITY_NAMED_IAM \
		--no-fail-on-empty-changeset
	@echo "✅ GitHub OAuth test stack deployed"
	@echo ""
	@echo "API Gateway URL:"
	@aws cloudformation describe-stacks \
		--stack-name sliderule-github-oauth-test \
		--query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
		--output text
	@echo ""
	@echo "JWT Signing Key (KMS - RS256):"
	@aws cloudformation describe-stacks \
		--stack-name sliderule-github-oauth-test \
		--query 'Stacks[0].Outputs[?OutputKey==`JWTSigningKeyArn`].OutputValue' \
		--output text
	@echo ""
	@echo "JWKS Endpoint (for JWT verification):"
	@aws cloudformation describe-stacks \
		--stack-name sliderule-github-oauth-test \
		--query 'Stacks[0].Outputs[?OutputKey==`JwksEndpoint`].OutputValue' \
		--output text

deploy-github-oauth-prod: upload-github-oauth-lambda ## Deploy GitHub OAuth stack to prod environment
	@echo "ℹ️  Note: GitHub Client Secret must exist in Secrets Manager:"; \
	echo "   aws secretsmanager create-secret --name sliderule/github-oauth-client-secret-prod --secret-string 'YOUR_SECRET'"
	aws cloudformation deploy \
		--template-file cloudformation/github-oauth.yaml \
		--stack-name sliderule-github-oauth-prod \
		--parameter-overrides \
			GitHubClientId=$(VITE_GITHUB_CLIENT_ID_PROD) \
			Environment=prod \
			FrontendUrl=https://client.slideruleearth.io \
			LambdaS3Bucket=$(LAMBDA_BUCKET) \
		--capabilities CAPABILITY_NAMED_IAM \
		--no-fail-on-empty-changeset
	@echo "✅ GitHub OAuth prod stack deployed"
	@echo ""
	@echo "API Gateway URL:"
	@aws cloudformation describe-stacks \
		--stack-name sliderule-github-oauth-prod \
		--query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
		--output text
	@echo ""
	@echo "JWT Signing Key (KMS - RS256):"
	@aws cloudformation describe-stacks \
		--stack-name sliderule-github-oauth-prod \
		--query 'Stacks[0].Outputs[?OutputKey==`JWTSigningKeyArn`].OutputValue' \
		--output text
	@echo ""
	@echo "JWKS Endpoint (for JWT verification):"
	@aws cloudformation describe-stacks \
		--stack-name sliderule-github-oauth-prod \
		--query 'Stacks[0].Outputs[?OutputKey==`JwksEndpoint`].OutputValue' \
		--output text

update-github-oauth-lambda-test: upload-github-oauth-lambda ## Update Lambda code only (test) - faster than full deploy
	@FUNCTION_NAME=$$(aws cloudformation describe-stack-resource \
		--stack-name sliderule-github-oauth-test \
		--logical-resource-id GitHubOAuthLambda \
		--query 'StackResourceDetail.PhysicalResourceId' \
		--output text); \
	echo "Updating Lambda: $$FUNCTION_NAME"; \
	aws lambda update-function-code \
		--function-name $$FUNCTION_NAME \
		--s3-bucket $(LAMBDA_BUCKET) \
		--s3-key github-oauth.zip
	@echo "✅ Lambda code updated (test)"

update-github-oauth-lambda-prod: upload-github-oauth-lambda ## Update Lambda code only (prod) - faster than full deploy
	@FUNCTION_NAME=$$(aws cloudformation describe-stack-resource \
		--stack-name sliderule-github-oauth-prod \
		--logical-resource-id GitHubOAuthLambda \
		--query 'StackResourceDetail.PhysicalResourceId' \
		--output text); \
	echo "Updating Lambda: $$FUNCTION_NAME"; \
	aws lambda update-function-code \
		--function-name $$FUNCTION_NAME \
		--s3-bucket $(LAMBDA_BUCKET) \
		--s3-key github-oauth.zip
	@echo "✅ Lambda code updated (prod)"

create-github-oauth-secret-test: ## Create GitHub Client Secret in AWS Secrets Manager (one-time setup)
	@if [ -z "$(SECRET)" ]; then \
		echo "❌ Error: SECRET must be provided"; \
		echo "   Usage: make create-github-oauth-secret-test SECRET='your-github-client-secret'"; \
		exit 1; \
	fi
	aws secretsmanager create-secret \
		--name sliderule/github-oauth-client-secret-test \
		--secret-string "$(SECRET)" \
		--description "GitHub OAuth Client Secret for SlideRule Web Client (test)"
	@echo "✅ GitHub Client Secret created in Secrets Manager"

create-github-oauth-secret-prod: ## Create GitHub Client Secret in AWS Secrets Manager (one-time setup)
	@if [ -z "$(SECRET)" ]; then \
		echo "❌ Error: SECRET must be provided"; \
		echo "   Usage: make create-github-oauth-secret-prod SECRET='your-github-client-secret'"; \
		exit 1; \
	fi
	aws secretsmanager create-secret \
		--name sliderule/github-oauth-client-secret-prod \
		--secret-string "$(SECRET)" \
		--description "GitHub OAuth Client Secret for SlideRule Web Client (prod)"
	@echo "✅ GitHub Client Secret created in Secrets Manager"

destroy-github-oauth-test: ## Destroy GitHub OAuth stack from test environment
	aws cloudformation delete-stack --stack-name sliderule-github-oauth-test
	@echo "✅ GitHub OAuth test stack deletion initiated"

destroy-github-oauth-prod: ## Destroy GitHub OAuth stack from prod environment
	aws cloudformation delete-stack --stack-name sliderule-github-oauth-prod
	@echo "✅ GitHub OAuth prod stack deletion initiated"

github-oauth-test-url: ## Get the API Gateway URL for the test GitHub OAuth stack
	@aws cloudformation describe-stacks \
		--stack-name sliderule-github-oauth-test \
		--query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
		--output text

github-oauth-test-jwks: ## Get the JWKS from the test environment (for JWT verification)
	@API_URL=$$(aws cloudformation describe-stacks \
		--stack-name sliderule-github-oauth-test \
		--query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
		--output text); \
	curl -s "$$API_URL/auth/github/jwks" | python3 -m json.tool

github-oauth-test-public-key: ## Get the public key (PEM) from the test environment
	@API_URL=$$(aws cloudformation describe-stacks \
		--stack-name sliderule-github-oauth-test \
		--query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
		--output text); \
	curl -s "$$API_URL/auth/github/public-key"

github-oauth-info-test: ## Show all GitHub OAuth test stack info
	@echo "=== GitHub OAuth Test Stack Info ==="
	@echo ""
	@echo "API Gateway URL:"
	@aws cloudformation describe-stacks \
		--stack-name sliderule-github-oauth-test \
		--query 'Stacks[0].Outputs[?OutputKey==`ApiGatewayUrl`].OutputValue' \
		--output text
	@echo ""
	@echo "JWT Signing Key (KMS ARN):"
	@aws cloudformation describe-stacks \
		--stack-name sliderule-github-oauth-test \
		--query 'Stacks[0].Outputs[?OutputKey==`JWTSigningKeyArn`].OutputValue' \
		--output text
	@echo ""
	@echo "JWKS Endpoint:"
	@aws cloudformation describe-stacks \
		--stack-name sliderule-github-oauth-test \
		--query 'Stacks[0].Outputs[?OutputKey==`JwksEndpoint`].OutputValue' \
		--output text
	@echo ""
	@echo "Public Key Endpoint:"
	@aws cloudformation describe-stacks \
		--stack-name sliderule-github-oauth-test \
		--query 'Stacks[0].Outputs[?OutputKey==`PublicKeyEndpoint`].OutputValue' \
		--output text


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