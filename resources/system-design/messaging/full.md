# Messaging & Streaming — Full Reference

## Why Async Messaging?

Synchronous request-response (REST/gRPC) couples caller and callee: both must be running, the caller blocks waiting for the response, and failures in the callee fail the caller. This coupling is fine for real-time read operations but creates problems for write-heavy workflows:

- A user completes checkout: you need to charge their card, update inventory, send a confirmation email, trigger warehouse fulfillment, and notify the analytics pipeline. Doing all this synchronously means the user waits 2–5 seconds and the checkout fails if any downstream service is down.
- With async messaging: checkout writes the order to DB and publishes one event. The user gets a response in 100ms. All downstream work happens independently and can retry failures without affecting the user experience.

The trade-off: eventual consistency. The user may get "Your order is confirmed" before inventory is actually decremented. For most e-commerce, this is fine (inventory checks happen at add-to-cart time). For financial transactions, you may need stricter guarantees.

## Kafka Architecture In Depth

Kafka is a distributed commit log. Understanding it at this level separates senior candidates:

**The log abstraction**: Kafka topics are append-only logs. Producers append records; consumers read from any offset they choose. Unlike a traditional queue where consuming removes the message, Kafka retains messages for a configured period (default 7 days). Multiple consumer groups can read the same topic independently — each group tracks its own offset.

**Partitions and ordering**: ordering is guaranteed within a partition, not across partitions. If you have 3 partitions and write messages A, B, C in order, B might land on partition 2 while A lands on partition 1. If global ordering matters (e.g., all events for a user must be in order), use a **partition key**: `key=user_id` ensures all events for the same user go to the same partition.

**Consumer groups and parallelism**: within a consumer group, each partition is assigned to exactly one consumer. To add more consumers, you add more partitions. A group with 3 consumers reading a 3-partition topic achieves maximum parallelism. A 4th consumer would be idle. More consumers than partitions → some consumers are idle. Fewer consumers than partitions → some consumers handle multiple partitions.

**Producer acknowledgments** (`acks` config):
- `acks=0`: fire and forget. Fastest, but lost messages on broker failure.
- `acks=1`: leader ACKs, then async replication. Fast but message lost if leader crashes before replication.
- `acks=all` (or `-1`): all in-sync replicas ACK. Slowest but no data loss.

**Idempotent producers** (`enable.idempotence=true`): producer assigns sequence numbers to messages; broker deduplicates retries. Eliminates duplicates from producer-side retries. Combined with `acks=all`, gives exactly-once at the producer level.

**Transactions** in Kafka: producer can write to multiple partitions atomically. Consumer can commit offset and publish to another topic atomically. This is how Kafka Streams achieves exactly-once processing: read → process → write all committed atomically.

**Log compaction**: for changelog topics, Kafka can compact: only retain the latest record per key. The topic becomes an eventually consistent snapshot — reading all records gives you the current state. Used heavily in Kafka Streams (KTable) and CDC (Change Data Capture) pipelines.

## Choosing Between SQS, SNS, and Kinesis

**SQS (Simple Queue Service)** is a traditional queue: a message is consumed by one consumer and deleted. It absorbs load spikes (messages queue up when consumers are slower than producers), enables independent scaling of producers and consumers, and provides built-in retry with DLQ.

Use SQS for: background job processing (image resizing, email sending, report generation), any "do this once" task dispatch, decoupling two services that don't need real-time or ordering guarantees.

**SQS FIFO** adds exactly-once processing and ordering within a message group. Throughput is limited (3,000 msg/s with batching) compared to standard SQS (unlimited). Use FIFO only when ordering truly matters.

**SNS (Simple Notification Service)** is pure pub/sub: one message, multiple subscribers. Used for fan-out: a single event (order placed) triggers multiple actions (SQS queues for email, inventory, analytics). SNS is the entry point; SQS queues are the delivery targets.

**SNS + SQS fan-out pattern**: SNS topic → multiple SQS queues. Each subscriber has its own queue (so a slow consumer doesn't block others) and can scale independently. This is the AWS-native fan-out solution.

**Kinesis Data Streams** is the AWS equivalent of Kafka for real-time streaming. Key differences from Kafka:
- Managed (no brokers to run, scale by adding shards)
- 7-day retention max (vs Kafka's configurable unlimited with tiered storage)
- Enhanced fan-out: dedicated 2 MB/s throughput per consumer per shard (vs shared 2 MB/s in standard)
- Pricing based on shard-hours and PUT units

Use Kinesis for: real-time analytics pipelines, clickstream processing, log aggregation, where you don't want to run Kafka yourself.

## Event Sourcing In Practice

Traditional CRUD databases record only current state: when a bank balance changes from $1000 to $900, you update a row. All history of why is gone (unless you implemented an audit log separately).

Event sourcing flips this: you record every event that caused a state change — `MoneyWithdrawn { amount: 100, merchant: "Starbucks", timestamp: ... }`. Current state is derived by replaying all events for an entity.

**Benefits in practice**:
- **Complete audit trail**: every state change has a who/what/when/why record.
- **Temporal queries**: what was the account balance on January 15th? Replay events up to that timestamp.
- **Debugging**: you can replay exactly what happened to reproduce a production bug.
- **Multiple projections**: the same event stream drives a relational "balance" view, an analytics "spending by category" view, and a ML training dataset — independently.

**Challenges in practice**:
- **Schema evolution**: events are immutable. Changing the schema of past events requires an upcaster (a function that transforms old event format to new). This is the #1 operational challenge.
- **Query complexity**: you can't do `SELECT * FROM account WHERE balance > 1000` directly. You must build and maintain projections (read models) for every query pattern.
- **Snapshots**: after thousands of events, replaying from the beginning is too slow. Snapshots periodically capture current state; replay from latest snapshot.
- **Event ordering**: events for the same entity must be applied in order. Concurrency requires optimistic concurrency control (version number on event stream; reject writes to outdated version).

## CQRS and Projections

CQRS separates the write model (commands that mutate state) from the read model (queries that read state). Without CQRS, you optimize your schema for both writing (normalized, constrained) and reading (denormalized, joined) simultaneously — a tension that leads to compromise.

With CQRS:
- **Write side**: strict validation, domain logic, ACID transactions, normalized schema in Postgres
- **Read side**: denormalized tables or documents optimized for specific UI queries, possibly in Elasticsearch or MongoDB or Redis

The read model is populated by **projections**: event handlers that listen to events from the write side and update the read model. Projections are eventually consistent — there's a small lag between a command completing and the read model reflecting it.

**Practical example**: an order management system.
- Command: `PlaceOrder({ items, shipping, payment })` → validates inventory, charges card, writes `OrderPlaced` event to event store.
- Projection A: listens to `OrderPlaced` → updates `orders` Postgres table for the admin dashboard.
- Projection B: listens to `OrderPlaced` → updates Elasticsearch `orders` index for full-text search.
- Projection C: listens to `OrderPlaced` → updates `user_order_counts` Redis key for the account page.

If a projection falls behind, you rebuild it by replaying the event stream from the beginning — the event store is the source of truth.

## Exactly-Once Delivery — The Reality

True exactly-once processing end-to-end is theoretically impossible without coordination between the message broker, the consumer, and any external side effects (DB writes, API calls).

The practical approaches:

**At-least-once + idempotent consumers**: the consumer may process a message multiple times (due to retries, rebalancing, crashes). If the consumer's action is idempotent (checking and creating with a dedup key), the result is correct regardless of how many times it's processed.

**Transactional outbox + polling publisher**: the producer writes the event to an outbox table in the same DB transaction as the business operation. A separate process reads undelivered events and publishes them. Exactly-once from the producer's perspective; the consumer still needs to be idempotent.

**Kafka exactly-once** (within Kafka ecosystem only): using Kafka Streams or the transactional producer API, you can achieve exactly-once processing within a Kafka-to-Kafka pipeline. External side effects (REST API calls, non-Kafka DB writes) break this guarantee.

The most robust real-world pattern is **at-least-once delivery + idempotent consumers + deduplication storage**. It's simpler to reason about and handles the cases that "exactly-once" brokers claim to handle but often don't under failure scenarios.
