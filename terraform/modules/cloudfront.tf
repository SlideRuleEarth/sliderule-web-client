resource "aws_cloudfront_response_headers_policy" "security_headers_policy" {
  name = "${replace(var.domainName, ".", "-")}-shp"
  security_headers_config {
    content_type_options {
      override = true
    }
    frame_options {
      frame_option = "DENY"
      override     = true
    }
    referrer_policy {
      referrer_policy = "same-origin"
      override        = true
    }
    xss_protection {
      mode_block = true
      protection = true
      override   = true
    }
    strict_transport_security {
      access_control_max_age_sec = "63072000"
      include_subdomains         = true
      preload                    = true
      override                   = true
    }
    content_security_policy {
      content_security_policy = "frame-ancestors 'none'; default-src 'none'; img-src 'self' data: https://*.openstreetmap.org https://openlayers.org https://mt1.google.com https://tile.googleapis.com https://server.arcgisonline.com https://cdn.rawgit.com https://cdn.jsdelivr.net https://www.opengis.net https://worldwind25.arc.nasa.gov https://neo.gsfc.nasa.gov https://gibs.earthdata.nasa.gov https://gibs.earthdata.nasa.gov https://gitc.earthdata.nasa.gov https://www.glims.org https://*.arcgis.com https://elevation.nationalmap.gov https://nimbus.cr.usgs.gov https://tiles.maps.eox.at https://*.tile.opentopomap.org ; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self'; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; object-src 'none'; font-src 'self' https://fonts.gstatic.com; connect-src 'self' blob: https://*.slideruleearth.io https://*.${var.domainApex} https://nominatim.openstreetmap.org https://server.arcgisonline.com https://www.opengis.net https://worldwind25.arc.nasa.gov  https://neo.gsfc.nasa.gov https://gibs.earthdata.nasa.gov https://gitc.earthdata.nasa.gov https://www.glims.org https://*.arcgis.com https://elevation.nationalmap.gov https://elevation.nationalmap.gov https://extensions.duckdb.org https://tile.googleapis.com https://tiles.maps.eox.at;"
      override                = true
    }
  }
}

resource "aws_cloudfront_distribution" "my_cloudfront" {
  depends_on = [
    aws_s3_bucket.this_site_bucket
  ]

  origin {
    domain_name = aws_s3_bucket.this_site_bucket.bucket_regional_domain_name
    origin_id   = "s3-${replace(var.domainName, ".", "-")}-cloudfront"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.origin_access_identity.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = [var.domainName]

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "s3-${replace(var.domainName, ".", "-")}-cloudfront"

    forwarded_values {
      query_string = false

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400

    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers_policy.id
  }

  price_class = "PriceClass_200"

  viewer_certificate {
    cloudfront_default_certificate = true
    acm_certificate_arn            = aws_acm_certificate.mysite.arn
    ssl_support_method             = "sni-only"
    minimum_protocol_version        = "TLSv1"
  }

  custom_error_response {
    error_caching_min_ttl = 0
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
  }

  custom_error_response {
    error_caching_min_ttl = 0
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
  }
}

resource "aws_cloudfront_origin_access_identity" "origin_access_identity" {
  comment = "access-identity-${replace(var.domainName, ".", "-")}.s3.amazonaws.com"
}
