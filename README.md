# Sliderule Web Client
This project started with a copy of the v0.11 of [https://github.com/aws-samples/amazon-cloudfront-secure-static-site](https://github.com/aws-samples/amazon-cloudfront-secure-static-site).

The Sliderule specific web client code is located in the www directory.

[README-AmazonCloudFrontSecureStaticWebsite](./README-AmazonCloudFrontSecureStaticWebsite.md) describes the Amazon CloudFront Secure Static Website architecture, setup and deployment.

This was used to create and deploy our sliderule-web-client:
```
make cold-start-sliderule-webclient
make package-and-deploy
```

To update the content of the website sync the www directory with the current web-client-stack-customresourcestack-s3bucketroot[unique-id] bucket:
e.g.
```
aws s3 sync www/ s3://web-client-stack-customresourcestack-s3bucketroot-1exsbbvzf84py/
``` 

To invalidate the CloudFront cache use with the appropriate distribution-id:
```
aws cloudfront create-invalidation --distribution-id EXAMPLE1234 --paths "/*"
```