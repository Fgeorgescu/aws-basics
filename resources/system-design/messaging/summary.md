# Messaging & Streaming

## Message Queue vs Pub/Sub vs Event Streaming

| | Message Queue | Pub/Sub | Event Streaming |
|---|---|---|---|
| Delivery | One consumer per message | All subscribers | Ordered log; replay |
| Retention | Deleted after ACK | Deleted after delivery | Retained (configurable) |
| Ordering | Per-queue FIFO | No guarantee | Per-partition ordered |
| Examples | SQS, RabbitMQ | SNS, Google Pub/Sub | Kafka, Kinesis |
| Best for | Task distribution | Fan-out notifications | Event sourcing, analytics |

## Apache Kafka

### Core Concepts
- **Topic**: named log; data written in append-only fashion
- **Partition**: unit of parallelism within a topic; ordered within partition
- **Offset**: position of a message in a partition; consumers track their own offset
- **Consumer Group**: multiple consumers sharing a topic; each partition → 1 consumer in group
- **Broker**: Kafka server; cluster has multiple brokers
- **Replication factor**: how many brokers hold a copy of each partition

### Guarantees
| Guarantee | Config |
|---|---|
| At most once | Disable retries; auto-commit offset before processing |
| At least once | Enable retries; commit offset after processing |
| Exactly once | Idempotent producer + transactional consumers |

### Throughput Patterns
- **Batching**: producer batches messages before send (tunable `linger.ms`, `batch.size`)
- **Compression**: snappy/lz4/zstd per batch
- **Partitioning**: more partitions = more parallelism; but increases coordination overhead
- **Log compaction**: Kafka retains only latest value per key (good for CDC, state stores)

## Delivery Guarantees

| Guarantee | At-Least-Once | At-Most-Once | Exactly-Once |
|---|---|---|---|
| Message lost? | Never | Possible | Never |
| Duplicate? | Possible | Never | Never |
| Complexity | Medium | Low | High |
| Use when | Idempotent consumers | Loss OK (metrics, logs) | Financial, inventory |

- Exactly-once requires **idempotent producers** + **transactional consumers** (Kafka) or **deduplication** (SQS)

## Dead Letter Queue (DLQ)

- Messages that repeatedly fail processing are moved to a DLQ
- Prevents poison pills from blocking the queue indefinitely
- Pattern: retry 3× with backoff → DLQ → alert → manual inspection

## Event Sourcing

- Store every change as an immutable event; derive current state by replaying events
- **Benefits**: full audit log, temporal queries, easy replayability, decoupled consumers
- **Drawbacks**: event schema evolution is hard; high storage; complex queries
- **Event store**: Kafka, EventStoreDB, or Postgres append-only table

## CQRS (Command Query Responsibility Segregation)

- Separate **write model** (commands, validation) from **read model** (projections, optimized queries)
- Write side emits events → read side builds denormalized views
- Enables different storage engines per side (e.g., Postgres writes, Elasticsearch reads)
- Common pairing: CQRS + Event Sourcing

## Outbox Pattern

- Problem: writing to DB and publishing to queue in same transaction is hard (two-phase commit)
- Solution: write event to an **outbox table** in the same DB transaction, then a separate process reads and publishes
- Ensures at-least-once delivery without distributed transactions
- Tools: Debezium (CDC), polling publisher

## Saga Pattern (Distributed Transactions)

| Type | How | Pros | Cons |
|---|---|---|---|
| **Choreography** | Each service listens + reacts to events | No central coordinator | Hard to trace flow |
| **Orchestration** | Central orchestrator calls each step | Explicit flow, easy to monitor | Orchestrator becomes coupling point |

- Compensating transactions roll back completed steps on failure
- Replace ACID distributed transactions when services are separate databases

## Back-pressure

- Producers generating faster than consumers can handle → queue grows unboundedly
- Solutions:
  - **Rate limiting** producers
  - **Dropping** messages (metrics use case where loss is OK)
  - **Blocking** producers (reactive streams)
  - **Scaling** consumers horizontally
  - **Increasing partitions** (Kafka) to add consumer parallelism

## SQS vs SNS vs Kafka (AWS Context)

| | SQS | SNS | Kinesis/Kafka |
|---|---|---|---|
| Type | Queue | Pub/Sub | Streaming log |
| Retention | 14 days | No retention | 7 days (Kinesis) / configurable |
| Ordering | FIFO queue only | No | Per-shard/partition |
| Replay | No | No | Yes |
| Throughput | ~3,000 msg/s standard | Millions/s | Millions/s |
| Use | Async task processing | Fan-out | Real-time pipelines |
