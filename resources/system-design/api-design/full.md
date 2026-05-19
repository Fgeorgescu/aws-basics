# API Design — Full Reference

## REST in Depth

REST (Representational State Transfer) is an architectural style, not a protocol. True REST is stateless: each request contains all information needed to serve it — no server-side session. This is what enables horizontal scaling.

**Resource modeling**: the hardest part of REST design is modeling your domain as resources. Resources are nouns, not verbs. Instead of `POST /sendEmail`, you create a resource: `POST /emails` with `{ status: "pending" }`. This maps naturally to CRUD and makes your API predictable.

**Nested resources vs query parameters**: use nesting for ownership relationships (`/users/123/orders` means orders owned by user 123). Use query parameters for filtering (`/orders?user_id=123&status=shipped`). The nested form is better for access control (you can restrict access to `/users/123/*` based on the authenticated user).

**HATEOAS** (Hypermedia as the Engine of Application State): a REST constraint where responses include links to related resources. In practice, few APIs implement this fully, and clients are usually hardcoded to known URLs.

**HTTP caching**: REST APIs can leverage HTTP caching headers:
- `Cache-Control: max-age=3600` — client and proxy can cache for 1 hour
- `ETag: "abc123"` — client can use `If-None-Match: abc123` to get 304 Not Modified if unchanged
- `Last-Modified` + `If-Modified-Since` — time-based equivalent

This is a massive advantage of REST over GraphQL for read-heavy public APIs.

## GraphQL — When It Shines and When It Doesn't

GraphQL solves two problems that REST has:

**Over-fetching**: REST returns the whole resource even when you only need 3 fields. A mobile app showing a user's name and avatar still gets their full profile, preferences, and settings from `GET /users/123`.

**N+1 queries**: to display a list of posts with their authors, REST requires: 1 request for posts, then N requests for each author. GraphQL fetches everything in one request, and a well-implemented resolver uses DataLoader to batch the author lookups.

**Where GraphQL hurts**:

- **Caching**: GraphQL typically uses `POST /graphql` for all queries. HTTP caching is per-URL, so you lose CDN-level caching. Workarounds (persisted queries, GET for queries) add complexity.
- **Rate limiting**: "one request" can be infinitely expensive. A malicious client can nest queries 10 levels deep. You need complexity analysis and depth limits.
- **Authorization**: in REST, you authorize at the route level. In GraphQL, every field resolver must check authorization independently. Forgetting one resolver means data leaks.
- **Error handling**: GraphQL always returns HTTP 200 with errors in the body. Monitoring systems that alert on 4xx/5xx miss GraphQL errors. You must parse response bodies to detect failures.

GraphQL is excellent for: product APIs consumed by multiple clients (web, iOS, Android, third-party) with different data needs; developer experience where a schema acts as living documentation; internal BFF (Backend for Frontend) layer.

## gRPC for Internal Services

gRPC uses Protocol Buffers (Protobuf) for serialization: a binary format that is 3–10× smaller than JSON and much faster to serialize/deserialize. Combined with HTTP/2 (multiplexing, header compression, binary framing), gRPC is ideal for high-throughput internal microservice communication.

**Protobuf schema**:
```protobuf
service OrderService {
  rpc GetOrder(GetOrderRequest) returns (Order);
  rpc StreamOrders(StreamRequest) returns (stream Order);
}

message GetOrderRequest {
  string order_id = 1;
}
```

**gRPC streaming patterns**:
- **Server streaming**: server sends a stream of responses (e.g., subscribe to real-time price updates)
- **Client streaming**: client sends a stream (e.g., uploading a large file in chunks)
- **Bidirectional streaming**: both sides stream (e.g., real-time collaborative editing)

**Trade-offs vs REST**:
- Protobuf is not human-readable (requires tooling to inspect); JSON is debug-friendly
- Browser support for gRPC requires gRPC-Web (a wrapper); REST works natively in browsers
- Code generation from .proto files is excellent for typed clients; REST requires OpenAPI/Swagger for equivalent

## Rate Limiting — Full Algorithm Comparison

**Fixed Window Counter** is the simplest: count requests per minute. At 11:59:59 a user can make 100 requests, and at 12:00:00 another 100, effectively making 200 requests in 2 seconds. This boundary burst is the main weakness.

**Sliding Window Log** tracks the timestamp of every request. To check: count requests with timestamp > (now - window). Accurate but O(n) memory per user where n is requests per window — impractical for high-traffic APIs.

**Sliding Window Counter** approximates the sliding window using two fixed windows: `count = previous_window_count × (time_remaining_in_window / window_size) + current_window_count`. This is O(1) memory and accurate within ~0.1% in testing.

**Token Bucket** is the most burst-friendly. Tokens accumulate at rate R up to capacity C. Each request consumes 1 token. A user can burst up to C requests instantly if they've been idle. AWS API Gateway uses token bucket by default. Redis implementation: store `{tokens, last_refill_time}` per user; on request, calculate tokens added since last refill, clamp to capacity, deduct 1.

**Distributed Rate Limiting**: each app server tracking rate state locally means a user can make 10x the limit by hitting 10 different servers. Central Redis is the standard solution: atomic `INCR` + `EXPIRE` gives you consistent rate limiting across all instances with sub-millisecond overhead.

## JWT Deep Dive

A JWT consists of three base64url-encoded parts separated by dots: `header.payload.signature`.

**Header**: `{ "alg": "HS256", "typ": "JWT" }` — specifies the signing algorithm.

**Payload**: claims about the user. Standard claims:
- `sub`: subject (user ID)
- `iss`: issuer (your auth service)
- `aud`: audience (which service this token is for)
- `exp`: expiration (Unix timestamp)
- `iat`: issued at

**Signature**: `HMAC-SHA256(base64url(header) + "." + base64url(payload), secret)`

**Security considerations**:
- Never put sensitive data in payload — it's base64 encoded, not encrypted. Anyone can decode it.
- Short expiry (15 min for access tokens) + refresh tokens (7 days, stored in httpOnly cookie)
- Algorithm confusion attack: always validate `alg` header server-side; don't trust `"none"` algorithm
- Secret rotation: rotate signing secrets regularly; use `kid` (key ID) header to support multiple active keys during rotation

**Revocation challenge**: JWTs are stateless and valid until expiry. To invalidate before expiry:
1. Short TTL (15 min) + don't support revocation — acceptable for many apps
2. Redis blocklist: store invalidated JTI (JWT ID) claim; check on every request — O(1) lookup
3. Short TTL + refresh token rotation: revoking the refresh token prevents token renewal

## API Gateway — Production Architecture

An API gateway is the entry point for all client traffic. In production, it's a critical piece of infrastructure:

**Cross-cutting concerns it handles**:
1. **TLS termination**: HTTPS at the edge; services communicate over HTTP internally (within private network)
2. **Auth**: validate JWT, API key, or forward to auth service for more complex flows
3. **Rate limiting**: centralized enforcement prevents backend overload
4. **Request validation**: reject malformed requests before they reach services
5. **Response transformation**: add/remove fields, change format
6. **Circuit breaking**: stop forwarding to unhealthy backends
7. **Canary routing**: send 5% of traffic to new service version
8. **Observability**: collect metrics, logs, and traces for every request

**Self-managed vs managed**:
- AWS API Gateway: managed, serverless, integrates with Lambda, Cognito, WAF. Limit: 10,000 req/s default.
- Kong (open-source): runs on your infra; highly extensible via plugins; supports any backend
- Envoy: high-performance proxy used as data plane for service meshes (Istio); gRPC-native

## Webhook Design

Webhooks are HTTP callbacks: instead of polling your API for updates, you call the client's registered endpoint when something happens.

**Delivery challenges**:
- Client endpoint may be down → need retry with exponential backoff
- Client may be slow → use async delivery with a queue; don't block your main path
- Must guarantee at-least-once delivery → client endpoint must be idempotent (check event ID)
- Order is not guaranteed across retries → events should include enough context to be processed independently

**Implementation pattern**:
1. Event occurs → write to outbox table in same DB transaction as the triggering operation
2. Webhook publisher reads outbox, POSTs to client endpoint
3. On 2xx: mark delivered; on failure: retry with backoff up to 24h
4. Client sends their secret in `X-Webhook-Secret` or signature in `X-Signature-256` for validation

**Fan-out**: large webhook platforms (GitHub, Stripe) fan out to thousands of subscribers per event. This requires a queue per subscriber, not synchronous fan-out.
