# Reliability Patterns — Full Reference

## Circuit Breaker — The Failure Absorber

The circuit breaker pattern prevents a failing downstream service from cascading failures upstream. Without it, if Service B is down and Service A synchronously calls it, every request to A hangs waiting for B's timeout (say 30s), A's thread pool exhausts, and A itself becomes unresponsive. Callers of A now cascade the same way — the failure propagates.

With a circuit breaker, after `failureThreshold` consecutive failures, the breaker trips to **Open** state and immediately fails requests without calling B. A's threads are freed, A can still handle requests (perhaps returning degraded responses), and B is given time to recover.

**Half-Open state** is the recovery probe mechanism. After the circuit has been open for `timeout` (say 30s), it allows one request through. If it succeeds → circuit closes and normal traffic resumes. If it fails → circuit opens again for another timeout period (often with backoff).

**State storage**: in a distributed system with multiple instances of Service A, each instance has its own circuit breaker state. One instance's circuit being open doesn't affect others. This is generally desirable (fast failure propagation) but means you won't trip the circuit until each instance independently observes enough failures.

**Metrics to monitor**: circuit state (closed/open/half-open), failure rate, success rate in half-open. Alert when circuit opens — it means a dependency is degraded.

## Retry Strategy — The Details Matter

**What to retry**: transient failures: network timeouts, 429 (rate limited), 503 (service unavailable). Do not retry: client errors 400/401/403/404 (retrying won't help), or operations that are not idempotent without a deduplication mechanism.

**Full Jitter vs Equal Jitter**:

- **No jitter**: all callers retry at exactly the same intervals → correlated spikes → thundering herd on recovering service
- **Full jitter**: `sleep = random_between(0, min(cap, base * 2^attempt))` — completely random within the window; maximally spreads load
- **Equal jitter**: `sleep = min(cap, base * 2^attempt) / 2 + random(0, that/2)` — ensures you at least wait half the window; slightly less spread but avoids very short waits

AWS's recommendation (and Exponential Backoff and Jitter blog post, 2015): Full Jitter for most cases; Equal Jitter when you need a minimum wait guarantee.

**Total timeout budget**: if you allow 5 retries with 30s timeouts each, a single request could consume 150 seconds of downstream latency. The caller's own timeout may expire before you finish retrying. Always consider the end-to-end timeout budget and ensure `sum(retry timeouts) < caller timeout`.

**Retry budgets** (from Google SRE): instead of per-request retry limits, maintain a ratio of retries to non-retries across all requests (e.g., no more than 10% of requests can be retries). This prevents an overloaded service from being crushed by retries during recovery.

## Timeout Design

Timeouts are one of the most commonly misconfigured reliability controls. Too short → false failures, unnecessary retries. Too long → threads pile up, cascading failures, bad user experience.

**Empirical approach**: measure your p99 latency for each external call in production. Set timeout to ~2× p99. If p99 is 200ms, set timeout to 400ms. Anything taking longer than 2× p99 is almost certainly either broken or so slow it's useless.

**Context propagation**: modern services pass deadlines through service call chains. If a user request has a 2-second budget, and Service A takes 500ms, Service B should know it only has 1.5 seconds. In Go, this is `context.WithDeadline`. In gRPC, deadlines propagate automatically. Without propagation, Service D (4 hops deep) may not know the caller's budget is already exhausted.

**Connection timeouts vs read timeouts**: always set both separately. A connection timeout of 2s prevents waiting forever for TCP handshake (appropriate for service discovery issues). A read timeout of 30s allows legitimate long-running operations. Setting only one leaves the other unbounded.

## Bulkhead — Isolating Failure Domains

Named after ship compartments, bulkheads prevent one failure from consuming all shared resources.

**Thread pool isolation**: instead of one shared thread pool for all outbound calls, each downstream dependency gets its own pool. If calls to Service B are slow and consume all 50 threads in their pool, calls to Service C (separate pool of 50) are unaffected.

**Semaphore isolation**: a lightweight alternative; limits concurrent calls to a dependency without a separate thread pool. No overhead of context switching but provides less isolation (blocking threads still count against the shared pool).

**Connection pool isolation**: each downstream DB or external service gets its own connection pool. A connection pool exhaustion to the analytics DB doesn't affect the user DB connection pool.

**Resource quotas in Kubernetes**: each pod has CPU and memory limits. A runaway pod can't consume all node resources, protecting other pods. ResourceQuotas per namespace prevent one team's deployments from starving another's.

## Observability — Implementing the Triangle

**Structured logging** is the foundation. Log in JSON, not plain text. Include: `request_id`, `user_id`, `service_name`, `duration_ms`, `status_code`, `error`. JSON logs are queryable in CloudWatch Logs Insights, Splunk, and Elasticsearch without custom parsing.

**Log levels in production**: DEBUG → only in local/staging (too verbose in prod). INFO → normal operation events. WARN → unexpected but recoverable (retry succeeded, fallback used). ERROR → requires attention, request failed. CRITICAL/FATAL → paging-level, service is down.

**Distributed tracing** links all logs and spans across a request's journey through microservices. Each request gets a `trace_id` (propagated via HTTP header `X-Trace-ID`). Each service creates a span with start time, end time, parent span ID, and tags (db.statement, http.url, error). Tools like AWS X-Ray or Jaeger visualize the flame graph of where time was spent.

**RED method metrics** per service:
- **Rate**: requests per second — is traffic normal?
- **Errors**: error rate — is something failing?
- **Duration**: latency distribution (p50, p95, p99) — is it slow?

**USE method metrics** per resource:
- **Utilization**: % of time resource is busy (CPU at 80%)
- **Saturation**: queue depth, wait time (memory near OOM, disk I/O queue long)
- **Errors**: error events (disk errors, NIC drops)

**SLO tracking**: implement synthetic monitoring (canary requests every 30s from external endpoints), not just internal metrics. Internal metrics don't tell you if the user experience is broken.

## Graceful Degradation Patterns

The principle: a system under stress should shed load gracefully, not fail catastrophically.

**Load shedding**: when request queue depth exceeds a threshold, start returning 503 to new requests rather than queuing them indefinitely. A 503 allows the caller to retry or fail fast. An indefinitely-queued request means the user waits forever.

**Feature flagging**: wrap non-critical features in feature flags with circuit-breaker-like behavior. If the recommendation service is slow, the feature flag turns off recommendations and the page still loads without them. Operations can toggle flags without a deployment.

**Stale data serving**: during a cache or DB issue, serve stale data from a secondary cache (Redis fallback, CDN cache, local in-process cache) rather than returning errors. A product page with a price that's 5 minutes stale is better than an error page.

**Graceful shutdown sequence** on SIGTERM:
1. Stop accepting new connections (deregister from load balancer/service discovery)
2. Wait for in-flight requests to complete (drain period, e.g., 30s)
3. Close DB connections, flush caches, finish async jobs
4. Exit 0

Kubernetes: `preStop` hook + `terminationGracePeriodSeconds` controls this. Without it, in-flight requests get connection resets.

## Chaos Engineering in Practice

The Netflix Chaos Monkey randomly terminates production instances to prove that no single instance failure brings down the service. This sounds reckless but forces engineering discipline: every service must be resilient to instance loss, which also makes routine deploys (which terminate instances) trivially safe.

**Structured chaos experiments**:
1. **Define steady state**: error rate < 0.1%, p99 < 500ms, no alerts firing.
2. **Hypothesize**: "If we terminate one DB read replica, the application falls back to other replicas and error rate stays below 1%."
3. **Run experiment**: terminate the replica in production (or staging) during off-peak hours.
4. **Measure**: did steady state metrics hold? Did failover happen within expected time?
5. **Fix or document**: if steady state wasn't maintained, fix the gap. If it held, document the proved resilience.

**AWS Fault Injection Simulator (FIS)**: native AWS service for chaos experiments. Can inject: EC2 instance termination, RDS failover, network latency injection (SSM-based), throttling of AWS API calls. Safer than manual chaos because experiments are defined, time-bounded, and auto-stopped.
