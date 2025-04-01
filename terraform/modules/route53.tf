data "aws_route53_zone" "public" {
  name         = var.domainApex
  private_zone = false
}

resource "aws_acm_certificate" "mysite" {
  //provider                  = aws.us_east_1
  domain_name               = "${var.domainApex}"  # Root domain
  subject_alternative_names = ["*.${var.domainApex}"]  # Wildcard domain for subdomains
  validation_method         = "DNS"
  lifecycle {
    create_before_destroy = true
  }
}

# Route 53 record for root domain validation
resource "aws_route53_record" "cert_validation_root" {
  allow_overwrite = true
  name            = tolist(aws_acm_certificate.mysite.domain_validation_options)[0].resource_record_name
  records         = [tolist(aws_acm_certificate.mysite.domain_validation_options)[0].resource_record_value]
  type            = tolist(aws_acm_certificate.mysite.domain_validation_options)[0].resource_record_type
  zone_id         = data.aws_route53_zone.public.id
  ttl             = 60
}

# Route 53 record for wildcard domain validation
resource "aws_route53_record" "cert_validation_wildcard" {
  allow_overwrite = true
  name            = tolist(aws_acm_certificate.mysite.domain_validation_options)[1].resource_record_name
  records         = [tolist(aws_acm_certificate.mysite.domain_validation_options)[1].resource_record_value]
  type            = tolist(aws_acm_certificate.mysite.domain_validation_options)[1].resource_record_type
  zone_id         = data.aws_route53_zone.public.id
  ttl             = 60
}

# ACM Certificate Validation for both records
resource "aws_acm_certificate_validation" "cert" {
  //provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.mysite.arn
  validation_record_fqdns = [
    aws_route53_record.cert_validation_root.fqdn,
    aws_route53_record.cert_validation_wildcard.fqdn
  ]
}

# Alias record for CloudFront distribution
resource "aws_route53_record" "web" {
  zone_id = data.aws_route53_zone.public.id
  name    = var.domainName

  type = "A"

  alias {
    name                   = aws_cloudfront_distribution.my_cloudfront.domain_name
    zone_id                = aws_cloudfront_distribution.my_cloudfront.hosted_zone_id
    evaluate_target_health = false
  }
}
