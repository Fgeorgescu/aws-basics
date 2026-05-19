# System Design Fundamentals

## CAP Theorem

| Property | Meaning |
|---|---|
| **Consistency** | Every read receives the most recent write (or an error) |
| **Availability** | Every request receives a response (not guaranteed to be latest) |
| **Partition Tolerance** | System continues operating despite network partitions |

- Network partitions are inevitable in distributed systems — you must choose **CP** or **AP**
- **CP systems**: HBase, Zookeeper, etcd — reject or timeout during partition
- **AP systems**: Cassandra, DynamoDB, CouchDB — serve stale data during partition

## ACID vs BASE

| ACID (relational) | BASE (NoSQL) |
|---|---|
| Atomicity | Basically Available |
| Consistency | Soft state |
| Isolation | Eventually consistent |
| Durability | |

## Consistency Models (weakest → strongest)

1. **Eventual** — writes propagate asynchronously; reads may be stale (Cassandra, DNS)
2. **Monotonic read** — you never read older data than you've already read
3. **Read-your-writes** — you always see your own writes immediately
4. **Session** — consistency within a single session
5. **Causal** — causally related operations seen in order by all
6. **Sequential** — all operations appear in the same order globally
7. **Linearizable / Strong** — every op appears atomic and globally ordered (Zookeeper, etcd)

## Scalability

| Type | How | When |
|---|---|---|
| **Vertical** | Bigger machine (more CPU/RAM) | Simple, no code changes; hits hardware limits |
| **Horizontal** | More machines | Requires stateless design or partitioning |

- **Stateless** services scale horizontally by default — no session affinity needed
- **Stateful** services (DBs, caches) require sharding/replication strategy

## Latency vs Throughput

- **Latency**: time for a single request (ms) — optimize with caching, indexing, proximity
- **Throughput**: requests per second — optimize with parallelism, batching, pooling
- They are often in tension: batching increases throughput but adds latency

## Latency Numbers Everyone Should Know

| Operation | Approximate Time |
|---|---|
| L1 cache reference | 0.5 ns |
| L2 cache reference | 7 ns |
| RAM reference | 100 ns |
| SSD random read | 150 µs |
| HDD seek | 10 ms |
| Same datacenter round trip | 0.5 ms |
| Cross-region round trip | 150 ms |

## SLI / SLO / SLA

- **SLI** (Indicator): actual measured metric (e.g., 99th percentile latency = 120 ms)
- **SLO** (Objective): target for SLI (e.g., p99 < 200 ms, 99.9% of the time)
- **SLA** (Agreement): contract with customer; breach triggers compensation
- **Error Budget**: allowed downtime from SLO (99.9% → 8.7 h/year)

## Back-of-Envelope Estimation

| Unit | Value |
|---|---|
| 1 million requests/day | ~12 req/s |
| 1 billion requests/day | ~12,000 req/s |
| 1 KB × 1 billion | 1 TB |
| Average web request | ~1 KB |
| Average image | ~300 KB |
| 1 Gbps bandwidth | ~125 MB/s |

## Concurrency vs Parallelism

- **Concurrency**: dealing with multiple tasks at once (I/O multiplexing, event loop)
- **Parallelism**: executing multiple tasks simultaneously (multi-core CPU)
- Most web servers use concurrency (async I/O) not true parallelism
