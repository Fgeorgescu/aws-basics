# Disaster Recovery on AWS — In Depth

## DR vs High Availability: The Distinction That Matters

High availability and disaster recovery are often conflated, but they solve different problems. HA keeps a system running through failures by building redundancy into the normal operating path — an ALB with targets in three AZs is an HA design. DR is what happens when HA fails: a region goes down, a database is corrupted, ransomware encrypts your data. DR asks: how do we get back to a known-good state, and how fast?

This distinction changes which services you reach for. HA tools (Auto Scaling, Multi-AZ RDS, ALB) are always-on infrastructure. DR tools (AWS Backup, DRS, Route 53 ARC routing controls) are your recovery mechanism when the normal infrastructure can no longer be restored.

---

## 1. Translating Business Requirements Into Architecture

Before picking a DR strategy, establish two numbers from a business conversation — not an engineering estimate.

**RTO (Recovery Time Objective)** is the maximum time the business can survive with the service unavailable. For an e-commerce platform, RTO might be 5 minutes before revenue loss becomes material. For an internal HR system, it might be 24 hours. RTO drives which failover strategy tier you build.

**RPO (Recovery Point Objective)** is the maximum data loss measured in time. For a financial transaction system, RPO might be zero — no transaction can be lost. For a content management system, losing 15 minutes of edits might be acceptable. RPO drives your replication mode: synchronous for near-zero RPO (with latency cost), asynchronous for minutes or seconds (with potential data loss).

These targets should be documented and signed off by the business owner. Engineers who set their own RTO targets systematically under-estimate recovery time and over-engineer solutions that exceed what the business actually requires.

---

## 2. DR Strategy Tiers in Detail

### Backup and Restore

The simplest and cheapest strategy. AWS Backup creates scheduled snapshots of RDS, EBS, EFS, DynamoDB, S3, and other services and stores them in a Backup Vault. Cross-region copy jobs move vaults to a DR region. On recovery, you restore from the most recent snapshot and rebuild your infrastructure from IaC.

**RTO**: Typically 1–4 hours (snapshot restore of a large database, launch EC2 from AMI, apply IaC). **RPO**: Equal to the snapshot interval — hourly snapshots mean up to 1 hour of data loss.

**Cost**: Storage for snapshots plus cross-region transfer. A 2TB RDS instance with daily snapshots retained for 30 days costs roughly $60–120/month in snapshot storage, plus ~$40 to replicate each snapshot cross-region. No running infrastructure in the DR region.

**AWS Backup specifics**: Backup plans define schedules, retention policies, and copy destinations. Backup vaults can have vault lock policies (WORM) — no one, including the management account, can delete backups within the retention period. This is critical for ransomware protection: even if an attacker gains access to the AWS account, they cannot delete the backups. Cross-account vault copies are the strongest version of this — backups in a separate account under a separate SCP that denies all deletion.

### Pilot Light

The term comes from a gas furnace pilot flame — the minimum required to re-ignite the system quickly. You keep data replication running continuously (RDS cross-region read replica, S3 CRR, AMI copies) but run no compute in the DR region. Infrastructure-as-code definitions and runbooks exist, ready to execute.

**RTO**: 20–60 minutes depending on how much compute must be launched and how large the database promotion is. **RPO**: Depends on replication lag — for RDS async cross-region replicas, typically 1–5 minutes. Monitor `ReplicaLag` CloudWatch metric continuously.

On failover, the runbook: (1) promote the RDS read replica to standalone primary, (2) launch EC2 instances from copied AMIs, (3) update Route 53 records. Steps 1 and 2 can be automated with Lambda and Systems Manager Automation documents, bringing actual RTO closer to 15–20 minutes.

**The promotion problem**: Promoting an RDS read replica severs the replication link. There is no rollback — once promoted, it becomes an independent database. If the primary region recovers, you must either re-replicate all data written to the promoted replica back to the primary, or accept that the primary region is now your DR and the former DR is your new primary. Plan the runbook to handle this carefully.

### Warm Standby

A scaled-down replica of production runs continuously in the DR region. Instead of 12 `m6i.4xlarge` instances, you run 2. Instead of an Aurora cluster with 3 reader nodes, you run 1. The infrastructure shape is identical; only the capacity is reduced.

**RTO**: 10–20 minutes. Infrastructure exists and is healthy; recovery time is dominated by: (a) Auto Scaling group scaling up to production capacity (3–5 minutes to launch and pass health checks), and (b) RDS or Aurora instance resize if required (may need a restart). **RPO**: With Aurora Global Database, typically under 1 second. With RDS cross-region replicas, 1–5 minutes.

**The sizing trap**: Many teams size the warm standby at "20% of production" and assume it can handle 20% of traffic during testing. The problem is failover sends 100% of traffic. Size the DR Auto Scaling group *maximum* at 100% of production peak capacity — even if you only run 2 instances normally. Route 53 ARC readiness checks will flag if the DR ASG maximum drifts below production.

**Cost modeling**: Running 2 of 12 instances full-time in DR = 17% compute overhead. Aurora replica running idle = ~30% of primary instance cost (I/O is minimal when not serving traffic). Total overhead is typically 20–35% of the primary region's bill.

### Active-Active

Both regions serve live traffic simultaneously. Route 53 latency-based routing or Global Accelerator sends each user to the nearest healthy endpoint. A "failure" reduces capacity; there is no failover event, no DNS propagation delay, no RTO.

The data tier must handle concurrent writes from multiple regions. The two viable options:

**DynamoDB Global Tables**: Multi-master, last-writer-wins conflict resolution. Any region can write. Replication is sub-second under normal conditions. Each additional replica region costs 1 rWRU (Replicated Write Request Unit) per write operation — so a 3-region table costs 3× the single-region write cost. For a high-throughput table at 100,000 WRUs/second, that's 2 additional regions × 100,000 rWRUs/s × $1.25 per million = $0.25/s, $21,600/day in replication charges alone.

**Aurora Global Database with write forwarding**: The primary region handles all writes; write forwarding routes writes from secondary regions to the primary transparently. This is not truly active-active for writes — write latency from the secondary region includes the cross-region round trip (60–175ms). It is active-active for reads. True active-active writes in Aurora require application-level partitioning (different entities written to different regions).

---

## 3. AWS Elastic Disaster Recovery (DRS)

DRS is AWS's answer to enterprise workload DR, including on-premises servers and non-AWS infrastructure. It continuously replicates source servers (physical, VMware, or EC2) at the block level to a staging area in the target AWS region. Replication is ongoing — not snapshot-based — achieving RPO of seconds to minutes.

**How it works:**
1. Install the AWS Replication Agent on source servers.
2. The agent continuously replicates block-level changes to lightweight staging EC2 instances (not full-size production replicas — just enough to store the data).
3. When failover is triggered, DRS provisions full-size recovery EC2 instances, applies the staged data, and the instances boot within minutes.
4. Recovery instances can be launched in drill mode (won't affect production) or actual failover mode.

**RTO**: Typically 5–20 minutes from trigger to operational EC2 instances. The variable is boot time and application startup, not data transfer (data is already staged).

**Use cases where DRS is the right tool:**
- Migrating on-premises workloads to AWS while maintaining DR capability during transition
- Replicating complex multi-tier applications where a database-only replication approach would miss application state
- Compliance requirements that mandate continuous replication with auditable RPO

**Cost**: $0.028/hour per replicated server for the replication agent, plus staging EC2 and EBS costs (small instances, roughly 20–30% of production instance cost). You only pay full EC2 cost when recovery instances are launched.

---

## 4. Route 53 ARC: Closing the Gap Between Paper RTO and Real RTO

Standard Route 53 failover routing has a critical blind spot: it detects that the primary endpoint is unhealthy, flips the DNS record to the secondary, and declares success. It does not know whether:
- The secondary region's Auto Scaling group has been accidentally scaled to zero
- The secondary database is hours behind in replication lag
- The secondary NLB has no registered targets

Route 53 ARC readiness checks fix this. You define a readiness check for each component of your DR environment:
- "This ASG must have a maximum capacity of ≥ 10"
- "This RDS instance must be of type db.r6g.4xlarge or larger"
- "This NLB must have ≥ 3 healthy registered targets"

ARC continuously evaluates these checks and presents a readiness status. A red readiness check means your DR environment has drifted from production and your actual RTO is unknown. You discover this during weekly monitoring, not during a 2am incident.

**Routing controls** are the other half. Instead of waiting for DNS TTL propagation (up to 60 seconds) plus resolver caching (potentially much longer), routing controls let you issue a single API call that atomically flips traffic. The control plane for routing controls is distributed across 5 separate Route 53 ARC cluster endpoints in different AWS regions — even if 3 of them are unavailable, you can still execute a failover. This is designed for the scenario where the outage affecting your primary region might also be affecting AWS's control plane in that region.

---

## 5. Runbook Automation

An untested, manual runbook is a liability in a real disaster. The operator executing it is under pressure, the environment may be partially degraded, and steps that were documented six months ago may no longer reflect the current infrastructure.

**Systems Manager Automation documents** (SSM Automation) encode the runbook as a versioned, auditable, parameterized script. A DR runbook as an SSM document can: promote an Aurora global database secondary, update Route 53 records, scale an Auto Scaling group, and send notifications — all triggered by a single API call or from the AWS console. SSM Automation integrates with IAM, so the runbook can only be executed by authorized principals, and every execution is logged in CloudTrail.

**EventBridge + Lambda** can make failover fully automatic: a Lambda function subscribed to Route 53 health check state-change events detects the primary failure and invokes the SSM Automation document. The human operator receives a notification that failover has started, not a page to go execute a runbook.

The risk of full automation is false positives: a momentary blip triggers failover, causing unnecessary disruption. The Route 53 health check thresholds (minimum 3 consecutive failures before declaring unhealthy) and ARC readiness checks (verify DR is ready before allowing automated failover) are the safeguards against this.

---

## 6. DR Testing: The Only Way to Know Your Real RTO

AWS Fault Injection Service (FIS) is the operationalized way to test DR. Relevant FIS experiments for DR validation:

- **aws:rds:failover-db-cluster**: Forces an RDS Multi-AZ or Aurora cluster failover. Measures actual promotion time and confirms the application reconnects cleanly.
- **aws:ec2:terminate-instances**: Terminates EC2 instances in an Auto Scaling group. Confirms ASG replaces them within the expected time.
- **aws:ec2:stop-instances with subnet targeting**: Simulates an AZ failure by stopping all instances in a specific subnet. Tests whether the application correctly routes around the failed AZ.
- **aws:route53:delete-health-check** (or injecting failures on a health check endpoint): Triggers Route 53 failover to the DR region under controlled conditions.

**AWS Resilience Hub** complements FIS by performing static analysis. It reads your CloudFormation stacks or Terraform state, models the failure domains, and computes a Resiliency Score. A score below your threshold flags specific gaps: "Lambda concurrency limit could cause throttling during a traffic spike to the DR region," or "This SQS queue has no DLQ — messages will be lost if the consumer fails." Resilience Hub re-scores on every infrastructure change, catching regressions before they become real incidents.

**The documentation requirement**: DR testing is only valuable if it produces a written record. Record: what was the trigger event, what time was the failover initiated, what time was the service restored, what was the state of replication at the time of failover (the actual RPO), and what failed or was slower than expected. This record is the input to the next quarter's DR improvement work.
