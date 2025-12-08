"""
GitHub OAuth Lambda Handler for SlideRule Web Client

Handles OAuth authentication flow and organization membership verification
for the SlideRuleEarth GitHub organization.

Supports two flows:
1. Authorization Code Flow (for web clients)
2. Device Flow (for CLI/Python clients)
"""

import json
import os
import secrets
import urllib.parse
import boto3
import requests

# Configuration from environment variables
GITHUB_CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID')
GITHUB_ORG = os.environ.get('GITHUB_ORG', 'SlideRuleEarth')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'https://testsliderule.org')
SECRET_ARN = os.environ.get('SECRET_ARN')

# GitHub OAuth endpoints
GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize'
GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
GITHUB_DEVICE_CODE_URL = 'https://github.com/login/device/code'
GITHUB_API_URL = 'https://api.github.com'


def get_github_client_secret():
    """Retrieve GitHub client secret from AWS Secrets Manager."""
    if not SECRET_ARN:
        raise ValueError("SECRET_ARN environment variable not set")

    client = boto3.client('secretsmanager')
    response = client.get_secret_value(SecretId=SECRET_ARN)
    return response['SecretString']


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
    Exchange code for token, check org membership, redirect to frontend.
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

        # Redirect to frontend with results
        return redirect_to_frontend_with_result(
            state=state,
            username=username,
            is_member=membership['is_member'],
            is_owner=membership['is_owner']
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


def redirect_to_frontend_with_result(state, username, is_member, is_owner):
    """Redirect to frontend with successful authentication result."""
    # Parse original state to extract frontend redirect URI if present
    original_state = state
    frontend_redirect = None

    if '|' in state:
        parts = state.split('|', 1)
        original_state = parts[0]
        frontend_redirect = parts[1] if len(parts) > 1 else None

    # Build redirect URL
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

        return json_response(200, {
            'status': 'success',
            'username': username,
            'is_member': membership['is_member'],
            'is_owner': membership['is_owner'],
            'organization': GITHUB_ORG
        })

    except Exception as e:
        print(f"Error in device poll: {str(e)}")
        return json_response(500, {
            'status': 'error',
            'error': 'internal_error',
            'error_description': str(e)
        })
