# Design Exercises

Each exercise asks you to produce:
- **Architecture description**: which resources exist, in which accounts/AZs/regions, and how they connect.
- **Resource list**: the specific AWS resources you would provision.
- **Decision rationale**: why you chose one approach over alternatives (cost, security, operational complexity).

No Terraform, CDK, or implementation is required.

---

## Exercise 1: Multi-Account Hub-and-Spoke Network

### Context
A company has three AWS accounts:
- **Prod account** (us-east-1): hosts production workloads in private subnets
- **Staging account** (us-east-1): hosts pre-production workloads in private subnets
- **Shared Services account** (us-east-1): hosts internal tooling (Artifactory, monitoring), accessible by both prod and staging
- A second region **eu-west-1** is being added for disaster recovery — a prod-equivalent workload will run there

### Requirements
- Prod and staging must **not** be able to communicate with each other.
- Both must be able to reach shared services.
- The DR workload in eu-west-1 must be able to communicate with us-east-1 prod (for data replication).
- All inter-VPC traffic must stay off the internet.

### Constraints
- Budget-conscious: minimize TGW attachment costs where possible.
- Shared services must remain private (no public endpoints).

### Deliverable
Design the full network topology. Address:
1. TGW vs VPC peering — justify your choice.
2. How do you prevent prod↔staging communication? (route table design)
3. How does eu-west-1 connect to us-east-1?
4. How do you share the TGW across accounts?
5. What route table entries are required on each VPC side?

---

## Exercise 2: Private S3 Access Across Accounts

### Context
- **Data Lake account**: owns an S3 bucket `s3://company-data-lake` encrypted with a customer-managed KMS key.
- **Processing account**: runs an EMR cluster and Glue jobs that need to read from and write to the data lake bucket.
- Security requirement: **no data must traverse the internet at any point**.
- Compliance requirement: all S3 access must be logged and auditable.

### Requirements
- The processing account's jobs must authenticate with the data lake account without storing long-lived credentials.
- The data lake bucket must reject any request not originating from within the AWS network.
- Access must be revokable instantly if the processing account is compromised.

### Deliverable
Design the access control and network architecture. Address:
1. What VPC endpoint type do you use, and where do you deploy it?
2. How do you write the S3 bucket policy and KMS key policy to allow cross-account access?
3. What IAM role structure enables the EMR/Glue jobs to access the bucket?
4. How do you enforce the "no internet" requirement on the bucket side?
5. How do you revoke access instantly if needed?

---

## Exercise 3: Secure Cross-Account CI/CD Pipeline

### Context
- **Tooling account**: runs a GitHub Actions self-hosted runner (on EC2 or ECS).
- **Prod account**: hosts the production environment. No developer should have standing access.
- **Staging account**: hosts the staging environment.
- The company wants to ensure that **only the CI/CD pipeline** can deploy to production — not engineers directly, even with AWS credentials.

### Requirements
- Engineers can deploy to staging manually (via Identity Center) but not prod.
- The pipeline must deploy infrastructure (Terraform) and application artifacts (ECR images, Lambda ZIPs).
- All pipeline actions must be auditable.
- If a pipeline credential is compromised, the blast radius must be limited to a single account.

### Deliverable
Design the IAM and organizational guardrail structure. Address:
1. What IAM roles exist in each account, and what are their trust policies?
2. What SCP do you attach to the prod OU to prevent direct human deployment?
3. How does the GitHub Actions runner authenticate to AWS? (OIDC vs instance profile — justify)
4. How do you scope the deploy role's permissions to only what Terraform needs?
5. How do you audit who triggered each deployment and what changed?

---

## Exercise 4: Identity Center with External IdP Integration

### Context
- A 20-account AWS organization.
- The engineering team (100 people, 8 teams) uses **Okta** as their IdP.
- Access patterns:
  - Each team owns 2–3 accounts (their dev, staging, and a shared service).
  - A platform team needs read-only access to **all** accounts.
  - A security team needs read-only + incident-response access to **all** accounts.
  - Individual developers should only access their team's accounts.

### Requirements
- Human access must go through Identity Center only — no IAM users.
- Session duration: 1 hour for prod, 8 hours for dev/sandbox.
- MFA required for prod account access.
- As teams grow/shrink, access provisioning should require minimal AWS-side changes.

### Deliverable
Design the Identity Center configuration. Address:
1. How do you structure Permission Sets? List the ones you'd create and their policies.
2. How do you sync Okta groups to Identity Center?
3. How do you handle the platform team's and security team's cross-account read access without creating one assignment per account?
4. How do you enforce MFA for prod without impacting dev experience?
5. How would you implement ABAC so that Okta group membership dynamically controls access without manual account assignments?

---

## Exercise 5: Cost-Optimized Multi-Region Architecture

### Context
- Primary region: **us-east-1**; DR region: **eu-west-1**.
- Three workload accounts: prod, staging, shared-services — replicated in both regions.
- Workloads: ECS Fargate services, RDS PostgreSQL, S3 data lake.
- Monthly data transfer between regions: ~5TB (replication traffic).
- The company has committed to staying under $15,000/month in infrastructure (excluding EC2 instance costs).

### Requirements
- RDS must fail over to eu-west-1 within 15 minutes of a us-east-1 outage.
- S3 data must be available in both regions.
- Inter-account service calls must stay off the internet.
- NAT costs must be minimized.

### Deliverable
Design the architecture with cost breakdown. Address:
1. TGW vs VPC peering for the intra-region topology — cost and routing justification.
2. How do you connect us-east-1 and eu-west-1? Estimate the monthly cost.
3. What is your RDS failover strategy? (Global Database vs read replica promotion — justify)
4. How do you eliminate or minimize NAT GW costs for AWS service traffic?
5. Estimate the monthly networking cost (TGW attachments + data processing + inter-region transfer + NAT).
6. What Savings Plans strategy would you recommend?

---

## Exercise 6: Zero-Trust Client Access to Critical Infrastructure (Advanced)

### Context
- Your company runs a financial services platform in AWS (3 accounts: prod, shared-services, security).
- A **client** (a large bank) needs to call your internal REST API (`api.internal.yourcompany.com`) from their **own AWS account**.
- The bank's AWS account ID is known but not trusted beyond this integration.
- Security requirements:
  - The bank must **not** have access to any other resource in your VPC.
  - Traffic must not traverse the public internet.
  - You must be able to revoke the bank's access instantly.
  - All API calls must be authenticated and logged.
  - The CIDR ranges must not need to be coordinated (the bank may have overlapping CIDRs with you).

### Requirements
- The solution must work without VPC peering or VPN.
- The bank's engineers should not need IAM credentials in your account.
- The API must remain accessible to your own internal services as well.

### Deliverable
Design the connectivity and access control architecture. Address:
1. How do you expose the API to the bank's account without peering? (PrivateLink endpoint service design)
2. What NLB configuration is required, and where does it sit?
3. How do you restrict the endpoint service to only the bank's account?
4. How does the bank create their side of the connection?
5. How do you authenticate the bank's API calls (API key, SigV4, mTLS — justify)?
6. How do you revoke access instantly?
7. How does this architecture extend if you need to onboard a second client?

---

## Recommended Tools

### Diagramming

| Tool | Best For | Cost |
|---|---|---|
| **[draw.io / diagrams.net](https://app.diagrams.net)** | Polished architecture diagrams with official AWS shape library | Free |
| **[Cloudcraft](https://www.cloudcraft.co)** | AWS-specific isometric diagrams; can import from a live AWS account | Free tier + paid |
| **[Excalidraw](https://excalidraw.com)** | Fast whiteboard-style sketching during design sessions or interviews | Free |
| **[Mermaid](https://mermaid.live)** | Code-based diagrams that live in Git alongside your docs | Free |
| **[Lucidchart](https://www.lucidchart.com)** | Collaborative, enterprise-friendly; good AWS stencil library | Paid (free trial) |

**Recommendation by scenario:**
- **Interview whiteboard / live design session** → Excalidraw (fastest, no friction)
- **Client-facing deliverable** → Cloudcraft or draw.io with [official AWS icons](https://aws.amazon.com/architecture/icons/)
- **Docs-as-code in a repo** → Mermaid (renders in GitHub, GitLab, and many markdown viewers)

### AWS Icon Sets
- **Official AWS Architecture Icons**: download from [aws.amazon.com/architecture/icons](https://aws.amazon.com/architecture/icons/) — SVG/PNG packs for draw.io, PowerPoint, Sketch, and Figma.
- draw.io has these built in under *Search Shapes → AWS*.

### Other Useful Tools

| Tool | Purpose |
|---|---|
| **[Former2](https://former2.com)** | Reverse-engineer existing AWS resources into CloudFormation / Terraform / CDK |
| **[Steampipe](https://steampipe.io)** | SQL queries against live AWS resources — great for auditing multi-account orgs |
| **[AWS Well-Architected Tool](https://console.aws.amazon.com/wellarchitected)** | Review a workload against the 6 pillars; generates a risk report |
| **[AWS Pricing Calculator](https://calculator.aws)** | Estimate monthly costs before you build |
| **[Policy Simulator](https://policysim.aws.amazon.com)** | Test IAM policies against specific API calls without deploying anything |
| **[cfn-lint](https://github.com/aws-cloudformation/cfn-lint)** | Validate CloudFormation templates locally |

---

## Reference: Useful AWS Documentation

- [VPC Endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html)
- [Transit Gateway](https://docs.aws.amazon.com/vpc/latest/tgw/what-is-transit-gateway.html)
- [AWS PrivateLink](https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-share-your-services.html)
- [Service Control Policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html)
- [Permission Boundaries](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html)
- [AWS Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html)
- [AWS Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html)
- [AWS Control Tower](https://docs.aws.amazon.com/controltower/latest/userguide/what-is-control-tower.html)
- [AWS RAM](https://docs.aws.amazon.com/ram/latest/userguide/what-is.html)
