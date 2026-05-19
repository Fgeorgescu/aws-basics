# System Design Exercises — Full Walkthroughs

## Exercise 1: Design a URL Shortener

### Clarify Requirements
- **Functional**: shorten URL, redirect short URL, custom aliases (optional), expiry (optional)
- **Non-functional**: 100M new URLs/day, 10B redirects/day, < 10ms redirect latency, 5-year retention

### Capacity Estimation
- Redirects: 10B/day ≈ 115,000 req/s
- New URLs: 100M/day ≈ 1,200 req/s
- Storage: 100M URLs/day × 365 days × 5 years × 500 bytes/URL ≈ **90 TB**
- Read:write ratio = 100:1 → read-heavy; cache is essential

### Short Code Generation Options

**Counter + Base62**: auto-incrementing counter → Base62 encode. 6 chars = 56 billion unique codes. Simple, no collision. Challenge: single counter is a bottleneck → use distributed counter (Redis INCR, or range-based allocation per server).

**Random Base62**: generate 7 random chars, check uniqueness in DB. Simple but collisions increase as the table grows. At 1 billion entries, collision probability per generation ≈ 1/56B — still negligible.

**Hash-based**: MD5/SHA256(long_url) → take first 7 chars. Deterministic (same URL → same short code), natural deduplication. Risk: hash collision for different long URLs → retry with longer prefix.

### Data Model
```sql
CREATE TABLE urls (
    short_code  VARCHAR(10)   PRIMARY KEY,
    long_url    TEXT          NOT NULL,
    user_id     UUID,
    created_at  TIMESTAMP     DEFAULT NOW(),
    expires_at  TIMESTAMP,
    click_count BIGINT        DEFAULT 0
);

CREATE INDEX ON urls(long_url);  -- for dedup on creation
```

### Architecture

**Write path** (1,200 req/s):
1. API server validates URL, generates short code
2. Check Redis (and DB) for existing mapping (dedup)
3. Write to Postgres primary
4. Cache `short_code → long_url` in Redis (TTL = 24h)

**Read path** (115,000 req/s):
1. Check Redis cache first (95%+ hit rate for popular URLs)
2. On miss: fetch from Postgres read replica, populate cache
3. Return HTTP 301 (permanent redirect, browser caches) or 302 (for analytics)

**Analytics**: publish click event to Kafka asynchronously; consumer aggregates to DW. Never update `click_count` on hot path.

**CDN**: cache redirects at edge for popular URLs. Use short TTL (5 min) to allow expiry to work.

### Handling 301 vs 302
- **301 (Permanent)**: browser caches forever; no more requests to your servers for that URL. Zero cost after first visit. But you lose analytics for repeat visitors.
- **302 (Temporary)**: browser never caches; every click goes through your servers. Analytics complete but higher infrastructure cost.
- Decision: user choice or default 302 with `Cache-Control: max-age=300` (5 min browser cache, preserves some analytics while reducing load).

---

## Exercise 2: Design Twitter / Social Feed

### Requirements
- 300M users, 100M daily active, 500M tweets/day, home timeline in < 200ms
- Each user follows ~200 others on average; some celebrities have 100M+ followers

### The Fan-Out Problem

**Fan-out on write**: when a user tweets, immediately push to all followers' feed caches. Low-latency reads (just LRANGE from Redis), but massive write amplification. A celebrity with 100M followers would trigger 100M Redis writes per tweet — unacceptable.

**Fan-out on read**: when a user loads their feed, query all people they follow and merge. No write amplification, but high read complexity: 200 people followed × 10 latest tweets each = 2,000 DB lookups + merge per timeline load. For 100M daily active users loading feed multiple times per day — too slow.

**Hybrid approach (Twitter's actual solution)**:
- Regular users (< 1M followers): fan-out on write into follower feed caches
- Celebrities (> threshold): no fan-out on write; stored separately in `celebrity_tweet` table
- Feed read: `LRANGE feed:{userId} 0 19` (pre-computed) + fetch latest tweets from followed celebrities + merge by timestamp

### Data Model

**Tweet**: `tweet_id (snowflake), user_id, content, created_at, media_ids[]`

**Snowflake ID**: 64-bit ID = 41 bits timestamp (ms since epoch) + 10 bits machine ID + 12 bits sequence. Monotonically increasing, sortable by creation time, globally unique without coordination.

**Feed cache** (Redis):
```
feed:{userId} → Sorted Set  (score=timestamp, member=tweet_id)
```
On new tweet from followed user: `ZADD feed:{followerId} timestamp tweetId`; `ZREMRANGEBYRANK feed:{followerId} 0 -801` (keep only latest 800).

### Timeline Read

```
1. ZRANGE feed:{userId} 0 19 WITHSCORES   → 20 most recent tweet IDs
2. For each celebrity followed: fetch their latest tweets from celebrity table
3. Merge and sort all tweet IDs by timestamp
4. Batch fetch tweet content: MGET tweet:{id} for all IDs
5. Batch fetch user profile for each unique author
```

Multi-level caching:
- L1: tweet content in Redis (tweet ID → serialized tweet)
- L2: user profile in Redis (user ID → serialized profile)
- L3: tweet content in Memcached for older tweets

### Media Storage
- Client uploads image directly to S3 via pre-signed URL
- S3 → trigger Lambda → generate thumbnails → store in S3
- CloudFront CDN serves all media with long-lived cache headers

---

## Exercise 3: Design a Distributed Cache (like Redis)

### Requirements
- Sub-millisecond get/set, 10M ops/s, TB-scale data, horizontal scaling, persistence option

### Core Design: In-Memory Hash Table

Keys and values stored in a large hash table in memory. Operations:
- `GET key`: O(1) hash lookup
- `SET key value [EX seconds]`: O(1) hash insert + add to expiry sorted set
- `DEL key`: O(1) hash delete

**Memory management**: allocate a large memory pool upfront (jemalloc), manage allocation internally. Never use system malloc per key — too slow, too fragmented.

**Expiry mechanism**: store keys with TTL in a sorted set (score = expiry timestamp). Background thread periodically scans and deletes expired keys. Also lazy expiration: check TTL on every GET, return miss if expired.

### Persistence
- **RDB (snapshot)**: fork the process, child writes memory to disk. Parent continues serving. Configurable interval (every 5 min if 1000 keys changed). Fast restart from recent snapshot. Risk: lose last 5 min of data on crash.
- **AOF (append-only file)**: every write command appended to log. On restart, replay log. Can configure `fsync` frequency: `always` (every write, slowest, most durable), `everysec` (every second, lose 1s on crash), `no` (OS decides, fastest, least durable).
- **Both**: use RDB for fast restart, AOF for durability. On startup, AOF takes precedence (more complete).

### Replication
Leader-follower async replication: follower connects, receives PSYNC, gets full RDB dump, then receives a stream of write commands. Replication buffer stores recent commands in case follower temporarily disconnects and needs to resync.

**Sentinel** (HA without clustering): 3+ Sentinel processes monitor the leader; majority vote triggers automatic failover; clients connect to Sentinel to discover current leader.

### Clustering (Sharding)
Redis Cluster uses consistent hashing with 16,384 hash slots. Each primary node owns a range of slots. `hash_slot = CRC16(key) % 16384`. Clients are given the slot map on connection; can route directly to the right node. On mismatch, node returns `MOVED` redirect.

### Data Structures as First-Class Features
Beyond simple key-value:
- **Sorted Set** (`ZADD`, `ZRANGE`): leaderboards, rate limiting (sliding window log), scheduling
- **List** (`LPUSH`, `LRANGE`): feed timelines, queues
- **Hash** (`HSET`, `HGET`): user profiles, shopping carts (one key per user, fields per attribute)
- **HyperLogLog** (`PFADD`, `PFCOUNT`): approximate distinct count with 0.81% error, 12KB per counter (vs 8 bytes × N for exact count)
- **Pub/Sub** (`PUBLISH`, `SUBSCRIBE`): real-time notifications, chat (not persistent — use Kafka if persistence needed)
- **Streams** (`XADD`, `XREAD`): Kafka-like persistent message log with consumer groups

---

## Exercise 4: Design a Notification System

### Requirements
- 100M users, email + push + SMS + in-app
- Transactional (OTP, password reset): < 5s delivery, exactly-once
- Marketing (newsletters): bulk sending, high latency OK, opt-out respected
- Deduplication, retry, DLQ, user preferences

### Architecture

```
Event Source → Kafka → Notification Orchestrator → [Channel Workers]
```

**Notification Orchestrator**:
1. Consume event from Kafka
2. Look up user notification preferences (what channels are enabled, opt-outs)
3. Fetch user's contact info (email, phone, device tokens)
4. Generate notification content from template
5. Check deduplication table (DynamoDB): `hash(user_id + notification_type + entity_id + date)` → skip if already sent
6. Publish to appropriate channel queues

**Channel Workers** (separate services, independently scalable):
- **Email**: SendGrid/SES integration; handle bounces/unsubscribes; respect sending limits
- **Push**: Firebase FCM (Android + web), APNs (iOS); handle token rotation; batch up to 500 per API call
- **SMS**: Twilio; expensive, only for critical (OTP, fraud alerts)
- **In-App**: write to `notifications` table + WebSocket push if user is connected

### Deduplication
Critical for transactional notifications (don't send OTP 3 times because of retries).

Key structure: `{user_id}:{notification_type}:{entity_id}:{day}`
- OTP for order #456: `user_123:order_confirmed:456:2024-01-15` — valid for the day
- Marketing email: `user_123:weekly_newsletter:2024-01-15` — valid for the week

Storage: DynamoDB with TTL (auto-delete after 7 days). Conditional write (PutItem with condition `attribute_not_exists`) — atomic check + write.

### Priority Queuing
Different Kafka topics per priority:
- `notifications.critical` (OTP, fraud, password reset): small pool of fast workers
- `notifications.transactional` (order status, shipping): standard workers
- `notifications.marketing` (newsletters, promotions): bulk workers with rate limiting to respect provider limits

### Rate Limiting Per Provider
Email providers (SendGrid) have sending limits. SMS has per-second rate limits from Twilio. Implement leaky bucket per channel worker pool. For marketing sends, spread over time (drip campaign) rather than blasting all at once.

---

## Exercise 5: Design Google Drive / Dropbox

### Requirements
- Upload/download large files, sync across devices, share with others, version history

### File Storage
Never store file content in the database. Store binary data in S3.

**Chunked upload**: split files into 4MB chunks. Upload each chunk independently to S3 (presigned PUT URLs). This enables: resumable uploads (retry only failed chunks), parallel upload (multiple chunks simultaneously), deduplication (hash each chunk, skip if already in S3 — "content-addressed storage").

**Metadata DB** (Postgres):
```sql
files: file_id, user_id, name, size, parent_folder_id, created_at, current_version_id
file_versions: version_id, file_id, s3_key, checksum, created_at
chunks: chunk_id, checksum, s3_key, size
file_version_chunks: version_id, chunk_id, order
```

### Sync Protocol
1. Client A uploads new version → API creates new `file_version` → publishes `FileUpdated` event
2. Notification service pushes delta to all connected devices of the same user via WebSocket
3. Client B receives notification, fetches diff (which chunks changed), downloads only new/changed chunks

**Conflict resolution**: if two devices edit the same file offline and sync simultaneously → create a conflict copy (like Dropbox). Surface both versions in UI, let user choose.

### Sharing and Permissions
- Share via link (public URL with token, optional password) or invite by email
- Permission model: Owner > Editor > Viewer
- Store in `file_permissions` table; enforce at API layer on every request
- Pre-signed S3 URLs for downloads: generate short-lived URL (15 min) that allows direct S3 download without going through your servers — reduces bandwidth cost and latency

### Version History
- Keep last N versions per file (configurable per plan)
- Async cleanup job: delete old versions beyond the retention limit; delete orphaned chunks with reference count = 0
- Restore: create new file_version pointing to old version's chunks — no data copy needed
