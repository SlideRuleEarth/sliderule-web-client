# Sliderule Web Client
This project started with a copy of the v0.11 of [https://github.com/aws-samples/amazon-cloudfront-secure-static-site](https://github.com/aws-samples/amazon-cloudfront-secure-static-site).

The Sliderule specific web client code is located in the ./web-client/dist directory.

The following diagram shows an overview of how the solution works:

![Architecture](./docs/images/cf-secure-static-site-architecture.png)

1. The viewer requests the website at e.g. client.slideruleearth.io
2. If the requested object is cached, CloudFront returns the object from its cache to the viewer.
3. If the object is not in CloudFront’s cache, CloudFront requests the object from the origin (an S3 bucket).
4. S3 returns the object to CloudFront
5. CloudFront caches the object.
6. The object is returned to the viewer. Subsequent responses for the object are served from the CloudFront cache.


This was used to create our sliderule-web-client for the first time (ONE TIME ONLY) to create helper functions in which:
```
make cold-start-sliderule-web-client
```

This was used to build and deploy changes to web-client (our single page app) :
```
make deploy
```

To update trivial changes to the website for development (Not for production)
```
make live-update
``` 
