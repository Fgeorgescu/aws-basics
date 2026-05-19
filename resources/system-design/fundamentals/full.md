# System Design Fundamentals — Full Reference

## CAP Theorem in Practice

Eric Brewer's CAP theorem states that a distributed system can guarantee at most two of: Consistency, Availability, and Partition Tolerance. Since network partitions are a physical reality you cannot prevent (cables get cut, routers fail, datacenters lose connectivity), every distributed system must choose whether to remain **consistent** or **available** during a partition.

**CP systems** like HBase, Zookeeper, and etcd choose consistency: when a partition occurs, a minority partition refuses to serve requests rather than risk returning stale data. This is the right choice for coordination services (leader election, distributed locks) where a stale answer is dangerous.

**AP systems** like Cassandra, DynamoDB (in eventual consistency mode), and CouchDB choose availability: every node continues serving requests even if it's partitioned from the rest of the cluster, accepting that some reads may return stale data. This is right for social feeds, shopping carts, and user preferences where being slightly stale is acceptable.

**PACELC** extends CAP: even without partitions (the "else" case), you trade **Latency** for **Consistency**. Synchronous replication is consistent but slow; async replication is fast but eventually consistent. This is the more relevant daily trade-off for most system designers.

## ACID vs BASE in Detail

**ACID** properties give you a reliable transaction model in relational databases:

- **Atomicity**: the transaction either commits completely or rolls back entirely — no partial states. Implemented via WAL (Write-Ahead Logging) and undo logs.
- **Consistency**: every transaction moves the database from one valid state to another, respecting all constraints, triggers, and cascades.
- **Isolation**: concurrent transactions behave as if they executed serially. The actual isolation level (Read Uncommitted → Serializable) trades consistency for performance.
- **Durability**: committed transactions survive crashes. Achieved via WAL being flushed to disk before ACK.

**Isolation Levels and Their Trade-offs:**

| Level | Dirty Read | Non-Repeatable Read | Phantom Read |
|---|---|---|---|
| Read Uncommitted | Possible | Possible | Possible |
| Read Committed | Prevented | Possible | Possible |
| Repeatable Read | Prevented | Prevented | Possible |
| Serializable | Prevented | Prevented | Prevented |

Most databases default to Read Committed (Postgres) or Repeatable Read (MySQL InnoDB). Serializable is correct but expensive.

**BASE** is the trade-off NoSQL systems make:

- **Basically Available**: the system responds to every request, though the response might indicate failure or return stale data.
- **Soft State**: data may be in transition; you cannot assume it has reached its final state at any given moment.
- **Eventually Consistent**: given enough time without new writes, all replicas will converge to the same value.

## Consistency Models Unpacked

Consistency is a spectrum, not a binary. Understanding where different systems fall helps you choose the right tool:

**Eventual consistency** means writes propagate asynchronously. A read immediately after a write might return the old value. DNS is the canonical example — a record update propagates globally in minutes to hours. Cassandra, DynamoDB (default), and most NoSQL databases work this way.

**Read-your-writes consistency** is a special case where you always see your own updates. Even if the system is eventually consistent, your own writes are immediately visible to you. Implemented by routing your reads to the primary or by tagging writes with a version you then use to verify reads.

**Causal consistency** preserves the happens-before relationship. If Alice posts "I uploaded a photo" and then Bob comments on it, anyone who sees Bob's comment must also see Alice's post. This is stronger than eventual but weaker than sequential. Systems like MongoDB (with causally consistent sessions) implement this.

**Linearizability** (also called strong consistency or atomic consistency) is the strongest guarantee: every operation appears to take effect instantaneously at some point between its invocation and response, and all operations appear in a total order consistent with real time. Zookeeper, etcd (via Raft), and Google Spanner are linearizable.

## Scalability — Why Statelessness Matters

**Vertical scaling** has a hard ceiling. The largest EC2 instance is `u-24tb1.metal` with 24 TB RAM. Beyond that, you cannot scale a single machine further. Vertical scaling also creates risk: one large machine is a single point of failure.

**Horizontal scaling** distributes load across many commodity machines. It requires your application to be stateless — no per-process state that makes one request depend on being handled by the same server as a previous request.

The classic anti-pattern is in-process session storage. If a user's session is in memory on Server A, they'll get a 401 if load-balanced to Server B. Solutions:

1. **Sticky sessions**: load balancer always routes the same user to the same server. Breaks horizontal scaling; hides the problem.
2. **Shared session store**: all servers read/write sessions from Redis. True statelessness achieved.
3. **Stateless tokens (JWT)**: session state is signed and held by the client. Server validates signature, no shared store needed.

## Latency Numbers as Design Constraints

Understanding orders of magnitude separates good designs from great ones. When you reach for a remote DB call to serve every HTTP request, you're making a choice: one network round trip (0.5 ms same datacenter) plus DB query time (1–100 ms depending on index use) for every user click.

A page that makes 10 sequential DB calls will have a minimum latency of 10–50 ms from DB alone, before any compute or serialization time. The fix is always: parallelize independent calls, cache computed results, push computation earlier in the pipeline.

The key insight: **RAM is 10,000× faster than disk, and disk is 100× faster than network**. Cache hot data in memory; avoid unnecessary disk I/O; minimize network hops.

## SLOs and Error Budgets in Practice

A 99.9% SLO sounds strict but allows 8.7 hours of downtime per year. A 99.99% SLO allows only 52 minutes. The difference in engineering investment between these two is enormous.

Error budgets operationalize this: if your SLO is 99.9%, your error budget is 0.1% of requests can fail. Engineering teams track error budget burn rate. If you're burning budget too fast, you slow down feature releases and focus on reliability. If you have budget left, you can accept more risk with new deployments.

The error budget concept aligns incentives: both reliability (SRE) and velocity (dev) teams share the budget. Exhausting it hurts everyone's goals.

## Back-of-Envelope: Building Intuition

The skill that separates good system design answers is the ability to quickly size a system without a calculator. The key numbers:

- **Byte size**: char = 1B, UUID = 36B, average tweet = 140B, average user record = 1KB
- **Time**: 1 request/s × 86,400 s/day ≈ 86K requests/day; 1M requests/day ≈ 12 req/s
- **Storage**: 1M users × 1KB = 1GB; 1B rows × 100B = 100GB
- **Bandwidth**: 1KB × 1M req/s = 1GB/s = 8Gbps (need multiple 10Gbps links)

When estimating, always state your assumptions clearly: "I'll assume average request size is 1KB and we need 10 years of retention, which gives us..."

## Amdahl's Law — Why Parallelism Has Limits

If 5% of your program is serial (cannot be parallelized), adding infinite CPUs never speeds it up more than 20×. This governs system design trade-offs: if your critical path has 5 synchronous serial steps and each is 10ms, you cannot reduce end-to-end latency below 50ms regardless of how many servers you add. Break the serial chain: parallelize independent operations, cache intermediate results, and push work asynchronously when order doesn't matter.
