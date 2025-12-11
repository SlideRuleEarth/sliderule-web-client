# SlideRule JWT Backend Integration Guide

## Overview

The SlideRule GitHub OAuth system issues RS256-signed JWTs that can be used to authorize access to backend services. This guide explains how to validate tokens and implement access control for cluster operations.

## JWT Claims

```json
{
  "sub": "github-username",
  "username": "github-username",
  "aud": "sliderule",
  "iss": "https://ftr9mkl568.execute-api.us-west-2.amazonaws.com",
  "org": "SlideRuleEarth",
  "org_member": true,
  "org_owner": false,
  "accessible_clusters": ["sliderule", "username-cluster", "team-a"],
  "deployable_clusters": ["username-cluster", "team-a"],
  "max_nodes": 7,
  "cluster_ttl_hours": 8,
  "iat": 1733900000,
  "exp": 1733943200
}
```

### Claim Descriptions

| Claim | Type | Description |
|-------|------|-------------|
| `sub` | string | GitHub username (subject) |
| `aud` | string | Audience - always `"sliderule"` |
| `iss` | string | Issuer URL - use for JWKS discovery |
| `org` | string | GitHub org - `"SlideRuleEarth"` |
| `org_member` | boolean | Is user a SlideRuleEarth member? |
| `org_owner` | boolean | Is user an org admin/owner? |
| `accessible_clusters` | string[] | Clusters user can query/access |
| `deployable_clusters` | string[] | Clusters user can deploy/destroy |
| `max_nodes` | integer | Max compute nodes user can provision |
| `cluster_ttl_hours` | integer | Max cluster runtime in hours |

---

## JWKS Endpoints

Use these to fetch the public key for token verification:

- **Standard OIDC**: `https://ftr9mkl568.execute-api.us-west-2.amazonaws.com/.well-known/jwks.json`
- **Alternate**: `https://ftr9mkl568.execute-api.us-west-2.amazonaws.com/auth/github/jwks`
- **PEM format**: `https://ftr9mkl568.execute-api.us-west-2.amazonaws.com/auth/github/public-key`

---

## API Gateway Integration

### Option 1: Built-in JWT Authorizer

For basic validation (checks `iss`, `aud`, `exp` only):

```yaml
ClusterApiAuthorizer:
  Type: AWS::ApiGatewayV2::Authorizer
  Properties:
    ApiId: !Ref ClusterApi
    AuthorizerType: JWT
    IdentitySource:
      - '$request.header.Authorization'
    JwtConfiguration:
      Issuer: 'https://ftr9mkl568.execute-api.us-west-2.amazonaws.com'
      Audience:
        - 'sliderule'
```

### Option 2: Lambda Authorizer (Recommended)

For checking custom claims like `org_member` and `deployable_clusters`:

```python
import json
import jwt
import requests
from functools import lru_cache

JWKS_URL = 'https://ftr9mkl568.execute-api.us-west-2.amazonaws.com/.well-known/jwks.json'

@lru_cache(maxsize=1)
def get_signing_key(kid):
    jwks = requests.get(JWKS_URL, timeout=5).json()
    for key in jwks['keys']:
        if key['kid'] == kid:
            return jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
    raise ValueError(f'Key {kid} not found')

def lambda_handler(event, context):
    auth_header = event.get('headers', {}).get('authorization', '')
    if not auth_header.startswith('Bearer '):
        return deny(event['routeArn'])

    token = auth_header[7:]
    unverified = jwt.get_unverified_header(token)
    signing_key = get_signing_key(unverified['kid'])

    payload = jwt.decode(
        token, signing_key, algorithms=['RS256'],
        audience='sliderule',
        issuer='https://ftr9mkl568.execute-api.us-west-2.amazonaws.com'
    )

    if not payload.get('org_member'):
        return deny(event['routeArn'])

    return allow(payload['sub'], event['routeArn'], {
        'username': payload['username'],
        'deployable_clusters': ','.join(payload.get('deployable_clusters', [])),
        'max_nodes': str(payload.get('max_nodes', 0)),
    })
```

---

## Authorization Rules

| Action | Required Check |
|--------|----------------|
| Access any API | `org_member == true` |
| Access a cluster | `cluster_id in accessible_clusters` |
| Deploy a cluster | `cluster_id in deployable_clusters` |
| Destroy a cluster | `cluster_id in deployable_clusters` OR `org_owner == true` |
| Deploy to production (`sliderule-green/blue`) | `org_owner == true` |
| Node count | `requested_nodes <= max_nodes` |
| Cluster TTL | Enforce `cluster_ttl_hours` as max runtime |

---

## Example: Cluster Deploy Handler

```python
def deploy_cluster(event, context):
    # Claims passed from authorizer
    auth = event['requestContext']['authorizer']['lambda']
    username = auth['username']
    deployable = auth['deployable_clusters'].split(',')
    max_nodes = int(auth['max_nodes'])

    cluster_id = event['pathParameters']['clusterId']
    body = json.loads(event.get('body', '{}'))
    requested_nodes = body.get('nodes', 1)

    # Authorization checks
    if cluster_id not in deployable:
        return {'statusCode': 403, 'body': f'Cannot deploy to {cluster_id}'}

    if requested_nodes > max_nodes:
        return {'statusCode': 403, 'body': f'Max nodes: {max_nodes}'}

    # Proceed with deployment...
```

---

## Testing

Get a token by authenticating at:
- Test: https://testsliderule.org (click Login)
- The token is stored in browser localStorage as `sliderule_token`

Decode at https://jwt.io to inspect claims.

---

## Questions?

Contact the SlideRule team or open an issue in the repository.
