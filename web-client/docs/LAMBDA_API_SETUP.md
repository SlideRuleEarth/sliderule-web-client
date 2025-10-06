# AWS Lambda API Gateway Setup Guide

This guide explains how to set up AWS API Gateway to allow your web client to securely invoke Lambda functions without exposing AWS credentials.

## Architecture Overview

```
Browser → API Gateway → Lambda Function
```

**Benefits:**
- No AWS credentials exposed in browser
- Built-in rate limiting and throttling
- Request validation before Lambda invocation
- WAF integration for additional security
- Better logging and monitoring
- Cost controls via usage plans

---

## AWS Setup Steps

### 1. Create Lambda Functions

1. Go to AWS Lambda Console
2. Create a new function or use existing ones
3. Example Lambda function (Node.js):

```javascript
export const handler = async (event) => {
    // Parse the incoming request body
    const body = JSON.parse(event.body || '{}');

    // Your business logic here
    const result = {
        message: 'Function executed successfully',
        input: body,
        timestamp: new Date().toISOString()
    };

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Configure based on your domain
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify(result)
    };
};
```

### 2. Create API Gateway REST API

1. Go to API Gateway Console
2. Click "Create API" → Choose "REST API"
3. Select "New API"
4. Enter API name (e.g., "SlideRule Lambda API")
5. Click "Create API"

### 3. Configure API Resources and Methods

#### Create a proxy resource (recommended for multiple functions):

1. Click "Actions" → "Create Resource"
2. Check "Configure as proxy resource"
3. Resource path: `/{proxy+}`
4. Enable CORS if needed
5. Click "Create Resource"

#### Or create specific resources:

1. Click "Actions" → "Create Resource"
2. Resource name: function name (e.g., "myFunction")
3. Resource path: `/myFunction`
4. Click "Create Resource"
5. Click "Actions" → "Create Method" → Select "POST"
6. Integration type: Lambda Function
7. Check "Use Lambda Proxy integration"
8. Select your Lambda function
9. Click "Save"

### 4. Enable CORS (Important for browser access)

1. Select your resource
2. Click "Actions" → "Enable CORS"
3. Configure allowed origins (e.g., `https://yourdomain.com` or `*` for development)
4. Check the methods you want to enable
5. Click "Enable CORS and replace existing CORS headers"

### 5. Create Usage Plan (Recommended for rate limiting)

1. Click "Usage Plans" in left sidebar
2. Click "Create"
3. Enter plan name (e.g., "Standard Plan")
4. Set throttling limits:
   - Rate: 100 requests per second
   - Burst: 200 requests
5. Set quota limits:
   - 10,000 requests per day (adjust as needed)
6. Click "Next"
7. Add your API and stage
8. Click "Done"

Note: With Cognito authentication, API keys are not needed. Rate limiting is per-user based on their JWT token.

### 6. Deploy API

1. Click "Actions" → "Deploy API"
2. Select "[New Stage]" from dropdown
3. Enter stage name (e.g., "prod" or "dev")
4. Click "Deploy"
5. Note the "Invoke URL" (e.g., `https://abc123.execute-api.us-east-1.amazonaws.com/prod`)

---

## Web Client Configuration

### 1. Add Environment Variables

Add to your `.env` file:

```bash
# AWS Region
VITE_AWS_REGION=us-east-1

# Cognito Configuration (required for authentication)
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx

# API Gateway Configuration
VITE_LAMBDA_API_GATEWAY_URL=https://abc123.execute-api.us-east-1.amazonaws.com/prod
```

**Note:** This setup requires Cognito User Pools for authentication. See [COGNITO_SETUP.md](./COGNITO_SETUP.md) for complete authentication setup.

### 2. Use the Component

```vue
<script setup lang="ts">
import SrLambdaExecutor from '@/components/SrLambdaExecutor.vue';

const availableFunctions = [
    {
        name: 'myFunction',
        label: 'My Function',
        description: 'Description of what this function does',
        defaultPayload: {
            key: 'value'
        }
    },
    {
        name: 'anotherFunction',
        label: 'Another Function',
        description: 'Another function description'
    }
];
</script>

<template>
    <SrLambdaExecutor
        :available-functions="availableFunctions"
        :auto-load-functions="false"
    />
</template>
```

### 3. Or Use the Service Directly

```typescript
import { lambdaApiService } from '@/services/lambdaApiService';

async function executeMyFunction() {
    const result = await lambdaApiService.invokeLambda('myFunction', {
        input: 'data'
    });

    if (result.success) {
        console.log('Success:', result.data);
    } else {
        console.error('Error:', result.error);
    }
}
```

---

## Advanced Security Configuration

### 1. Add Resource Policy to API Gateway (Optional)

Add additional domain restrictions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Principal": "*",
            "Action": "execute-api:Invoke",
            "Resource": "arn:aws:execute-api:region:account-id:api-id/*",
            "Condition": {
                "StringEquals": {
                    "aws:Referer": [
                        "https://yourdomain.com/*"
                    ]
                }
            }
        }
    ]
}
```

Note: With Cognito authentication, this provides additional protection but is not strictly necessary.

### 2. Enable CloudWatch Logs

1. In API Gateway, go to "Settings"
2. Set "CloudWatch log level" to "INFO" or "ERROR"
3. Enable detailed metrics
4. This helps with debugging and monitoring

### 3. Enable AWS WAF (Optional)

For additional protection:
1. Create a WAF Web ACL
2. Add rules for rate limiting, bot detection, IP filtering
3. Associate with your API Gateway

### 4. Add Request Validation

1. Create a model for your request body
2. In "Method Request", set request validator
3. API Gateway will reject invalid requests before invoking Lambda

---

## Lambda Function Permissions

Ensure your Lambda execution role has necessary permissions:

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        }
    ]
}
```

---

## Testing Your Setup

### Using curl with Cognito:

First, obtain a JWT token by signing in through your web app, then:

```bash
# Replace YOUR_JWT_TOKEN with the actual token
curl -X POST \
  https://abc123.execute-api.us-east-1.amazonaws.com/prod/myFunction \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -d '{"key": "value"}'
```

### Expected Response:

```json
{
    "message": "Function executed successfully",
    "input": {"key": "value"},
    "timestamp": "2025-01-15T10:30:00.000Z"
}
```

---

## Monitoring and Costs

### Monitor Usage:
- CloudWatch Metrics: Requests, latency, errors
- CloudWatch Logs: Detailed execution logs
- API Gateway Dashboard: Usage by user (via Cognito)

### Cost Optimization:
- Set appropriate usage plan limits
- Enable caching for GET requests
- Use Lambda reserved concurrency to limit costs
- Set CloudWatch alarms for unusual activity

### Example CloudWatch Alarm:

```
Metric: 4XXError or 5XXError
Threshold: > 100 errors in 5 minutes
Action: Send SNS notification
```

---

## Troubleshooting

### CORS Errors:
- Verify CORS is enabled in API Gateway
- Check Lambda function returns proper CORS headers
- Ensure OPTIONS method is configured
- Ensure `Authorization` header is allowed in CORS

### 403 Forbidden:
- Check Cognito authorizer is configured correctly
- Verify JWT token is valid and not expired
- Check user pool ID matches between Cognito and API Gateway
- Ensure `Authorization: Bearer <token>` header format is correct

### 429 Too Many Requests:
- Rate limit exceeded
- Increase throttling limits in usage plan
- Implement retry logic in client

### 500 Internal Server Error:
- Check Lambda function logs in CloudWatch
- Verify Lambda has necessary permissions
- Check for errors in Lambda code

---

## Production Checklist

- [ ] API Gateway deployed to production stage
- [ ] Cognito User Pool created and configured (see [COGNITO_SETUP.md](./COGNITO_SETUP.md))
- [ ] Cognito authorizer added to API Gateway
- [ ] CORS properly configured for production domain
- [ ] Usage plan with appropriate rate limits
- [ ] CloudWatch logging enabled
- [ ] CloudWatch alarms configured
- [ ] Lambda functions tested with JWT tokens
- [ ] Lambda functions extract user info from JWT claims
- [ ] Error handling implemented
- [ ] Environment variables configured
- [ ] Documentation updated
- [ ] Cost monitoring in place
- [ ] Authentication flow tested end-to-end

---

## Additional Resources

- [API Gateway Documentation](https://docs.aws.amazon.com/apigateway/)
- [Lambda Documentation](https://docs.aws.amazon.com/lambda/)
- [API Gateway Security Best Practices](https://docs.aws.amazon.com/apigateway/latest/developerguide/security-best-practices.html)
