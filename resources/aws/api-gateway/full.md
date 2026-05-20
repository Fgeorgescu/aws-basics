# API Gateway — Auth & Authorization (Full)

## Why API Gateway Auth Matters in Interviews

API Gateway sits at the edge of your AWS workload — it's the first thing that touches a request before any Lambda, ECS, or EC2 backend sees it. Every auth decision you make here has cost, latency, and security trade-offs that interviewers probe. The core question is always: *who validates the token, what does that cost, and what happens when it fails?*

---

## The Three Flavours of API Gateway

Before choosing an auth method, you need to pick the right API type — they don't all support the same authorizers.

| | REST API | HTTP API | WebSocket API |
|---|---|---|---|
| Relative cost | 1× | ~0.3× | — |
| Cognito authorizer | ✅ native | ❌ use JWT | ❌ |
| JWT authorizer | ❌ | ✅ | ❌ |
| Lambda authorizer | ✅ | ✅ | ✅ |
| IAM (SigV4) | ✅ | ✅ | ✅ |
| API keys | ✅ | ❌ | ❌ |
| WAF | ✅ | ✅ | ❌ |

**HTTP API** is the right default for new greenfield work unless you need REST-only features (request validation, custom gateway responses, edge caching via CloudFront integration, or WAF on HTTP API is fine). It is significantly cheaper and lower latency.

---

## Cognito User Pools Authorizer (REST API)

This is the zero-code auth path for Cognito-backed applications. API Gateway itself validates the JWT — your backend never touches the token.

**What it validates:**
- Token signature (against the User Pool's JWKS endpoint `https://cognito-idp.<region>.amazonaws.com/<poolId>/.well-known/jwks.json`)
- Expiry (`exp` claim)
- Issuer (`iss`) matches the configured User Pool
- Audience (`aud`) matches the configured App Client ID

**ID token vs Access token:**
Both are JWTs but serve different purposes. The ID token carries user attributes (email, name, custom claims) and is meant for the client to know who the user is. The Access token carries scopes and is meant to authorize API calls. Always use the Access token when calling APIs — it has a shorter default expiry and scope enforcement is cleaner.

**Scopes:** REST API + Cognito authorizer can enforce OAuth scopes (`read:items`, `write:orders`) declared on the method. If the token's scope list doesn't include the required scope, API GW returns 403 before your Lambda is invoked.

**Limitation:** Native Cognito authorizer only works on REST API. On HTTP API you need the JWT authorizer.

---

## JWT Authorizer (HTTP API)

HTTP API's JWT authorizer is provider-agnostic — it works with any OIDC-compliant IdP including Cognito, Auth0, and Okta. You supply two values:

```
issuer:   https://cognito-idp.eu-west-1.amazonaws.com/eu-west-1_abc123
audience: [my-app-client-id]
```

API Gateway fetches the JWKS from `<issuer>/.well-known/openid-configuration`, caches it, and validates signature + expiry + aud + iss on every request. There is no Lambda cold start, no cache TTL to tune — it's the cheapest authorizer to run.

**What it does NOT do:** scope enforcement, custom claim checks, revocation checks. If you need any of those, wrap it in a Lambda authorizer or check claims in your backend.

---

## Lambda Authorizer — The Escape Hatch

Use a Lambda authorizer when validation logic can't be expressed as a simple JWT check:
- Third-party tokens (SAML assertions, proprietary formats)
- Combining token validation with a database lookup (e.g., checking if a session has been revoked)
- IP-based allow/deny combined with token checks
- Multi-tenant routing where the tenant is derived from a header

### Token-based authorizer

The Lambda receives a single string — the value of the `Authorization` header (or a custom header). It returns an IAM policy document plus an optional `context` map.

```python
def handler(event, context):
    token = event["authorizationToken"]
    claims = verify_jwt(token)   # your validation logic
    
    return {
        "principalId": claims["sub"],
        "policyDocument": allow_policy(event["methodArn"]),
        "context": {
            "userId": claims["sub"],
            "orgId":  claims["custom:orgId"],
            "tier":   claims["custom:tier"],
        }
    }
```

The `context` values are injected into the integration request as `$context.authorizer.userId` etc. Pass them to your backend via a mapping template or integration request header — your Lambda function never needs to re-parse the token.

### Request-based authorizer

The Lambda receives the full request context: headers, query string parameters, path parameters, and stage variables. Use this when auth depends on more than one input — for example, an IP allowlist combined with an API key in a custom header.

### Caching

The authorizer result is cached by a configurable key. For token-based authorizers the cache key is the token value. For request-based you define the cache key from any combination of identity sources. Cache TTL defaults to 300 s; set it to 0 during development or you'll spend time wondering why permission changes aren't taking effect.

**Latency:** Lambda authorizers add cold-start latency on the first invocation after a period of inactivity. If p99 latency matters, enable provisioned concurrency on the authorizer Lambda.

---

## IAM Authorization

IAM auth is the right choice for service-to-service communication within AWS. The client signs the request with SigV4 using AWS credentials (access key + secret, or a role's short-lived credentials). API Gateway validates the signature against IAM without any Lambda invocation.

**Cross-account:** an EC2 or Lambda in account A can call an API in account B by assuming a role in account B and using those credentials to sign. The API's resource policy must explicitly allow the role ARN from account A.

**Private APIs:** A private API is only reachable through a VPC interface endpoint (`com.amazonaws.<region>.execute-api`). Even with a private API you must have:
1. A VPC endpoint policy allowing `execute-api:Invoke`
2. A resource policy on the API allowing the VPC endpoint ID

Both must say Allow — one `Deny` at either layer blocks the request.

---

## Resource Policies

Resource policies are evaluated *before* any authorizer. They're an IP firewall + principal filter at the API level.

Common patterns:

**IP allowlist:**
```json
{
  "Effect": "Allow",
  "Principal": "*",
  "Action": "execute-api:Invoke",
  "Resource": "arn:aws:execute-api:*:*:*",
  "Condition": { "IpAddress": { "aws:SourceIp": ["203.0.113.0/24"] } }
}
```

**Allow only from a specific VPC endpoint:**
```json
{
  "Effect": "Allow",
  "Principal": "*",
  "Action": "execute-api:Invoke",
  "Resource": "arn:aws:execute-api:*:*:*",
  "Condition": { "StringEquals": { "aws:sourceVpce": "vpce-0abc123def456" } }
}
```

**Cross-account access:**
```json
{
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::111122223333:role/CallerRole" },
  "Action": "execute-api:Invoke",
  "Resource": "arn:aws:execute-api:*:*:*"
}
```

A common interview gotcha: if you add a resource policy with no explicit Allow, implicit deny kicks in and all requests fail — even from your own account. You must have an explicit `Allow` for every principal that should have access.

---

## Usage Plans and API Keys

API keys are not a security mechanism — they provide no cryptographic guarantee. Their value is throttling and quota enforcement per consumer. Use them when:
- You're a SaaS offering API access to developers and need per-customer rate limits
- You want to track consumption by client without building a custom system

**Flow:**
1. Create an API key
2. Create a usage plan (throttle: X req/s, quota: Y req/day)
3. Associate the usage plan with an API stage
4. Associate the API key with the usage plan
5. Client sends `x-api-key: <value>` header

Combine API keys with a Lambda authorizer if you also need real authentication — the Lambda validates the actual identity, the API key controls the rate.

---

## Mutual TLS (mTLS)

mTLS requires the *client* to present a certificate that the server validates. This is common in B2B APIs and financial services where the client identity must be cryptographically proven.

**Setup:**
1. Build a truststore (PEM bundle of trusted CA certificates) and upload to S3
2. Enable mTLS on a custom domain name pointing at the API
3. API Gateway validates the client cert against the truststore at the TLS handshake
4. The validated certificate's distinguished name is available at `$context.identity.clientCert.*`

**Gotcha:** mTLS only works on custom domains, not the default `execute-api` endpoint. You must disable the default endpoint (`disableExecuteApiEndpoint: true`) or clients can bypass mTLS by hitting the default URL directly.

---

## WAF Integration

AWS WAF sits in front of API Gateway and evaluates rules before the request reaches your authorizer. This is where you block:
- Known malicious IPs / bot fingerprints (managed rule groups)
- Rate-based rules (e.g., no more than 100 req/5 min per IP regardless of auth)
- SQL injection and XSS pattern matches on request bodies
- Geographic blocks

WAF fires before Lambda authorizers, before Cognito validation, before anything in your code. A WAF block returns 403 and the request never reaches your API.

---

## Architecture Patterns

### Public API with end-user auth
```
Client → CloudFront → API Gateway (HTTP API)
                           ↓
                    JWT Authorizer (Cognito)
                           ↓
                    Lambda / ECS backend
```

### Internal service mesh
```
Lambda A (role: ServiceA) → API Gateway (REST API)
                                  ↓
                           IAM auth + resource policy
                                  ↓
                           Lambda B / private ECS
```

### Third-party token with custom claims
```
Client (Auth0 token) → API Gateway (REST API)
                             ↓
                      Lambda Authorizer
                      (verifies Auth0 JWT,
                       looks up permissions in DynamoDB,
                       returns context: { permissions })
                             ↓
                      Backend (reads $context.authorizer.permissions)
```

### B2B partner API
```
Partner (client cert + SigV4) → API Gateway (custom domain)
                                        ↓
                                 mTLS validation
                                        ↓
                                 IAM auth (assumed role per partner)
                                        ↓
                                 Lambda backend
```

---

## Interview Trade-offs to Know

**Cognito authorizer vs Lambda authorizer:**
Cognito is faster (no Lambda cold start), cheaper (no Lambda invocations), and zero-code. Lambda is more flexible — use it only when Cognito can't express your requirements.

**Token-based vs request-based Lambda authorizer:**
Request-based is more powerful but the cache key must be manually specified. If you forget to set a meaningful cache key, every request becomes a cold authorizer invocation and you lose the latency/cost benefit of caching entirely.

**REST API vs HTTP API for auth:**
HTTP API's JWT authorizer is cheaper and lower latency than REST API's Cognito authorizer for simple cases. The catch is HTTP API can't enforce OAuth scopes natively — scope enforcement has to move into your backend or a Lambda authorizer wrapper.

**What happens on authorizer timeout?**
If your Lambda authorizer times out (default 29 s max), API Gateway returns 500 to the client. This is a hard dependency — if your authorizer goes down, your entire API goes down. Keep authorizer Lambdas fast and stateless. Don't call downstream services that aren't HA.
