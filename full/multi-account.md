# AWS Multi-Account Organization — In Depth

## Why This Is the Most Important Architectural Decision

The decision to use multiple AWS accounts — and how to structure them — sets the foundation for everything else: security posture, blast radius, cost visibility, regulatory compliance, and operational autonomy. It's also a decision that's very expensive to reverse. Teams that start with a single account and try to split it later face months of migration work, re-architecture, and coordination. Getting this right upfront is worth significant investment.

---

## 1. Why Multiple Accounts Aren't Just a Bureaucratic Complexity

### The Blast Radius Argument

The most compelling reason for account separation is hard isolation. Within a single account, any sufficiently privileged IAM role can read or modify any resource. A misconfigured IAM policy, a compromised credential, or an operational mistake in one workload can cascade to others. Separate accounts create a hard AWS-enforced boundary — even an account administrator can't affect resources in a different account without an explicit cross-account role trust.

Consider a real scenario: a developer accidentally runs `terraform destroy` on the wrong workspace, hitting the wrong `AWS_PROFILE`. In a single-account setup, this could take down production. In a multi-account setup, a mistake in the dev account is contained to the dev account.

### The Billing Visibility Argument

AWS Cost Explorer can break down costs by service and by tag, but tags are optional, inconsistently applied, and easy to forget. Account-level separation gives you cost attribution that's guaranteed and requires no discipline from engineering teams — every dollar spent in the payments-prod account is definitively attributed to the payments team's production workload.

### The Policy Flexibility Argument

SCPs apply to OUs and accounts, not to IAM roles within an account. If you want to enforce "production workloads must always have deletion protection enabled" and "sandbox accounts can do anything", you need those workloads in different accounts. You cannot achieve this granularity within a single account.

---

## 2. Organizational Structure in Depth

### The OU Hierarchy

AWS Organizations uses a tree structure. At the root sits the management account. Below it are OUs, which can contain other OUs and accounts. SCPs applied to an OU are inherited by everything below it.

The recommended structure isn't arbitrary — it's designed around how SCPs cascade:

```
Root [FullAWSAccess SCP]
├── Security OU [deny-all-except-security-tools SCP]
│   ├── Log Archive Account
│   └── Audit Account
├── Infrastructure OU [deny-workloads SCP]
│   ├── Network Account
│   └── Shared Services Account
├── Workloads OU [baseline security SCPs]
│   ├── Production OU [strict SCPs: deny IAM user creation, require MFA, restrict regions]
│   └── Non-Production OU [moderate SCPs: restrict regions, protect audit trail]
├── Sandbox OU [minimal SCPs: only restrict leaving org and disabling CloudTrail]
└── Suspended OU [deny-all SCP: no actions permitted]
```

The Suspended OU deserves mention: when an account is being decommissioned, move it here first. The deny-all SCP prevents any further resource creation or modification while you complete the offboarding checklist. After 30 days with no activity, close the account.

### Why the Management Account Must Be Empty

The management account has a unique property: SCPs don't apply to it. An IAM user or role in the management account can do anything in the management account, regardless of any SCP. This makes it a critical security target.

The discipline required: nothing runs in the management account except AWS Organizations, Control Tower (if used), consolidated billing, and the configuration of SCPs and policies. No EC2 instances, no Lambda functions, no developer access. If an attacker compromises the management account, they can create new accounts in your organization, change SCPs to remove guardrails, and access billing data — but they shouldn't be able to reach workload resources because there are none in the management account.

---

## 3. Foundational Accounts: The Security Foundation

### Log Archive Account

The Log Archive account exists for one reason: to hold audit logs that even account administrators cannot tamper with. The threat model is an insider attack or a compromised account: if an attacker gains administrator access to a workload account, they should not be able to delete the CloudTrail evidence of their actions.

This requires two controls working together. First, the S3 bucket policy in the Log Archive account allows cross-account writes (using `aws:PrincipalOrgID` to accept writes from all accounts in the org) but denies all delete operations to everyone including the Log Archive account's own administrators. Second, an SCP on the Log Archive OU denies `s3:DeleteObject`, `s3:DeleteBucket`, and `s3:PutBucketPolicy` — so even if someone gains admin access to the Log Archive account, they cannot change the bucket policy to allow themselves to delete logs.

For regulated industries (financial services, healthcare), consider adding S3 Object Lock with a Compliance retention period. This makes logs truly immutable at the AWS storage layer, not just policy-enforced.

### Security/Audit Account

The Security account is the operational home for your security team. It has read-only cross-account roles into every account in the organization — useful for incident response without needing to request access during a crisis. It's the delegated administrator for GuardDuty, Security Hub, Macie, Config Aggregator, and IAM Access Analyzer.

The key principle: the Security account has *visibility* into all accounts but does not have *write access* to workload accounts during normal operations. This separation means the security team can investigate, correlate findings, and raise alerts without being able to accidentally (or deliberately) modify production resources.

### Network Account

In organizations with more than a handful of accounts, centralizing network infrastructure in a dedicated account simplifies operations enormously. The Network account owns the Transit Gateway (shared to workload accounts via RAM), manages Direct Connect and VPN connections (so all accounts share a single on-premises connection), and hosts centralized DNS resolution infrastructure.

The operational benefit of the centralized model: when you need to update routing policy, add a new CIDR advertisement over Direct Connect, or modify firewall rules, you do it in one place — not across every workload account independently.

A common pattern is the centralized egress architecture: instead of each workload account having its own NAT Gateway, all outbound internet traffic flows from workload VPCs through the TGW to a shared egress VPC in the Network account, where a single NAT Gateway (or a managed firewall for inspection) handles all outbound connections. Cost savings are significant at scale, and it gives you a single place to inspect and log outbound traffic.

---

## 4. Control Tower and Landing Zone Automation

### The Scaling Problem That Control Tower Solves

Without automation, provisioning a new AWS account following security best practices takes hours of manual work: enabling CloudTrail, setting up Config, enrolling in GuardDuty, configuring IAM Identity Center access, deleting the default VPC, setting up budget alerts, applying the right SCPs. Multiply this by the cadence of new account creation in a growing organization and you have a reliability problem — some accounts will have configurations that were never applied, or were applied inconsistently.

Control Tower automates all of this. When a new account is vended through Account Factory, Control Tower automatically applies a baseline set of guardrails (SCPs and Config rules), enrolls the account in CloudTrail, Config, GuardDuty, and Security Hub, sets up Identity Center access, and creates the foundational networking. All accounts start in a known-good state.

### Account Factory for Terraform (AFT)

For organizations that already invest in Infrastructure as Code, AFT is the preferred approach. Account requests are pull requests to a Git repository. The PR specifies the account name, OU placement, and any custom configurations. When merged, a pipeline provisions the account through Control Tower and then runs customization Terraform modules.

AFT customizations are where you encode your organization's specific baseline: deploying Datadog agents, setting up cost anomaly alerts, configuring account-specific Config rules, or provisioning initial networking. Every account gets exactly the same baseline, applied consistently, reviewable in version control.

---

## 5. Cross-Account Access Patterns in Depth

### The CI/CD Pattern: Why It Matters for Security

The CI/CD cross-account pattern is one of the most important security designs in a multi-account organization because it directly addresses a common attack vector: developers with standing access to production accounts. Standing access means a compromise of a developer's Identity Center session, laptop, or credentials can result in unauthorized production changes.

The alternative: developers have standing access to non-production accounts, and *only the CI/CD pipeline* can deploy to production. The pipeline has a role with exactly the permissions needed for deployment, and the trust policy on that role only trusts the specific pipeline role ARN in the tooling account. An SCP on the production OU denies `iam:CreateRole`, `iam:DeleteRole`, and `ec2:RunInstances` except when called by the pipeline role ARN.

The result: a developer's compromised credentials cannot touch production. The blast radius of a compromised developer account is bounded to non-production environments.

For GitHub Actions, the modern approach is OIDC federation: GitHub's OIDC provider is registered as a trusted identity provider in your AWS account, and workflows request temporary credentials by exchanging a GitHub-issued JWT for AWS credentials. No long-lived secrets are stored in GitHub at all.

### Data Access Across Accounts: The KMS Layer

When workload accounts need to access data in a centralized data lake account, the pattern involves three policy layers: the IAM role in the processing account (allows `s3:GetObject` on the target bucket), the S3 bucket policy in the data account (allows the processing role ARN), and the KMS key policy (grants `kms:Decrypt` to the processing role ARN).

The KMS key policy is the revocation mechanism. To immediately cut off a workload account's access to data — in a security incident or after a contract termination — you update the KMS key policy to remove the cross-account decrypt grant. Existing encrypted objects become inaccessible to the revoked account within seconds, without touching the IAM policies or the S3 bucket policy.

---

## 6. Cost Optimization at Organizational Scale

### Consolidated Billing: The Volume Discount Mechanism

When accounts are consolidated under one organization, AWS aggregates their usage for pricing purposes. This matters for services with tiered pricing: S3 storage, data transfer, and CloudFront. A single account using 100TB of S3 pays the 100TB rate. Ten accounts using 10TB each, consolidated, also pay the 100TB rate. Without consolidation, each account pays the 10TB rate independently.

The same aggregation applies to Reserved Instances and Savings Plans. Compute Savings Plans purchased in the management account (or a designated payer account) automatically apply to eligible usage across all member accounts — in the order that maximizes discount coverage. You commit to a $/hour spend across any combination of EC2, Lambda, and Fargate across all regions and instance types, and AWS applies the discount where it fits best.

### The Data Transfer Trap

Data transfer pricing is where multi-account architectures can generate surprising costs. The rules:

Traffic between instances **in the same AZ** is free, regardless of account. Traffic between AZs costs $0.01/GB in each direction. Traffic through the Transit Gateway costs $0.02/GB processed. Traffic out to the internet costs ~$0.09/GB (first 10TB).

The implication for architecture: if your services call each other frequently and data volumes are high, AZ alignment matters significantly. An ECS service in `us-east-1a` calling an RDS instance in `us-east-1b` pays $0.01/GB each direction on every query result. At 1TB/day of database reads, that's $20/day or ~$600/month in avoidable costs. Multi-AZ deployments must account for this — often the right answer is to pay the cross-AZ charge deliberately for high availability rather than try to avoid it, but you should make that tradeoff consciously.

VPC Endpoints directly offset TGW costs: if S3 and DynamoDB traffic goes through a TGW to reach a centralized NAT Gateway, every byte is processed at $0.02/GB and $0.045/GB respectively. Gateway Endpoints route that traffic directly, bypassing the TGW entirely, for free. In an architecture with significant S3 access, this can reduce TGW data processing costs by 40–60%.

### Governance Controls That Enforce Cost Hygiene

Tag enforcement via SCP is the most effective cost governance control because it prevents untagged resources from ever existing. An SCP denying `ec2:RunInstances` unless `aws:RequestTag/CostCenter` is present means no EC2 instance can be launched without a cost center tag — at creation time, not as an audit that runs later and finds violations.

Combine this with AWS Cost Anomaly Detection at the organizational level: create monitors for each account, each service, and each tag-based cost category. Set alerts for anomalies above a threshold (e.g., daily spend 3x higher than the 7-day average). Anomaly detection catches resource sprawl (someone forgot to terminate a cluster), pricing surprises (a workload suddenly generating more data transfer), and potentially unauthorized resource creation (an attacker mining cryptocurrency).

---

## 7. The New Account Checklist: Why Automation Is Non-Negotiable

The number of things that must be configured in every new account — CloudTrail, Config, GuardDuty, Security Hub, budget alerts, default VPC deletion, block public access, IAM password policy, root MFA alert — makes manual provisioning unreliable. Any item missed is a gap in your security posture that won't be discovered until an incident occurs.

The checklist exists not as a manual process but as a specification for your automation. Every item should be verifiable with a Config rule or a Security Hub finding. If a new account is provisioned and any item is missing, it should immediately generate a finding in the Security account, triggering remediation. Organizations that treat the checklist as a best-effort document, rather than a mandatory and monitored baseline, consistently find gaps during security audits.
