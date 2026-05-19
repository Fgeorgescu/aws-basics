# Scalability Patterns

## Load Balancing

### Algorithms
| Algorithm | How | Best For |
|---|---|---|
| **Round Robin** | Rotate through servers evenly | Homogeneous servers, equal load |
| **Weighted Round Robin** | Higher weight → more requests | Heterogeneous server capacities |
| **Least Connections** | Route to server with fewest active | Long-lived connections (WebSockets) |
| **IP Hash** | hash(client_IP) % N | Sticky sessions without cookies |
| **Random** | Random selection | Simple, works well at scale |
| **Resource-based** | Route based on CPU/mem | When load is highly variable |

### L4 vs L7 Load Balancer
| | L4 (Transport) | L7 (Application) |
|---|---|---|
| Operates at | TCP/UDP | HTTP, headers, cookies |
| Content awareness | No | Yes |
| SSL termination | No | Yes |
| Path-based routing | No | Yes |
| Performance | Faster | More flexible |
| Examples | AWS NLB, HAProxy TCP | AWS ALB, Nginx, Envoy |

## CDN (Content Delivery Network)

- Caches static assets (images, JS, CSS, videos) at edge PoPs near users
- **Push CDN**: upload content proactively to CDN (infrequently updated assets)
- **Pull CDN**: CDN fetches from origin on first request, caches until TTL expires (most common)
- Reduces: latency, origin bandwidth costs, DDoS surface
- **Dynamic content**: CDN can cache with `Vary` headers; or use edge compute (Lambda@Edge, Cloudflare Workers)

## Database Scaling

### Read Scaling
- **Read replicas**: async copies; route read traffic there; slight replication lag
- **Caching layer**: Redis/Memcached in front of DB; cache frequently read, rarely changed data
- **Denormalization**: store pre-computed aggregates; trade write complexity for read speed

### Write Scaling
- **Vertical scaling**: bigger DB instance (limits exist)
- **Sharding**: partition data across multiple DB instances by key range or hash
- **Write-through cache**: write lands in cache + DB simultaneously
- **CQRS**: separate write and read paths entirely

### Connection Scaling
- **Connection pooling**: PgBouncer, RDS Proxy — multiplex thousands of app connections into small DB pool
- **Read/write splitting**: app routes reads to replica, writes to primary

## Horizontal Scaling — Design Principles

1. **Stateless services**: store session in shared store (Redis) not in process memory
2. **External storage**: app instances don't hold durable state (use S3, DB, cache)
3. **Configuration via environment**: no hard-coded hostnames
4. **Health checks**: load balancer removes unhealthy instances automatically
5. **Graceful shutdown**: drain in-flight requests before terminating (SIGTERM handler)

## Auto-Scaling

- **Reactive**: scale out when CPU > 70% for 5 min; scale in when < 30% for 20 min
- **Predictive**: ML-based forecasting (AWS Predictive Scaling, KEDA)
- **Schedule-based**: scale up before known traffic spikes (cron)
- **Cooldown periods**: prevent thrashing (e.g., wait 3 min between scale-in events)
- **Scale-in protection**: protect instances processing long-running jobs

## Caching at Every Layer

```
Browser cache → CDN → API gateway cache → Application cache (Redis) → DB query cache → DB
```

- **Cache hit ratio**: > 95% is healthy; watch for cache stampede (thundering herd)
- **Cache stampede fix**: probabilistic early expiration, mutex lock on miss, request coalescing

## Thundering Herd

- All cache entries expire simultaneously → massive DB load
- Solutions:
  - **Staggered TTLs**: add small random jitter to expiry time
  - **Lock + single fetch**: first miss acquires lock, others wait
  - **Background refresh**: refresh before expiry while serving stale

## Queue-Based Load Leveling

- Absorb traffic spikes by writing to a queue; workers process at their own pace
- Decouples **ingestion rate** from **processing rate**
- Queue depth = natural autoscaling signal (KEDA, SQS-based scaling)

## Consistent Hashing

- Nodes and keys placed on a virtual ring; key routed to nearest node clockwise
- Adding/removing a node only remaps keys near that node (≈ 1/N of all keys)
- Used by: Cassandra, DynamoDB, Memcached clusters, CDN edge routing
- **Virtual nodes**: each physical node occupies multiple ring positions → even distribution

## Geographic Distribution

| Pattern | How | Use |
|---|---|---|
| **Active-Active** | All regions serve traffic | Maximum availability |
| **Active-Passive** | One primary, others standby | Simpler; for DR |
| **Read local, write global** | Reads from nearest region, writes to single primary | Read-heavy, global users |
| **Geofencing** | Route users to compliant region | Data residency requirements |
