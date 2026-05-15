# AWS Basics

A structured study guide covering core AWS concepts. Each topic has a concise summary and a full educational version with deeper explanations, design rationale, and real-world context.

## Topics

| Topic | Contents |
|---|---|
| **Networking** | VPC, IGW, NAT Gateway, VPC Endpoints, PrivateLink, Transit Gateway, VPC Peering, multi-region connectivity |
| **Security** | IAM, SCPs, Permission Boundaries, Identity Center, cross-account access, GuardDuty, CloudTrail, Security Hub |
| **Multi-Account** | AWS Organizations, OU structure, foundational accounts, Control Tower, Landing Zone, cost optimization |
| **High Availability** | RTO/RPO, failover tiers, niche HA costs (inter-AZ replication, Global Tables write multiplier, Aurora Global DB I/O), AWS HA services |
| **Disaster Recovery** | DR strategy tiers (Backup & Restore → Active-Active), AWS DRS, AWS Backup, Route 53 ARC, runbook automation, DR testing |
| **Cloud to Cloud** | AWS ↔ Azure and AWS ↔ GCP connectivity, shared identity federation, Workload Identity |
| **Diagrams** | Mermaid architecture diagrams: multi-account org, TGW hub-and-spoke, cross-account CI/CD, VPC endpoints, Identity Center, multi-region HA |
| **Exercises** | Six architecture design scenarios with context, requirements, and solution guidance |
| **Glossary** | 80+ terms with abbreviations, descriptions, official docs links, and Azure/GCP equivalents |
| **Videos** | AWS Back to Basics playlist organised by topic with direct YouTube links |

## Running the Viewer

A small Node.js viewer lets you browse all documents in the browser with a Summary / Full toggle and inline Mermaid diagram rendering.

**Requirements**: Node.js (no npm install needed — uses only built-in modules).

```bash
node server.js
```

Then open [http://localhost:3000](http://localhost:3000).

New topics added to `resources/` are automatically picked up on page refresh.

## Structure

```
.
├── CLAUDE.md / README.md
├── resources/
│   ├── <topic>/
│   │   ├── summary.md   # Concise bullet-point reference
│   │   └── full.md      # Educational prose with context and examples
│   └── videos.md        # Single-version file
├── index.html           # Browser viewer UI
└── server.js            # Local HTTP server (no dependencies)
```

## Coverage

Topics are mapped to the AWS Well-Architected Framework pillars — primarily Security, Reliability, and Cost Optimization. Azure and GCP equivalents are included throughout to support multi-cloud contexts.
