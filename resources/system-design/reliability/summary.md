# Reliability Patterns

## Circuit Breaker

Three states:
- **Closed** (normal): requests pass through; failure count tracked
- **Open** (tripped): requests fail fast without calling downstream; no wasted resources
- **Half-Open** (probing): one request allowed through; if success → Closed; if fail → Open

```
Config: failureThreshold=5, timeout=30s, halfOpenMax=1
```

- Prevents cascading failures when a dependency is degraded
- Libraries: Resilience4j (Java), Polly (.NET), Hystrix (legacy), AWS SDK built-in

## Retry with Exponential Backoff + Jitter

```
delay = min(cap, base * 2^attempt) + random_jitter
```

| Attempt | Base Delay | With Jitter |
|---|---|---|
| 1 | 100ms | 70–130ms |
| 2 | 200ms | 140–260ms |
| 3 | 400ms | 280–520ms |
| 4 | 800ms | 560–1040ms |

- **Only retry idempotent operations** (GET, PUT); never retry non-idempotent without deduplication
- Retry on: network timeout, 429, 503 — not on 400, 401, 404 (client errors, no point retrying)
- Set **max retries** and **total timeout budget** to avoid indefinite stalling

## Timeout

- Every external call must have a timeout — never block indefinitely
- Three types:
  - **Connection timeout**: time to establish TCP connection (e.g., 2s)
  - **Read timeout**: time waiting for response bytes (e.g., 30s)
  - **Request timeout**: total end-to-end budget including retries (e.g., 60s)
- Propagate deadlines via headers (`X-Request-Deadline`) or context (gRPC deadline)

## Bulkhead Pattern

- Isolate failures by partitioning resources (thread pools, connection pools, semaphores)
- If one service degrades, its bulkhead absorbs the damage; other services keep separate pools
- Ship analogy: watertight compartments prevent one breach from sinking the whole ship

## Rate Limiting (Service Self-Protection)

- Protect your own service from being overloaded by upstream clients
- Also protect downstream dependencies by throttling your own call rate

## Health Checks

| Type | Endpoint | Checks |
|---|---|---|
| **Liveness** | `/health/live` | Process is alive (not deadlocked) |
| **Readiness** | `/health/ready` | Ready to receive traffic (DB connected, caches warm) |
| **Startup** | `/health/startup` | App has finished initialization |

- K8s uses all three; load balancers typically use liveness/readiness
- Deep health checks: verify DB connection, queue connectivity, critical dependencies

## Graceful Degradation

- When a dependency fails, return **degraded but functional** response instead of error
- Examples:
  - Recommendation service down → show popular items (cached)
  - Search unavailable → return error message but shopping cart still works
  - Payment service slow → queue the request and notify async

## Idempotency (Reliability Perspective)

- Retry safety depends on idempotency
- Implement via **idempotency keys** stored in DB with result for 24h–7 days
- Critical for: payment processing, order creation, email sending

## Observability Triangle

```
Metrics → "Is something wrong?"
Logs    → "What happened?"
Traces  → "Where did it go wrong?"
```

| Signal | Tool | Use |
|---|---|---|
| **Metrics** | Prometheus, CloudWatch, Datadog | Alerting, dashboards, SLO tracking |
| **Logs** | ELK, Splunk, CloudWatch Logs | Debugging, audit trail |
| **Traces** | Jaeger, X-Ray, Zipkin | Latency breakdown, dependency mapping |

### Key Metrics to Track
- **RED**: Rate, Errors, Duration (for each service)
- **USE**: Utilization, Saturation, Errors (for each resource)
- **Four Golden Signals**: Latency, Traffic, Errors, Saturation

## Chaos Engineering

- Deliberately inject failures to verify resilience
- Process:
  1. Define steady state (normal behavior baseline)
  2. Hypothesize failure impact
  3. Inject failure in production or staging
  4. Observe and compare to steady state
- Tools: Chaos Monkey (Netflix), AWS Fault Injection Simulator, Gremlin

## Data Durability Patterns

| Pattern | How | RTO | RPO |
|---|---|---|---|
| **Snapshots** | Periodic full backup | Hours | Hours |
| **WAL shipping** | Continuous transaction log | Minutes | Seconds–minutes |
| **Synchronous replication** | Write confirmed on 2+ nodes | Seconds | 0 |
| **Async replication** | Write confirmed on primary only | Seconds | Seconds–minutes |

## Failure Modes to Design For

- Network partition / packet loss
- Dependency timeout / slowdown (not hard crash)
- Data corruption (bad writes, byte flips)
- Memory leak / CPU runaway (gradual degradation)
- Cold start / thundering herd after restart
- Clock skew between nodes
- Partial failure in distributed transaction
