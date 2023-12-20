SHELL := /bin/bash

DISTRIBUTION_ID = $(shell aws cloudfront list-distributions --query "DistributionList.Items[?Aliases.Items[0]=='client.testsliderule.org'].Id" --output text)
S3_BUCKET_ROOT = $(shell aws cloudformation describe-stacks --stack-name web-client-stack --region us-east-1 --query "Stacks[0].Outputs[?OutputKey=='S3BucketRoot'].OutputValue" --output text)
HOSTED_ZONE_ID = $(shell aws route53 list-hosted-zones --query "HostedZones[?Name=='testsliderule.org.'].Id"  --output text | sed 's|.*/||')

pre-deploy:
ifndef TEMP_BUCKET
	$(error TEMP_BUCKET is undefined)
endif
ifndef ADMIN_EMAIL
	$(error ADMIN_EMAIL is undefined)
endif
ifndef SUBNETS
	$(error SUBNETS is undefined)
endif
ifndef SEC_GROUPS
	$(error SEC_GROUPS is undefined)
endif

pre-run:
ifndef ROLE_NAME
	$(error ROLE_NAME is undefined)
endif

setup-predeploy:
	virtualenv venv
	source venv/bin/activate
	pip install cfn-flip==1.2.2

clean:
	rm -rf *.zip source/witch/nodejs/node_modules/

test-cfn:
	cfn_nag templates/*.yaml --blacklist-path ci/cfn_nag_blacklist.yaml

version:
	@echo $(shell cfn-flip templates/main.yaml | python -c 'import sys, json; print(json.load(sys.stdin)["Mappings"]["Solution"]["Constants"]["Version"])')

package:
	zip -r packaged.zip templates backend cfn-publish.config build.zip -x **/__pycache* -x *settings.js

build-static:
	cd source/witch/ && npm install --prefix nodejs mime-types && cp witch.js nodejs/node_modules/

package-static:
	make build-static
	cd source/witch && zip -r ../../witch.zip nodejs

####################################################################################################
#
# SlideRule Web-Client specific targets are located here
#
####################################################################################################

cold-start-sliderule-webclient: ## This is run once to create the S3 bucket and initial generic template
	make package-static
	aws s3 mb s3://testsliderule-web-client --region us-east-1

prepare-template: build ## This is run to package an updated template for the web client 
	aws cloudformation package --region us-east-1 --template-file templates/main.yaml --s3-bucket testsliderule-web-client --output-template-file packaged.template 

deploy: prepare-template ## This is run to deploy the stack from the dist folder NOTE: Now you can use update to upload the dist directly to S3 
	aws cloudformation deploy --region us-east-1 --stack-name web-client-stack --template-file packaged.template --capabilities CAPABILITY_NAMED_IAM CAPABILITY_AUTO_EXPAND --parameter-overrides DomainName=testsliderule.org SubDomain=client HostedZoneId=$(HOSTED_ZONE_ID)

# TBD update this to be domain specific
live-update: build ## Only use this for extremely trivial changes to the web client for testing. NOT to be used for production
	aws s3 sync web-client/dist/ s3://$(S3_BUCKET_ROOT) --delete
	aws cloudfront create-invalidation --distribution-id $(DISTRIBUTION_ID) --paths "/*" 

delete-stack: ## This is run to delete the stack
	aws cloudformation delete-stack --stack-name web-client-stack --region us-east-1

describe-stacks: ## This is run to describe the stack 
	aws cloudformation describe-stacks --stack-name web-client-stack --region us-east-1

describe-stack-events: ## This is run to describe the stack events leading to a failure
	aws cloudformation describe-stack-events --stack-name web-client-stack --region us-east-1

build: ## This is run to build the web client and update the dist folder
	cd web-client && npm run build

build-with-maps: ## This is run to build the web client and update the dist folder with src map files
	cd web-client && npm run build_with_maps

run: ## This is run to run the web client locally for development
	cd web-client && npm run dev

preview: ## This is run to preview the web client production build locally for development
	cd web-client && npm run preview


help: ## That's me!
	@printf "\033[37m%-30s\033[0m %s\n" "#-----------------------------------------------------------------------------------------"
	@printf "\033[37m%-30s\033[0m %s\n" "# Makefile Help       "
	@printf "\033[37m%-30s\033[0m %s\n" "#-----------------------------------------------------------------------------------------"
	@printf "\033[37m%-30s\033[0m %s\n" "#----target--------------------description------------------------------------------------"
	@grep -E '^[a-zA-Z_-].+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
	@echo DISTRIBUTION_ID:$(DISTRIBUTION_ID)	
	@echo S3_BUCKET_ROOT:$(S3_BUCKET_ROOT)
	@echo HOSTED_ZONE_ID:$(HOSTED_ZONE_ID)