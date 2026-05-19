# System Design Glossary

## ACID — Atomicity, Consistency, Isolation, Durability
Relational database transaction guarantees. Atomic = all-or-nothing; Consistent = constraints always satisfied; Isolated = concurrent transactions don't interfere; Durable = committed data survives crashes. Contrast with BASE.

## API Gateway — API Gateway
Entry-point proxy that handles auth, rate limiting, routing, SSL termination, and observability for all inbound API traffic. Examples: AWS API Gateway, Kong, Envoy.

## Availability — Availability
Fraction of time a system is operational. Expressed as "nines": 99.9% = 8.7 h/year downtime; 99.99% = 52 min/year. Availability = MTBF / (MTBF + MTTR).

## BASE — Basically Available, Soft State, Eventually Consistent
NoSQL consistency model. Trades ACID guarantees for higher availability and horizontal scalability. Contrast with ACID.

## Bloom Filter — Bloom Filter
Probabilistic data structure that tests set membership. Returns "definitely not in set" or "probably in set" (false positives possible, false negatives never). Space-efficient: 1B entries ≈ 1.2 GB at 1% FPR. Used in Cassandra, CDN routing, Chrome safe browsing.

## CAP — Consistency, Availability, Partition Tolerance
Theorem: a distributed system can guarantee at most two of C, A, P. Since network partitions are unavoidable, systems choose CP (consistent, sacrifices availability during partition) or AP (available, may return stale data).

## CDC — Change Data Capture
Pattern for capturing row-level DB changes (inserts, updates, deletes) and streaming them to downstream consumers. Implemented via DB transaction log tailing. Tools: Debezium, AWS DMS. Used for event sourcing, search index sync, cache invalidation.

## Circuit Breaker — Circuit Breaker
Pattern that stops calling a failing service after a threshold of failures (Open state), periodically probes for recovery (Half-Open), and resumes normal traffic when healthy (Closed). Prevents cascading failures.

## CQRS — Command Query Responsibility Segregation
Architectural pattern separating write operations (commands) from read operations (queries). Each side can use a different data model and storage technology, optimizing for its access pattern.

## CRDT — Conflict-free Replicated Data Type
Data structure that can be merged across replicas without coordination and is mathematically guaranteed to converge. Examples: G-Counter, OR-Set, LWW-Register. Used for distributed collaboration without consensus overhead.

## Consistent Hashing — Consistent Hashing
Ring-based key routing algorithm where adding/removing a node only remaps adjacent keys (1/N of all keys) rather than all keys. Used in Cassandra, DynamoDB, Memcached, CDN routing.

## DLQ — Dead Letter Queue
Queue that receives messages that fail processing after maximum retries. Prevents poison-pill messages from blocking the main queue. Triggers alerts for manual inspection.

## Event Sourcing — Event Sourcing
Storing every state change as an immutable event, deriving current state by replaying the event log. Provides full audit history, temporal queries, and multiple read projections. Paired often with CQRS.

## FPR — False Positive Rate
In probabilistic data structures (Bloom filters): fraction of membership queries that incorrectly return "present" for elements not in the set. Configurable by tuning filter size and hash count.

## gRPC — Google Remote Procedure Call
High-performance RPC framework using Protocol Buffers (binary serialization) over HTTP/2. Supports bidirectional streaming. Used for internal microservice communication. ~3-10× more compact than JSON.

## GraphQL — GraphQL
Query language and runtime for APIs. Clients specify exactly what data they need, eliminating over-fetching. Schema-first, strongly typed. Trade-offs: HTTP caching is harder, authorization must be per-field, no HTTP-level error codes.

## HATEOAS — Hypermedia as the Engine of Application State
REST constraint where API responses include links to related actions/resources. Allows clients to navigate the API without out-of-band documentation. Rarely implemented fully in practice.

## Idempotency — Idempotency
Property where applying an operation multiple times produces the same result as applying it once. Critical for safe retries. GET, PUT, DELETE are idempotent; POST is not by default. Implemented via idempotency keys.

## JWT — JSON Web Token
Signed, base64url-encoded token containing claims (user ID, roles, expiry). Stateless authentication: server validates signature without a DB lookup. Three parts: header.payload.signature. Never put secrets in payload — it is only encoded, not encrypted.

## L4 / L7 — Layer 4 / Layer 7 Load Balancer
L4 (Transport): routes by IP/port; no HTTP awareness; very fast. L7 (Application): routes by URL, headers, cookies; supports SSL termination, path-based routing, WebSocket upgrades.

## Latency — Latency
Time for a single operation to complete (milliseconds). Described by percentiles: p50 (median), p99 (worst 1%), p999 (worst 0.1%). Optimize with caching, indexing, co-location, parallelism.

## LRU — Least Recently Used
Cache eviction policy: evict the entry that has not been accessed for the longest time. Most common default. Contrast with LFU (Least Frequently Used) for skewed access patterns.

## MTBF — Mean Time Between Failures
Average operational time between system failures. Higher MTBF = more reliable. Used with MTTR to calculate availability.

## MTTR — Mean Time To Recovery
Average time to restore service after a failure. Lower MTTR = faster recovery. Improved by automation, runbooks, observability, and chaos engineering.

## Outbox Pattern — Transactional Outbox
Reliably publish events by writing to an outbox table in the same DB transaction as the business operation, then a separate publisher reads and delivers. Guarantees at-least-once delivery without distributed transactions.

## PACELC — Partition, Availability, Consistency, Else, Latency, Consistency
Extension of CAP: even without partitions, there is a trade-off between latency and consistency. Synchronous replication = consistent but slow; async = fast but eventually consistent.

## Protobuf — Protocol Buffers
Google's binary serialization format used by gRPC. Schema defined in .proto files, compiled to typed client/server stubs. 3–10× smaller and faster than JSON. Not human-readable.

## Quorum — Quorum
In replication: minimum number of nodes that must agree for an operation to succeed. W (write quorum) + R (read quorum) > N (total replicas) guarantees overlap, ensuring reads always see the latest committed write.

## Rate Limiting — Rate Limiting
Controlling how many requests a client can make in a time window. Algorithms: Token Bucket (burst-friendly), Leaky Bucket (smooth output), Sliding Window Counter (accurate + efficient). Implemented with Redis INCR.

## RED — Rate, Errors, Duration
Service-level metric framework. Rate: requests/s. Errors: % of failed requests. Duration: latency distribution (p50/p99). Together they answer "is something wrong?" for a given service.

## Replication — Replication
Maintaining copies of data on multiple nodes for fault tolerance and read scaling. Types: single-leader (all writes to one primary), multi-leader (multiple datacenters), leaderless (quorum-based, e.g., Cassandra).

## RPO — Recovery Point Objective
Maximum acceptable data loss measured in time. RPO = 1h means you can tolerate losing up to 1 hour of data. Drives backup frequency and replication strategy.

## RTO — Recovery Time Objective
Maximum acceptable downtime after a failure. RTO = 15 min means service must be restored within 15 minutes of an incident. Drives failover automation and DR complexity.

## Saga — Saga Pattern
Distributed transaction pattern: a sequence of local transactions with compensating transactions to undo completed steps on failure. Two styles: choreography (event-driven) and orchestration (central coordinator).

## Sharding — Sharding
Horizontal partitioning of data across multiple database instances by a partition key. Strategies: range, hash, consistent hashing, directory-based. Enables write scaling beyond a single node.

## SLA — Service Level Agreement
Contractual commitment on uptime/performance. Breach triggers compensation. Always looser than the internal SLO (you need margin for the SLO to protect the SLA).

## SLI — Service Level Indicator
Actual measured metric: e.g., "99th percentile latency = 120 ms" or "error rate = 0.05%."

## SLO — Service Level Objective
Internal target for an SLI: e.g., "p99 latency < 200 ms, 99.9% of time." Breach burns error budget; sustained breach triggers reliability work over feature work.

## Snowflake ID — Snowflake ID
64-bit distributed unique ID: 41 bits timestamp (ms) + 10 bits machine ID + 12 bits sequence. Monotonically increasing (sortable by time), globally unique without coordination. Used by Twitter, Discord.

## SSE — Server-Sent Events
HTTP-based protocol for server-to-client streaming. Simpler than WebSockets (HTTP, unidirectional, auto-reconnect). Suitable for live feeds, dashboards, notification delivery.

## Throughput — Throughput
Number of operations completed per unit time (requests/s, messages/s, MB/s). Optimize with parallelism, batching, pipelining, connection pooling. Contrast with latency.

## Token Bucket — Token Bucket
Rate limiting algorithm: tokens added to bucket at rate R up to capacity C; each request consumes 1 token. Allows bursting up to C requests when bucket is full. Most burst-tolerant algorithm.

## Two-Phase Commit (2PC) — Two-Phase Commit
Distributed transaction protocol: Prepare phase (coordinator asks all participants if they can commit) → Commit phase (if all ready, coordinator tells all to commit). Strong consistency but blocking on coordinator failure.

## USE — Utilization, Saturation, Errors
Resource-level metric framework. Utilization: % busy. Saturation: queue depth / wait time. Errors: error events. Applies to CPU, memory, disk, network interfaces.

## Vector Clock — Vector Clock
Mechanism for tracking causality across distributed nodes without synchronized clocks. N-dimensional counter vector, one per node. Determines happens-before relationships and identifies concurrent (conflicting) events.

## WAL — Write-Ahead Log
Append-only log written before applying changes to the data files. Enables crash recovery (replay log on restart) and replication (stream log to replicas). Foundation of durability in Postgres, Kafka, etcd.

## WebSocket — WebSocket
Full-duplex, persistent TCP connection established via HTTP Upgrade. Enables real-time bidirectional communication. Scale requires sticky sessions or a pub/sub backplane (Redis) across server instances.
