"""JWT verification via JWKS for the remote MCP server.

Verifies JWTs issued by the SlideRule authenticator by fetching the public key
from the JWKS endpoint and checking RS256 signatures locally.
"""

import logging
import time

import httpx
import jwt
from jwt import PyJWK

from mcp.server.auth.provider import AccessToken

log = logging.getLogger("sliderule-mcp")

JWKS_CACHE_TTL = 300  # seconds


class JwtVerifier:
    """Verifies SlideRule JWTs using the authenticator's JWKS endpoint.

    Implements the MCP SDK TokenVerifier protocol.
    """

    def __init__(self, jwks_url: str, audience: str, issuer: str):
        self._jwks_url = jwks_url
        self._audience = audience
        self._issuer = issuer
        self._jwks_cache: dict | None = None
        self._jwks_fetched_at: float = 0

    async def _get_signing_key(self, token: str) -> jwt.algorithms.RSAPublicKey:
        """Fetch JWKS and return the signing key matching the token's kid."""
        now = time.time()
        if self._jwks_cache is None or (now - self._jwks_fetched_at) > JWKS_CACHE_TTL:
            async with httpx.AsyncClient() as client:
                resp = await client.get(self._jwks_url, timeout=10)
                resp.raise_for_status()
                self._jwks_cache = resp.json()
                self._jwks_fetched_at = now
                log.info("Fetched JWKS from %s (%d keys)", self._jwks_url, len(self._jwks_cache.get("keys", [])))

        headers = jwt.get_unverified_header(token)
        kid = headers.get("kid")

        for key_data in self._jwks_cache.get("keys", []):
            if key_data.get("kid") == kid or kid is None:
                return PyJWK(key_data).key

        raise jwt.exceptions.InvalidKeyError(f"No matching key found for kid={kid}")

    async def verify_token(self, token: str) -> AccessToken | None:
        """Verify a Bearer JWT and return AccessToken if valid.

        Implements the MCP SDK TokenVerifier protocol.
        Returns None with a logged reason on any failure.
        """
        try:
            signing_key = await self._get_signing_key(token)
            payload = jwt.decode(
                token,
                signing_key,
                algorithms=["RS256"],
                audience=self._audience,
                issuer=self._issuer,
            )
            sub = payload.get("sub")
            if not sub:
                log.info("JWT rejected: missing sub claim")
                return None
            return AccessToken(
                token=token,
                client_id=sub,
                scopes=payload.get("scopes", []),
                expires_at=payload.get("exp"),
            )
        except jwt.ExpiredSignatureError:
            log.info("JWT rejected: token expired")
            return None
        except jwt.InvalidTokenError as e:
            log.info("JWT rejected: %s", e)
            return None
        except httpx.HTTPError as e:
            log.warning("JWT verification failed: could not fetch JWKS: %s", e)
            return None

