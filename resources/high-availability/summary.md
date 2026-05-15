# High Availability on AWS

## 1. RTO and RPO — Define Before Choosing Anything

| Metric | Definition | Drives |
|---|---|---|
| **RTO** (Recovery Time Objective) | Max acceptable downtime after a failure | Failover strategy tier |
| **RPO** (Recovery Point Objective) | Max acceptable data loss (time window) | Replication mode (sync vs async) |

| RTO Target | Strategy | Approx. Cost Multiplier |
|---|---|---|
| Hours | Pilot Light (minimal DR in standby) | ~1.1× |
| 30–60 min | Warm Standby (scaled-down DR) | ~1.3–1.5× |
| Minutes | Active-Passive (full mirror, DNS failover) | ~2× |
| Seconds | Active-Active (multi-region, live traffic) | ~3–5× |

---

## 2. The Non-Obvious HA Costs

### Inter-AZ Traffic (the silent budget killer)
- **$0.01/GB each direction** for all inter-AZ traffic, including replication.
- RDS Multi-AZ: every database write is synchronously replicated across AZs — inter-AZ transfer is charged at $0.01/GB each way on the replication stream.
- ALB with cross-zone load balancing enabled (default): ALB nodes in AZ-a send requests to targets in AZ-b → inter-AZ charge applies to every cross-AZ request.
- NAT Gateway per-AZ: 3× hourly cost (~$96/mo fixed) but **eliminates** cross-AZ transfer charges from compute to NAT.
- ElastiCache Multi-AZ: replica sync traffic is inter-AZ.

### Cross-Region Replication Costs
- **S3 Cross-Region Replication (CRR)**: S3 request charges (PUT per replicated object) + inter-region data transfer (~$0.02/GB source to destination).
- **RDS cross-region read replica**: ongoing async replication generates inter-region data transfer at standard rates (~$0.02–$0.08/GB depending on regions).
- **Aurora Global Database replication**: $0.20 per million replicated I/Os + inter-region data transfer.
- **DynamoDB Global Tables**: each write costs 1 WRU in source + 1 rWRU per additional replica region. A table with 3 regions = 3× write cost.

### Route 53 Health Check Costs
| Health Check Type | Monthly Cost |
|---|---|
| Basic (HTTP/TCP) | $0.50 |
| HTTPS / string match | $0.75 |
| Calculated (composite) | $0.50 |
| Multi-region health checks | +$1.00 per endpoint |

Monitoring 20 endpoints with HTTPS from multiple regions = ~$35/month before any DNS query charges.

### Global Accelerator vs Route 53 Failover
- **Global Accelerator**: $0.025/hr per accelerator (~$18/mo) + $0.01/GB premium data transfer on top of standard transfer rates. Provides anycast IPs and faster failover (~30s vs DNS TTL).
- **Route 53 failover**: no per-accelerator cost; health check costs apply. Failover speed limited by DNS TTL (60–300s typical).

### NLB vs ALB Cross-Zone Load Balancing
- **ALB**: cross-zone enabled by default, inter-AZ charges apply for cross-zone traffic.
- **NLB**: cross-zone disabled by default; when enabled on NLBs created after Oct 2023, **no inter-AZ charges apply**. Pre-Oct 2023 NLBs still incur charges.

---

## 3. Latency Reference

| Traffic Path | Typical RTT |
|---|---|
| Within an AZ | < 0.5 ms |
| Cross-AZ (same region) | 1–2 ms |
| us-east-1 ↔ us-west-2 | ~60 ms |
| us-east-1 ↔ eu-west-1 | ~80 ms |
| us-east-1 ↔ ap-southeast-1 | ~175 ms |
| us-east-1 ↔ ap-northeast-1 | ~155 ms |

**Implication for replication**:
- Synchronous replication (RDS Multi-AZ): ~1–2ms added write latency — acceptable.
- Synchronous cross-region: 80–175ms added write latency — generally not viable; use async.
- Aurora Global Database replication lag: typically < 1s (async, measured via `aurora_global_db_replication_lag`).

---

## 4. Failover Strategies

### Pilot Light
Minimal resources pre-deployed in DR region: AMIs, DB snapshots replicated, DNS records pre-created but pointing to primary. On failover: launch compute from AMIs, promote DB replica, flip DNS.

- **RTO**: 30–60 min (EC2 launch + DB promotion time)
- **Cost**: snapshot storage + network transfer only; no running compute in DR
- **Best for**: non-critical systems with budget constraints

### Warm Standby
Scaled-down version of production running continuously in DR region (e.g., 1 instance where prod runs 10, smallest RDS class). On failover: scale up Auto Scaling group, resize DB.

- **RTO**: 10–30 min
- **Cost**: ~20–30% of full DR cost
- **Best for**: internal systems, SLA of hours

### Active-Passive (Full Mirror)
Full production infrastructure running in DR region, idle or receiving no live traffic. Route 53 failover routing with health checks handles DNS cutover.

- **RTO**: 1–5 min (DNS TTL + health check interval)
- **RPO**: seconds to minutes (depends on replication lag)
- **Cost**: ~2× production (full duplicate infrastructure)

### Active-Active
Traffic served from multiple regions simultaneously. No failover — a region failure automatically reduces capacity but the system stays up. Requires stateless or globally replicated data tiers.

- **RTO**: 0 (no failover needed)
- **RPO**: 0 with Global Tables / Aurora Global DB
- **Cost**: 3–5× single-region (data replicated, compute duplicated, more transfer)
- **Hidden cost**: conflict resolution in data tier; architect for eventual consistency or accept 2× write costs

---

## 5. AWS Services for High Availability

### Route 53
- **Failover routing**: primary + secondary record sets with health checks. Secondary activates when primary health check fails.
- **Latency routing**: routes each user to the lowest-latency region. No health check by default — combine with failover for resilience.
- **Health check tuning**: check interval (10s fast / 30s standard), failure threshold (1–10), evaluation regions (1–3+). Faster detection = higher cost + more false positives.
- **Route 53 ARC** (Application Recovery Controller): readiness checks verify DR capacity before failover; routing controls allow manual region-level traffic shifting with API/console.

### Global Accelerator
- Two static anycast IPs; routes to nearest healthy endpoint over AWS backbone.
- Health check failover in ~30s (faster than DNS TTL-based failover).
- Use when: you need static IPs (IP allowlisting by clients), sub-60s failover, or TCP/UDP (not just HTTP).
- Not a CDN — does not cache content; routes to your origin faster.

### RDS High Availability
| Mode | Standby | Failover Time | RPO | Extra Cost |
|---|---|---|---|---|
| Multi-AZ Instance | 1 sync standby (not readable) | 60–120s | ~0 | ~2× instance |
| Multi-AZ Cluster | 2 readable standbys | ~35s | ~0 | ~3× instance |
| Cross-region read replica | Async replica | Manual promotion, 10–30 min | Minutes | Transfer + instance |
| Aurora Global DB | Up to 5 secondary regions | < 1 min (managed) | < 1s | Replication I/O + transfer |

### Aurora-Specific
- Storage is 6-way replicated across 3 AZs by default — storage HA is built in, you only pay for the compute standbys.
- Aurora Serverless v2: scales to 0.5 ACUs in standby — drastically reduces warm standby cost for variable workloads.
- Global Database: secondary regions can serve reads, reducing latency for global users even before any failover.

### DynamoDB
- Multi-AZ by default within a region (3 AZ replication) — no configuration required.
- **Global Tables**: active-active multi-region. Conflicts resolved by last-writer-wins per item. Write costs multiply per region.
- **Point-in-time recovery (PITR)**: continuous backups up to 35 days; no RTO benefit but RPO measured in seconds.

### S3 Multi-Region Access Points (MRAP)
- Single global endpoint; requests routed to the nearest S3 bucket.
- Works with Cross-Region Replication to maintain copies in each region.
- Supports **failover controls**: shift traffic between buckets via routing config (Active-Active or Active-Passive).
- Additional cost: MRAP data transfer fee ($0.0033/GB) on top of standard S3 pricing.

### ElastiCache
- **Cluster mode enabled (Redis)**: data sharded across multiple node groups, each with replicas across AZs. Failure of one shard does not affect others.
- **Multi-AZ with auto-failover**: replica in a different AZ promoted automatically on primary failure (~20–30s).
- Replication is async — potential for small data loss on failover (tune with `repl-backlog-size`).

### CloudFront Origin Failover
- Configure an origin group with a primary and secondary S3 or ALB origin.
- CloudFront retries on 5xx errors or connection timeouts to the primary, then routes to secondary.
- No additional CloudFront cost; secondary origin receives full request volume during failover.

### AWS Resilience Hub
- Analyzes your application's architecture and compares its effective RTO/RPO against your targets.
- Generates a Resiliency Score and specific recommendations (add a read replica, configure a health check, etc.).
- Integrates with CloudFormation, Terraform, and AppRegistry.

---

## 6. Health Check Tuning

| Setting | Fast (Expensive) | Standard (Default) |
|---|---|---|
| Check interval | 10s | 30s |
| Failure threshold | 1 | 3 |
| Detection latency | 10s | 90s |
| Additional Route 53 cost | Yes (fast HCs cost more) | No |

**False positive risk**: at threshold=1 and interval=10s, a single slow response triggers failover — even during a momentary spike. Threshold=3 + interval=10s gives 30s detection with lower false-positive rate.

---

## 7. Best Practices

- **Test failover on a schedule** — an untested failover plan is not a failover plan. Use AWS Fault Injection Service (FIS) to simulate AZ failures, instance terminations, and network disruptions.
- **Set DNS TTL to 60s** for any record behind a health check. High TTLs negate the benefit of fast health check detection.
- **Decouple with SQS before calling downstream services** — if the downstream fails, messages queue rather than cascading failures upstream.
- **Use Circuit Breaker pattern** for synchronous service calls. AWS App Mesh and API Gateway support circuit breaking natively.
- **Align NAT Gateway AZ placement** with your compute AZs to avoid inter-AZ NAT transfer charges.
- **Pre-warm Global Accelerator** for expected traffic spikes — it handles scaling automatically but connection table limits apply.
- **Verify Aurora replication lag** before promoting a Global Database secondary: check `aurora_global_db_replication_lag` < acceptable RPO before initiating managed failover.
- **Use Route 53 ARC readiness checks** before any failover: they verify that the DR region has sufficient capacity (Auto Scaling group limits, DB instance availability) before traffic is shifted.
