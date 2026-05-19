# API Design

## REST vs GraphQL vs gRPC

| | REST | GraphQL | gRPC |
|---|---|---|---|
| Protocol | HTTP/1.1 | HTTP/1.1 or 2 | HTTP/2 |
| Format | JSON/XML | JSON | Protobuf (binary) |
| Typing | Loosely typed | Strongly typed schema | Strongly typed (proto) |
| Versioning | URL or header | Schema evolution | Proto backward compat |
| Over-fetching | Common | Eliminated | N/A (explicit RPC) |
| Streaming | SSE / WebSocket | Subscriptions | Bidirectional streaming |
| Best for | Public APIs, CRUD | Complex graphs, mobile | Internal microservices |

## REST Best Practices

### URL Design
- Resources as nouns: `GET /users/123/orders` not `GET /getOrdersForUser`
- Use HTTP verbs: GET, POST, PUT, PATCH, DELETE
- Collections plural: `/users`, `/products`
- Nested resources for relationships: `/users/123/addresses`
- Filter/sort/paginate via query params: `?status=active&sort=created_at&page=2&limit=50`

### Status Codes
| Code | Meaning |
|---|---|
| 200 OK | Success |
| 201 Created | Resource created (POST) |
| 204 No Content | Success, no body (DELETE) |
| 400 Bad Request | Client error, validation failed |
| 401 Unauthorized | Not authenticated |
| 403 Forbidden | Authenticated but no permission |
| 404 Not Found | Resource doesn't exist |
| 409 Conflict | Duplicate or state conflict |
| 429 Too Many Requests | Rate limited |
| 500 Internal Server Error | Server fault |

### Pagination Patterns
| Pattern | Pros | Cons |
|---|---|---|
| **Offset** (`?page=2&limit=50`) | Simple | Drift on insert; slow for deep pages |
| **Cursor** (`?after=cursor_token`) | Stable, efficient | No random page jumps |
| **Keyset** (`?after_id=123`) | Very fast (index) | Requires sortable unique key |

## Rate Limiting

### Algorithms
| Algorithm | How | Pros | Cons |
|---|---|---|---|
| **Token bucket** | Tokens added at rate R; request consumes 1 | Allows bursts up to bucket size | Complex distributed state |
| **Leaky bucket** | Fixed output rate regardless of input | Smooth output | No burst tolerance |
| **Fixed window** | Count per minute/hour | Simple | Burst at window boundary |
| **Sliding window log** | Track each request timestamp | Accurate | High memory |
| **Sliding window counter** | Weighted blend of two windows | Accurate + efficient | Approximation |

### Implementation
- Rate limit by: IP, user ID, API key, endpoint
- Storage: Redis (INCR + EXPIRE) for shared rate state across instances
- Return `Retry-After` header with `429` response

## API Gateway

Responsibilities:
- **Auth**: JWT validation, API key check
- **Rate limiting**: centralized enforcement
- **Routing**: path-based to microservices
- **Load balancing**: across service instances
- **SSL termination**: HTTPS offloading
- **Request/response transformation**
- **Caching**: response caching at edge
- **Observability**: logging, tracing, metrics

Tools: Kong, AWS API Gateway, Nginx, Envoy, Traefik

## Authentication Patterns

| Pattern | How | Best For |
|---|---|---|
| **API Key** | Static key in header/query | Server-to-server, simple access |
| **Basic Auth** | Base64(user:pass) in header | Simple, internal only |
| **JWT** | Signed token with claims | Stateless; scales well |
| **OAuth 2.0** | Delegated authorization with scopes | Third-party access |
| **mTLS** | Both sides present certificates | Service-to-service, zero trust |

### JWT Flow
1. Client authenticates → server issues signed JWT (exp, sub, roles)
2. Client sends `Authorization: Bearer <token>` on each request
3. Server validates signature + expiry — no DB lookup needed
4. Revocation: short TTL + refresh token (or blocklist in Redis)

## API Versioning Strategies

| Strategy | Example | Notes |
|---|---|---|
| **URL path** | `/v1/users` | Most explicit; cacheable |
| **Query param** | `?version=1` | Easy but messy |
| **Header** | `Accept: application/vnd.api+json;version=1` | Clean but less discoverable |
| **Subdomain** | `v1.api.example.com` | DNS-level routing |

## WebSockets

- Full-duplex persistent TCP connection upgraded from HTTP
- Use when: live chat, real-time dashboards, multiplayer games, notifications
- Alternatives:
  - **SSE (Server-Sent Events)**: server → client only; simpler; auto-reconnect
  - **Long polling**: client holds connection open; less efficient
- Scale: sticky sessions or pub/sub backplane (Redis) so any node can push to any client

## Idempotency

- **Idempotent**: same request N times = same result as 1 time
- GET, PUT, DELETE are idempotent; POST is not by default
- Pattern: client sends `Idempotency-Key: <uuid>`; server stores result for 24h; deduplicates retries
- Critical for: payments, order creation, any state-changing operation
