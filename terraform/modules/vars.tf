variable "domain_root" {
  type = string
}
variable "domainName" {
  type = string
}
variable "domainApex" {
  type = string
}
variable "s3_bucket_name" {
  type = string
}
variable "create_apex_redirect" {
  type    = bool
  default = true
}