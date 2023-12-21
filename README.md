# Sliderule Web Client
This project started with a copy of the v0.11 of [https://github.com/aws-samples/amazon-cloudfront-secure-static-site](https://github.com/aws-samples/amazon-cloudfront-secure-static-site).

The Sliderule specific web client code is located in the www directory.

The following diagram shows an overview of how the solution works:

![Architecture](./docs/images/cf-secure-static-site-architecture.png)

1. The viewer requests the website at www.example.com.
2. If the requested object is cached, CloudFront returns the object from its cache to the viewer.
3. If the object is not in CloudFront’s cache, CloudFront requests the object from the origin (an S3 bucket).
4. S3 returns the object to CloudFront
5. CloudFront caches the object.
6. The object is returned to the viewer. Subsequent responses for the object are served from the CloudFront cache.
This was used to create and deploy our sliderule-web-client:
```
make cold-start-sliderule-webclient
make package-and-deploy
```

To update the content of the website sync the www directory with the current web-client-stack-customresourcestack-s3bucketroot[unique-id] bucket:
e.g.
```
aws s3 sync web-client/dist/ s3://web-client-stack-customresourcestack-s3bucketroot-1exsbbvzf84py/
``` 

To invalidate the CloudFront cache use with the appropriate distribution-id:
```
aws cloudfront create-invalidation --distribution-id EXAMPLE1234 --paths "/*"
```