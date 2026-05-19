# Distributed Systems — Full Reference

## Why Distributed Systems Are Hard

Single-machine programs have one execution environment: one CPU, one memory space, one clock, one storage subsystem. When something fails, it fails completely and you know immediately.

Distributed systems have partial failures: one of twenty nodes is slow (not failed), two of three replicas received a write (not all), the network dropped 0.01% of packets. Designing for partial failures — where the system must detect, adapt to, and recover from these scenarios — is the core challenge.

The fundamental problems:
- **Unreliable networks**: packets are delayed, reordered, or dropped. You can't distinguish "slow node" from "dead node" without timeouts, but timeouts create false negatives.
- **Unreliable clocks**: NTP synchronization has bounded error, not zero error. You can't rely on timestamps for ordering across nodes.
- **Partial failures**: a process can crash mid-operation, leaving state half-updated.
- **No shared memory**: coordination requires network communication, which has all the above problems.

## Raft — The Understandable Consensus Algorithm

Raft was designed specifically to be easier to understand than Paxos while providing equivalent guarantees. Its paper is titled "In Search of an Understandable Consensus Algorithm."

**Three roles**: Leader, Follower, Candidate. At any time, at most one Leader exists per term.

**Leader election**: all nodes start as Followers with a random election timeout (150–300ms). If a Follower doesn't hear from a Leader before timeout, it becomes a Candidate, increments its term, votes for itself, and sends RequestVote RPCs. A node grants a vote if: it hasn't voted this term, and the candidate's log is at least as up-to-date as its own. If a Candidate receives majority votes, it becomes Leader and immediately sends heartbeats to prevent new elections.

**Log replication**: the Leader receives all client requests and appends them to its log. It then sends AppendEntries RPCs to all Followers (also serves as heartbeats). An entry is **committed** once the Leader has received confirmation from a majority. The Leader then notifies Followers to apply the committed entry to their state machine.

**Safety properties**:
- **Election Safety**: at most one leader per term (majority vote requirement enforces this)
- **Leader Append-Only**: leaders never overwrite entries; only append
- **Log Matching**: if two logs contain an entry with same index and term, all entries up to that index are identical (enforced by AppendEntries consistency check)
- **Leader Completeness**: if an entry is committed in a given term, it will be present in all future leaders' logs
- **State Machine Safety**: if a server has applied a log entry at a given index, no other server will ever apply a different entry for that index

## Distributed Transactions in Practice

The fundamental challenge: you have two databases (or microservices with their own DBs), and you need an operation to either succeed on both or fail on both. There's no shared transaction log.

**Two-Phase Commit (2PC) failure modes**:

The coordinator sends "Prepare" to both participants. Both respond "Ready." Then the coordinator crashes before sending "Commit." The participants are now in an uncertain state — they've locked resources and can't unilaterally commit or abort. They must wait for the coordinator to recover. This is the **blocking** problem with 2PC.

Optimizations: coordinator writes commit decision to its own WAL before sending Commit messages, so after recovery it can replay the decision. Participants can query each other to determine the outcome (cooperative termination).

Despite its flaws, 2PC is widely used in practice for same-datacenter cross-shard transactions where coordinator failure is rare and recovery is fast (XA transactions in MySQL, distributed transactions in SQL Server).

**Saga choreography** example — hotel booking:

```
BookFlight → [FlightBooked event]
                → BookHotel → [HotelBooked event]
                                → ChargeCard → [PaymentCharged event]
                                                → ConfirmBooking

If ChargeCard fails:
  → CompensateHotel (cancel hotel booking)
  → CompensateFlight (cancel flight booking)
```

Each service listens for events and publishes its own. No central coordinator. Failure triggers compensating transactions in reverse order. **Challenge**: what if the compensating transaction also fails? You need a retry mechanism for compensations, and eventually a human escalation path.

**Saga orchestration** example:

```
SagaOrchestrator:
  1. Call FlightService.Book()
  2. If OK: Call HotelService.Book()
  3. If OK: Call PaymentService.Charge()
  4. If any step fails: call compensating transactions in reverse
```

The orchestrator is stateful (stores which steps completed) and can resume after a crash. Simpler to reason about than choreography. The downside is coupling: all services are coupled to the orchestrator interface.

## Consistent Hashing — Mathematical Intuition

The key insight: use the same hash function to map both servers and keys to the same circular ring (modular arithmetic space, typically 0 to 2^32).

When looking up where to store key K:
1. Compute `hash(K)` → position P on ring
2. Walk clockwise from P until you hit a server
3. That's the server responsible for K

When a server is added at position S:
- Only keys in the arc (predecessor_of_S, S] need to move to the new server
- All other keys are unaffected

The probability that any given key belongs to the arc that changes is `arc_size / ring_size = 1/N`. So in expectation, only 1/N of keys need to move.

**Virtual nodes implementation**: instead of placing each physical server at one point on the ring, create K virtual nodes per physical server, each at a different ring position. Common values: K=150 (Cassandra default). Each virtual node `server_i_vnode_j` hashes to a different position. When physical server A is removed, its 150 virtual nodes' keys are distributed across 150 different segments of the ring, each assigned to a different physical server. The resulting load redistribution is smooth.

## Vector Clocks and Conflict Resolution

Physical clocks tell you what time an event happened. Vector clocks tell you whether two events have a causal relationship, which is often more useful.

A vector clock for N nodes is an N-dimensional vector. Each node increments its own position on every operation. When sending a message, a node includes its current vector. The receiver merges: takes element-wise maximum and increments its own.

**Determining causality**:
- `V1 < V2` (V1 happens-before V2): every element of V1 ≤ corresponding element of V2, and at least one is strictly less.
- **Concurrent events**: neither V1 < V2 nor V2 < V1. They have no causal relationship.

Concurrent events in a distributed database represent conflicts that need resolution.

**Last-Write-Wins (LWW)**: keep the event with the higher timestamp. Simple but loses data — the other concurrent write is discarded. Widely used (DynamoDB default, Cassandra default) because it's operationally simple even though it loses writes.

**Multi-value register**: keep all concurrent values (as DynamoDB does internally with its versioning system). Surface the conflict to the application. The application decides how to merge. Amazon's shopping cart used this approach — if you add items on two devices offline, both lists merge rather than one being discarded.

**CRDTs**: mathematically guaranteed to converge without coordination. The most practical CRDT is a **G-Counter** (grow-only counter): each node maintains its own counter; the global count is the sum. Merging is element-wise maximum. This is how distributed view count or like count systems work.

## The Fallacies of Distributed Computing

Peter Deutsch's eight fallacies — assumptions developers make about distributed systems that are false:

1. **The network is reliable** — packets get dropped, delayed, reordered
2. **Latency is zero** — network calls are 3–6 orders of magnitude slower than in-process calls
3. **Bandwidth is infinite** — serialization, compression, and data transfer add up
4. **The network is secure** — treat internal network as untrusted; use mTLS
5. **Topology doesn't change** — servers fail, IPs change, services move
6. **There is one administrator** — multiple teams own different parts; coordination is required
7. **Transport cost is zero** — cloud egress costs real money; data gravity matters
8. **The network is homogeneous** — different paths have different characteristics

These fallacies explain why naive "just call the remote service like it's a local function" approaches fail at scale. Every remote call needs: timeout, retry logic, circuit breaking, error handling for partial failures, and observability.

## Coordination Services: Zookeeper and etcd

Both provide primitively simple APIs (key-value store with watches and TTL) that enable building complex distributed primitives:

**Distributed locks**:
1. Create an ephemeral node `/locks/my_resource_<sequentialNumber>`
2. List children of `/locks/my_resource*`; sort by sequence number
3. If your node is smallest: you hold the lock
4. Else: watch the node with next smaller sequence number; wait for it to disappear

The ephemeral node auto-deletes when the holder's session dies, preventing lock starvation from crashed holders.

**Leader election** uses the same mechanism — whoever has the smallest sequence number is the leader.

**Service discovery**: services register their address as ephemeral nodes. Clients watch the directory for changes. No separate service registry needed.

**etcd** (used by Kubernetes for all cluster state) uses Raft for consensus, provides linearizable reads (you can optionally request serializable for lower latency), and has a gRPC API. More modern than Zookeeper, with better tooling and API design.
