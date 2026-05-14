# Design Exercises — Extended Guidance

This version includes deeper context, hints, and evaluation criteria for each exercise. Use it after attempting a design on your own to check your reasoning.

---

## How to Approach Any AWS Design Exercise

Before drawing a single resource, answer four questions:
1. **What is the security boundary?** Which entities should have zero access to each other?
2. **What is the traffic flow?** Draw data paths before drawing resources.
3. **What fails, and what happens when it does?** Identify single points of failure and how they're mitigated.
4. **What does this cost?** Identify the top two or three cost drivers and whether they can be reduced.

Interviewers don't expect you to recall exact prices, but they expect you to know *which* resources have meaningful costs and *which direction* the cost scales with traffic volume.

---

## Recommended Tools

### Choosing the Right Diagramming Tool

The tool you reach for should match the context. In a live interview or design session, speed matters more than beauty — a rough Excalidraw sketch you produce in 3 minutes communicates far better than a polished draw.io diagram you spend 15 minutes perfecting. For client deliverables, the opposite is true.

**[Excalidraw](https://excalidraw.com)** is the best choice for real-time design work. It has a hand-drawn aesthetic that signals "this is a sketch, not a final design" — which is exactly the right framing during exploratory discussions. It runs in the browser with no login, has an AWS icon library (load it from the + menu → *AWS Icons*), and sessions are shareable via link for collaborative whiteboarding.

**[draw.io / diagrams.net](https://app.diagrams.net)** is the go-to for anything you'll present or hand to a client. The official AWS shape library is built in (search for any service name). Diagrams save as XML, so they're diff-able in version control, and there's a VS Code extension that lets you edit them directly in your repo. For multi-account architecture diagrams, draw.io's swimlane and group containers model AWS accounts and VPCs cleanly.

**[Cloudcraft](https://www.cloudcraft.co)** is purpose-built for AWS and is the most visually distinctive option — it generates isometric 3D diagrams that look immediately recognizable as AWS architecture. Its killer feature is live import: connect your AWS account and it auto-generates a diagram from your actual running infrastructure. Useful both for documentation and for auditing what was actually deployed vs what was designed.

**[Mermaid](https://mermaid.live)** is the right choice when diagrams need to live alongside code. Mermaid diagrams are text (a DSL), render in GitHub/GitLab markdown, and can be version-controlled like any other file. They're best for sequence diagrams (request flows, auth handshakes) and simple flowcharts — not detailed infrastructure diagrams with 50 AWS resource icons.

**[Lucidchart](https://www.lucidchart.com)** is the enterprise option: real-time collaboration, strong AWS stencil library, and tight integration with Confluence/Google Workspace. Worth using if your client or team already has a license.

### AWS Official Icon Set

Always use the official AWS Architecture Icons for any client-facing work — it signals professionalism and makes diagrams unambiguous. Download the full set (SVG + PNG) from [aws.amazon.com/architecture/icons](https://aws.amazon.com/architecture/icons/). The pack includes icons for every service plus grouping containers (VPC, subnet, availability zone, account, region). draw.io has these built-in under *Extra Shapes → Networking → AWS*.

**Icon usage conventions:**
- Service icons (EC2, S3, RDS) go inside the appropriate container (subnet, VPC).
- Group containers use light-colored backgrounds: VPC is a solid-line rectangle, subnet is dashed, AZ is light gray.
- Data flow arrows should be directional and labeled with protocol/port where relevant.

### Other Tools Worth Knowing

**[Former2](https://former2.com)** solves a common problem: you inherit an AWS environment with no IaC and need to understand and document it. Former2 reads your live AWS account (via read-only credentials) and generates CloudFormation, Terraform, CDK, or Pulumi representations of everything it finds. Useful for both documentation and as a starting point for bringing existing infrastructure under version control.

**[Steampipe](https://steampipe.io)** lets you run SQL queries against live AWS resources across accounts. For multi-account auditing — "show me all S3 buckets across all accounts that have public access enabled" or "list all IAM roles that have been unused for 90+ days" — Steampipe is dramatically faster than writing boto3 scripts or clicking through the console. The AWS plugin supports hundreds of table types covering nearly every AWS service.

**[AWS Well-Architected Tool](https://console.aws.amazon.com/wellarchitected)** is an interactive questionnaire based on AWS's six pillars (Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability). For client-facing work, completing a Well-Architected Review produces a formal risk report that you can use to prioritize improvements and communicate architectural tradeoffs. It's also a useful study framework — the question set covers the same topics as this guide.

**[AWS Pricing Calculator](https://calculator.aws)** is essential for any design exercise that asks you to estimate cost. It's more accurate than mental math for complex configurations (TGW data processing + multiple interface endpoints + cross-region transfer) and produces a shareable URL you can include in a proposal or design document.

**[IAM Policy Simulator](https://policysim.aws.amazon.com)** lets you test what a specific IAM role can and cannot do against any AWS API call, without actually running the API. Invaluable for debugging "access denied" errors, verifying that a permission boundary is scoped correctly, or testing an SCP before deploying it to a production OU.

---

## Exercise 1: Multi-Account Hub-and-Spoke Network

### Context
Three AWS accounts:
- **Prod account** (us-east-1): production workloads in private subnets
- **Staging account** (us-east-1): pre-production workloads in private subnets
- **Shared Services account** (us-east-1): internal tooling (Artifactory, monitoring), must be accessible by both prod and staging
- A **DR prod account** is being added in eu-west-1 for data replication

### Requirements
- Prod and staging must not communicate with each other
- Both must reach shared services
- DR account must communicate with us-east-1 prod for replication traffic
- All inter-VPC traffic stays off the internet

### Constraints
- Budget-conscious; minimize fixed TGW costs where possible

---

### Why TGW over Peering Here

You have at least four VPCs with a segmentation requirement (prod ↔ staging must not communicate) and a transitivity requirement (prod → shared services → but not prod → staging → shared services). VPC peering is non-transitive and has no concept of route table segmentation — you'd have to carefully avoid creating certain peering pairs, which is fragile.

TGW solves both with route table isolation:
- **prod-rt**: associates prod VPC, propagates routes for shared-services VPC only
- **staging-rt**: associates staging VPC, propagates routes for shared-services VPC only
- **shared-services-rt**: associates shared-services VPC, propagates routes for both prod and staging

With this configuration, prod can reach shared services and vice versa, staging can reach shared services and vice versa, but prod has no route to staging and vice versa — enforced by the TGW route tables, not by a policy that someone could accidentally loosen.

### Cross-Region: TGW Peering

For the DR account in eu-west-1, create a second TGW in eu-west-1. Create a TGW peering attachment between the us-east-1 TGW and the eu-west-1 TGW. Add static routes on each TGW pointing to the other region's CIDR via the peering attachment.

Note that TGW peering does not propagate routes dynamically — you must add static routes manually. Keep the CIDR plan simple (e.g., `10.0.0.0/8` for us-east-1, `10.1.0.0/8` for eu-west-1) to minimize the number of route entries.

### RAM Sharing

The TGW is created in the Network account (or whichever account owns network infrastructure). Share it to workload accounts via AWS RAM. Each workload account creates a TGW attachment from their VPC to the shared TGW. The Network account approves the attachment (or enables auto-accept for accounts within the org).

### Deliverable Checklist
- [ ] TGW in us-east-1 (in Network account) shared to prod, staging, shared-services accounts via RAM
- [ ] TGW in eu-west-1 shared to DR prod account
- [ ] TGW peering attachment between the two regional TGWs
- [ ] Three TGW route tables: prod-rt, staging-rt, shared-services-rt with correct associations and propagations
- [ ] Static routes on each TGW for the cross-region peering
- [ ] VPC route tables in each account: `10.0.0.0/8 → tgw-attachment` for private subnets

---

## Exercise 2: Private S3 Access Across Accounts

### Context
- **Data Lake account**: S3 bucket `company-data-lake` encrypted with a CMK
- **Processing account**: EMR cluster and Glue jobs need read/write access
- No internet traversal, all access logged, access must be instantly revocable

---

### The Network Path

The processing account's EMR/Glue jobs run in a private subnet. For S3 traffic to stay private, you need an S3 Gateway Endpoint in the processing account's VPC. The gateway endpoint is free, works via route table injection, and keeps all S3 traffic within the AWS backbone. If the workloads run in the Network account's shared subnet (RAM pattern), the endpoint must be in the VPC those subnets belong to.

### The IAM Chain

Cross-account S3 access requires two policy layers to both say yes:

**In the data lake account — S3 bucket policy:**
```json
{
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::PROCESSING_ACCOUNT:role/ETLRole" },
  "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
  "Resource": ["arn:aws:s3:::company-data-lake", "arn:aws:s3:::company-data-lake/*"]
}
```

**In the data lake account — KMS key policy:**
```json
{
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::PROCESSING_ACCOUNT:role/ETLRole" },
  "Action": ["kms:Decrypt", "kms:GenerateDataKey"],
  "Resource": "*"
}
```

**In the processing account — ETLRole identity policy:**
```json
{
  "Effect": "Allow",
  "Action": ["s3:GetObject", "s3:PutObject", "s3:ListBucket"],
  "Resource": ["arn:aws:s3:::company-data-lake", "arn:aws:s3:::company-data-lake/*"]
}
```

### Enforcing "No Internet" on the Bucket Side

Use a bucket policy deny for non-VPC access:
```json
{
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:*",
  "Resource": ["arn:aws:s3:::company-data-lake/*"],
  "Condition": {
    "StringNotEquals": { "aws:sourceVpc": "vpc-PROCESSING_VPC_ID" }
  }
}
```

This ensures that even if a credential is leaked and used from outside the VPC, S3 will reject the request.

### Instant Revocation

To revoke the processing account's access immediately:
1. Remove the `ETLRole` principal from the KMS key policy — all existing S3 operations requiring decryption fail immediately.
2. Optionally: attach an IAM policy to `ETLRole` denying S3 access (belt and suspenders).
3. The KMS key policy change takes effect within seconds and is retroactive — no session tokens or cached credentials allow continued access once the key policy is updated.

---

## Exercise 3: Secure Cross-Account CI/CD Pipeline

### Context
- **Tooling account**: GitHub Actions self-hosted runner or CodePipeline
- **Prod account**: production environment; no developer standing access
- **Staging account**: developers can deploy manually via Identity Center

---

### The Core Design Principle

Developers should not have standing access to production, period. This is not about trusting developers — it's about limiting the blast radius of a compromised credential, a phishing attack, or a mistake. If the pipeline is the only entity that can deploy to production, a compromised developer credential can damage non-production environments but cannot touch production.

### GitHub Actions OIDC vs Instance Profile

For a GitHub Actions runner, OIDC federation is strongly preferred over instance profiles for the runner EC2. Here's why:

**Instance profile**: the runner EC2 instance has an IAM role. Any workflow on any repository running on that runner can call `sts:AssumeRole` and impersonate the deploy role. If you run multiple repos on the same runner fleet, a malicious workflow in a low-privilege repository could assume the prod deploy role.

**OIDC**: each GitHub Actions workflow requests a temporary credential by presenting a GitHub-issued JWT to AWS STS. The IAM trust policy can condition on the `sub` claim in the JWT, which includes the repository name, branch, and environment. You can restrict prod deploy role assumption to specifically `repo:your-org/your-repo:environment:production`, meaning only workflows from that specific repo targeting the production environment can assume the role. No other workflow on the runner can impersonate it.

### SCP to Prevent Direct Human Access to Prod

On the Production OU, add an SCP:
```json
{
  "Effect": "Deny",
  "Action": [
    "ec2:RunInstances",
    "ecs:CreateService",
    "lambda:UpdateFunctionCode",
    "cloudformation:ExecuteChangeSet"
  ],
  "Resource": "*",
  "Condition": {
    "StringNotLike": {
      "aws:PrincipalArn": "arn:aws:iam::PROD_ACCOUNT:role/CICDDeployRole"
    }
  }
}
```

This denies deployment actions to everyone except the CI/CD deploy role. Note: this SCP must be carefully scoped to avoid locking out emergency access — ensure your break-glass role ARN is also exempt.

### Audit Trail

Every deployment is auditable through CloudTrail:
- The OIDC token contains the GitHub run ID, workflow name, and triggering actor
- These appear in the `sourceIdentity` or session context of the CloudTrail event
- You can trace any AWS API call back to the specific GitHub Actions run that triggered it

---

## Exercise 4: Identity Center + External IdP Integration

### Context
- 20-account organization, 100 engineers, 8 teams, using Okta
- Platform team: read-only to all accounts
- Security team: read-only + incident response to all accounts
- Developers: access to their team's accounts only

---

### Permission Sets to Create

Design these permission sets in Identity Center:

| Permission Set | Policy | Session Duration | Notes |
|---|---|---|---|
| `ReadOnly` | AWS-managed ReadOnlyAccess | 8h | All non-sensitive access |
| `DevAccess` | Custom: deploy + debug for non-prod | 8h | No iam:* except ListPolicies |
| `ProdDeploy` | Custom: deploy only via pipeline (minimal) | 1h | Almost never used directly |
| `IncidentResponse` | Custom: EC2 SSM, CloudWatch Logs, describe all | 2h | Security team only |
| `OrgReadOnly` | Custom: read-only + Cost Explorer | 8h | Platform team |

### Group-to-Account Assignment Strategy

The naive approach — create one account assignment per team per account — works for 20 accounts. It breaks at 100+ accounts.

For scale, use ABAC:
1. In Okta, add a custom attribute `team` to each user (payments, platform, security, etc.)
2. Configure SCIM to sync this attribute to Identity Center as a principal tag
3. In each account's IAM inline policy for the Permission Set role, add: `Condition: {"StringEquals": {"aws:PrincipalTag/team": "payments"}}` to scope access to resources tagged with the matching team.
4. Tag all resources with `Team=payments`, `Team=platform`, etc.

Now instead of manually assigning groups to accounts, you assign the groups to a "wildcard" permission set and let ABAC handle scoping. New accounts get access automatically when you tag their resources correctly.

### Platform Team Cross-Account Read Access

Two approaches:

**Option A**: Create an `OrgReadOnly` Permission Set. Assign it to the platform team group across *all* accounts. In Identity Center, this is done once (not 20 times) by using the CLI/API to iterate accounts. As new accounts are created via Account Factory, a post-provisioning customization automatically adds this assignment.

**Option B** (more elegant at scale): Create a cross-account IAM role `PlatformReadOnly` in every account (via a StackSet), trusted by the platform team's Identity Center role in a designated "jump" account. The platform team logs into the jump account and assumes roles across accounts programmatically. Useful for automation but adds complexity for console access.

Option A is better for console users. Option B is better for automated access (scripts, tools).

### MFA for Prod Without Impacting Dev

In Identity Center, MFA is enforced at the IdP level (Okta in this case) — you configure Okta to require MFA for all SAML assertions to AWS. This is universal, not per-account.

For a *per-account* differentiation, use a combination of session duration (1h for prod, 8h for dev) and require re-authentication in the IdP when session duration has elapsed. Alternatively, create a separate Okta application for production account access with a stricter MFA policy (hardware token required, no push notifications).

---

## Exercise 5: Cost-Optimized Multi-Region Architecture

### Context
- Primary us-east-1, DR eu-west-1, three workload accounts, 5TB/month cross-region replication
- ECS Fargate, RDS PostgreSQL, S3 data lake
- Sub-$15,000/month infrastructure budget, RTO ≤ 15 minutes for RDS

---

### Network Topology: TGW vs Peering for Intra-Region

With three accounts per region, intra-region topology is the 4-VPC case (prod, staging, shared-services + network account). TGW is the right choice for the reasons in Exercise 1 — segmentation requirements and the future growth trajectory. The cost at 4 attachments per region:

- us-east-1 TGW: 4 attachments × $0.05/hr × 730 hrs = ~$146/month
- eu-west-1 TGW: same = ~$146/month

### Cross-Region: Cost Estimate

TGW inter-region peering for the replication traffic:
- 5TB/month cross-region data transfer: 5,000GB × $0.02/GB (us-east-1 to eu-west-1) = $100/month
- TGW peering attachments: 2 × $0.05/hr × 730 = ~$73/month
- Total cross-region networking: ~$173/month

Compare to the alternative (not using TGW for cross-region): direct VPC peering between prod account VPCs in each region. This avoids TGW peering attachment costs but requires manual route management and doesn't scale with additional accounts. Given three accounts that may all need cross-region access, TGW peering is worth the overhead.

### RDS Failover Strategy

**Option A: RDS Global Database** (for Aurora PostgreSQL)
- Primary cluster in us-east-1 replicates to secondary in eu-west-1 with ~1s lag
- Failover: promote secondary to primary — takes about 1 minute
- After promotion, update application DNS (Route 53 CNAME) to the new primary endpoint
- Cost: Global Database add-on pricing applies (~$0.20/million I/Os replicated)

**Option B: Read Replica Promotion** (for standard RDS PostgreSQL)
- Maintain a cross-region read replica in eu-west-1
- Replication is asynchronous — you may lose recently committed transactions in a failover
- Promotion to standalone primary takes 5–10 minutes, meeting the 15-minute RTO
- DNS update required after promotion
- Cost: standard read replica pricing, no additional replication fee

For a 15-minute RTO with standard PostgreSQL, Option B is sufficient and cheaper. For sub-5-minute RTO or zero-RPO requirements, Aurora Global Database is necessary.

### Minimizing NAT Gateway Costs

Replace all AWS service traffic with endpoints:
- S3 Gateway Endpoint: free, eliminates all S3 traffic from NAT
- ECR Interface Endpoint: Fargate pulls images; without this, every container start pulls through NAT (container images are typically 100MB–1GB each)
- Secrets Manager Interface Endpoint: eliminates secrets retrieval from NAT
- CloudWatch Logs Interface Endpoint: eliminates log shipping from NAT

For ECS Fargate specifically, the ECR and Logs endpoints are the highest-volume ones. Deploying 50 Fargate tasks/day pulling 500MB images without endpoints = 25GB/day through NAT = ~$34/month in NAT processing that becomes $0 with an interface endpoint.

### Cost Summary Estimate

| Component | Monthly Cost |
|---|---|
| TGW (us-east-1): 4 attachments | ~$146 |
| TGW (eu-west-1): 4 attachments | ~$146 |
| TGW cross-region peering + data | ~$173 |
| NAT GW (us-east-1, 3 AZs) | ~$96 fixed + variable |
| NAT GW (eu-west-1, 3 AZs, DR = standby) | ~$96 fixed (minimal traffic in DR) |
| Interface Endpoints (ECR, SSM, Logs, Secrets, etc.) × 2 regions | ~$100–150 |
| **Networking subtotal** | **~$760–810** |

This is well within the $15,000 budget for networking alone, leaving room for compute and storage.

---

## Exercise 6: Zero-Trust Client Access (Advanced)

### Context
- A bank needs to call your internal REST API from their own AWS account
- No internet traversal, no VPC peering, no VPN, instant revocation required
- Your API must remain available to your internal services

---

### Why PrivateLink Is the Only Right Answer

VPC peering would expose your entire VPC CIDR to the bank, violating the principle of least exposure. A VPN over the internet is explicitly excluded. PrivateLink exposes exactly one service (your NLB) with no other VPC access — the bank never sees your IP ranges or other resources.

### Your Side (Provider)

1. Deploy your API behind a **Network Load Balancer** (NLB). PrivateLink requires an NLB; ALBs are not supported as the backend directly (you can use an NLB that targets an ALB, but this adds latency and cost).

2. Create an **Endpoint Service** pointing to the NLB. Enable `RequiresAcceptance = true` so you can explicitly approve each consumer. Add the bank's AWS account ID to the allowed principals list.

3. The service name will be something like `com.amazonaws.vpce.us-east-1.vpce-svc-0abc123456`. Share this name with the bank.

### The Bank's Side (Consumer)

The bank creates an **Interface Endpoint** in their VPC pointing to your service name. AWS provisions ENIs in their subnets. They can create a Route 53 private hosted zone to give the endpoint a friendly DNS name (`api.yourcompany.com` → their ENI IPs) — this means their application code doesn't need to be updated when the endpoint IDs change.

You approve the connection request in your Endpoint Service console or via CLI.

### Authentication: mTLS vs API Key vs SigV4

**API key**: simplest but weakest — key can be shared, logged in transit, or leaked. Acceptable only if combined with TLS and rate limiting.

**SigV4**: bank creates an IAM role in their account and signs API requests with AWS credentials. You validate the signature in your API (or API Gateway does this for you). Strong cryptographic authentication, auditable, integrates with IAM. The bank must implement SigV4 request signing, which is non-trivial.

**mTLS**: both sides present TLS certificates for mutual authentication. The bank presents a certificate issued by a CA you trust (or you issue them a certificate). Cryptographically strong, technology-agnostic (any HTTP client supports TLS). The complexity is certificate lifecycle management — rotation, expiry, and revocation (CRL/OCSP).

**Recommendation for financial services**: mTLS or SigV4 combined with a custom claim (bank account ID in a header, validated server-side). mTLS is more standard in financial industry integrations.

### Instant Revocation

To revoke the bank's access:
1. Remove their account ID from the Endpoint Service's allowed principals list.
2. Delete the interface endpoint connection acceptance.
3. Their existing endpoint connections will fail within minutes as the connection is terminated.

No need to rotate credentials, change IAM policies, or touch the bank's account — you control the revocation entirely from your side.

### Scaling to Multiple Clients

The architecture scales elegantly: each new client creates their own Interface Endpoint pointing to the same Endpoint Service. Each connection is a separate ENI in their VPC. You approve each connection independently and can revoke them independently.

For differentiated access (client A can only call `/payments`, client B can call `/payments` and `/reports`): add an API Gateway in front of the NLB. The API GW validates the mTLS certificate subject or the SigV4 caller identity and routes/authorizes accordingly. Each client's requests are logged and attributable to their identity without any shared credentials.
