"""
GitHub OAuth Lambda Handler for SlideRule Web Client

Handles OAuth authentication flow and organization membership verification
for the SlideRuleEarth GitHub organization.

Supports two flows:
1. Authorization Code Flow (for web clients)
2. Device Flow (for CLI/Python clients)

Returns a signed JWT containing:
- username: GitHub username
- is_member: boolean for org membership
- is_owner: boolean for org admin role
- teams: list of team slugs the user belongs to
- max_nodes: maximum compute nodes (15 for owners, 7 for members)
- cluster_ttl_hours: max cluster runtime in hours (12 for owners, 8 for members)
- exp: token expiration timestamp (default 12 hours, configurable via JWT_EXPIRATION_HOURS)

The JWT can be validated by the SlideRule server using the shared signing secret.
"""

import json
import os
import secrets
import urllib.parse
from datetime import datetime, timedelta, timezone
import boto3
import requests
import jwt

# Configuration from environment variables
GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID')
GITHUB_ORG = os.environ.get('GITHUB_ORG', 'SlideRuleEarth')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://testsliderule.org')
CLIENT_SECRET_NAME = os.environ.get('CLIENT_SECRET_NAME')
JWT_SIGNING_KEY_ARN = os.environ.get('JWT_SIGNING_KEY_ARN')

# JWT configuration
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = int(os.environ.get('JWT_EXPIRATION_HOURS', '12'))

# GitHub OAuth endpoints
GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code'
GITHUB_API_URL = 'https://api.github.com'

# Allowed redirect domains (for open redirect protection)
# These are validated against the redirect_uri to prevent attackers from
# redirecting tokens to malicious sites
ALLOWED_REDIRECT_HOSTS = [
    'testsliderule.org',
    'client.slideruleearth.io',
    'localhost',
    '127.0.0.1',
]

# Cache for secrets (Lambda container reuse)
_secrets_cache = {}


def _get_secret(secret_arn):
    """Retrieve a secret from AWS Secrets Manager."""
    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId=secret_arn)
    return response['SecretString']


def get_github_client_secret():
    """Retrieve GitHub client secret from AWS Secrets Manager."""
    if 'client_secret' not in _secrets_cache:
        if not CLIENT_SECRET_NAME:
            raise ValueError("CLIENT_SECRET_NAME environment variable not set")
        _secrets_cache['client_secret'] = _get_secret(CLIENT_SECRET_NAME)
    return _secrets_cache['client_secret']


def get_jwt_signing_key():
    """Retrieve JWT signing key from AWS Secrets Manager."""
    if 'jwt_signing_key' not in _secrets_cache:
        if not JWT_SIGNING_KEY_ARN:
            raise ValueError("JWT_SIGNING_KEY_ARN environment variable not set")
        _secrets_cache['jwt_signing_key'] = _get_secret(JWT_SIGNING_KEY_ARN)
    return _secrets_cache['jwt_signing_key']


def is_valid_redirect_uri(uri):
    """
    Validate that a redirect URI points to an allowed domain.
    Prevents open redirect attacks where an attacker could redirect
    the JWT token to a malicious site.

    Args:
        uri: The redirect URI to validate

    Returns:
        True if the URI is safe to redirect to, False otherwise
    """
    if not uri:
        return False

    try:
        parsed = urllib.parse.urlparse(uri)
        host = parsed.hostname

        if not host:
            return False

        # Check against allowed hosts
        for allowed_host in ALLOWED_REDIRECT_HOSTS:
            if host == allowed_host or host.endswith('.' + allowed_host):
                return True

        # Also allow the configured FRONTEND_URL host
        frontend_parsed = urllib.parse.urlparse(FRONTEND_URL)
        if host == frontend_parsed.hostname:
            return True

        print(f"Rejected redirect to unauthorized host: {host}")
        return False

    except Exception as e:
        print(f"Error validating redirect URI: {e}")
        return False


def lambda_handler(event, context):
    """Main Lambda handler - routes requests based on path."""
    path = event.get('rawPath', '')
    method = event.get('requestContext', {}).get('http', {}).get('method', 'GET')

    print(f"Received request: {method} {path}")

    # Web client Authorization Code flow
    if path == '/auth/github/login':
        return handle_login(event)
    elif path == '/auth/github/callback':
        return handle_callback(event)
    # Device Flow for CLI/Python clients
    elif path == '/auth/github/device':
        return handle_device_code_request(event)
    elif path == '/auth/github/device/poll':
        return handle_device_poll(event)
    else:
        return {
            'statusCode': 404,
            'body': json.dumps({'error': 'Not found'})
        }


def handle_login(event):
    """
    Initiate GitHub OAuth flow.
    Redirects user to GitHub authorization page.
    """
    # Get query parameters
    query_params = event.get('queryStringParameters') or {}
    state = query_params.get('state', secrets.token_urlsafe(32))
    redirect_uri = query_params.get('redirect_uri')

    # Build the callback URL (this Lambda's callback endpoint)
    # Get the host from the request
    headers = event.get('headers', {})
    host = headers.get('host', '')
    protocol = 'https'
    callback_url = f"{protocol}://{host}/auth/github/callback"

    # Store the frontend redirect URI in state if provided
    if redirect_uri:
        state = f"{state}|{redirect_uri}"

    # Build GitHub authorization URL
    params = {
        'client_id': GITHUB_CLIENT_ID,
        'redirect_uri': callback_url,
        'scope': 'read:org',
        'state': state
    }

    auth_url = f"{GITHUB_AUTHORIZE_URL}?{urllib.parse.urlencode(params)}"

    return {
        'statusCode': 302,
        'headers': {
            'Location': auth_url,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        'body': ''
    }


def handle_callback(event):
    """
    Handle GitHub OAuth callback.
    Exchange code for token, check org membership, get teams, create JWT, redirect to frontend.
    """
    query_params = event.get('queryStringParameters') or {}
    code = query_params.get('code')
    state = query_params.get('state', '')
    error = query_params.get('error')
    error_description = query_params.get('error_description')

    # Handle OAuth errors from GitHub
    if error:
        return redirect_to_frontend_with_error(state, error_description or error)

    if not code:
        return redirect_to_frontend_with_error(state, 'No authorization code received')

    try:
        # Exchange code for access token
        access_token = exchange_code_for_token(code, event)

        # Get user info
        user_info = get_github_user(access_token)
        username = user_info.get('login')

        if not username:
            return redirect_to_frontend_with_error(state, 'Could not get GitHub username')

        # Check organization membership
        membership = check_org_membership(access_token, username)

        # Get user's teams in the organization (only if they're a member)
        teams = []
        if membership['is_member']:
            teams = get_user_teams(access_token, username)
            print(f"User {username} belongs to teams: {teams}")

        # Create signed JWT token for all users (used for rate limiting)
        auth_token = create_auth_token(
            username=username,
            is_member=membership['is_member'],
            is_owner=membership['is_owner'],
            teams=teams
        )

        # Redirect to frontend with results
        return redirect_to_frontend_with_result(
            state=state,
            username=username,
            is_member=membership['is_member'],
            is_owner=membership['is_owner'],
            teams=teams,
            token=auth_token
        )

    except Exception as e:
        print(f"Error during OAuth callback: {str(e)}")
        return redirect_to_frontend_with_error(state, str(e))


def exchange_code_for_token(code, event):
    """Exchange authorization code for access token."""
    headers = event.get('headers', {})
    host = headers.get('host', '')
    callback_url = f"https://{host}/auth/github/callback"

    client_secret = get_github_client_secret()

    response = requests.post(
        GITHUB_TOKEN_URL,
        headers={
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data={
            'client_id': GITHUB_CLIENT_ID,
            'client_secret': client_secret,
            'code': code,
            'redirect_uri': callback_url
        }
    )

    if response.status_code != 200:
        raise Exception(f"Failed to exchange code for token: {response.text}")

    data = response.json()

    if 'error' in data:
        raise Exception(f"GitHub OAuth error: {data.get('error_description', data['error'])}")

    access_token = data.get('access_token')
    if not access_token:
        raise Exception("No access token in response")

    return access_token


def get_github_user(access_token):
    """Get authenticated user's GitHub profile."""
    response = requests.get(
        f"{GITHUB_API_URL}/user",
        headers={
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/vnd.github.v3+json'
        }
    )

    if response.status_code != 200:
        raise Exception(f"Failed to get user info: {response.text}")

    return response.json()


def check_org_membership(access_token, username):
    """
    Check if user is a member of the SlideRuleEarth organization.
    Returns dict with is_member and is_owner flags.
    """
    # Try to get the user's membership in the org
    response = requests.get(
        f"{GITHUB_API_URL}/orgs/{GITHUB_ORG}/memberships/{username}",
        headers={
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/vnd.github.v3+json'
        }
    )

    if response.status_code == 200:
        data = response.json()
        state = data.get('state', '')
        role = data.get('role', '')

        # User must have 'active' state to be considered a member
        is_member = state == 'active'
        is_owner = is_member and role == 'admin'

        return {
            'is_member': is_member,
            'is_owner': is_owner
        }
    elif response.status_code == 404:
        # User is not a member of the organization
        return {
            'is_member': False,
            'is_owner': False
        }
    else:
        print(f"Unexpected response checking org membership: {response.status_code} {response.text}")
        return {
            'is_member': False,
            'is_owner': False
        }


def get_user_teams(access_token, username):
    """
    Get all teams the user belongs to in the SlideRuleEarth organization.
    Returns a list of team slugs.
    """
    teams = []

    # GitHub API returns paginated results, so we need to handle pagination
    url = f"{GITHUB_API_URL}/orgs/{GITHUB_ORG}/teams"
    page = 1
    per_page = 100

    while True:
        response = requests.get(
            url,
            headers={
                'Authorization': f'Bearer {access_token}',
                'Accept': 'application/vnd.github.v3+json'
            },
            params={
                'page': page,
                'per_page': per_page
            }
        )

        if response.status_code != 200:
            print(f"Failed to get org teams: {response.status_code} {response.text}")
            break

        org_teams = response.json()
        if not org_teams:
            break

        # Check membership in each team
        for team in org_teams:
            team_slug = team.get('slug')
            if team_slug and is_user_in_team(access_token, team_slug, username):
                teams.append(team_slug)

        # Check if there are more pages
        if len(org_teams) < per_page:
            break
        page += 1

    return teams


def is_user_in_team(access_token, team_slug, username):
    """Check if a user is a member of a specific team."""
    response = requests.get(
        f"{GITHUB_API_URL}/orgs/{GITHUB_ORG}/teams/{team_slug}/memberships/{username}",
        headers={
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/vnd.github.v3+json'
        }
    )

    if response.status_code == 200:
        data = response.json()
        # User must have 'active' state
        return data.get('state') == 'active'

    return False


def create_auth_token(username, is_member, is_owner, teams):
    """
    Create a signed JWT containing the user's authentication info.
    This token can be validated by the SlideRule server.

    Token includes max_nodes and cluster_ttl based on user role:
    - Owners: max_nodes=15, cluster_ttl=12 hours
    - Members: max_nodes=7, cluster_ttl=8 hours
    - Non-members: max_nodes=0, cluster_ttl=0 (no access)

    Token expiration is JWT_EXPIRATION_HOURS (default 12) regardless of role.
    """
    signing_key = get_jwt_signing_key()

    now = datetime.now(timezone.utc)

    # Determine max_nodes and cluster TTL based on role
    if is_owner:
        max_nodes = 15
        cluster_ttl_hours = 12
    elif is_member:
        max_nodes = 7
        cluster_ttl_hours = 8
    else:
        # Non-members get no access
        max_nodes = 0
        cluster_ttl_hours = 0

    # Token expiration based on JWT_EXPIRATION_HOURS config
    expiration = now + timedelta(hours=JWT_EXPIRATION_HOURS)

    payload = {
        'sub': username,  # Subject (GitHub username)
        'username': username,
        'is_member': is_member,
        'is_owner': is_owner,
        'teams': teams,
        'org': GITHUB_ORG,
        'max_nodes': max_nodes,
        'cluster_ttl_hours': cluster_ttl_hours,  # Max cluster runtime
        'iat': int(now.timestamp()),  # Issued at
        'exp': int(expiration.timestamp()),  # Expiration (12 hours)
        'iss': 'sliderule-github-oauth'  # Issuer
    }

    token = jwt.encode(payload, signing_key, algorithm=JWT_ALGORITHM)
    return token


def redirect_to_frontend_with_result(state, username, is_member, is_owner, teams=None, token=None):
    """Redirect to frontend with successful authentication result."""
    # Parse original state to extract frontend redirect URI if present
    original_state = state
    frontend_redirect = None

    if '|' in state:
        parts = state.split('|', 1)
        original_state = parts[0]
        frontend_redirect = parts[1] if len(parts) > 1 else None

    # Validate redirect URI to prevent open redirect attacks
    # Only use frontend_redirect if it points to an allowed domain
    if frontend_redirect and not is_valid_redirect_uri(frontend_redirect):
        print(f"Security: Rejected invalid redirect URI: {frontend_redirect}")
        frontend_redirect = None

    # Build redirect URL (fall back to configured FRONTEND_URL if invalid)
    base_url = frontend_redirect or FRONTEND_URL

    # Ensure we redirect to the callback path on the frontend
    if not base_url.endswith('/auth/github/callback'):
        base_url = base_url.rstrip('/') + '/auth/github/callback'

    params = {
        'state': original_state,
        'username': username,
        'isMember': 'true' if is_member else 'false',
        'isOwner': 'true' if is_owner else 'false'
    }

    # Add teams as comma-separated list
    if teams:
        params['teams'] = ','.join(teams)

    # Add JWT token
    if token:
        params['token'] = token

    redirect_url = f"{base_url}?{urllib.parse.urlencode(params)}"

    return {
        'statusCode': 302,
        'headers': {
            'Location': redirect_url,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        'body': ''
    }


def redirect_to_frontend_with_error(state, error_message):
    """Redirect to frontend with error."""
    original_state = state
    frontend_redirect = None

    if '|' in state:
        parts = state.split('|', 1)
        original_state = parts[0]
        frontend_redirect = parts[1] if len(parts) > 1 else None

    # Validate redirect URI to prevent open redirect attacks
    if frontend_redirect and not is_valid_redirect_uri(frontend_redirect):
        print(f"Security: Rejected invalid redirect URI in error flow: {frontend_redirect}")
        frontend_redirect = None

    base_url = frontend_redirect or FRONTEND_URL

    if not base_url.endswith('/auth/github/callback'):
        base_url = base_url.rstrip('/') + '/auth/github/callback'

    params = {
        'state': original_state,
        'error': error_message
    }

    redirect_url = f"{base_url}?{urllib.parse.urlencode(params)}"

    return {
        'statusCode': 302,
        'headers': {
            'Location': redirect_url,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        },
        'body': ''
    }


# =============================================================================
# Device Flow handlers (for CLI/Python clients)
# =============================================================================

def json_response(status_code, body):
    """Return a JSON API response with CORS headers."""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        },
        'body': json.dumps(body)
    }


def handle_device_code_request(event):
    """
    Handle Device Flow initiation.
    Returns device_code, user_code, and verification_uri for the user.

    POST /auth/github/device
    """
    try:
        # Request device code from GitHub
        response = requests.post(
            GITHUB_DEVICE_CODE_URL,
            headers={
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data={
                'client_id': GITHUB_CLIENT_ID,
                'scope': 'read:org'
            }
        )

        if response.status_code != 200:
            print(f"GitHub device code request failed: {response.status_code} {response.text}")
            return json_response(500, {
                'error': 'device_code_request_failed',
                'error_description': f"GitHub returned status {response.status_code}"
            })

        data = response.json()

        if 'error' in data:
            return json_response(400, {
                'error': data.get('error'),
                'error_description': data.get('error_description', 'Unknown error')
            })

        # Return the device code info to the client
        return json_response(200, {
            'device_code': data.get('device_code'),
            'user_code': data.get('user_code'),
            'verification_uri': data.get('verification_uri'),
            'verification_uri_complete': data.get('verification_uri_complete'),
            'expires_in': data.get('expires_in'),
            'interval': data.get('interval', 5)
        })

    except Exception as e:
        print(f"Error in device code request: {str(e)}")
        return json_response(500, {
            'error': 'internal_error',
            'error_description': str(e)
        })


def handle_device_poll(event):
    """
    Handle Device Flow polling.
    Client polls this endpoint with device_code to check if user has authorized.

    POST /auth/github/device/poll
    Body: { "device_code": "..." }

    Returns:
    - 200 with membership info if authorized
    - 202 with authorization_pending if user hasn't authorized yet
    - 400 with error if authorization failed or expired
    """
    try:
        # Parse request body
        body = event.get('body', '{}')
        if event.get('isBase64Encoded', False):
            import base64
            body = base64.b64decode(body).decode('utf-8')

        try:
            params = json.loads(body) if body else {}
        except json.JSONDecodeError:
            # Try URL-encoded format
            params = dict(urllib.parse.parse_qsl(body))

        device_code = params.get('device_code')

        if not device_code:
            return json_response(400, {
                'error': 'missing_device_code',
                'error_description': 'device_code is required'
            })

        # Poll GitHub for access token
        client_secret = get_github_client_secret()

        response = requests.post(
            GITHUB_TOKEN_URL,
            headers={
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data={
                'client_id': GITHUB_CLIENT_ID,
                'client_secret': client_secret,
                'device_code': device_code,
                'grant_type': 'urn:ietf:params:oauth:grant-type:device_code'
            }
        )

        data = response.json()

        # Check for errors
        if 'error' in data:
            error = data.get('error')

            # authorization_pending means user hasn't authorized yet - keep polling
            if error == 'authorization_pending':
                return json_response(202, {
                    'status': 'pending',
                    'error': error,
                    'error_description': data.get('error_description', 'Waiting for user authorization')
                })

            # slow_down means client is polling too fast
            if error == 'slow_down':
                return json_response(202, {
                    'status': 'pending',
                    'error': error,
                    'error_description': data.get('error_description', 'Polling too fast'),
                    'interval': data.get('interval', 10)
                })

            # Other errors are terminal
            return json_response(400, {
                'status': 'error',
                'error': error,
                'error_description': data.get('error_description', 'Authorization failed')
            })

        # Success! We have an access token
        access_token = data.get('access_token')
        if not access_token:
            return json_response(500, {
                'status': 'error',
                'error': 'no_access_token',
                'error_description': 'No access token in response'
            })

        # Get user info
        user_info = get_github_user(access_token)
        username = user_info.get('login')

        if not username:
            return json_response(500, {
                'status': 'error',
                'error': 'no_username',
                'error_description': 'Could not get GitHub username'
            })

        # Check organization membership
        membership = check_org_membership(access_token, username)

        # Get user's teams in the organization (only if they're a member)
        teams = []
        if membership['is_member']:
            teams = get_user_teams(access_token, username)
            print(f"User {username} belongs to teams: {teams}")

        # Create signed JWT token for all users (used for rate limiting)
        auth_token = create_auth_token(
            username=username,
            is_member=membership['is_member'],
            is_owner=membership['is_owner'],
            teams=teams
        )

        return json_response(200, {
            'status': 'success',
            'username': username,
            'is_member': membership['is_member'],
            'is_owner': membership['is_owner'],
            'teams': teams,
            'token': auth_token,
            'organization': GITHUB_ORG
        })

    except Exception as e:
        print(f"Error in device poll: {str(e)}")
        return json_response(500, {
            'status': 'error',
            'error': 'internal_error',
            'error_description': str(e)
        })
