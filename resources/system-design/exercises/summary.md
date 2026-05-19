# System Design Exercises

## Exercise 1: Design a URL Shortener (e.g., bit.ly)

**Requirements**: 100M new URLs/day, 10B redirects/day, URLs never deleted

**Resources**
- API servers (stateless, horizontally scaled) behind ALB
- Redis cluster: `short_code → long_url` with 24h TTL for hot URLs
- PostgreSQL: durable store of all mappings (sharded by short code)
- CDN: cache most popular redirects at edge (cache-control: 1 day)
- Bloom filter: fast "does this short code exist?" without DB hit

**Short Code Generation**
- Base62 encode a counter (6 chars = 56B unique codes) — simple, no collision
- Or: MD5/SHA256 of long URL → take first 7 chars; retry on collision
- Custom aliases: user-supplied; check uniqueness first

**Rationale**
- Reads >> writes (100:1 ratio) → cache-heavy read path
- 10B redirects/day ≈ 115K req/s → multiple app servers + CDN handles it
- Redirect is HTTP 301 (permanent, browser caches) or 302 (temporary, for analytics)

---

## Exercise 2: Design Twitter/Social Feed

**Requirements**: 300M users, 500M tweets/day, home timeline in < 1s

**Resources**
- Tweet Service → Kafka → Fan-out Service
- Redis: per-user feed list (`LPUSH feed:{userId}`, cap at 800 entries)
- Object storage (S3): media (images, video)
- CDN: serve media
- Read Service: `LRANGE feed:{userId} 0 19` for home timeline
- Celebrity handling: pull-on-read for users with > 1M followers (not pre-computed)

**Topology**
- **Fan-out on write** for normal users: on tweet, push to all followers' feed caches
- **Fan-out on read** (hybrid) for celebrities: don't fan out to millions; merge at read time
- Timeline = fan-out feeds merged with celebrity tweets user follows

**Rationale**
- Pre-computed feeds give sub-millisecond reads but 300x write amplification for normal users
- Celebrity fan-out would be 100M writes per tweet — unacceptable → hybrid model
- Redis sorted sets could store tweets ranked by timestamp

---

## Exercise 3: Design a Distributed Rate Limiter

**Requirements**: 1M users, 100 req/s per user limit, 1ms overhead max, multi-datacenter

**Resources**
- Redis cluster (local per region): token bucket state per user key
- API Gateway or middleware: checks rate before forwarding
- Optional: Redis Cluster with read replicas for HA

**Algorithm**: Sliding Window Counter (most accurate + efficient)
```
key = "rate:{userId}:{current_minute}"
count = INCR key
EXPIRE key 60
if count > limit: return 429
```

**Multi-region consideration**
- Run rate limiter locally per region; allow slightly over-limit globally (best-effort)
- Or: synchronize via CRDTs (PN-Counter) at ~100ms intervals (approximate)
- True global exact limiting requires cross-region coordination → too slow

**Rationale**
- Redis INCR is atomic and O(1) — <1ms overhead achievable
- Fixed window chosen for simplicity; sliding window log adds memory overhead

---

## Exercise 4: Design a Notification System

**Requirements**: 100M users, email + push + SMS, retry on failure, deduplication

**Resources**
- Trigger sources (orders, alerts, social) → Kafka topic per channel
- Notification Service: consumes Kafka, resolves user preferences + addresses
- Channel workers: Email (SES/SendGrid), Push (FCM/APNs), SMS (Twilio)
- DynamoDB: idempotency keys (deduplication within 24h)
- DLQ: failed deliveries after 3 retries → alert + manual review
- User Preference Service: which channels user has enabled

**Topology**
```
Event → Kafka → Notification Service → [Email Worker / Push Worker / SMS Worker]
                         ↓
               Preference + Dedup Check → DynamoDB
```

**Rationale**
- Kafka gives replay, ordering, fan-out to multiple channel workers
- Deduplication key = `(notification_type, entity_id, user_id, day)` — prevents duplicate sends
- Prefer async delivery; synchronous only for critical alerts (OTP codes)

---

## Exercise 5: Design a Key-Value Store (like Redis)

**Requirements**: 10M ops/s, durability, replication, sub-ms p99

**Resources**
- In-memory hash map with O(1) reads/writes
- WAL (Write-Ahead Log): append-only file; replay on restart for durability
- Snapshots (RDB): periodic full dump; faster restart than full WAL replay
- Leader + N replicas: async replication; sync optional for durability guarantee
- Cluster mode: consistent hashing for horizontal sharding
- Eviction: LRU + TTL-based expiry

**Topology**
- Single-node: write → WAL → apply to memory → ACK
- Cluster: hash-slot-based routing (Redis uses 16384 slots)
- Sentinel: external process monitors leaders; triggers failover

**Rationale**
- Memory-first gives sub-ms; WAL gives durability without sacrificing throughput
- Async replication keeps writes fast; sync replication (WAIT) available for critical data
- Data structures (sorted sets, lists, hashes) built on the core hash table

---

## Exercise 6: Design a Web Crawler

**Requirements**: Crawl 1B pages, respect robots.txt, politeness delays, dedup, incremental updates

**Resources**
- URL Frontier: priority queue (recrawl priority, politeness per domain)
- Bloom filter: in-memory deduplication of seen URLs (1B entries ≈ 1.2 GB at 1% FPR)
- Fetcher workers: respect Crawl-Delay from robots.txt; per-domain rate limiting
- DNS cache: avoid repeated DNS lookups (cache TTL = 5 min)
- Content store: S3 for raw HTML
- Parser: extract links, normalize URLs, detect canonical
- Near-duplicate detection: SimHash/MinHash to skip near-identical pages

**Politeness**
- One active request per domain at a time
- Respect `robots.txt` and `Crawl-delay` directives
- Backoff if server returns 429 or 503

**Rationale**
- Bloom filter prevents re-crawling; false positive (skip novel URL) is acceptable
- Domain-level rate limiting avoids overwhelming small sites
- Priority queue: fresh/high-PageRank pages crawled more frequently
