####################################################################################################
#
# SlideRule Web-Client specific targets are located here
#
####################################################################################################

SHELL := /bin/bash
ROOT = $(shell pwd)
DOMAIN ?= 
DOMAIN_ROOT = $(firstword $(subst ., ,$(DOMAIN)))
DISTRIBUTION_ID = $(shell aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[0]=='client.$(DOMAIN)'].Id" --output text)

clean: # Clean up the web client dependencies 
	rm -rf *.zip web-client/dist web-client/node_modules web-client/package-lock.json

reinstall: clean ## Reinstall the web client dependencies
	cd web-client && npm install

live-update: build # Update the web client in the S3 bucket and invalidate the CloudFront cache
	UPLOAD_DATE=$$(date +"%Y-%m-%d %T"); \
	echo "export const UPLOAD_DATE = '$$UPLOAD_DATE';" > web-client/src/uploadDate.ts
	aws s3 sync web-client/dist/ s3://client.$(DOMAIN) --delete
	aws cloudfront create-invalidation --distribution-id $(DISTRIBUTION_ID) --paths "/*" 

live-update-testsliderule: ## Update the testsliderule.org with new build
	make live-update DOMAIN=testsliderule.org

build: ## Build the web client and update the dist folder
	BUILD_DATE=$$(date +"%Y-%m-%d %T"); \
	echo "export const BUILD_DATE = '$$BUILD_DATE';" > web-client/src/buildDate.ts
	cd web-client && npm run build

type-check: ## Build the web client and update the dist folder
	cd web-client && npm run type-check

build-with-maps: ## Build the web client and update the dist folder with src map files
	cd web-client && npm run build_with_maps

run: ## Run the web client locally for development
	RUN_DEV_DATE=$$(date +"%Y-%m-%d %T"); \
	echo "export const RUN_DEV_DATE = '$$RUN_DEV_DATE';" > web-client/src/runDevDate.ts
	cd web-client && npm run dev

preview: ## Preview the web client production build locally for development
	cd web-client && npm run preview

deploy: # Deploy the web client to the S3 bucket
	mkdir -p terraform/ && cd terraform/ && terraform init && terraform workspace select $(DOMAIN)-web-client || terraform workspace new $(DOMAIN)-web-client && terraform validate && \
	terraform apply -var domainName=client.$(DOMAIN) -var domainApex=$(DOMAIN) -var domain_root=$(DOMAIN_ROOT) 

destroy: # Destroy the web client 
	mkdir -p terraform/ && cd terraform/ && terraform init && terraform workspace select $(DOMAIN)-web-client || terraform workspace new $(DOMAIN)-web-client && terraform validate && \
	terraform destroy -var domainName=client.$(DOMAIN) -var domainApex=$(DOMAIN) -var domain_root=$(DOMAIN_ROOT)

deploy-to-testsliderule: ## Deploy the web client to the testsliderule.org cloudfront and update the s3 bucket
	make deploy DOMAIN=testsliderule.org && \
	make live-update DOMAIN=testsliderule.org

destroy-testsliderule: ## Destroy the web client from the testsliderule.org cloudfront and remove the S3 bucket
	make destroy DOMAIN=testsliderule.org 

help: ## That's me!
	@printf "\033[37m%-30s\033[0m %s\n" "#-----------------------------------------------------------------------------------------"
	@printf "\033[37m%-30s\033[0m %s\n" "# Makefile Help       "
	@printf "\033[37m%-30s\033[0m %s\n" "#-----------------------------------------------------------------------------------------"
	@printf "\033[37m%-30s\033[0m %s\n" "#----target--------------------description------------------------------------------------"
	@grep -E '^[a-zA-Z_-].+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
	@echo DOMAIN: $(DOMAIN)	
	@echo DOMAIN_ROOT: $(DOMAIN_ROOT)
	@echo DISTRIBUTION_ID: $(DISTRIBUTION_ID)