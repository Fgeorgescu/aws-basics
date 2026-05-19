# Data Stores — Full Reference

## Choosing the Right Database

The most common mistake in system design interviews is reaching for the same database for every use case. The choice depends on your access patterns, consistency requirements, and scale characteristics.

**When SQL wins**: you have relational data with complex joins (e.g., e-commerce: orders, line items, products, users all related), you need ACID transactions (financial ledgers, inventory deduction), you have complex reporting queries that span multiple entities, or your team knows SQL well and the scale fits (millions not billions of rows per table).

**When NoSQL wins**: your access pattern is key-based (always fetch by user ID, order ID), your schema changes frequently (product catalogs with different attributes per product type), you need massive horizontal write throughput (IoT sensor data, event logs), or you need geo-distributed active-active writes.

The worst scenario is picking NoSQL to "scale" and then realizing you need joins — you'll implement application-level joins that are slower and more fragile than the DB would have been.

## Caching In Depth

Caching is the most impactful performance optimization available, and also the hardest to get right. The famous saying: "There are two hard things in computer science: cache invalidation, naming things, and off-by-one errors."

**Cache-Aside (Lazy Loading)** is the most common pattern. The application manages the cache explicitly:
1. Check cache. If hit, return data.
2. If miss, query database.
3. Populate cache with result.
4. Return data.

**Advantages**: cache only contains data that's actually requested; a cache restart doesn't cause a thundering herd on startup.
**Disadvantages**: three round trips on a miss (check cache, query DB, write cache); initial warm-up period has all misses; risk of stale data if DB updates happen outside this code path.

**Write-Through** populates the cache on every write:
1. Application writes to DB.
2. Application also writes to cache.

**Advantages**: cache is always fresh.
**Disadvantages**: writes are slower (two operations); cache holds data that may never be read (wasted memory).

**Write-Behind (Write-Back)** writes to cache immediately and flushes to DB asynchronously:
1. Application writes to cache.
2. Cache asynchronously flushes to DB.

**Advantages**: writes are extremely fast.
**Disadvantages**: data loss if cache dies before flush; requires durability guarantees on the cache (Redis AOF).

**The Cache Stampede Problem**: When a cache entry expires (or is evicted), many concurrent requests simultaneously go to the database to repopulate it. This can overwhelm a database that was previously protected. Solutions:

- **Probabilistic Early Expiration (PER)**: each request calculates whether to refresh early based on remaining TTL and a random factor. Refresh happens in the background before expiry.
- **Request coalescing**: a request that causes a cache miss acquires a lock; subsequent requests for the same key wait for the first to complete and then serve the cached result.
- **Stale-while-revalidate**: serve stale data immediately, trigger background refresh, update cache when complete.

## Indexing Strategy

Indexes speed up reads at the cost of write overhead and storage. Every index you add makes INSERT/UPDATE/DELETE slower because the index must be maintained.

**B-Tree indexes** (default in Postgres, MySQL) are balanced trees that support range queries. `WHERE created_at > '2024-01-01'` uses a B-Tree. They support equality, comparison, and LIKE (prefix only).

**Hash indexes** are O(1) for equality but support no range queries. Postgres has hash indexes but they're rarely used (B-Tree is usually faster in practice due to caching).

**Composite indexes** cover multiple columns. The critical rule: queries must use the **leftmost prefix** of the composite index. An index on `(user_id, created_at)` helps `WHERE user_id = 123` and `WHERE user_id = 123 AND created_at > X` but not `WHERE created_at > X` alone.

**Covering indexes** include all columns a query needs, eliminating the need to fetch the actual row. `SELECT user_id, email FROM users WHERE user_id = 123` with an index on `(user_id, email)` is served entirely from the index — no heap access.

**Partial indexes** index only rows matching a condition: `CREATE INDEX ON orders(user_id) WHERE status = 'pending'`. Smaller, faster, only useful if queries filter on that condition.

**When indexes hurt**:
- Tables with <1000 rows: sequential scan is faster due to overhead of index lookup + random I/O.
- Columns with <10 distinct values (e.g., status, boolean): the optimizer may skip the index because it still touches most rows.
- Bulk insert workloads: building indexes on every insert is expensive; batch load without indexes, then build indexes.

## Replication Deep Dive

**Single-Leader replication** is the simplest. One node (primary) accepts all writes; followers replicate asynchronously. 

Replication lag creates a window where followers have stale data. For most applications this is fine. For user-facing reads-after-write (you just updated your profile and reload the page), you need to route that specific read back to the primary. AWS Aurora handles this with a session consistency option.

**Multi-Leader replication** lets multiple datacenters accept writes. Each datacenter has a local primary. This enables low-latency writes globally but introduces **write conflicts**: two users in different regions update the same record simultaneously. 

Conflict resolution strategies:
- Last Write Wins (LWW): the write with the higher timestamp wins. Simple but can lose data (the other write is discarded).
- Application-level merge: the application receives both conflicting values and merges them (like a CRDT).
- Let user resolve: surfaces the conflict in the UI (Dropbox, Google Docs auto-merge use variants of this).

**Leaderless replication** (Dynamo-style) has no leader. Any node accepts writes. Reads and writes use quorums:
- N = total replicas (e.g., 3)
- W = write quorum (e.g., 2 nodes must ACK write)
- R = read quorum (e.g., 2 nodes must respond to read)
- When W + R > N, at least one node in the read set overlaps the write set → you always read the latest committed write.

The trick: you can tune consistency vs latency by adjusting W and R. W=1, R=1 is fastest but no consistency guarantee. W=3, R=3 is fully consistent but slow and not highly available.

## Sharding at Scale

Sharding (horizontal partitioning) is what you reach for when a single database can't handle your data volume or write throughput.

**Range sharding** assigns key ranges to shards: users 0–999999 on shard 1, 1000000–1999999 on shard 2. Range queries are efficient — scan shard 1 for users 500000–600000 hits one shard. The problem: **hot partitions**. If your key is `created_at`, all new data writes go to the latest shard while old shards sit idle.

**Hash sharding** distributes keys evenly: `shard = hash(key) % num_shards`. No hot partitions. But you lose range queries — `WHERE user_id BETWEEN 1000 AND 2000` hits every shard.

**Consistent hashing** places shards on a virtual ring. Adding a shard only moves keys adjacent to it on the ring. Without consistent hashing, adding a shard to a hash-sharded cluster requires rehashing all keys.

**Cross-shard operations** are the primary pain point. A query joining users and orders where each is on different shards requires fetching from both and joining in application code. Transactions spanning shards require distributed transaction coordination (2PC or Saga). The advice: **shard carefully and try to co-locate related data on the same shard**.

## Time-Series Databases

Regular relational databases aren't optimized for time-series data:
- High write throughput (millions of sensor readings per second)
- Queries always filter by time range
- Old data has lower value and should be downsampled or deleted automatically

**InfluxDB** stores measurements with tags (indexed metadata) and fields (actual values). Queries are SQL-like but time-centric: `SELECT mean(temperature) FROM sensors WHERE time > now() - 1h GROUP BY time(5m)`.

**Amazon Timestream** is serverless time-series on AWS. Automatically tiers data from memory to SSD to magnetic as it ages. No servers to manage.

**TimescaleDB** is an extension to Postgres that adds time-series optimizations (hypertables, automatic partitioning by time, continuous aggregates) while remaining fully SQL compatible. Best when you need SQL joins with other relational data.

## Search Engines as a Complement

Elasticsearch (and OpenSearch) maintain an inverted index: for each word in your documents, they store which documents contain that word. This makes full-text search extremely fast.

**When to add Elasticsearch alongside your primary DB**: users need to search by arbitrary text fields; you need fuzzy matching ("jonh" → "john"); you need faceted search with aggregations (filters + counts); you need geospatial queries.

**Data flow**: primary DB is the source of truth; a sync process (Change Data Capture via Debezium, or application dual-write) writes data to Elasticsearch. Reads for search queries go to Elasticsearch; reads for record lookups go to the primary DB.

**Pitfall**: Elasticsearch is not a primary database. It doesn't have full ACID transactions, it has eventual consistency for near-real-time indexing (1s default refresh interval), and its data model is optimized for search, not arbitrary queries. Never replace your relational DB with Elasticsearch.
