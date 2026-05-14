# AWS Multi-Account Organization

## 1. Why Multiple Accounts?

A single AWS account for all workloads creates:
- **Blast radius**: a misconfiguration or breach affects everything.
- **Noisy billing**: hard to attribute costs to teams or products.
- **Coarse-grained SCPs**: you can't apply different guardrails to prod vs sandbox.
- **Audit complexity**: logs from all workloads mixed together.

Separate accounts provide hard isolation boundaries enforced by AWS itself — not just IAM policies.

---

## 2. AWS Organizations Structure

### Hierarchy
```
Root
├── Management Account (billing only, no workloads)
├── OU: Security
│   ├── Log Archive Account
│   └── Security/Audit Account
├── OU: Infrastructure
│   ├── Network Account (TGW, DNS, Direct Connect)
│   └── Shared Services Account (internal tools, artifact repos)
├── OU: Workloads
│   ├── OU: Production
│   │   └── Prod Account(s)
│   └── OU: Non-Production
│       ├── Staging Account
│       └── Dev Account(s)
├── OU: Sandbox
│   └── Individual developer sandbox accounts
└── OU: Suspended
    └── Accounts pending deletion (SCPs block all actions)
```

### Key Properties
- SCPs attached to an OU **inherit** to all child OUs and accounts.
- The **management account** is exempt from SCPs — keep workloads out of it.
- The **Suspended OU** should have a deny-all SCP — prevents any activity in accounts being decommissioned.

---

## 3. Foundational Accounts

### Management Account
- **Only** for: AWS Organizations, Control Tower, consolidated billing, SCPs.
- No workloads, no IAM users, no developer access.
- Protect with MFA on root; restrict access to billing console only.

### Log Archive Account
- Receives CloudTrail, AWS Config, VPC Flow Logs, and ALB access logs from all other accounts.
- S3 bucket policy: allows `s3:PutObject` from all accounts in the org (`aws:PrincipalOrgID` condition), denies all deletes.
- SCP on this account: deny `s3:DeleteObject`, `s3:DeleteBucket`, `s3:PutBucketPolicy` — even admins can't delete logs.
- Consider S3 Object Lock (WORM) for compliance requirements.

### Security/Audit Account
- Delegated administrator for: GuardDuty, Security Hub, AWS Config, Macie, IAM Access Analyzer.
- Read-only cross-account roles into all accounts for incident response.
- Security team's "single pane of glass" — all findings aggregated here.
- Never use this account to run workloads.

### Network Account
- Owns the **Transit Gateway** (shared to workload accounts via RAM).
- Hosts **shared VPC subnets** (via RAM) for centralized egress, inspection, or DNS.
- Manages **Direct Connect** and **Site-to-Site VPN** termination.
- Route 53 Resolver inbound/outbound endpoints for DNS forwarding.

### Shared Services Account
- Internal tools accessible to all workload accounts: artifact repository (CodeArtifact, ECR), internal APIs, monitoring (Grafana, Prometheus).
- Exposed to workload accounts via PrivateLink or RAM-shared subnets.

---

## 4. Landing Zone and Control Tower

### AWS Control Tower
Automates the setup of a secure multi-account environment:
- Creates the foundational OU structure and accounts (Log Archive, Audit).
- Deploys **Guardrails** (SCPs + Config rules) — preventive and detective.
- Enrolls all accounts in CloudTrail, Config, and SSO automatically.

### Account Factory
- Self-service account vending via Service Catalog.
- **Account Factory for Terraform (AFT)**: GitOps-based account vending — raise a PR with a new account definition, pipeline provisions the account with baseline configuration.
- Customizations via AFT hooks: post-provisioning Terraform runs to add account-specific Config rules, tagging, or IAM roles.

### Guardrail Categories
| Type | Mechanism | Example |
|---|---|---|
| **Mandatory** | SCP, cannot be disabled | Disallow changes to CloudTrail |
| **Strongly recommended** | SCP or Config rule, on by default | Disallow public read on S3 |
| **Elective** | Opt-in | Restrict allowed EC2 instance types |

---

## 5. Cross-Account Access Patterns

### CI/CD Deployment Pattern
```
Tooling Account
  └── CodePipeline / GitHub Actions runner
        ↓ sts:AssumeRole
  Target Account (prod/staging)
        └── DeployRole (least-privilege: only deploy what the pipeline needs)
```

- Pipeline role in tooling account has permission to assume `DeployRole` in each target account.
- `DeployRole` trust policy only trusts the specific pipeline role ARN.
- SCP on prod OU: deny `iam:CreateRole`, `iam:DeleteRole` except for the pipeline role — humans cannot manually deploy.

### Data Access Pattern
```
Processing Account (ETL jobs)
  └── ETL Role
        ↓ cross-account assume + s3:GetObject
  Data Lake Account
        └── S3 Bucket (bucket policy allows ETL Role ARN)
        └── KMS Key (key policy grants decrypt to ETL Role ARN)
```

Always encrypt cross-account S3 data with a **customer-managed KMS key** so you can revoke access without deleting data.

### Centralized Egress Pattern
Instead of a NAT GW per account:
```
Workload VPCs (private, no internet route)
  ↓ TGW attachment
Network Account VPC
  └── Centralized NAT GW / egress inspection firewall
  └── IGW
```

Benefits: one place to inspect/log all outbound traffic; cost savings by sharing NAT GW capacity across accounts.

---

## 6. Cost Optimization in a Multi-Account Org

### Consolidated Billing
- All accounts' usage rolls up to the management account.
- AWS applies **volume discounts** on aggregated usage (S3, data transfer tiers).
- **Savings Plans** and **Reserved Instances** purchased in the management account automatically apply to eligible usage across all accounts.

### Cost Allocation
- Enforce tagging via **Tag Policies** in Organizations — standardize tag key names (e.g., `Environment`, `Team`, `CostCenter`).
- SCP pattern: deny resource creation without required tags (e.g., deny `ec2:RunInstances` if `aws:RequestTag/CostCenter` is absent).
- Enable **AWS Cost Allocation Tags** in the management account billing console to split costs by tag.
- **Cost Explorer** with linked accounts: view costs per account, per tag, per service.
- **AWS Cost Anomaly Detection**: org-level anomaly monitors; alert on unexpected spend spikes per account or service.

### Data Transfer Costs (biggest surprise in multi-account)
| Traffic Type | Cost |
|---|---|
| Intra-AZ, same account | Free |
| Intra-AZ, cross-account via peering | Free |
| Inter-AZ (any) | $0.01/GB each direction |
| TGW data processing | $0.02/GB |
| Internet egress | ~$0.09/GB |
| NAT GW processing | $0.045/GB |

**Design principle**: Keep workload compute and data in the **same AZ**. If using TGW, be aware that all traffic is processed and billed — use gateway endpoints for S3/DynamoDB to bypass TGW entirely.

### Rightsizing and Waste
- Enable **AWS Compute Optimizer** org-wide for EC2/Lambda/ECS rightsizing recommendations.
- **S3 Intelligent-Tiering** for data lakes with unknown access patterns.
- **Savings Plans**: Compute Savings Plans apply across EC2, Lambda, Fargate, and all regions — most flexible. Commit to a $/hr spend, not specific instance types.
- **Spot Instances** for stateless, fault-tolerant workloads — 60–90% discount.

---

## 7. Governance Best Practices

### Tag Policies
Defined in Organizations; enforce standardized tag keys and allowed values across all accounts. Non-compliant tags appear in Config findings (not hard-blocked by default, but can be combined with SCPs).

### Backup Policy
Org-level AWS Backup policies define backup plans that apply to tagged resources across all accounts. Ensures critical data is backed up even if individual account admins forget.

### Delegated Administrator Pattern
Never do administrative tasks from the management account. Instead, delegate each service to a purpose-built account:
| Service | Delegated To |
|---|---|
| GuardDuty | Security account |
| Security Hub | Security account |
| AWS Config (Aggregator) | Security account |
| IAM Access Analyzer | Security account |
| AWS Firewall Manager | Network account |
| Control Tower | Management account (no delegation available) |

### Incident Response Readiness
- Pre-create **cross-account read-only roles** in every account, trusted by the security account.
- Document runbooks: how to isolate an EC2 (SG swap), how to rotate compromised credentials, how to revoke a session.
- Test quarterly: fire a GuardDuty test finding, verify it reaches Security Hub and triggers an alert.

---

## 8. Account Vending and Baseline Checklist

Every new account should automatically have:
- [ ] CloudTrail delivering to Log Archive account
- [ ] AWS Config enabled, delivering to Log Archive account
- [ ] GuardDuty enrolled in org (auto-enrolled by delegated admin)
- [ ] Security Hub enrolled in org
- [ ] Default VPC deleted in all regions
- [ ] S3 Block Public Access enabled account-wide
- [ ] IAM Account Password Policy hardened
- [ ] Root account MFA enabled (alert if not)
- [ ] Billing alerts set (per-account budget in Cost Explorer)
- [ ] Required tags enforced via SCP or Tag Policy
