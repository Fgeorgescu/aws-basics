# API Gateway — Auth & Authorization

## API Types

| Type | Use Case | Auth Options |
|---|---|---|
| **REST API** | Full-featured, legacy | All methods |
| **HTTP API** | Low-latency, cheaper (~70% cost reduction) | JWT, IAM, Lambda |
| **WebSocket API** | Bidirectional, real-time | Lambda, IAM |

## Auth Methods Comparison

| Method | Who validates | Token type | Best for |
|---|---|---|---|
| **Cognito User Pools** | API GW natively | JWT (ID/Access token) | End-user auth, mobile/web apps |
| **Lambda authorizer (token)** | Your Lambda | Any (JWT, OAuth, SAML, API key) | Custom logic, 3rd-party IdP |
| **Lambda authorizer (request)** | Your Lambda | Headers, query params, stage vars | IP allow-list, multi-header logic |
| **IAM auth** | AWS SigV4 | AWS credentials | Service-to-service, AWS principals |
| **API keys** | API GW | String key | Usage tracking, throttle per client |
| **None** | — | — | Public endpoints |

## Cognito User Pools Authorizer

- API GW validates the JWT signature + expiry against the Cognito JWKS endpoint — no Lambda needed
- Validates `aud` (client ID) and `iss` (User Pool URL)
- ID token or Access token accepted; Access token preferred for API calls
- Token refresh handled client-side; API GW sees only the current token
- **Not available on HTTP API** — use JWT authorizer instead

## JWT Authorizer (HTTP API only)

```
issuer:   https://cognito-idp.<region>.amazonaws.com/<user-pool-id>
audience: [<app-client-id>]
```

- Lighter than Cognito authorizer; no AWS-specific SDK needed
- Works with any OIDC-compliant provider (Auth0, Okta, Cognito)
- Validates `iss`, `aud`, `exp` only — no scope enforcement unless you add Lambda

## Lambda Authorizer

### Token-based
```
Authorization: Bearer <token>
```
- Lambda receives token string, returns IAM policy (`Allow`/`Deny`) + optional context
- Cache key = token value; TTL 0–3600 s (default 300 s)

### Request-based
- Lambda receives full request context (headers, path, query, stage variables)
- Use when auth depends on multiple inputs

### Policy document returned
```json
{
  "principalId": "user123",
  "policyDocument": {
    "Version": "2012-10-17",
    "Statement": [{ "Effect": "Allow", "Action": "execute-api:Invoke",
                    "Resource": "arn:aws:execute-api:*:*:*" }]
  },
  "context": { "userId": "user123", "tier": "premium" }
}
```
- `context` fields are injected into `$context.authorizer.*` — pass to backends via mapping templates

## IAM Authorization

- Client signs request with SigV4 (AWS SDK does this automatically)
- Useful for Lambda → API GW, ECS → API GW, cross-account with assumed role
- Resource policy can restrict by `aws:SourceIp`, `aws:PrincipalOrgID`, VPC endpoint ID
- Combine with **VPC endpoint** to create fully private APIs

## Resource Policies

```json
{
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "execute-api:Invoke",
    "Resource": "arn:aws:execute-api:<region>:<account>:<api-id>/*",
    "Condition": { "IpAddress": { "aws:SourceIp": ["203.0.113.0/24"] } }
  }]
}
```

- Applied before any authorizer — deny here means hard reject
- Use to: restrict by IP, allow only your VPC endpoint, allow cross-account principals
- **Private API** requires both a VPC endpoint policy AND a resource policy `Allow`

## Usage Plans & API Keys

- API key sent in `x-api-key` header (not a security mechanism — rate control only)
- Usage plan defines: throttle (requests/s + burst), quota (requests/day or month)
- Associate usage plan → API stage + API key
- Keys are rotatable; clients get new key without code change

## mTLS (Mutual TLS)

- Client presents a certificate; API GW validates against a truststore (S3 object)
- Supported on custom domain names only (not execute-api default endpoint)
- Combine with Lambda authorizer for additional claim validation

## WAF Integration

- Attach AWS WAF WebACL to API GW stage
- Blocks SQLi, XSS, rate-based rules, IP reputation lists before auth runs
- Evaluated before Lambda authorizer / Cognito check

## Decision Guide

```
Is it service-to-service within AWS?
  → IAM auth + resource policy (or VPC endpoint for private)

Is it end-user (browser/mobile) with Cognito?
  → HTTP API + JWT authorizer  (or REST API + Cognito authorizer)

Custom token / 3rd-party IdP / complex logic?
  → Lambda authorizer (token-based)

Auth requires multiple headers or IP logic?
  → Lambda authorizer (request-based)

Just rate-limit/quota per client, no real auth?
  → API keys + usage plan
```

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| Authorizer cache returns stale `Deny` | Set cache TTL = 0 during rollout, or use unique cache key |
| ID token instead of Access token rejected by scopes | Use Access token for API calls; ID token for identity only |
| Resource policy `Deny` blocking everything | Check implicit deny — must have explicit `Allow` too |
| Lambda authorizer cold start adds latency | Enable provisioned concurrency on authorizer Lambda |
| HTTP API missing Cognito native authorizer | Use JWT authorizer with Cognito as OIDC issuer |
