# Data Stores

## SQL vs NoSQL Decision

| Factor | Choose SQL | Choose NoSQL |
|---|---|---|
| Data structure | Relational, normalized | Flexible, schema-less |
| Query complexity | Complex joins, aggregations | Key lookups, simple queries |
| Consistency | ACID required | Eventual OK |
| Scale | Vertical + limited horizontal | Massive horizontal |
| Examples | Postgres, MySQL, Aurora | DynamoDB, MongoDB, Cassandra |

## NoSQL Types

| Type | Model | Best For | Examples |
|---|---|---|---|
| **Key-Value** | hash map | Sessions, caches | Redis, DynamoDB |
| **Document** | JSON/BSON tree | Catalogs, user profiles | MongoDB, Firestore |
| **Wide-Column** | sparse column store | Time-series, analytics | Cassandra, HBase, BigTable |
| **Graph** | nodes + edges | Social networks, fraud | Neo4j, Neptune |
| **Time-Series** | time-indexed rows | Metrics, IoT | InfluxDB, Timestream |
| **Search** | inverted index | Full-text search | Elasticsearch, OpenSearch |

## Caching

### Strategies

| Strategy | Flow | When |
|---|---|---|
| **Cache-aside** | App checks cache → miss → load DB → populate cache | Most common, flexible |
| **Write-through** | Write to cache and DB simultaneously | Strong consistency reads |
| **Write-behind** | Write to cache → async flush to DB | High write throughput |
| **Read-through** | Cache fetches from DB on miss automatically | Transparent to app |

### Eviction Policies
- **LRU** (Least Recently Used) — most common
- **LFU** (Least Frequently Used) — better for skewed access patterns
- **TTL** — time-based expiry regardless of access

### Tools
- **Redis**: persistent, data structures (sorted sets, lists), pub/sub, Lua scripting
- **Memcached**: simpler, multi-threaded, pure key-value only

## Indexing

- **B-Tree index**: range queries, equality — default in most RDBMS
- **Hash index**: equality only, O(1) lookup — Redis hashes
- **Composite index**: multi-column; query must use leftmost prefix
- **Covering index**: all query columns in index — avoids table fetch
- **Full-text index**: inverted index for text search

### When to avoid indexes
- High write workloads (indexes add write overhead)
- Low-cardinality columns (e.g., boolean — index rarely helps)
- Small tables (sequential scan often faster)

## Replication

| Mode | Writes | Reads | Failover |
|---|---|---|---|
| **Single-leader** | Leader only | Leader or replicas | Manual or automatic |
| **Multi-leader** | Multiple datacenters | Local | Conflict resolution needed |
| **Leaderless** | Quorum (W nodes) | Quorum (R nodes) | Automatic (N, W, R tunable) |

- **Quorum**: W + R > N guarantees overlap (e.g., N=3, W=2, R=2)
- **Replication lag**: replicas can be behind; read-your-writes requires routing back to leader

## Sharding / Partitioning

| Strategy | How | Pros | Cons |
|---|---|---|---|
| **Range** | Key ranges per shard | Range queries efficient | Hot partitions |
| **Hash** | hash(key) % N | Even distribution | No range queries |
| **Consistent hashing** | Key on a ring | Minimal resharding on add/remove | Complex implementation |
| **Directory** | Lookup table | Flexible | Lookup is a bottleneck |

- **Hot partition problem**: high-traffic keys (celebrities) overload one shard → add random suffix, pre-shard
- **Cross-shard transactions**: avoid if possible; use Saga pattern when needed

## Connection Pooling

- DB connections are expensive (TCP + auth handshake)
- Pool: 10–100 connections shared by hundreds of app instances
- Tools: PgBouncer (Postgres), RDS Proxy (AWS), HikariCP (JVM)
- Size rule of thumb: `pool_size = (core_count × 2) + effective_spindle_count`

## Data Warehousing vs OLTP

| | OLTP | OLAP / DW |
|---|---|---|
| Query pattern | Short reads/writes | Long scans, aggregations |
| Schema | Normalized | Denormalized (star/snowflake) |
| Storage | Row-oriented | Column-oriented |
| Examples | Postgres, MySQL | Redshift, BigQuery, Snowflake |
