
variable "domainApex" {
    description = "domain name without any subdomain e.g. testsliderule.org"
    default = "testsliderule.org"
}

variable "domainName" {
    description = "full domain name of client site to use with extension e.g. testsliderule.client.org or just testsliderule.org"
    default = "testsliderule.org"
}

variable "domain_root" {
    description = "domain name without any subdomain e.g. testsliderule"
    default = "testsliderule.org"
  
}

variable "s3_bucket_name" {
  type        = string
  description = "The name of the S3 bucket to create/use for the website"
  validation {
    condition = length(var.s3_bucket_name) > 0
    error_message = "The s3_bucket_name variable must not be empty."
  }
}
 

variable "cost_grouping" {
  description = "the name tag to identify a grouping or subset of resources"
  type        = string
  default     = "web-client"
}