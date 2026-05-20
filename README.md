# Interview Study Guide

A structured study guide covering AWS and general system design concepts for interview preparation. Each topic has a concise summary and a full educational version with deeper explanations, design rationale, and real-world context.

**[View online → https://fgeorgescu.github.io/aws-basics/](https://fgeorgescu.github.io/aws-basics/)**

## AWS Topics

| Topic | Contents |
|---|---|
| **Networking** | VPC, IGW, NAT Gateway, VPC Endpoints, PrivateLink, Transit Gateway, VPC Peering, multi-region connectivity |
| **Security** | IAM, SCPs, Permission Boundaries, Identity Center, cross-account access, GuardDuty, CloudTrail, Security Hub |
| **Multi-Account** | AWS Organizations, OU structure, foundational accounts, Control Tower, Landing Zone, cost optimization |
| **High Availability** | RTO/RPO, failover tiers, niche HA costs, AWS HA services, health check tuning |
| **Disaster Recovery** | DR strategy tiers (Backup & Restore → Active-Active), AWS DRS, AWS Backup, Route 53 ARC, runbook automation |
| **Cloud to Cloud** | AWS ↔ Azure and AWS ↔ GCP connectivity, shared identity federation, Workload Identity |
| **API Gateway** | Auth methods: Cognito authorizer, JWT authorizer, Lambda authorizer, IAM/SigV4, mTLS, resource policies, WAF |
| **Diagrams** | Mermaid architecture diagrams: multi-account org, TGW hub-and-spoke, cross-account CI/CD, VPC endpoints |
| **Exercises** | Six architecture design scenarios with context, requirements, and solution guidance |
| **Glossary** | 80+ terms with abbreviations, descriptions, official docs links, and Azure/GCP equivalents |
| **Videos** | AWS Back to Basics playlist organised by topic with direct YouTube links |

## System Design Topics

| Topic | Contents |
|---|---|
| **Fundamentals** | CAP theorem, ACID vs BASE, consistency models, scalability, latency vs throughput, SLI/SLO/SLA, back-of-envelope estimation |
| **Data Stores** | SQL vs NoSQL decision, caching strategies, indexing, replication, sharding, connection pooling, time-series DBs, search engines |
| **API Design** | REST best practices, GraphQL, gRPC, rate limiting algorithms, API gateway, JWT auth, WebSockets, idempotency |
| **Messaging** | Kafka, SQS/SNS/Kinesis, delivery guarantees, event sourcing, CQRS, Saga pattern, outbox pattern, back-pressure |
| **Scalability** | Load balancing (L4/L7), CDN, database read/write scaling, auto-scaling, consistent hashing, geographic distribution |
| **Reliability** | Circuit breaker, retry with backoff, timeouts, bulkhead, health checks, graceful degradation, chaos engineering |
| **Distributed Systems** | Raft/Paxos consensus, distributed transactions (2PC, Saga), vector clocks, CRDTs, Bloom filters, gossip protocol |
| **Diagrams** | Mermaid diagrams: three-tier architecture, microservices, CQRS, Saga, fan-out, rate limiter, blue-green, canary |
| **Exercises** | Six classic design problems: URL shortener, Twitter feed, rate limiter, notification system, key-value store, web crawler |
| **Glossary** | 40+ system design terms: CAP, ACID, BASE, circuit breaker, CQRS, CRDTs, sharding, quorum, and more |

## Running the Viewer

A small Node.js viewer lets you browse all documents in the browser with a Summary / Full toggle, collapsible sidebar categories, inline Mermaid diagram rendering, and glossary tooltips.

**Requirements**: Node.js (no npm install needed — uses only built-in modules).

```bash
node server.js
```

Then open [http://localhost:3000](http://localhost:3000).

New topics added under `resources/aws/` or `resources/system-design/` are automatically picked up on page refresh.

## Structure

```
.
├── CLAUDE.md / README.md
├── resources/
│   ├── aws/
│   │   ├── <topic>/
│   │   │   ├── summary.md   # Concise bullet-point reference
│   │   │   └── full.md      # Educational prose with context and examples
│   │   └── videos.md        # Single-version file
│   └── system-design/
│       └── <topic>/
│           ├── summary.md
│           └── full.md
├── index.html               # Browser viewer UI
└── server.js                # Local HTTP server (no dependencies)
```
