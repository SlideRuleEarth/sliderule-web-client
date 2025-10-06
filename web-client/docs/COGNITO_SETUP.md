# AWS Cognito User Pools Setup Guide

This guide explains how to set up AWS Cognito User Pools to provide secure authentication for Lambda function invocation via API Gateway.

## Architecture Overview

```
Browser → Cognito (Authentication) → API Gateway (Authorization) → Lambda
```

**Security Benefits:**
- ✅ No AWS credentials exposed in browser
- ✅ Per-user authentication with JWT tokens
- ✅ No API keys to leak
- ✅ Built-in password policies and MFA support
- ✅ User management (signup, signin, password reset)
- ✅ Token expiration and refresh
- ✅ Fine-grained access control per user

---

## Part 1: AWS Cognito Setup

### Step 1: Create Cognito User Pool

1. Go to AWS Cognito Console
2. Click "Create user pool"
3. Configure sign-in experience:
   - **Sign-in options**: Select "Email"
   - Click "Next"

4. Configure security requirements:
   - **Password policy**: Choose minimum requirements (default is good)
   - **MFA**: Optional - "No MFA" or "Optional MFA" recommended for testing
   - **User account recovery**: Email only
   - Click "Next"

5. Configure sign-up experience:
   - **Self-service sign-up**: Enable
   - **Attribute verification**: Email
   - **Required attributes**:
     - Email (already selected)
     - Given name (optional)
     - Family name (optional)
   - Click "Next"

6. Configure message delivery:
   - **Email provider**: Choose "Send email with Cognito"
   - For production, use "Send email with Amazon SES" for better deliverability
   - Click "Next"

7. Integrate your app:
   - **User pool name**: `SlideRuleLambdaUsers` (or your preferred name)
   - **App client name**: `SlideRuleWebClient`
   - **Client secret**: "Don't generate a client secret" (important for browser apps)
   - **Authentication flows**:
     - ✅ ALLOW_USER_PASSWORD_AUTH
     - ✅ ALLOW_REFRESH_TOKEN_AUTH
   - Click "Next"

8. Review and create:
   - Review your settings
   - Click "Create user pool"

### Step 2: Note Your Configuration Values

After creating the user pool, note these values:

1. **User Pool ID**: Found at the top of the user pool details page
   - Format: `us-east-1_aBcDeFgHi`
   - You'll use this as `VITE_COGNITO_USER_POOL_ID`

2. **App Client ID**: Go to "App integration" → "App clients"
   - Format: `1a2b3c4d5e6f7g8h9i0j1k2l3m`
   - You'll use this as `VITE_COGNITO_CLIENT_ID`

3. **AWS Region**: The region where you created the user pool
   - Example: `us-east-1`
   - You'll use this as `VITE_AWS_REGION`

---

## Part 2: API Gateway Integration

### Step 1: Create Cognito Authorizer in API Gateway

1. Go to API Gateway Console
2. Select your API (or create one following [LAMBDA_API_SETUP.md](./LAMBDA_API_SETUP.md))
3. In the left sidebar, click "Authorizers"
4. Click "Create New Authorizer"
5. Configure:
   - **Name**: `CognitoAuthorizer`
   - **Type**: "Cognito"
   - **Cognito User Pool**: Select your user pool
   - **Token Source**: `Authorization`
   - **Token Validation**: Leave blank (uses default regex)
6. Click "Create"
7. Test the authorizer (optional):
   - Get a token by signing in through your app
   - Paste the token (without "Bearer " prefix)
   - Click "Test"

### Step 2: Attach Authorizer to API Methods

1. In API Gateway, select your API
2. Click on a resource (e.g., `/{proxy+}` or specific function path)
3. Click on a method (e.g., `POST`)
4. Click "Method Request"
5. Under "Settings":
   - **Authorization**: Select your Cognito authorizer
   - **OAuth Scopes**: Leave empty
6. Save changes
7. Repeat for all methods that require authentication

### Step 3: Deploy API

1. Click "Actions" → "Deploy API"
2. Select your stage (e.g., "prod")
3. Click "Deploy"

---

## Part 3: Lambda Function Configuration

Your Lambda functions will now receive Cognito user information in the event:

```javascript
export const handler = async (event) => {
    // Extract user info from Cognito
    const claims = event.requestContext.authorizer.claims;

    const userInfo = {
        userId: claims.sub,              // Unique user ID
        email: claims.email,             // User's email
        emailVerified: claims.email_verified === 'true',
        givenName: claims.given_name,    // First name
        familyName: claims.family_name,  // Last name
    };

    console.log('User:', userInfo);

    // Parse request body
    const body = JSON.parse(event.body || '{}');

    // Your business logic here
    // You can now implement per-user permissions, data isolation, etc.

    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*', // Configure for your domain
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        body: JSON.stringify({
            message: 'Success',
            user: userInfo,
            result: body
        })
    };
};
```

### Example: User-Specific Data Access

```javascript
export const handler = async (event) => {
    const userId = event.requestContext.authorizer.claims.sub;
    const userEmail = event.requestContext.authorizer.claims.email;

    // Use userId to fetch user-specific data
    // Use DynamoDB, S3, or other AWS services with user-scoped access

    // Example: Check if user has permission
    const hasPermission = await checkUserPermission(userId, 'execute-function');

    if (!hasPermission) {
        return {
            statusCode: 403,
            body: JSON.stringify({ error: 'Permission denied' })
        };
    }

    // Execute function logic...
};
```

---

## Part 4: Web Client Configuration

### Step 1: Install Dependencies

Already done if you followed the main setup:

```bash
npm install amazon-cognito-identity-js
```

### Step 2: Configure Environment Variables

Add to your `.env` file:

```bash
# AWS Region
VITE_AWS_REGION=us-east-1

# Cognito Configuration
VITE_COGNITO_USER_POOL_ID=us-east-1_aBcDeFgHi
VITE_COGNITO_CLIENT_ID=1a2b3c4d5e6f7g8h9i0j1k2l3m

# API Gateway URL (without trailing slash)
VITE_LAMBDA_API_GATEWAY_URL=https://abc123.execute-api.us-east-1.amazonaws.com/prod
```

### Step 3: Use in Your Application

#### Option 1: Use the Lambda Executor Component

```vue
<script setup lang="ts">
import SrLambdaExecutor from '@/components/SrLambdaExecutor.vue';

const functions = [
    {
        name: 'myFunction',
        label: 'My Function',
        description: 'Description of what this function does',
        defaultPayload: { key: 'value' }
    }
];
</script>

<template>
    <SrLambdaExecutor
        :available-functions="functions"
        :auto-load-functions="false"
    />
</template>
```

The component includes built-in authentication UI.

#### Option 2: Use Auth Store Directly

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/stores/authStore';
import { lambdaApiService } from '@/services/lambdaApiService';
import SrAuth from '@/components/SrAuth.vue';

const authStore = useAuthStore();
const showAuth = ref(false);
const result = ref('');

onMounted(async () => {
    await authStore.initialize();
});

async function executeFunction() {
    if (!authStore.isAuthenticated) {
        showAuth.value = true;
        return;
    }

    const response = await lambdaApiService.invokeLambda('myFunction', {
        data: 'value'
    });

    result.value = JSON.stringify(response, null, 2);
}
</script>

<template>
    <div>
        <p v-if="authStore.isAuthenticated">
            Signed in as: {{ authStore.userEmail }}
            <button @click="authStore.signOut()">Sign Out</button>
        </p>
        <button v-else @click="showAuth = true">Sign In</button>

        <button @click="executeFunction">Execute Lambda</button>
        <pre>{{ result }}</pre>

        <SrAuth v-model:visible="showAuth" />
    </div>
</template>
```

---

## Part 5: Testing

### Test User Sign Up

1. Open your web application
2. Click "Sign Up" or "Create Account"
3. Enter email and password
4. Check email for confirmation code
5. Enter confirmation code
6. Sign in with your credentials

### Test Lambda Invocation

1. Sign in to your application
2. Select a Lambda function
3. Enter payload
4. Click "Execute"
5. Verify you see successful response

### Test Token Expiration

Cognito ID tokens expire after 1 hour by default. The auth service automatically refreshes tokens when needed.

### Check Lambda Logs

1. Go to CloudWatch Logs
2. Find your Lambda function's log group
3. Check recent logs to see the user claims:

```json
{
  "sub": "12345678-1234-1234-1234-123456789012",
  "email": "user@example.com",
  "email_verified": "true",
  "given_name": "John",
  "family_name": "Doe"
}
```

---

## Advanced Configuration

### Enable MFA (Multi-Factor Authentication)

1. Go to Cognito User Pool → "Sign-in experience"
2. Click "Edit" on MFA
3. Select "Optional" or "Required"
4. Choose MFA methods: SMS, TOTP (authenticator app), or both
5. Save changes

Users will be prompted to set up MFA on next sign-in.

### Custom Password Policy

1. Go to User Pool → "Sign-in experience"
2. Click "Edit" on Password policy
3. Configure:
   - Minimum length (8-99 characters)
   - Require uppercase, lowercase, numbers, special characters
   - Password expiration
4. Save changes

### Email Customization

1. Go to User Pool → "Messaging"
2. Click "Edit" on Email
3. Customize:
   - Verification email subject and message
   - Invitation email (if using admin-created users)
   - Password reset email
4. Use variables like `{####}` for verification code, `{username}` for username
5. Save changes

### Advanced Security Features

1. Go to User Pool → "App integration" → "App clients"
2. Select your app client
3. Click "Edit"
4. Configure:
   - **Token validity**: ID token, Access token, Refresh token durations
   - **Authentication flows**: Enable/disable specific flows
   - **Prevent user existence errors**: Recommended for security
5. Save changes

### Hosted UI (Optional)

Cognito provides a hosted authentication UI:

1. Go to User Pool → "App integration"
2. Click "Create app client"
3. Configure:
   - Enable "Hosted UI"
   - Add callback URLs
   - Add sign-out URLs
4. Cognito provides a hosted login page

For SlideRule, we use the custom UI in `SrAuth.vue` for better integration.

---

## Troubleshooting

### "User is not authenticated" Error

**Cause**: JWT token is missing or expired

**Solution**:
- Ensure user is signed in
- Check token in browser DevTools → Network tab → Request headers
- Token automatically refreshes, but check if refresh token is valid

### "Invalid token" Error

**Cause**: Token is malformed or from wrong user pool

**Solution**:
- Verify `VITE_COGNITO_USER_POOL_ID` matches API Gateway authorizer
- Check token format (should be long JWT string)
- Ensure token is sent with "Bearer " prefix in Authorization header

### Email Not Received

**Cause**: Cognito email limits or spam filters

**Solution**:
- Check spam folder
- Use Amazon SES for production (Cognito has daily email limit)
- Verify email domain if using SES
- Use `resendConfirmationCode()` method

### CORS Errors

**Cause**: Missing CORS headers in Lambda response

**Solution**:
- Add CORS headers to all Lambda responses (see Lambda example above)
- Enable CORS in API Gateway (Actions → Enable CORS)
- Ensure Authorization header is allowed in CORS config

### Token Expiration Issues

**Cause**: ID tokens expire after 1 hour

**Solution**:
- The auth service automatically refreshes tokens
- Refresh tokens are valid for 30 days by default
- After 30 days, user must sign in again
- Adjust token validity in User Pool settings if needed

---

## Security Best Practices

### ✅ DO:
- Use strong password policies
- Enable MFA for production
- Use HTTPS only
- Set appropriate token expiration times
- Implement per-user authorization in Lambda
- Log authentication events
- Use Amazon SES for production email
- Regularly review CloudWatch logs
- Implement rate limiting in Lambda
- Use least-privilege IAM roles for Lambda

### ❌ DON'T:
- Don't use client secret (not secure in browsers)
- Don't store passwords in browser storage
- Don't expose admin credentials
- Don't disable SSL certificate validation
- Don't use same user pool for dev and prod
- Don't log sensitive user information
- Don't allow weak passwords

---

## Cost Considerations

### Cognito Pricing (as of 2024):

- **Free Tier**: 50,000 Monthly Active Users (MAU)
- **Paid Tier**: $0.0055 per MAU above 50,000
- **MFA SMS**: $0.00075 per SMS (if using SMS MFA)

### API Gateway Pricing:

- **REST API**: $3.50 per million requests
- **First 333 million requests**: $3.50/million
- **Additional data transfer charges apply

### Lambda Pricing:

- **Free Tier**: 1 million requests/month
- **Paid**: $0.20 per million requests
- **Duration charges**: Based on memory and execution time

### Typical Monthly Cost for Small App:
- 1,000 users × 100 Lambda calls/user = 100,000 requests
- **Cost**: ~$0 (within free tiers)

### For Production App (10,000 users):
- Cognito: Free (under 50,000 MAU)
- API Gateway: ~$0.35
- Lambda: ~$0.20
- **Total**: ~$0.55/month

---

## Production Checklist

- [ ] Cognito User Pool created
- [ ] App client configured (no client secret)
- [ ] Email verification enabled
- [ ] Password policy configured
- [ ] MFA enabled (optional but recommended)
- [ ] API Gateway authorizer created
- [ ] API Gateway methods protected with authorizer
- [ ] Lambda functions updated to use user claims
- [ ] CORS properly configured
- [ ] Environment variables set
- [ ] Token expiration tested
- [ ] Password reset flow tested
- [ ] User sign-up flow tested
- [ ] CloudWatch logs reviewed
- [ ] Amazon SES configured (for production email)
- [ ] Monitoring and alerts set up

---

## Additional Resources

- [AWS Cognito Documentation](https://docs.aws.amazon.com/cognito/)
- [API Gateway Authorizers](https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-use-lambda-authorizer.html)
- [amazon-cognito-identity-js GitHub](https://github.com/aws-amplify/amplify-js/tree/main/packages/amazon-cognito-identity-js)
- [JWT Token Structure](https://jwt.io/)

---

## Next Steps

After completing this setup:

1. Test authentication flow thoroughly
2. Implement per-user permissions in Lambda functions
3. Add user profile management features
4. Consider adding social sign-in (Google, Facebook, etc.) via Cognito Identity Providers
5. Set up CloudWatch alarms for failed authentication attempts
6. Implement audit logging for sensitive operations
