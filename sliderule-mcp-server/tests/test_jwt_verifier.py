"""Tests for JwtVerifier — JWT validation via JWKS."""

import json
import time
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from sliderule_mcp.jwt_verifier import JwtVerifier


AUDIENCE = "https://mcp.slideruleearth.io"
ISSUER = "https://login.slideruleearth.io"
JWKS_URL = "https://login.slideruleearth.io/.well-known/jwks.json"


@pytest.fixture
def verifier():
    return JwtVerifier(jwks_url=JWKS_URL, audience=AUDIENCE, issuer=ISSUER)


def _mock_jwks_response(jwks_dict):
    """Create a mock httpx response returning the JWKS dict."""
    resp = AsyncMock(spec=httpx.Response)
    resp.json.return_value = jwks_dict
    resp.raise_for_status = lambda: None
    return resp


# ── Valid token ───────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_valid_token(verifier, jwks_dict, make_token):
    token = make_token()

    with patch("sliderule_mcp.jwt_verifier.httpx.AsyncClient") as MockClient:
        client = AsyncMock()
        client.get.return_value = _mock_jwks_response(jwks_dict)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await verifier.verify_token(token)

    assert result is not None
    assert result.client_id == "testuser"
    assert result.token == token


# ── Expired token ─────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_expired_token(verifier, jwks_dict, make_token):
    token = make_token(exp_offset=-3600)  # expired 1 hour ago

    with patch("sliderule_mcp.jwt_verifier.httpx.AsyncClient") as MockClient:
        client = AsyncMock()
        client.get.return_value = _mock_jwks_response(jwks_dict)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await verifier.verify_token(token)

    assert result is None


# ── Wrong audience ────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_wrong_audience(verifier, jwks_dict, make_token):
    token = make_token(aud="https://wrong.example.com")

    with patch("sliderule_mcp.jwt_verifier.httpx.AsyncClient") as MockClient:
        client = AsyncMock()
        client.get.return_value = _mock_jwks_response(jwks_dict)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await verifier.verify_token(token)

    assert result is None


# ── Wrong issuer ──────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_wrong_issuer(verifier, jwks_dict, make_token):
    token = make_token(iss="https://evil.example.com")

    with patch("sliderule_mcp.jwt_verifier.httpx.AsyncClient") as MockClient:
        client = AsyncMock()
        client.get.return_value = _mock_jwks_response(jwks_dict)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await verifier.verify_token(token)

    assert result is None


# ── Missing sub claim ─────────────────────────────────────────────
@pytest.mark.asyncio
async def test_missing_sub(verifier, jwks_dict, rsa_keypair):
    """A token without sub should be rejected."""
    import jwt as pyjwt

    private_key, _ = rsa_keypair
    now = int(time.time())
    token = pyjwt.encode(
        {"aud": AUDIENCE, "iss": ISSUER, "iat": now, "exp": now + 3600},
        private_key,
        algorithm="RS256",
        headers={"kid": "test-key-1"},
    )

    with patch("sliderule_mcp.jwt_verifier.httpx.AsyncClient") as MockClient:
        client = AsyncMock()
        client.get.return_value = _mock_jwks_response(jwks_dict)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await verifier.verify_token(token)

    assert result is None


# ── Wrong kid (no matching key) ───────────────────────────────────
@pytest.mark.asyncio
async def test_wrong_kid(verifier, jwks_dict, make_token):
    token = make_token(kid="nonexistent-key-id")

    with patch("sliderule_mcp.jwt_verifier.httpx.AsyncClient") as MockClient:
        client = AsyncMock()
        client.get.return_value = _mock_jwks_response(jwks_dict)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await verifier.verify_token(token)

    assert result is None


# ── Tampered token (signature doesn't match) ─────────────────────
@pytest.mark.asyncio
async def test_tampered_token(verifier, jwks_dict, make_token):
    token = make_token()
    # Flip a character in the signature portion
    parts = token.split(".")
    sig = parts[2]
    tampered_char = "A" if sig[0] != "A" else "B"
    parts[2] = tampered_char + sig[1:]
    tampered_token = ".".join(parts)

    with patch("sliderule_mcp.jwt_verifier.httpx.AsyncClient") as MockClient:
        client = AsyncMock()
        client.get.return_value = _mock_jwks_response(jwks_dict)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await verifier.verify_token(tampered_token)

    assert result is None


# ── JWKS cache reuse ──────────────────────────────────────────────
@pytest.mark.asyncio
async def test_jwks_cache_reuse(verifier, jwks_dict, make_token):
    """Second call should use cached JWKS, not fetch again."""
    token1 = make_token(sub="user1")
    token2 = make_token(sub="user2")

    with patch("sliderule_mcp.jwt_verifier.httpx.AsyncClient") as MockClient:
        client = AsyncMock()
        client.get.return_value = _mock_jwks_response(jwks_dict)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        r1 = await verifier.verify_token(token1)
        r2 = await verifier.verify_token(token2)

    assert r1 is not None and r1.client_id == "user1"
    assert r2 is not None and r2.client_id == "user2"
    # JWKS should only be fetched once (cached)
    assert client.get.call_count == 1


# ── JWKS fetch failure ────────────────────────────────────────────
@pytest.mark.asyncio
async def test_jwks_fetch_failure(make_token):
    """If JWKS endpoint is unreachable, verification should return None."""
    verifier = JwtVerifier(jwks_url=JWKS_URL, audience=AUDIENCE, issuer=ISSUER)
    token = make_token()

    with patch("sliderule_mcp.jwt_verifier.httpx.AsyncClient") as MockClient:
        client = AsyncMock()
        client.get.side_effect = httpx.ConnectError("Connection refused")
        MockClient.return_value.__aenter__ = AsyncMock(return_value=client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await verifier.verify_token(token)

    assert result is None


# ── Token expiry is passed through ────────────────────────────────
@pytest.mark.asyncio
async def test_expires_at_passed_through(verifier, jwks_dict, make_token):
    token = make_token(exp_offset=7200)

    with patch("sliderule_mcp.jwt_verifier.httpx.AsyncClient") as MockClient:
        client = AsyncMock()
        client.get.return_value = _mock_jwks_response(jwks_dict)
        MockClient.return_value.__aenter__ = AsyncMock(return_value=client)
        MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await verifier.verify_token(token)

    assert result is not None
    assert result.expires_at is not None
    assert result.expires_at > time.time()
