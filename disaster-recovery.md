# Disaster Recovery on AWS

DR is the process of restoring service after an unplanned outage. Unlike HA (which prevents downtime), DR assumes something has failed and focuses on how fast and how completely you recover.

---

## RTO / RPO Targets Drive Everything

| Metric | Definition | Drives |
|---|---|---|
| **RTO** | Max acceptable time from failure to recovery | Failover strategy tier |
| **RPO** | Max acceptable data loss (measured in time) | Replication mode (sync vs async) |

---

## DR Strategy Tiers

| Strategy | RTO | RPO | Cost vs Single-Region | When to Use |
|---|---|---|---|---|
| **Backup & Restore** | Hours | Hours | +5–10% | Dev/test, low-criticality |
| **Pilot Light** | 20–60 min | Minutes | +10–15% | Internal tools, low SLA |
| **Warm Standby** | 10–20 min | Seconds | +20–40% | Most production workloads |
| **Active-Active** | 0 (no failover) | Near-zero | +100–200% | Revenue-critical, global |

---

## Key AWS DR Services

- **AWS Elastic Disaster Recovery (DRS)** — continuous block-level replication of servers to AWS; failover launches EC2 replicas within minutes
- **AWS Backup** — centralized policy-based backup across EC2, RDS, EFS, DynamoDB, S3; supports cross-region and cross-account vaults
- **Route 53 ARC** — readiness checks verify DR environment matches production; routing controls trigger manual failover in seconds
- **Aurora Global Database** — cross-region async replication, < 1s lag; managed failover < 1 min
- **DynamoDB Global Tables** — multi-region active-active replication; each additional region multiplies write cost
- **S3 Cross-Region Replication (CRR)** — async object replication; pairs with S3 MRAP for transparent multi-region reads
- **AWS FIS** — controlled chaos experiments to validate actual RTO before a real failure

---

## Data Replication Reference

| Service | Replication Mode | Typical RPO | Cross-Region Cost |
|---|---|---|---|
| RDS Multi-AZ | Synchronous | 0 | Inter-AZ traffic (~$0.01/GB) |
| RDS Read Replica (cross-region) | Async | Minutes | Data transfer ~$0.02/GB |
| Aurora Global Database | Async | < 1s | $0.20 per million replicated I/Os |
| DynamoDB Global Tables | Async | < 1s | 1 rWRU per replica region per write |
| S3 CRR | Async | Seconds–minutes | PUT + transfer ~$0.02/GB |
| EFS Replication | Async | Minutes | Transfer + storage costs |

---

## Network Failover

- **Route 53 failover routing** — health-check-driven DNS cutover; TTL 60s means ~1–2 min propagation
- **Route 53 ARC routing controls** — instant manual flip, bypasses DNS TTL
- **Global Accelerator** — anycast routing; no DNS TTL dependency; failover in seconds
- **TGW inter-region peering** — pre-provision the peering in both regions; failover traffic routes automatically via BGP

---

## DR for On-Premises Workloads

- **AWS DRS** replicates physical/virtual servers continuously; launch recovery instances in minutes
- **AWS Storage Gateway** — backup on-prem data to S3 as the DR target
- **Direct Connect + VPN backup** — maintain a VPN connection as failover for Direct Connect; BGP will prefer DX when healthy

---

## Testing DR

- Run **AWS FIS** experiments: force AZ failure, terminate instances, inject RDS failover
- Use **AWS Resilience Hub** to score your architecture against declared RTO/RPO targets and catch regressions
- Test at least quarterly; document actual RTO measured, not theoretical
- Validate **Route 53 ARC readiness checks** show green before declaring DR ready

---

## Common Pitfalls

- Sizing DR compute at normal traffic, not peak — results in DR region being overwhelmed on failover
- Not monitoring replication lag — RPO measured at time of failure, not at time of setup
- DNS TTL caching beyond 60s in mobile/ISP resolvers — use Global Accelerator for zero-TTL-dependency failover
- Forgetting cross-account KMS key grants — DR region can't decrypt data without access to the CMK
- Skipping DR tests — paper RTO and tested RTO routinely differ by 3–10×
