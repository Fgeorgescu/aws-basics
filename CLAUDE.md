# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

This repository is an AWS system design study guide for an interview preparation focused on a client engagement involving critical multi-account infrastructure. There is no runnable code — all content is markdown documentation and design exercises.

## Structure

```
.
├── CLAUDE.md / README.md     # Root-level (GitHub + tooling conventions)
├── resources/
│   ├── <topic>/
│   │   ├── summary.md        # Concise bullet-point reference
│   │   └── full.md           # Educational prose with context and examples
│   └── videos.md             # Single-version file (no full/ counterpart)
├── index.html                # Browser viewer UI
└── server.js                 # Local HTTP server (no dependencies)
```

## Topics

| Topic | Contents |
|---|---|
| `networking` | VPC endpoints, PrivateLink, NAT/Internet Gateways, Transit Gateway vs peering, multi-region connectivity |
| `security` | IAM, SCPs, Permission Boundaries, Identity Center, cross-account access, detective controls |
| `multi-account` | AWS Organizations structure, Landing Zone, foundational accounts, cross-account patterns, cost optimization |
| `high-availability` | RTO/RPO, failover tiers, niche HA costs, AWS HA services, health check tuning |
| `disaster-recovery` | DR strategy tiers, AWS DRS, AWS Backup, Route 53 ARC, runbook automation, DR testing |
| `cloud-to-cloud` | AWS ↔ Azure and AWS ↔ GCP connectivity patterns, shared identity, DNS federation |
| `diagrams` | Mermaid architecture diagrams for all core patterns |
| `exercises` | Six design scenarios requiring architecture rationale and resource selection (no implementation) |
| `glossary` | 80+ terms with abbreviations, descriptions, docs links, and Azure/GCP equivalents |
| `videos` | AWS Back to Basics playlist organised by topic |

## How to Use

- Read topic files before attempting exercises — exercises reference concepts defined in the theory files.
- Each exercise asks for: a resource list, a topology description, and a decision rationale. No Terraform or code is required.
- Pricing figures and service limits are accurate as of early 2025.
