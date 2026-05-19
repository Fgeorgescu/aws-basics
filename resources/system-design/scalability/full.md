# Scalability — Full Reference

## Load Balancing in Production

A load balancer is not just a traffic distributor — it's a health monitor, SSL terminator, and observability point. Understanding when to choose L4 vs L7 is a common interview question.

**L4 load balancers** operate at the TCP level. They see IP addresses and ports but not HTTP content. They're fast (just forward TCP segments without parsing HTTP) and work for any TCP protocol. AWS Network Load Balancer can handle millions of requests per second with sub-millisecond latency. Use L4 when: you need maximum throughput, you're not using HTTP (custom TCP protocol, gRPC without HTTP/2 termination), or you need to preserve client IP at the TCP level.

**L7 load balancers** operate at the HTTP level. They can inspect headers, URLs, cookies, and request bodies. This enables: path-based routing (`/api/*` → API servers, `/static/*` → CDN origin), host-based routing (virtual hosting), cookie-based sticky sessions without source IP dependency, SSL termination and certificate management, WebSocket upgrade handling, and gRPC routing. AWS Application Load Balancer is L7.

**Health checks at scale**: a naive health check that hits your DB on every check can cause thundering herd if 50 load balancers each check 50 backend instances every 5 seconds. Deep health checks (checking DB connectivity) should be configured to run less frequently or only from one check node. Shallow health checks (process is alive + not OOM) run frequently from every LB node.

**Least connections** is underrated. For APIs where some requests are fast (GET /ping) and some are slow (generate report), round-robin concentrates slow requests unevenly. Least connections automatically routes new requests to servers that have finished their slow tasks.

## CDN Architecture

A CDN is a geographically distributed network of cache servers (Points of Presence, PoPs). When a user in Tokyo requests an image from your US-based origin, the CDN PoP in Tokyo serves it from its local cache — no round trip to the US.

**Cache hierarchy**: most CDNs have a two-tier structure:
- **Edge PoPs**: closest to users; first layer of caching; cache hit serves immediately
- **Mid-tier PoPs (Shield/Origin Shield)**: aggregation layer between edges and origin; reduces origin load by consolidating misses from many edges into fewer origin requests

**Cache key**: by default, the URL is the cache key. `?` query parameters are usually included. This means `GET /product?id=123` and `GET /product?id=123&utm_source=email` are different cache keys — you'll cache the same response twice. Configure your CDN to strip marketing parameters from the cache key.

**Vary header**: `Vary: Accept-Encoding` tells the CDN to maintain separate cache entries for gzip vs brotli vs uncompressed responses. `Vary: Cookie` is a disaster — it effectively disables caching because every user has different cookies. Design your public APIs to not Vary on cookies.

**Dynamic content at the edge**: modern CDNs (Cloudflare Workers, Lambda@Edge, Vercel Edge Functions) run JavaScript at PoPs. You can: do A/B testing at the edge (no origin request needed), personalize responses without uncacheability, authenticate JWT tokens without hitting your origin, serve API responses from cache with edge logic for cache invalidation.

**Cache invalidation**: purge individual URLs (expensive if many), use surrogate keys/cache tags to purge all cached objects associated with a resource (e.g., purge all pages containing product #123), or design immutable URLs (append content hash: `main.a3f4c2.js`) so old cached objects are never stale.

## Database Scaling Patterns in Sequence

Systems typically follow this progression as they scale:

**Stage 1** (startup): single Postgres instance handles everything. RTO on failure is 5–15 min (bring up a new instance from backup). This is fine for early-stage products.

**Stage 2** (growth): add read replicas. Route read traffic to replicas; all writes go to primary. This typically 2–3× your read capacity. Replication lag (usually <1s) is acceptable for most use cases. AWS RDS Multi-AZ provides a synchronous standby for failover (not a read replica — standby doesn't accept reads). Aurora adds up to 15 read replicas with <10ms replica lag.

**Stage 3** (scaling): add a caching layer (Redis) in front of your read replicas. Cache hit ratios of 95%+ means your DB serves 5% of the traffic it used to. This multiplies read capacity by 20×.

**Stage 4** (high scale): vertical scaling of the primary. `db.r6g.16xlarge` on AWS has 512 GB RAM — a huge Postgres buffer pool that keeps most working data in memory. This often works longer than engineers expect.

**Stage 5** (extreme scale): sharding. This is when you've hit the limits of vertical scaling on your primary and your write throughput exceeds what one machine can handle. Sharding adds enormous operational complexity — avoid it as long as possible.

**Alternative to sharding**: functional decomposition (microservices). Instead of sharding the user table across 10 DB instances, extract user preferences into their own service + DB, user activity into another, etc. Each service's DB is smaller and more manageable.

## Connection Pooling — The Hidden Bottleneck

Postgres can handle ~100–200 concurrent connections before performance degrades due to memory pressure and context switching. A typical application server has 16 threads, each maintaining a DB connection. At 20 app servers × 16 threads = 320 connections — already above Postgres's comfortable limit.

**PgBouncer** is the standard solution. It sits between your app and Postgres, maintaining a small pool of actual Postgres connections (e.g., 20) and multiplexing thousands of application connections through them.

**Transaction mode** (the most efficient): a Postgres connection is only held for the duration of a transaction, then returned to the pool. App can have 10,000 open connections, but only 20 Postgres connections. Caveat: prepared statements, `SET` configurations, and advisory locks don't work across transactions in transaction mode.

**Session mode**: each application connection gets a dedicated Postgres connection for the duration of the session. Simpler but doesn't solve the connection count problem as well.

**RDS Proxy** is AWS's managed PgBouncer equivalent. It integrates with IAM and Secrets Manager, provides connection pooling with automatic failover during Multi-AZ failover events, and requires no application changes. More expensive than self-managed PgBouncer but zero operational overhead.

## Stateless Design — Making Services Scalable

The first question when scaling a service: "where does state live?" If any state is in the application process, you have a problem.

**Session state**: the classic stateful pattern. User logs in → session created in memory → load balancer must always send that user to the same server (sticky sessions). If that server dies, the user is logged out. Solution: store sessions in Redis. Now any server can handle any request.

**In-process caches**: a local cache warms up and provides fast lookups, but Cache invalidation becomes a per-instance problem. Server A invalidates its cache for product #123, but servers B and C still have stale data. Solution: for small, rarely-changing data (feature flags, config), accept per-instance staleness and refresh on a TTL. For highly dynamic data, use a shared cache (Redis).

**File uploads**: don't buffer uploaded files in app server memory or disk. Stream directly to S3 using pre-signed URLs — the upload goes directly from client to S3, never touching your app server. Your app server just validates the upload metadata after S3 confirms receipt via a callback.

**WebSocket connections**: inherently stateful (one connection lives on one server). Scale by: sticky sessions at the load balancer (fragile), or use a pub/sub backplane (Redis Pub/Sub, Socket.io adapter) so any server can publish messages that are delivered to clients connected to any other server.

## Auto-Scaling Nuances

**Scale-out is easy; scale-in is dangerous**. When you terminate an instance, it may be handling requests. If your application doesn't implement graceful shutdown (drain existing connections before exiting), users get connection errors. Implement SIGTERM handler: stop accepting new connections, finish in-flight requests, then exit.

**Cooldown periods prevent thrashing**. If CPU spikes for 30 seconds (a traffic burst) and you scale out, then CPU drops and you scale in, and then it spikes again — you're continuously launching and terminating instances. Cooldown: after scaling out, wait 5 min before scaling in. Scale-in cooldown is typically longer than scale-out cooldown.

**Bootstrapping time matters**. An instance that takes 10 min to become healthy (download configs, warm up caches, run migrations) doesn't help during a traffic spike. Solutions: bake your AMI (pre-install everything, just configure at startup), use containers with pre-built images, warm up caches with synthetic traffic on startup.

**Reserved + On-Demand + Spot**: for predictable baseline traffic, use Reserved Instances (70% cheaper). For auto-scaling, use On-Demand. For batch jobs and fault-tolerant workloads, use Spot (90% cheaper but can be interrupted). A mixed Auto Scaling Group (ASG) with a base of On-Demand and auto-scaling with Spot is the cost-optimal pattern.

## Consistent Hashing — Why It Matters

Without consistent hashing, adding a server to a hash-sharded cluster requires remapping almost all keys. With `N` servers and `N+1` servers, `N/(N+1)` of all keys need to move — approximately every key. This means when you scale up, you have a massive cache miss storm as all keys simultaneously need to be re-fetched and re-cached.

With consistent hashing, adding one server to an `N`-server cluster only moves `1/(N+1)` of keys — just the keys that "belong" to the new server's arc on the ring. This is the difference between a smooth scale-up and a thundering herd that brings down your database.

**Virtual nodes** (Vnodes) further smooth the distribution. Without vnodes, if you remove a server, all its keys move to one adjacent server — that server receives 2× its normal traffic. With 150 virtual nodes per physical server, each physical server has 150 small arcs on the ring. Removing it distributes its keys among 150 different neighbors, giving each neighbor a small, manageable additional load.
