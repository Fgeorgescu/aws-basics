# High Availability on AWS — In Depth

## Start With the Business Requirement, Not the Technology

The most common HA design mistake is reaching for multi-region active-active before establishing what level of resilience the business actually requires. Active-active might cost 4× a single-region deployment. If the business can tolerate 30 minutes of downtime and 5 minutes of data loss, that's a very different — and far cheaper — architecture than one designed for zero downtime and zero data loss.

**RTO (Recovery Time Objective)** is the maximum acceptable time between a failure event and full service restoration. It drives your failover *strategy*.

**RPO (Recovery Point Objective)** is the maximum acceptable data loss measured in time — how old can the most recent recovered state be? It drives your replication *mode*: synchronous replication approaches zero RPO; asynchronous replication accepts minutes of potential loss in exchange for lower latency and cost.

These two numbers should come from a business conversation about revenue impact per hour of downtime and regulatory requirements around data loss — not from an engineer's intuition about what "good" looks like.

---

## 1. The Non-Obvious Costs of High Availability

Most AWS cost documentation covers the obvious: running two instances costs twice as much as running one. What's less well understood is the *ongoing operational cost* of the traffic patterns that HA architectures generate.

### Inter-AZ Replication Traffic

Multi-AZ deployments replicate data between physically separate data centers. AWS charges $0.01/GB in each direction for all inter-AZ traffic — and this applies to replication streams, not just application traffic.

**RDS Multi-AZ** maintains a synchronous standby in a different AZ. Every write your application commits is synchronously replicated before the write is acknowledged. For a write-heavy database processing 1TB/day of changes, the replication stream alone costs $20/day ($600/month) in inter-AZ transfer charges — on top of the instance cost doubling. This is rarely budgeted for because the RDS pricing page only shows instance and storage costs.

**ElastiCache Multi-AZ** replication between primary and replica nodes crosses AZ boundaries. For in-memory caches handling large values or high write rates, this matters.

**The NAT Gateway tradeoff** is the most counterintuitive: running one NAT Gateway in a single AZ costs ~$32/month fixed. Running one per AZ costs ~$96/month. But if your compute is spread across three AZs and all routes to a single NAT, every byte of internet-bound traffic crosses an AZ boundary twice (once to reach the NAT, once for the response), billed at $0.01/GB each direction. For workloads generating 10TB/month of internet traffic, cross-AZ NAT costs $200/month — more than the cost of the two additional NAT Gateways. The per-AZ NAT strategy pays for itself.

### Cross-Zone Load Balancing

ALBs distribute traffic evenly across all healthy targets in all Availability Zones. When an ALB node in us-east-1a forwards a request to a target in us-east-1b, that's inter-AZ traffic. For applications with significant request volume, this can be a meaningful line item. You can disable cross-zone load balancing on an ALB, but this means uneven distribution if target counts vary across AZs — the tradeoff is cost versus balance.

Network Load Balancers changed behavior in late 2023: for NLBs created after that point, cross-zone load balancing can be enabled without incurring inter-AZ charges. For older NLBs, the charge still applies.

### Cross-Region Replication: The Full Picture

When designing a multi-region architecture, the data transfer costs often surprise teams used to thinking only about compute.

**S3 Cross-Region Replication** charges: the standard S3 PUT request cost per replicated object (you pay to write it again), plus inter-region data transfer at ~$0.02/GB. For a data lake with 10TB of new data daily being replicated to a DR region, the transfer cost alone is $200/day.

**DynamoDB Global Tables** has a replication model that multiplies write costs. Each write unit consumed in the primary region costs one WRU. Each additional region the write replicates to costs one Replicated Write Request Unit (rWRU). An active-active table with three regions means each logical write costs 3 WRUs total. For high-throughput tables, this is the dominant cost driver — often larger than the storage cost.

**Aurora Global Database** replication charges $0.20 per million replicated I/Os. An Aurora cluster handling 10,000 write I/Os per second generates 864 billion replicated I/Os per day per additional region — approximately $172/day per secondary region in replication fees, before data transfer.

### Route 53 Health Check Costs at Scale

Route 53 health checks appear cheap individually ($0.50–$0.75/month) but accumulate in large environments. A multi-region architecture with 5 regions, 3 endpoints per region (ALB, API Gateway, CloudFront), and HTTPS health checks from multiple evaluating regions can easily reach $150–200/month in health check fees. This is still modest compared to infrastructure costs but is often invisible in initial cost estimates.

---

## 2. Latency: Why It Determines Your Replication Model

Network latency between locations is not just a user experience concern — it directly determines which replication modes are architecturally viable.

### Latency Reference

Within a single AZ, network round-trips are under 0.5ms. Between AZs in the same region, 1–2ms is typical. These numbers are low enough for synchronous replication: RDS Multi-AZ commits a write, sends it to the standby, waits for acknowledgment, then returns success to the application. The 1–2ms added latency per write is acceptable for most OLTP workloads.

Cross-region latency is an order of magnitude higher: 60ms between US coasts, 80ms between US East and Europe, 150–175ms between US East and Asia-Pacific. Synchronous replication over these distances would add 80–175ms to every write operation — for a database serving hundreds of transactions per second, this is untenable. Cross-region replication is therefore always asynchronous: the primary acknowledges the write immediately and replicates in the background, accepting the possibility of data loss if the primary fails before replication completes.

### The RPO Implication

This is the fundamental tension in multi-region HA design. Asynchronous replication means RPO > 0. Aurora Global Database achieves typical replication lag under 1 second — so in practice your RPO might be 1–2 seconds even though it's technically non-zero. S3 Cross-Region Replication achieves eventual consistency, typically in seconds to minutes depending on object size and S3 API rate. DynamoDB Global Tables achieves sub-second replication under normal conditions.

For regulated environments where RPO must be documented and auditable, these "typically under X seconds" guarantees may be insufficient — they depend on AWS infrastructure performance, not contractual SLAs. Aurora Global Database does offer a managed failover RPO guarantee in certain configurations, but verify current service terms.

---

## 3. Failover Strategy Tiers: Cost vs. Recovery Speed

### Pilot Light

The minimum viable DR strategy. You replicate data (DB snapshots, S3 CRR, AMI copies) to a DR region but run no compute there under normal conditions. DNS records exist but point to the primary region. Infrastructure-as-code definitions are ready to apply.

When a failure occurs, an operator (or automation) executes the runbook: launch EC2 from copied AMIs, promote the RDS read replica to standalone, update Route 53 records. The launch and promotion time defines your RTO — typically 20–60 minutes.

The cost is nearly zero beyond storage: you pay for snapshot storage and cross-region data transfer during replication, but no running instances. This is appropriate for internal tools, test environments, or workloads where 30–60 minutes of downtime is acceptable.

### Warm Standby

A scaled-down version of your production environment runs continuously in the DR region. Instead of 10 EC2 instances, you run 1 or 2. Instead of a db.r6g.4xlarge RDS instance, you run a db.r6g.large. The infrastructure is identical in type but smaller in capacity.

When failover occurs, you scale the Auto Scaling group to full production capacity and resize the database instance (which requires a brief restart). RTO is typically 10–20 minutes — faster than pilot light because the infrastructure exists and just needs to scale, not be created from scratch.

The ongoing cost is proportional to the size of the standby. Running at 20% of production capacity in the DR region adds roughly 20% to your infrastructure bill. This is the most common strategy for "important but not critical" production workloads.

### Active-Passive (Hot Standby)

Full production infrastructure running in the DR region, receiving no live traffic. The data tier is continuously synchronized. Route 53 failover routing sends traffic to the primary; the health check triggers automatic cutover to the secondary.

RTO is bounded by DNS TTL (set to 60 seconds for health-checked records) plus the time for your application to become healthy behind the secondary load balancer — typically 1–5 minutes end-to-end. RPO depends on replication: with Aurora Global Database, it's typically under 1 second.

The cost is approximately 2× single-region (full duplicate compute + storage in DR, plus replication transfer). This is the appropriate choice when your RTO must be under 10 minutes but you can't justify active-active.

### Active-Active

Traffic is served simultaneously from multiple regions. There is no failover in the traditional sense — a region failure reduces total capacity, but the system continues serving traffic from surviving regions. Route 53 latency-based routing or Global Accelerator distributes requests to the nearest healthy endpoint.

The data tier must be globally replicated with writes accepted in any region: DynamoDB Global Tables or Aurora Global Database with write forwarding. Both come with cost multipliers (3× writes for 3-region Global Tables) and consistency considerations (last-writer-wins in DynamoDB; Aurora Global Database routes all writes to the primary region by default unless you use write forwarding).

Active-active is the most expensive strategy (3–5× single-region) and the most architecturally complex. It's justified for customer-facing systems with zero-downtime requirements, where a 5-minute outage directly causes measurable revenue loss.

---

## 4. AWS Services: What Actually Handles Failover

### Route 53 Application Recovery Controller (ARC)

Standard Route 53 failover routing has a critical blind spot: it switches DNS when the health check fails, but it doesn't verify that the DR region has sufficient capacity to absorb the traffic. ARC adds two capabilities:

**Readiness checks** continuously monitor that your DR environment mirrors the production configuration: the same Auto Scaling group maximum, the same RDS instance class, the same NLB capacity. A readiness check fails if your DR environment has drifted — for example, someone scaled down the DR Auto Scaling group and forgot to restore it. You discover this before a real failure, not during one.

**Routing controls** let you manually flip regional traffic with a single API call or console action, bypassing DNS TTL delays. This is critical for partial failures where the health check isn't triggering (the endpoint is technically responding but serving degraded results) — you can manually force traffic to the DR region in seconds.

### Aurora Global Database in Practice

Aurora Global Database maintains up to five secondary regions, each with their own Aurora cluster (reader endpoints available). Under normal operations, all writes go to the primary region; secondary regions serve reads, reducing latency for globally distributed users.

On failure of the primary region, managed failover promotes a secondary to primary in under a minute. During this promotion, writes are briefly blocked. The monitoring metric to watch is `aurora_global_db_replication_lag` (in milliseconds) — if it's trending up during normal operations, your RPO in a sudden primary failure is that lag value.

A subtle cost optimization: if your secondary region only needs to serve reads during normal operations (not a fully symmetric active-active setup), you can run a much smaller Aurora instance tier in the secondary than in the primary.

### AWS Fault Injection Service (FIS)

HA designs that have never been tested are speculation, not engineering. FIS lets you run controlled chaos experiments against your production (or staging) environment:

- Terminate random EC2 instances in an Auto Scaling group
- Interrupt Spot instances
- Force an AZ failure (block traffic to all resources in a specific AZ)
- Inject network latency or packet loss
- Force an RDS Multi-AZ failover

The value is in discovering the actual RTO of your system under real conditions — which is almost always longer than the theoretical RTO, due to connection draining, cache warmup, dependency timeouts, and monitoring alert delays. FIS experiments document both the failure mode and the recovery behavior, building confidence that failover actually works.

### CloudFront Origin Failover

CloudFront's origin failover groups configure a primary and secondary origin. When CloudFront receives a 5xx or connection timeout from the primary, it retries the request against the secondary within the same request — the client sees no failure. This is transparent application-layer failover, not DNS-based.

The secondary origin can be a different S3 bucket in another region (with CRR keeping them in sync), or a different ALB endpoint. Because CloudFront caches content at edge locations, even if both origins briefly fail, previously cached responses continue serving — dramatically reducing the effective user-visible impact of origin outages.

### AWS Resilience Hub

Resilience Hub ingests your application definition (from CloudFormation stacks, Terraform state, or manual resource selection) and performs a static analysis of the architecture against your declared RTO/RPO targets. It identifies gaps: "this Lambda function has no provisioned concurrency and may cold-start during a traffic spike," or "this SQS queue has no dead-letter queue, so failed messages will be lost."

The output is a Resiliency Score (0–100) and a prioritized remediation plan. Resilience Hub re-evaluates the score whenever the infrastructure changes, so it can catch HA regressions introduced by infrastructure updates — for example, a Terraform change that accidentally removed a read replica.

---

## 5. Health Check Design: The Tradeoff Nobody Talks About

The standard Route 53 health check configuration (30-second interval, failure threshold of 3) means it takes 90 seconds to detect a failure. Most teams set this up once and never revisit it. Understanding the tuning surface matters:

**Fast health checks** (10-second interval) detect failures in 10–30 seconds. They cost more (Route 53 charges a premium for fast checks) and increase the risk of false positives: a single slow response during a momentary spike can trigger failover. For latency-sensitive applications where 90 seconds is unacceptable, fast checks are worth the cost and the careful threshold tuning.

**Failure threshold** is the number of consecutive failures before the health check is declared unhealthy. Threshold=1 with 10s interval means one bad response triggers failover — very sensitive to transient issues. Threshold=3 with 10s interval means 30 seconds of consecutive failures, significantly reducing false positives while still detecting real failures within 30 seconds.

**String matching** validates that the response body contains a specific string — useful for detecting cases where the endpoint returns HTTP 200 but the application is in a degraded state (e.g., returning a cached "maintenance" page). This adds latency to the health check evaluation and costs slightly more.

**Composite health checks** combine multiple checks with AND/OR logic. You can define "healthy = (ALB check AND RDS check AND ElastiCache check)" — requiring all components to be healthy before considering the region available. This prevents partial failovers where traffic switches to a region with a degraded dependency.

---

## 6. Common Architectural Pitfalls

**The thundering herd on failover**: when all traffic suddenly shifts from a failed region to the survivor, the surviving region must absorb 2× its normal load. Auto Scaling needs time to launch new instances (typically 3–5 minutes). If your Warm Standby is running at 20% of production capacity, the 30-second failover RTO you planned becomes irrelevant — the DR region is immediately overwhelmed. Always size the DR environment to handle 100% of peak traffic, not 100% of normal traffic.

**Cache invalidation after failover**: applications that rely on in-memory caches (ElastiCache) must handle a cold cache in the DR region. The first minutes after failover, all requests miss the cache and hit the database — creating a spike that can look like the database is failing. ElastiCache Global Datastore replicates cache contents to secondary regions (async, for Redis), but not all workloads use this.

**DNS caching outside your control**: even with a 60-second TTL, some resolvers don't honor TTLs. Mobile devices, corporate DNS resolvers, and certain ISPs cache DNS results longer than specified. For zero-downtime requirements, DNS-based failover is insufficient alone — use Global Accelerator (anycast, no DNS TTL dependency) or implement application-level retry logic.

**Replication lag masking failures**: a cross-region read replica can drift significantly during a period of high write load, and you won't notice until failover reveals an RPO of hours, not seconds. Monitor `ReplicaLag` on RDS read replicas and `aurora_global_db_replication_lag` on Aurora continuously — set alarms at any value exceeding your RPO target.
