locals {
  terraform-git-repo = "sliderule-web-client"
}

provider "aws" {
  region  = "us-east-1"
  default_tags {
    tags = {
      Owner   = "SlideRule"
      Project = "web-client-${var.domain_root}"
      terraform-base-path = replace(path.cwd,
      "/^.*?(${local.terraform-git-repo}\\/)/", "$1")
      cost-grouping = "${var.cost_grouping}"
    }
  }
}

module "cloudfront" {
  source = "./modules/"
  domain_root   = var.domain_root
  domainName    = var.domainName
  domainApex    = var.domainApex
  s3_bucket_name = var.s3_bucket_name
}