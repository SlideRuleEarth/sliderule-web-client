"""
Tests for GitHub OAuth Lambda Handler security fixes.

These tests cover:
1. HMAC-signed OAuth state validation (CSRF protection)
2. Redirect URI scheme validation (prevent javascript:/data: schemes)
3. Org membership error handling (don't silently degrade on errors)
4. HTTP request timeouts
"""

import base64
import hashlib
import hmac
import json
import sys
import time
import unittest
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

# Mock dependencies before importing handler (not available in local dev)
sys.modules['boto3'] = MagicMock()
mock_jwt = MagicMock()
mock_jwt.encode = MagicMock(return_value='mock-jwt-token')
sys.modules['jwt'] = mock_jwt

# Mock environment variables before importing handler
import os
os.environ['GITHUB_CLIENT_ID'] = 'test-client-id'
os.environ['GITHUB_ORG'] = 'TestOrg'
os.environ['FRONTEND_URL'] = 'https://testsliderule.org'
os.environ['CLIENT_SECRET_NAME'] = 'test-secret'
os.environ['JWT_SIGNING_KEY_ARN'] = 'test-jwt-key-arn'

# Import after setting env vars and mocking boto3
import handler


class TestSignedState(unittest.TestCase):
    """Tests for HMAC-signed OAuth state (CSRF protection)."""

    @patch('handler.get_hmac_signing_key')
    def test_create_signed_state_without_redirect(self, mock_key):
        """State without redirect_uri should have empty b64 component."""
        mock_key.return_value = 'test-signing-key'

        state = handler.create_signed_state()
        parts = state.split(':')

        self.assertEqual(len(parts), 4)
        nonce, timestamp, redirect_b64, signature = parts
        self.assertTrue(len(nonce) > 0)
        self.assertTrue(timestamp.isdigit())
        self.assertEqual(redirect_b64, '')  # No redirect URI
        self.assertTrue(len(signature) == 64)  # SHA256 hex

    @patch('handler.get_hmac_signing_key')
    def test_create_signed_state_with_redirect(self, mock_key):
        """State with redirect_uri should encode it in base64."""
        mock_key.return_value = 'test-signing-key'
        redirect = 'https://example.com/callback'

        state = handler.create_signed_state(redirect)
        parts = state.split(':')

        self.assertEqual(len(parts), 4)
        redirect_b64 = parts[2]
        decoded = base64.urlsafe_b64decode(redirect_b64.encode()).decode()
        self.assertEqual(decoded, redirect)

    @patch('handler.get_hmac_signing_key')
    def test_verify_valid_state(self, mock_key):
        """Valid state should verify successfully."""
        mock_key.return_value = 'test-signing-key'
        redirect = 'https://testsliderule.org/callback'

        state = handler.create_signed_state(redirect)
        is_valid, extracted_redirect, error = handler.verify_signed_state(state)

        self.assertTrue(is_valid)
        self.assertEqual(extracted_redirect, redirect)
        self.assertIsNone(error)

    @patch('handler.get_hmac_signing_key')
    def test_verify_tampered_state(self, mock_key):
        """Tampered state should fail verification."""
        mock_key.return_value = 'test-signing-key'

        state = handler.create_signed_state()
        # Tamper with the nonce
        parts = state.split(':')
        parts[0] = 'tampered-nonce'
        tampered_state = ':'.join(parts)

        is_valid, redirect, error = handler.verify_signed_state(tampered_state)

        self.assertFalse(is_valid)
        self.assertIsNone(redirect)
        self.assertEqual(error, "Invalid state signature")

    @patch('handler.get_hmac_signing_key')
    def test_verify_expired_state(self, mock_key):
        """Expired state should fail verification."""
        mock_key.return_value = 'test-signing-key'

        # Create state with old timestamp
        nonce = 'test-nonce'
        old_timestamp = str(int(datetime.now(timezone.utc).timestamp()) - 700)  # 11+ minutes ago
        redirect_b64 = ''
        message = f"{nonce}:{old_timestamp}:{redirect_b64}"
        signature = hmac.new(
            'test-signing-key'.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        expired_state = f"{message}:{signature}"

        is_valid, redirect, error = handler.verify_signed_state(expired_state)

        self.assertFalse(is_valid)
        self.assertEqual(error, "State has expired")

    def test_verify_missing_state(self):
        """Missing state should fail verification."""
        is_valid, redirect, error = handler.verify_signed_state('')

        self.assertFalse(is_valid)
        self.assertEqual(error, "Missing state parameter")

    def test_verify_malformed_state(self):
        """Malformed state should fail verification."""
        is_valid, redirect, error = handler.verify_signed_state('not:enough:parts')

        self.assertFalse(is_valid)
        self.assertEqual(error, "Invalid state format")


class TestRedirectUriValidation(unittest.TestCase):
    """Tests for redirect URI validation (scheme + host)."""

    def test_valid_https_allowed_host(self):
        """HTTPS to allowed host should pass."""
        self.assertTrue(handler.is_valid_redirect_uri('https://testsliderule.org/callback'))
        self.assertTrue(handler.is_valid_redirect_uri('https://client.slideruleearth.io/auth'))
        self.assertTrue(handler.is_valid_redirect_uri('https://localhost/callback'))

    def test_valid_http_localhost(self):
        """HTTP to localhost should pass."""
        self.assertTrue(handler.is_valid_redirect_uri('http://localhost/callback'))
        self.assertTrue(handler.is_valid_redirect_uri('http://localhost:3000/callback'))
        self.assertTrue(handler.is_valid_redirect_uri('http://127.0.0.1/callback'))
        self.assertTrue(handler.is_valid_redirect_uri('http://127.0.0.1:8080/auth'))

    def test_invalid_http_non_localhost(self):
        """HTTP to non-localhost should fail."""
        self.assertFalse(handler.is_valid_redirect_uri('http://testsliderule.org/callback'))
        self.assertFalse(handler.is_valid_redirect_uri('http://example.com/callback'))
        self.assertFalse(handler.is_valid_redirect_uri('http://client.slideruleearth.io/callback'))
        self.assertFalse(handler.is_valid_redirect_uri('http://app.testsliderule.org/callback'))

    def test_invalid_javascript_scheme(self):
        """JavaScript scheme should fail (XSS prevention)."""
        self.assertFalse(handler.is_valid_redirect_uri('javascript://testsliderule.org/%0Aalert(1)'))
        self.assertFalse(handler.is_valid_redirect_uri('javascript:alert(1)'))

    def test_invalid_data_scheme(self):
        """Data scheme should fail."""
        self.assertFalse(handler.is_valid_redirect_uri('data:text/html,<script>alert(1)</script>'))

    def test_invalid_ftp_scheme(self):
        """FTP scheme should fail."""
        self.assertFalse(handler.is_valid_redirect_uri('ftp://testsliderule.org/file'))

    def test_invalid_unauthorized_host(self):
        """Unauthorized host should fail."""
        self.assertFalse(handler.is_valid_redirect_uri('https://evil.com/steal-token'))
        self.assertFalse(handler.is_valid_redirect_uri('https://attacker.io/callback'))

    def test_empty_and_none(self):
        """Empty or None URI should fail."""
        self.assertFalse(handler.is_valid_redirect_uri(''))
        self.assertFalse(handler.is_valid_redirect_uri(None))

    def test_subdomain_of_allowed_host(self):
        """Subdomain of allowed host should pass."""
        self.assertTrue(handler.is_valid_redirect_uri('https://app.testsliderule.org/callback'))
        self.assertTrue(handler.is_valid_redirect_uri('https://staging.client.slideruleearth.io/auth'))


class TestOrgMembershipErrorHandling(unittest.TestCase):
    """Tests for org membership check error handling."""

    @patch('handler.requests.get')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_membership_success(self, mock_get):
        """Successful membership check should return correct flags."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'state': 'active', 'role': 'member'}
        mock_get.return_value = mock_response

        result = handler.check_org_membership('token', 'testuser')

        self.assertTrue(result['is_org_member'])
        self.assertFalse(result['is_org_owner'])

    @patch('handler.requests.get')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_membership_owner(self, mock_get):
        """Owner membership check should set is_org_owner flag."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'state': 'active', 'role': 'admin'}
        mock_get.return_value = mock_response

        result = handler.check_org_membership('token', 'testuser')

        self.assertTrue(result['is_org_member'])
        self.assertTrue(result['is_org_owner'])

    @patch('handler.requests.get')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_membership_not_found(self, mock_get):
        """404 should return not a member (expected for non-members)."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response

        result = handler.check_org_membership('token', 'testuser')

        self.assertFalse(result['is_org_member'])
        self.assertFalse(result['is_org_owner'])

    @patch('handler.requests.get')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_membership_rate_limit_raises(self, mock_get):
        """429 rate limit should raise exception, not silently degrade."""
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_get.return_value = mock_response

        with self.assertRaises(Exception) as context:
            handler.check_org_membership('token', 'testuser')

        self.assertIn('rate limit', str(context.exception).lower())

    @patch('handler.requests.get')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_membership_server_error_raises(self, mock_get):
        """5xx errors should raise exception, not silently degrade."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_get.return_value = mock_response

        with self.assertRaises(Exception) as context:
            handler.check_org_membership('token', 'testuser')

        self.assertIn('unavailable', str(context.exception).lower())

    @patch('handler.requests.get')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_membership_unexpected_error_raises(self, mock_get):
        """Unexpected errors should raise exception, not silently degrade."""
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = 'Forbidden'
        mock_get.return_value = mock_response

        with self.assertRaises(Exception) as context:
            handler.check_org_membership('token', 'testuser')

        self.assertIn('403', str(context.exception))


class TestHttpTimeouts(unittest.TestCase):
    """Tests to verify HTTP timeouts are set on all requests."""

    @patch('handler.requests.post')
    @patch('handler.get_github_client_secret')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_exchange_code_has_timeout(self, mock_secret, mock_post):
        """exchange_code_for_token should set timeout."""
        mock_secret.return_value = 'secret'
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'access_token': 'token'}
        mock_post.return_value = mock_response

        event = {'headers': {'host': 'test.com'}}
        handler.exchange_code_for_token('code', event)

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        self.assertEqual(call_kwargs['timeout'], 15)

    @patch('handler.requests.get')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_get_github_user_has_timeout(self, mock_get):
        """get_github_user should set timeout."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'login': 'testuser'}
        mock_get.return_value = mock_response

        handler.get_github_user('token')

        mock_get.assert_called_once()
        call_kwargs = mock_get.call_args[1]
        self.assertEqual(call_kwargs['timeout'], 15)

    @patch('handler.requests.get')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_check_org_membership_has_timeout(self, mock_get):
        """check_org_membership should set timeout."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'state': 'active', 'role': 'member'}
        mock_get.return_value = mock_response

        handler.check_org_membership('token', 'user')

        mock_get.assert_called_once()
        call_kwargs = mock_get.call_args[1]
        self.assertEqual(call_kwargs['timeout'], 15)

    @patch('handler.requests.get')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_get_user_team_membership_has_timeout(self, mock_get):
        """get_user_team_membership should set timeout."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {'state': 'active', 'role': 'member'}
        mock_get.return_value = mock_response

        handler.get_user_team_membership('token', 'team-slug', 'user')

        mock_get.assert_called_once()
        call_kwargs = mock_get.call_args[1]
        self.assertEqual(call_kwargs['timeout'], 15)

    @patch('handler.requests.post')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_device_code_request_has_timeout(self, mock_post):
        """handle_device_code_request should set timeout."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            'device_code': 'dc',
            'user_code': 'uc',
            'verification_uri': 'https://github.com/login/device'
        }
        mock_post.return_value = mock_response

        handler.handle_device_code_request({})

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        self.assertEqual(call_kwargs['timeout'], 15)

    @patch('handler.requests.post')
    @patch('handler.get_github_client_secret')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_device_poll_has_timeout(self, mock_secret, mock_post):
        """handle_device_poll should set timeout."""
        mock_secret.return_value = 'secret'
        mock_response = MagicMock()
        mock_response.json.return_value = {'error': 'authorization_pending'}
        mock_post.return_value = mock_response

        event = {'body': json.dumps({'device_code': 'test-code'})}
        handler.handle_device_poll(event)

        mock_post.assert_called_once()
        call_kwargs = mock_post.call_args[1]
        self.assertEqual(call_kwargs['timeout'], 15)


class TestHandleCallback(unittest.TestCase):
    """Tests for OAuth callback handler with state validation."""

    @patch('handler.get_hmac_signing_key')
    def test_callback_rejects_invalid_state(self, mock_key):
        """Callback should reject requests with invalid state."""
        mock_key.return_value = 'test-signing-key'

        event = {
            'queryStringParameters': {
                'code': 'valid-code',
                'state': 'invalid:state:format'
            }
        }

        result = handler.handle_callback(event)

        self.assertEqual(result['statusCode'], 302)
        # URL-encoded: "Security error" becomes "Security+error"
        self.assertIn('Security+error', result['headers']['Location'])

    @patch('handler.get_hmac_signing_key')
    def test_callback_rejects_tampered_state(self, mock_key):
        """Callback should reject requests with tampered state."""
        mock_key.return_value = 'test-signing-key'

        # Create valid state then tamper with it
        valid_state = handler.create_signed_state()
        parts = valid_state.split(':')
        parts[0] = 'tampered'
        tampered_state = ':'.join(parts)

        event = {
            'queryStringParameters': {
                'code': 'valid-code',
                'state': tampered_state
            }
        }

        result = handler.handle_callback(event)

        self.assertEqual(result['statusCode'], 302)
        # URL-encoded: "Security error" becomes "Security+error"
        self.assertIn('Security+error', result['headers']['Location'])

    @patch('handler.get_hmac_signing_key')
    def test_callback_rejects_missing_state(self, mock_key):
        """Callback should reject requests with missing state."""
        mock_key.return_value = 'test-signing-key'

        event = {
            'queryStringParameters': {
                'code': 'valid-code'
            }
        }

        result = handler.handle_callback(event)

        self.assertEqual(result['statusCode'], 302)
        # URL-encoded: "Security error" becomes "Security+error"
        self.assertIn('Security+error', result['headers']['Location'])


class TestUserTeamsApi(unittest.TestCase):
    """Tests for user teams API (uses /user/teams instead of /orgs/{org}/teams)."""

    @patch('handler.get_user_team_membership')
    @patch('handler.requests.get')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_get_user_teams_uses_user_teams_endpoint(self, mock_get, mock_membership):
        """get_user_teams should use /user/teams endpoint."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = []
        mock_get.return_value = mock_response

        handler.get_user_teams('token', 'testuser')

        mock_get.assert_called()
        call_url = mock_get.call_args[0][0]
        self.assertIn('/user/teams', call_url)
        self.assertNotIn('/orgs/', call_url)

    @patch('handler.get_user_team_membership')
    @patch('handler.requests.get')
    @patch('handler.HTTP_TIMEOUT_SECONDS', 15)
    def test_get_user_teams_filters_by_org(self, mock_get, mock_membership):
        """get_user_teams should filter teams by organization."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = [
            {'slug': 'team1', 'organization': {'login': 'TestOrg'}},
            {'slug': 'team2', 'organization': {'login': 'OtherOrg'}},
            {'slug': 'team3', 'organization': {'login': 'TestOrg'}},
        ]
        mock_get.return_value = mock_response
        mock_membership.return_value = {'role': 'member'}

        teams, roles = handler.get_user_teams('token', 'testuser')

        # Should only include teams from TestOrg
        self.assertEqual(teams, ['team1', 'team3'])
        self.assertNotIn('team2', teams)


if __name__ == '__main__':
    unittest.main()
