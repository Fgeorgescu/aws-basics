# AWS Basics

A structured study guide covering core AWS concepts across networking, security, multi-account architecture, and cloud-to-cloud connectivity. Each topic includes a concise summary version and a full educational version with deeper explanations and context.

## Topics

| File | Contents |
|---|---|
| `networking.md` | VPC, subnets, IGW, NAT Gateway, VPC Endpoints, PrivateLink, Transit Gateway, VPC Peering, multi-region connectivity |
| `security.md` | IAM, SCPs, Permission Boundaries, Identity Center, cross-account access patterns, GuardDuty, CloudTrail, Security Hub |
| `multi-account.md` | AWS Organizations, OU structure, foundational accounts, Control Tower, Landing Zone, cost optimization |
| `cloud-to-cloud.md` | AWS ↔ Azure and AWS ↔ GCP connectivity, shared identity federation, Workload Identity |
| `high-availability.md` | RTO/RPO, failover strategies (Pilot Light → Active-Active), niche HA costs (inter-AZ replication, CRR, Global Tables write multiplier), AWS HA services and best practices |
| `glossary.md` | 60+ terms with abbreviations, descriptions, official docs links, and Azure/GCP equivalents |
| `exercises.md` | Six architecture design scenarios with context, requirements, and solution guidance |

Each topic file in `full/` contains the extended educational version of the corresponding root-level summary.

## Running the Viewer

A small Node.js viewer lets you browse and read all documents in the browser with a Summary / Full toggle.

**Requirements**: Node.js (no npm install needed — uses only built-in modules).

```bash
node server.js
```

Then open [http://localhost:3000](http://localhost:3000).

New `.md` files added to the root or `full/` directory are automatically picked up on page refresh.

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
