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

verify-s3-assets-testsliderule:
	make verify-s3-assets S3_BUCKET=testsliderule-webclient


live-update-testsliderule: ## Update the web client at testsliderule.org with new build
	make live-update S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org DOMAIN=testsliderule.org

# live-update-demo-dot-slideruleearth: ## Update the web client at demo.slideruleearth.io with new build
# 	make live-update S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io DOMAIN=demo.slideruleearth.io

live-update-client-dot-slideruleearth: ## Update the web client at client.slideruleearth.io with new build
	make live-update S3_BUCKET=slideruleearth-webclient-dot DOMAIN_APEX=slideruleearth.io DOMAIN=client.slideruleearth.io

convert-icons: ## Convert Maki SVG icons in src/assets/maki-svg to PNGs in public/icons
	@echo "🔄 Converting Maki SVG icons to PNGs..."
	node ./web-client/convert-maki-icons.js

build: convert-icons ## Build the web client and update the dist folder
	export VITE_BUILD_ENV=$(BUILD_ENV); \
	export VITE_APP_BUILD_DATE=$$(date +"%Y-%m-%d %T"); \
	export VITE_APP_VERSION=$$(git describe --tags --abbrev=0); \
	cd web-client && \
	echo "VITE_APP_BUILD_DATE=$$VITE_APP_BUILD_DATE" && \
	echo "VITE_APP_VERSION=$$VITE_APP_VERSION" && \
	echo "VITE_BUILD_ENV=$$VITE_BUILD_ENV" && \
	npm run build

run: ## Run the web client locally for development
	export VITE_BUILD_ENV=$(BUILD_ENV); \
	export VITE_RUN_DEV_DATE=$$(date +"%Y-%m-%d %T"); \
	export VITE_APP_VERSION=$$(git describe --tags --abbrev=0); \
	cd web-client && \
	echo "VITE_RUN_DEV_DATE=$$VITE_RUN_DEV_DATE" && \
	echo "VITE_APP_VERSION=$$VITE_APP_VERSION" && \
	echo "VITE_BUILD_ENV=$$VITE_BUILD_ENV" && \
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
	make live-update DOMAIN=testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org

destroy-client-testsliderule: ## Destroy the web client from the testsliderule.org cloudfront and remove the S3 bucket
	make destroy DOMAIN=testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org

release-live-update-to-testsliderule: src-tag-and-push ## Release the web client to the live environment NEEDS VERSION
	make live-update DOMAIN=testsliderule.org S3_BUCKET=testsliderule-webclient DOMAIN_APEX=testsliderule.org

# deploy-client-to-demo-dot-slideruleearth: ## Deploy the web client to the demo.slideruleearth.io cloudfront and update the s3 bucket
# 	make deploy DOMAIN=demo.slideruleearth.io S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io && \
# 	make live-update DOMAIN=demo.slideruleearth.io S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io

destroy-demo-dot-slideruleearth: ## Destroy the web client from the demo.slideruleearth.io cloudfront and remove the S3 bucket
	make destroy DOMAIN=demo.slideruleearth.io S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io

release-live-update-to-demo-dot-slideruleearth: src-tag-and-push ## Release the web client to the live environment NEEDS VERSION
	make live-update DOMAIN=demo.slideruleearth.io S3_BUCKET=slideruleearth-demo-dot DOMAIN_APEX=slideruleearth.io

deploy-client-to-client-dot-testsliderule: ## Deploy the web client to the testsliderule.org cloudfront and update the s3 bucket
	make deploy DOMAIN=client.testsliderule.org S3_BUCKET=testsliderule-webclient-dot DOMAIN_APEX=testsliderule.org && \
	make live-update DOMAIN=client.testsliderule.org S3_BUCKET=testsliderule-webclient-dot DOMAIN_APEX=testsliderule.org

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

.PHONY: check-vars
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