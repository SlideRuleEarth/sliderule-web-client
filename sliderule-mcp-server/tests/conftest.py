"""Shared test fixtures: RSA keypair, JWT helpers, mock WebSockets."""

import asyncio
import json
import time
from dataclasses import dataclass, field

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from jwt import PyJWK


# ── RSA keypair for signing test JWTs ─────────────────────────────
@pytest.fixture(scope="session")
def rsa_keypair():
    """Generate a throwaway RSA keypair for test JWT signing."""
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    public_key = private_key.public_key()
    return private_key, public_key


@pytest.fixture(scope="session")
def jwks_dict(rsa_keypair):
    """JWKS dict matching the test keypair."""
    _, public_key = rsa_keypair
    der = public_key.public_bytes(
        serialization.Encoding.DER,
        serialization.PublicFormat.SubjectPublicKeyInfo,
    )
    jwk = PyJWK.from_json(
        json.dumps(
            jwt.algorithms.RSAAlgorithm.to_jwk(public_key, as_dict=True)
            | {"kid": "test-key-1", "alg": "RS256", "use": "sig"}
        )
    )
    return {
        "keys": [
            jwt.algorithms.RSAAlgorithm.to_jwk(public_key, as_dict=True)
            | {"kid": "test-key-1", "alg": "RS256", "use": "sig"}
        ]
    }


@pytest.fixture
def make_token(rsa_keypair):
    """Factory to mint test JWTs with custom claims."""
    private_key, _ = rsa_keypair

    def _make(
        sub="testuser",
        aud="https://mcp.slideruleearth.io",
        iss="https://login.slideruleearth.io",
        exp_offset=3600,
        kid="test-key-1",
        extra_claims=None,
    ):
        now = int(time.time())
        payload = {
            "sub": sub,
            "aud": aud,
            "iss": iss,
            "iat": now,
            "exp": now + exp_offset,
        }
        if extra_claims:
            payload.update(extra_claims)
        return jwt.encode(
            payload,
            private_key,
            algorithm="RS256",
            headers={"kid": kid},
        )

    return _make


# ── Mock WebSocket ────────────────────────────────────────────────
@dataclass
class MockWebSocket:
    """Minimal mock of a Starlette WebSocket for testing SessionRouter."""

    sent_messages: list[str] = field(default_factory=list)
    closed: bool = False
    close_code: int | None = None
    close_reason: str = ""
    _incoming: asyncio.Queue = field(default_factory=asyncio.Queue)

    async def send_text(self, data: str) -> None:
        self.sent_messages.append(data)

    async def receive_text(self) -> str:
        return await self._incoming.get()

    async def close(self, code: int = 1000, reason: str = "") -> None:
        self.closed = True
        self.close_code = code
        self.close_reason = reason

    def inject_message(self, data: str) -> None:
        """Inject a message as if the browser sent it."""
        self._incoming.put_nowait(data)
