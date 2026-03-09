# Keycloak Local OAuth2.1 Test Server

Test the web client's OAuth2.1 implementation against a standards-compliant authorization server.

## Quick Start

```bash
# 1. Start Keycloak (imports the sliderule realm automatically)
cd keycloak
docker compose up -d

# 2. Wait for Keycloak to be ready (~30s)
curl -sf http://localhost:8080/realms/sliderule/.well-known/openid-configuration | jq .issuer

# 3. Copy the env override into the web client
cp keycloak/env.keycloak web-client/.env.local

# 4. Start the web client dev server
cd web-client
npm run dev
```

Open http://localhost:5173 and click Login. You'll be redirected to Keycloak's login page.

## Test Credentials

| Username     | Password   | Role   |
|-------------|-----------|--------|
| testuser    | testpass  | (none) |
| testmember  | testpass  | member |

## What Gets Tested

The web client performs the full OAuth2.1 flow against Keycloak:

1. **Discovery** — fetches `/.well-known/openid-configuration` from Keycloak
2. **Dynamic Client Registration (RFC 7591)** — registers a public client via Keycloak's DCR endpoint
3. **Authorization Code + PKCE (S256)** — redirects to Keycloak's login page with code_challenge
4. **Token Exchange** — exchanges the authorization code + code_verifier for an access token

## Keycloak Admin Console

- URL: http://localhost:8080/admin
- Username: `admin`
- Password: `admin`

From the admin console you can inspect clients, tokens, sessions, and events to debug the OAuth flow.

## Pre-registered Static Client

For testing without DCR, a static client `sliderule-web-client-static` is included in the realm.
To use it, set `clientId` in the auth store before initiating login (or temporarily hardcode it).

## Keycloak DCR Note

Keycloak's DCR is enabled by default for the realm. Anonymous registration creates clients with
limited permissions. The `registration_endpoint` is included in the OIDC discovery metadata.

## Cleanup

```bash
docker compose down -v   # removes container and volumes
```
