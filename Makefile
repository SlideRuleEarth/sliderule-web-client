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

clean: # This is run to clean up the web client dependencies 
	rm -rf *.zip web-client/dist web-client/node_modules

reinstall: clean ## This is run to reinstall the web client dependencies
	cd web-client && npm install

live-update: build # This is run to update the web client in the S3 bucket and invalidate the CloudFront cache
	aws s3 sync web-client/dist/ s3://client.$(DOMAIN) --delete
	aws cloudfront create-invalidation --distribution-id $(DISTRIBUTION_ID) --paths "/*" 

build: ## This is run to build the web client and update the dist folder
	cd web-client && npm run build

build-with-maps: ## This is run to build the web client and update the dist folder with src map files
	cd web-client && npm run build_with_maps

run: ## This is run to run the web client locally for development
	cd web-client && npm run dev

preview: ## This is run to preview the web client production build locally for development
	cd web-client && npm run preview

deploy: # This is run to deploy the web client to the S3 bucket
	mkdir -p terraform/ && cd terraform/ && terraform init && terraform workspace select $(DOMAIN)-web-client || terraform workspace new $(DOMAIN)-web-client && terraform validate && \
	terraform apply -var domainName=client.$(DOMAIN) -var domainApex=$(DOMAIN) -var domain_root=$(DOMAIN_ROOT) 

destroy: # This is run to destroy the web client 
	mkdir -p terraform/ && cd terraform/ && terraform init && terraform workspace select $(DOMAIN)-web-client || terraform workspace new $(DOMAIN)-web-client && terraform validate && \
	terraform destroy -var domainName=client.$(DOMAIN) -var domainApex=$(DOMAIN) -var domain_root=$(DOMAIN_ROOT)

deploy-to-testsliderule:
	make deploy DOMAIN=testsliderule.org && \
	make live-update DOMAIN=testsliderule.org

destroy-testsliderule:
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