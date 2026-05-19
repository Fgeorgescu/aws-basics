# Distributed Systems

## Consensus Algorithms

### Raft
- Leader-based: one elected leader handles all writes; replicates to followers
- Leader election: node with most up-to-date log wins election term
- Log replication: leader sends entries → followers ACK → leader commits when majority ACK → followers commit
- **Safe**: no two leaders in same term; committed entries never lost
- Used by: etcd, CockroachDB, Consul, TiKV

### Paxos
- More theoretical predecessor to Raft; harder to implement correctly
- Two phases: **Prepare** (promise not to accept lower proposals) + **Accept** (accept value if no conflict)
- Multi-Paxos adds optimizations for leader-based continuous operation

### ZAB (Zookeeper Atomic Broadcast)
- Zookeeper's protocol; primary-backup with ordered broadcast
- All writes go through leader; followers apply in order

## Leader Election

- **Requirements**: exactly one leader at a time; elect new leader if current fails
- **Split-brain risk**: two nodes both think they are leader → data corruption
- Prevention: distributed lock with TTL (etcd, Zookeeper), or majority quorum required
- **Fencing token**: monotonically increasing token; storage layer rejects writes with old token

## Distributed Transactions

### Two-Phase Commit (2PC)
1. **Prepare**: coordinator asks all participants "can you commit?"
2. **Commit**: if all say yes → coordinator sends commit; if any says no → abort

| Pros | Cons |
|---|---|
| Strong consistency | Coordinator is single point of failure |
| | Participants block waiting for coordinator |
| | Slow (2 round trips) |

### Saga Pattern (preferred at scale)
- Break transaction into local transactions; use compensating transactions to undo on failure
- **Choreography**: event-driven, each service reacts to events and publishes own events
- **Orchestration**: central saga orchestrator calls each step and handles rollback

### 3PC (Three-Phase Commit)
- Adds a pre-commit phase to allow recovery without blocking
- Still has failure scenarios; rarely used in practice

## Consistency Hashing (Deep Dive)

```
Ring: [0 ──── node_A ──── node_B ──── node_C ──── 2^32]
Key maps to: first node clockwise from hash(key) position
```

- Adding node: only keys between new_node and its predecessor remapped
- Removing node: only keys on removed node remapped to successor
- **Virtual nodes**: each physical node maps to K positions → smoother distribution
  - Without vnodes: adding a node shifts all load to adjacent node pair
  - With vnodes (e.g., 150 per node): new node takes small shares from many existing nodes

## Vector Clocks

- Track causality between events across nodes without synchronized clocks
- Each node maintains a counter; increment own counter on each event; merge on receive
- `[A:2, B:1, C:0]` happens-before `[A:3, B:2, C:0]` if all ≤ and at least one <
- Concurrent events (neither happens-before): need conflict resolution (last-write-wins, merge, CRDTs)
- Used by: DynamoDB (version vectors), Cassandra, Riak

## CRDTs (Conflict-free Replicated Data Types)

- Data structures that can be merged without coordination, guaranteed convergence
- **G-Counter**: grow-only counter (merge = max per node)
- **PN-Counter**: increment/decrement via two G-Counters
- **G-Set**: grow-only set (merge = union)
- **OR-Set**: add/remove set with unique tags to resolve conflicts
- Used by: Redis CRDT (Enterprise), Riak, collaborative editors (like Figma multiplayer)

## Distributed Locking

| Tool | Mechanism | Concern |
|---|---|---|
| Redis (Redlock) | SET key NX PX ttl | Clock drift, network partitions can violate safety |
| Zookeeper | Ephemeral sequential znodes | Stronger guarantees; higher latency |
| etcd | Lease with TTL + CAS | Strong consistency (Raft-based) |

- Always set **TTL** on locks to prevent deadlocks on crash
- Use **fencing tokens** to protect resources from stale lock holders

## Clock Synchronization

- **Wall clock** (NTP): can go backward; not monotonic; skew across nodes is 10s of ms to seconds
- **Monotonic clock**: always increases; not comparable across machines
- **Logical clock** (Lamport): counters for ordering events without wall time
- **TrueTime** (Google Spanner): GPS + atomic clocks; bounded uncertainty window → real global order
- Rule: never trust cross-node timestamp ordering; use logical clocks or consensus for ordering

## Bloom Filters

- Probabilistic data structure: test if element is **definitely not** in set, or **probably is**
- False positives possible; false negatives never
- Space-efficient: 1 billion entries ≈ 1.2 GB at 1% false positive rate
- Used by: Cassandra (avoid disk reads for missing keys), Chrome safe browsing, CDN routing, DB query planners

## Gossip Protocol

- Nodes periodically share state with random peers; state propagates exponentially
- Scales to thousands of nodes without central coordinator
- Used for: membership (who's alive), failure detection, metadata propagation
- Examples: Cassandra (ring membership), Consul agent mesh, SWIM protocol

## Split-Brain Scenarios

- Network partition creates two node groups, each believing the other is down
- Solutions:
  - **Quorum**: require majority; minority partition stops accepting writes
  - **Arbitrator/Witness**: third node breaks ties (AWS RDS Multi-AZ)
  - **STONITH** (Shoot The Other Node In The Head): fencing — deliberately kill the other partition
  - **Epoch-based fencing**: storage layer rejects old-epoch writes
