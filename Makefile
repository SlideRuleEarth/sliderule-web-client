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
DISTRIBUTION_ID = $(shell aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[0]=='$(DOMAIN_APEX)'].Id" --output text)
BUILD_ENV = $(shell git --git-dir .git --work-tree . describe --abbrev --dirty --always --tags --long)
VERSION ?= latest

clean: # Clean up the web client dependencies 
	rm -rf *.zip web-client/dist web-client/node_modules web-client/package-lock.json

reinstall: clean ## Reinstall the web client dependencies
	cd web-client && npm install

src-tag-and-push: ## Tag and push the web client source code to the repository
	$(ROOT)/VITE_VERSION.sh $(VERSION) && git push --tags; git push

live-update: build # Update the web client in the S3 bucket and invalidate the CloudFront cache
	export VITE_LIVE_UPDATE_DATE=$$(date +"%Y-%m-%d %T"); \
	echo "VITE_LIVE_UPDATE_DATE=$$VITE_LIVE_UPDATE_DATE" && \
	echo "S3_BUCKET=$(S3_BUCKET)" && \
	aws s3 sync web-client/dist/ s3://$(S3_BUCKET) --delete
	aws cloudfront create-invalidation --distribution-id $(DISTRIBUTION_ID) --paths "/*" 

live-update-testsliderule: ## Update the web client at testsliderule.org with new build
	make live-update DOMAIN=testsliderule.org S3_BUCKET=testsliderule-webclient

build: ## Build the web client and update the dist folder
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

preview: ## Preview the web client production build locally for development
	cd web-client && npm run preview

deploy: # Deploy the web client to the S3 bucket
	mkdir -p terraform/ && cd terraform/ && terraform init && terraform workspace select $(DOMAIN)-web-client || terraform workspace new $(DOMAIN)-web-client && terraform validate && \
	terraform apply -var domainName=$(DOMAIN) -var domainApex=$(DOMAIN_APEX) -var domain_root=$(DOMAIN_ROOT) -var s3_bucket_name=$(S3_BUCKET)

destroy: # Destroy the web client 
	mkdir -p terraform/ && cd terraform/ && terraform init && terraform workspace select $(DOMAIN)-web-client || terraform workspace new $(DOMAIN)-web-client && terraform validate && \
	terraform destroy -var domainName=$(DOMAIN) -var domainApex=$(DOMAIN_APEX) -var domain_root=$(DOMAIN_ROOT) -var s3_bucket_name=$(S3_BUCKET)

deploy-client-to-testsliderule: ## Deploy the web client to the testsliderule.org cloudfront and update the s3 bucket
	make deploy DOMAIN=testsliderule.org S3_BUCKET=testsliderule-webclient && \
	make live-update DOMAIN=testsliderule.org S3_BUCKET=testsliderule-webclient

destroy-client-testsliderule: ## Destroy the web client from the testsliderule.org cloudfront and remove the S3 bucket
	make destroy DOMAIN=testsliderule.org S3_BUCKET=testsliderule-webclient

release-live-update-to-testsliderule: src-tag-and-push ## Release the web client to the live environment NEEDS VERSION
	make live-update DOMAIN=testsliderule.org S3_BUCKET=testsliderule-webclient

deploy-docs-to-testsliderule: ## Deploy the web client to the testsliderule.org cloudfront and update the s3 bucket
	make deploy DOMAIN=docs.testsliderule.org S3_BUCKET=testsliderule-docs DOMAIN_APEX=testsliderule.org  

destroy-docs-testsliderule: ## Destroy the web client from the testsliderule.org cloudfront and remove the S3 bucket
	make destroy DOMAIN=docs.testsliderule.org S3_BUCKET=testsliderule-docs DOMAIN_APEX=testsliderule.org 

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