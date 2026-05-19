# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This repository is a study guide for interview preparation covering AWS infrastructure and general system design. There is no runnable code — all content is markdown documentation and design exercises.

## Structure

```
.
├── CLAUDE.md / README.md     # Root-level files (shown in viewer under Overview)
├── resources/
│   ├── aws/                  # AWS-specific topics
│   │   ├── <topic>/
│   │   │   ├── summary.md    # Concise bullet-point reference
│   │   │   └── full.md       # Educational prose with context and examples
│   │   └── videos.md         # Single-version file (no full/ counterpart)
│   └── system-design/        # General system design topics
│       └── <topic>/
│           ├── summary.md
│           └── full.md
├── index.html                # Browser viewer UI
└── server.js                 # Local HTTP server (no dependencies)
```

The viewer groups topics into two collapsible sidebar categories: **Amazon Web Services** and **System Design**. Categories are driven by the top-level subdirectory name under `resources/`. The server scans this structure dynamically — no config file needs updating when topics are added.

## AWS Topics (`resources/aws/`)

| Topic | Contents |
|---|---|
| `networking` | VPC endpoints, PrivateLink, NAT/Internet Gateways, Transit Gateway vs peering, multi-region connectivity |
| `security` | IAM, SCPs, Permission Boundaries, Identity Center, cross-account access, detective controls |
| `multi-account` | AWS Organizations structure, Landing Zone, foundational accounts, cross-account patterns, cost optimization |
| `high-availability` | RTO/RPO, failover tiers, niche HA costs, AWS HA services, health check tuning |
| `disaster-recovery` | DR strategy tiers, AWS DRS, AWS Backup, Route 53 ARC, runbook automation, DR testing |
| `cloud-to-cloud` | AWS ↔ Azure and AWS ↔ GCP connectivity patterns, shared identity, DNS federation |
| `diagrams` | Mermaid architecture diagrams for AWS core patterns |
| `exercises` | Six design scenarios requiring architecture rationale and resource selection |
| `glossary` | 80+ AWS terms with abbreviations, descriptions, docs links, and Azure/GCP equivalents |
| `videos` | AWS Back to Basics playlist organised by topic |

## System Design Topics (`resources/system-design/`)

| Topic | Contents |
|---|---|
| `fundamentals` | CAP theorem, ACID vs BASE, consistency models, scalability, latency/throughput, SLI/SLO/SLA, back-of-envelope |
| `data-stores` | SQL vs NoSQL, caching strategies, indexing, replication, sharding, connection pooling, time-series, search |
| `api-design` | REST, GraphQL, gRPC, rate limiting algorithms, API gateway, JWT, WebSockets, idempotency |
| `messaging` | Kafka, SQS/SNS/Kinesis, delivery guarantees, event sourcing, CQRS, Saga pattern, outbox pattern |
| `scalability` | Load balancing (L4/L7), CDN, database scaling, auto-scaling, consistent hashing, geographic distribution |
| `reliability` | Circuit breaker, retry/backoff, timeouts, bulkhead, health checks, graceful degradation, chaos engineering |
| `distributed-systems` | Raft/Paxos, distributed transactions, vector clocks, CRDTs, Bloom filters, gossip protocol |
| `diagrams` | Mermaid diagrams for common system design patterns |
| `exercises` | Six classic design problems (URL shortener, Twitter, rate limiter, notification system, key-value store, crawler) |
| `glossary` | 40+ system design terms with definitions |

## Adding New Content

### Add a topic to an existing category
Create a directory under `resources/aws/<topic>/` or `resources/system-design/<topic>/` with at least a `summary.md`. Optionally add `full.md` for the full educational version. The server and viewer pick it up automatically on reload.

### Add a new category
Create a new top-level directory under `resources/` (e.g., `resources/devops/`). Add a label for it in the `CATEGORY_LABELS` map in `index.html`. Topics within it follow the same `<topic>/summary.md` + `<topic>/full.md` convention.

### Content conventions
- `summary.md`: bullet-point or table-heavy reference; scannable in under 5 minutes
- `full.md`: educational prose; explains the *why*, trade-offs, and real-world context
- Use Mermaid code blocks (` ```mermaid `) for architecture diagrams — the viewer renders them inline
- Glossary files use `## ABBR — Full Name` headings; the viewer parses these for hover tooltips

### Keep this file updated
When adding, renaming, or removing a topic or category, update:
1. The topic table in this file (CLAUDE.md)
2. The topic table in README.md
3. `CATEGORY_LABELS` in `index.html` if a new category is added
4. Icon and label maps (`ICONS`, `LABELS`) in `index.html` if a new topic is added

## How to Use

- Read topic files before attempting exercises — exercises reference concepts defined in the theory files.
- Each exercise asks for: a resource list, a topology description, and a decision rationale. No Terraform or code is required.
- AWS pricing figures and service limits are accurate as of early 2025.
