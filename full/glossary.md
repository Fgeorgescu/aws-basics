# AWS Glossary — Extended

Full definitions with context, common misconceptions, and when each concept matters in practice. Sorted alphabetically.

---

## Active-Active
A multi-region deployment model where all regions simultaneously serve live production traffic. There is no failover step — if a region fails, traffic is redistributed among the surviving regions automatically (by Route 53 latency routing or Global Accelerator). The data tier must handle writes from multiple regions concurrently, which requires conflict resolution: DynamoDB Global Tables uses last-writer-wins per item; Aurora Global Database routes writes to a single primary region by default (write forwarding directs cross-region writes to the primary transparently).

The cost multiplier is significant. An active-active deployment across three regions roughly triples networking costs (replication traffic), multiplies write costs for DynamoDB (one rWRU per replica per write), and doubles or triples compute costs. It's justified when the business cannot tolerate even 1–5 minutes of reduced availability.

| | |
|---|---|
| **Docs** | [Active-active multi-site](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html) |
| **Azure** | Active-active with Azure Traffic Manager or Front Door |
| **GCP** | Multi-region with Cloud Spanner or multi-region Cloud Load Balancing |

---

## Active-Passive
A multi-region deployment where one region (primary) handles all traffic and a second region (DR) stays ready to accept traffic if the primary fails. The DR region can be fully provisioned (hot standby, ~2× cost), scaled down (warm standby, ~1.3× cost), or minimal (pilot light, ~1.1× cost).

Failover is triggered either automatically (Route 53 health check detects primary failure, flips DNS record to DR) or manually (operator updates routing, re-sizes DB, promotes replicas). The critical design question is whether your automated failover can complete within your RTO — which depends on DNS TTL, health check settings, DB promotion time, and whether the DR environment is pre-warmed.

| | |
|---|---|
| **Docs** | [DR options — active-passive](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html) |
| **Azure** | Azure Site Recovery / Traffic Manager with priority routing |
| **GCP** | Cloud Load Balancing with failover backend configuration |

---

## Aurora Global Database
An Aurora capability that replicates a primary Aurora cluster (in one region) to up to five secondary regions. Replication is asynchronous but typically achieves under 1 second of lag under normal conditions. Secondary clusters can serve read traffic, reducing read latency for globally distributed users even before any failover.

On managed failover (primary region failure), Aurora promotes one secondary to primary. The process takes under 1 minute in most configurations. The metric `aurora_global_db_replication_lag` tells you the current lag — if it's elevated (minutes, not sub-second), a sudden primary failure means you'll lose that lag window of writes. Always monitor this metric continuously and alarm before it approaches your RPO threshold.

| | |
|---|---|
| **Docs** | [Aurora Global Database](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html) |
| **Azure** | Azure SQL Database Active Geo-Replication / Hyperscale |
| **GCP** | Cloud Spanner (multi-region) / AlloyDB cross-region replication |

---

## ABAC — Attribute-Based Access Control
Access control model where permissions are derived from tags/attributes attached to the IAM principal and/or the target resource, rather than explicit per-resource assignments.

In practice, ABAC enables scaling access management in large organizations. Instead of manually creating one account assignment per team per account (which breaks at 50+ accounts), you sync user attributes from your IdP (e.g., `Team=payments`) via SCIM, then write IAM policies that reference `aws:PrincipalTag/Team`. A developer with `Team=payments` automatically has access to resources tagged `Team=payments` — no manual AWS-side updates when teams are reorganized.

| | |
|---|---|
| **Docs** | [IAM ABAC](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction_attribute-based-access-control.html) |
| **Azure** | Azure ABAC (conditions on role assignments, preview) |
| **GCP** | IAM Conditions |

---

## Account Factory (AFT — Account Factory for Terraform)
Control Tower feature for automated account provisioning. AFT (the Terraform variant) treats account requests as pull requests to a Git repository — merge the PR and a pipeline provisions the account, applies baseline configurations, and enrolls it in security services.

AFT separates account provisioning (handled by Control Tower) from account customization (your Terraform modules). Customizations run post-provisioning and apply your organization's specific baseline: deploy monitoring agents, set up budget alerts, configure account-specific Config rules, or pre-create IAM roles for the CI/CD pipeline.

| | |
|---|---|
| **Docs** | [Account Factory for Terraform](https://docs.aws.amazon.com/controltower/latest/userguide/aft-overview.html) |
| **Azure** | Azure Landing Zones vending (Bicep/Terraform pipeline) |
| **GCP** | GCP Project Factory (Terraform module) |

---

## ALB — Application Load Balancer
Layer 7 load balancer that routes HTTP/HTTPS traffic based on path, hostname, headers, or query parameters. Supports target groups of EC2, ECS tasks, Lambda functions, or IPs. An internal ALB (no public IP) is the standard choice for east-west service-to-service calls within a VPC.

Note: ALBs cannot be the direct backend of a PrivateLink Endpoint Service — you must place an NLB in front of the ALB if you need to expose it via PrivateLink.

| | |
|---|---|
| **Docs** | [ALB](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html) |
| **Azure** | Azure Application Gateway |
| **GCP** | Cloud Load Balancing (HTTP(S)) |

---

## ARN — Amazon Resource Name
Every AWS resource — IAM role, S3 bucket, EC2 instance, KMS key — has a globally unique ARN in the format `arn:aws:service:region:account-id:resource-type/resource-id`. ARNs are how IAM policies specify exact resources (or use wildcards like `arn:aws:s3:::my-bucket/*`).

The region and account-id fields are omitted for global resources (IAM, S3 bucket names). The `aws` partition becomes `aws-cn` in China or `aws-us-gov` in GovCloud — policies written for one partition won't work in another.

| | |
|---|---|
| **Docs** | [ARNs](https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html) |
| **Azure** | Resource ID (`/subscriptions/{sub}/resourceGroups/{rg}/providers/{provider}/{type}/{name}`) |
| **GCP** | Resource name (`//service.googleapis.com/projects/PROJECT/...`) |

---

## Availability Zone (AZ)
A physically separated and independently powered data center (or group of data centers) within an AWS region. AZs in the same region are connected via low-latency, high-bandwidth fiber links. Intra-AZ traffic is free; inter-AZ traffic costs $0.01/GB in each direction.

The practical implication: for cost-sensitive architectures, keep compute and its data store in the same AZ. For HA architectures, distribute across at least 2 AZs and accept the inter-AZ transfer cost as the price of redundancy.

| | |
|---|---|
| **Docs** | [Regions and AZs](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html) |
| **Azure** | Availability Zone (same concept) |
| **GCP** | Zone (same concept) |

---

## AWS Config
Continuous configuration recorder and compliance evaluator. Every change to a supported AWS resource creates a Configuration Item — a timestamped snapshot of the resource's state. Config rules compare these snapshots against compliance criteria and flag deviations.

Unlike CloudTrail (which records API calls), Config records resource *state*. This makes it useful for answering "what did this resource look like 3 months ago?" and "when did this security group rule get added?" Conformance packs bundle multiple rules into a deployable unit — use them to apply AWS's pre-built compliance frameworks (CIS Benchmarks, NIST 800-53) org-wide.

| | |
|---|---|
| **Docs** | [AWS Config](https://docs.aws.amazon.com/config/latest/developerguide/WhatIsConfig.html) |
| **Azure** | Azure Policy (compliance evaluation) + Azure Resource Graph (state query) |
| **GCP** | Security Command Center + Cloud Asset Inventory |

---

## BGP — Border Gateway Protocol
The routing protocol of the internet — also used extensively in AWS networking. Direct Connect virtual interfaces, Site-to-Site VPN connections, and Transit Gateway Connect all use BGP to exchange route information dynamically. When you add a new VPC CIDR, BGP propagates it to your on-premises router without manual updates.

A common operational issue: conflicting BGP ASNs when connecting multiple clouds or on-premises routers. Each BGP speaker must have a unique ASN. AWS VGW/TGW uses 64512 by default; GCP Cloud Router uses 65535; on-premises routers often use 65000. Always plan ASNs before building multi-cloud or hybrid topologies.

| | |
|---|---|
| **Docs** | [BGP with Direct Connect](https://docs.aws.amazon.com/directconnect/latest/UserGuide/routing-and-bgp.html) |
| **Azure** | Same protocol — used with ExpressRoute and VPN Gateway |
| **GCP** | Same protocol — used with Cloud Router |

---

## Blast Radius
The maximum scope of damage from a single point of failure — a compromised credential, a misconfiguration, or a deliberate attack. In AWS architecture, reducing blast radius is the primary justification for multi-account structures: a mistake in a dev account cannot reach prod; a compromised role in the payments account cannot touch the user-data account.

Within an account, blast radius is reduced through IAM least privilege, permission boundaries, and resource-level policies. Across accounts, it's reduced through hard account isolation and SCPs that prevent cross-account escalation.

| | |
|---|---|
| **Docs** | [Security pillar — limiting blast radius](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html) |
| **Azure** | Same concept — mitigated via Management Groups, subscriptions, and Azure Policy |
| **GCP** | Same concept — mitigated via GCP folders, project separation, and Organization Policies |

---

## CIDR — Classless Inter-Domain Routing
IP addressing notation that specifies both an IP address and a network prefix length (e.g., `10.0.0.0/16` = 65,536 addresses). VPCs require a CIDR block on creation; subnets carve subsets of that CIDR. AWS reserves 5 IPs per subnet (first 4 and last 1).

CIDR planning matters enormously in multi-account, multi-region, and hybrid architectures. Overlapping CIDRs between peered VPCs break routing — you can't have two VPCs both claiming `10.0.0.0/16` and peer them. Many enterprise environments discover this problem after years of ad-hoc VPC creation. Use an IP Address Manager (IPAM) to track allocations.

| | |
|---|---|
| **Docs** | [VPC CIDR blocks](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html) |
| **Azure** | Same notation for VNet address spaces |
| **GCP** | Same notation for VPC subnetworks |

---

## CloudTrail
Every API call made to AWS — from the console, CLI, SDK, or another AWS service — generates a CloudTrail event containing the caller's identity, timestamp, source IP, action performed, and the request parameters. This is your primary audit trail.

CloudTrail is only useful if it can't be tampered with. The standard hardening is: org-wide trail → Log Archive account S3 bucket (cross-account, deny-delete policy) + SCP blocking `cloudtrail:StopLogging` and `cloudtrail:DeleteTrail`. Log file integrity validation adds hash chains to detect any post-delivery modification. Without these controls, an attacker with account admin access can destroy the evidence of their actions.

| | |
|---|---|
| **Docs** | [CloudTrail](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html) |
| **Azure** | Azure Activity Log + Azure Monitor |
| **GCP** | Cloud Audit Logs |

---

## Confused Deputy
A class of security vulnerability where a trusted intermediate service (the "deputy") is manipulated into performing actions it shouldn't, on behalf of an unauthorized party. The canonical AWS example: a SaaS vendor serves multiple customers and has cross-account access to each. Without protection, the vendor could (accidentally or maliciously) use Customer A's credentials to act in Customer B's account.

The fix is the `sts:ExternalId` condition: each customer generates a unique secret ID, shares it with the vendor, and requires it as a condition in their IAM trust policy. The vendor must provide the correct external ID when assuming the role — making impersonation attacks infeasible even if the attacker knows the account ID and role name.

| | |
|---|---|
| **Docs** | [Confused deputy prevention](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html) |
| **Azure** | Mitigated via OIDC claims (audience/subject restrictions) in federated credentials |
| **GCP** | Mitigated via Workload Identity Pool attribute conditions |

---

## Control Tower
AWS's opinionated landing zone automation service. When you set up Control Tower, it creates a multi-account structure (management account, Log Archive, Audit), applies baseline SCPs and Config rules (guardrails), enables CloudTrail org-wide, and sets up Identity Center. All enrolled accounts start in a known-good security state.

The tradeoff: Control Tower is opinionated. It makes decisions about OU structure and guardrail implementation that may conflict with your existing setup. For greenfield environments, it's an excellent starting point. For mature environments, you may find custom Terraform landing zones more flexible — but then you own the maintenance of guardrails, account vending, and baseline enforcement.

| | |
|---|---|
| **Docs** | [AWS Control Tower](https://docs.aws.amazon.com/controltower/latest/userguide/what-is-control-tower.html) |
| **Azure** | Azure Landing Zones (architecture pattern with Bicep/Terraform accelerators) |
| **GCP** | Google Cloud Foundation Blueprint / Assured Workloads |

---

## Delegated Administrator
When you manage AWS Organizations, many security services (GuardDuty, Security Hub, Macie, Config Aggregator, IAM Access Analyzer) can be administered from a member account instead of the management account. This is the delegated administrator pattern.

It matters for two reasons: (1) the management account should have no workloads and minimal access — the fewer people who log into it, the better; (2) the security team needs a centralized view of findings across all accounts, but they shouldn't need management account access to get it. Delegating GuardDuty and Security Hub to a dedicated security account gives the security team everything they need without touching the management account.

| | |
|---|---|
| **Docs** | [Delegated admin](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_integrate_services_list.html) |
| **Azure** | Azure Lighthouse (cross-tenant delegation) |
| **GCP** | Folder-level IAM delegation |

---

## Direct Connect (DX)
A dedicated physical network connection between your on-premises or colocation environment and AWS. Unlike VPN (which runs over the public internet), Direct Connect traffic never traverses the internet — it runs over a private fiber path from your equipment to an AWS Direct Connect location.

The key differentiator from VPN is predictability: Direct Connect gives you consistent bandwidth, lower latency, and no jitter — important for latency-sensitive database replication, bulk data transfer, and any application where network variance affects SLA. The operational cost: months of setup time for a new circuit, higher fixed monthly costs, and a dependency on a physical facility.

| | |
|---|---|
| **Docs** | [AWS Direct Connect](https://docs.aws.amazon.com/directconnect/latest/UserGuide/Welcome.html) |
| **Azure** | Azure ExpressRoute |
| **GCP** | Cloud Interconnect (Dedicated) |

---

## ENI — Elastic Network Interface
A virtual network card that lives in a subnet and carries a private IP address (and optionally a public IP or Elastic IP). Every EC2 instance has at least one ENI; Interface VPC Endpoints, NAT Gateways, and load balancers all create ENIs in your subnets. Understanding ENIs matters because Interface Endpoints are billed per AZ (each AZ gets its own ENI), and security group rules apply at the ENI level.

| | |
|---|---|
| **Docs** | [ENI](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-eni.html) |
| **Azure** | Network Interface (NIC) |
| **GCP** | Network Interface |

---

## Endpoint Service
The provider-side resource that makes your service accessible via AWS PrivateLink. You create it by pointing to an NLB, whitelist the AWS account IDs of consumers, and share the service name. Consumers create Interface Endpoints in their own VPCs pointing to your service name — your VPC remains completely hidden from them.

This is the mechanism for multi-tenant SaaS on AWS: each customer gets their own Interface Endpoint in their own VPC, pointing to your shared service. You can revoke a single customer's access by removing their account from the whitelist without affecting other customers.

| | |
|---|---|
| **Docs** | [Endpoint services](https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-share-your-services.html) |
| **Azure** | Azure Private Link Service |
| **GCP** | Private Service Connect (producer side) |

---

## Gateway Endpoint
The simplest and cheapest form of VPC Endpoint — available only for S3 and DynamoDB, and completely free. Instead of creating an ENI, a Gateway Endpoint injects prefix list entries into your route table. Traffic destined for S3 or DynamoDB IPs is redirected through the endpoint rather than the NAT Gateway or IGW.

The practical implication: if your private instances access S3 or DynamoDB at all, you should have Gateway Endpoints deployed in every VPC. The cost saving (eliminating NAT Gateway processing at $0.045/GB) can be substantial, and the security benefit (traffic stays on the AWS backbone) is free.

| | |
|---|---|
| **Docs** | [Gateway endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html) |
| **Azure** | Service Endpoint (similar mechanism, different implementation) |
| **GCP** | Private Google Access |

---

## GuardDuty
AWS's ML-based threat detection service. It continuously ingests CloudTrail management events, S3 data events, VPC Flow Logs, and DNS query logs, then applies threat intelligence and behavioral analytics to identify anomalous activity: unusual API call patterns, access from known-malicious IPs, cryptocurrency mining, credential exfiltration, and more.

The critical operational property: with org-level GuardDuty and a delegated admin, member accounts cannot disable their own GuardDuty enrollment. This is enforced at the Organizations level — not by an SCP that an account admin could theoretically work around. It means even a fully compromised account continues generating GuardDuty findings.

| | |
|---|---|
| **Docs** | [GuardDuty](https://docs.aws.amazon.com/guardduty/latest/ug/what-is-guardduty.html) |
| **Azure** | Microsoft Defender for Cloud |
| **GCP** | Security Command Center (Event Threat Detection) |

---

## IAM — Identity and Access Management
AWS's core authorization system. Every API request to AWS is evaluated by IAM, which decides allow or deny based on the policies attached to the calling principal, the resource's policies, the active SCPs, and any permission boundaries. IAM covers users (avoid), groups, roles (prefer), and two types of policies: identity-based (attached to a principal) and resource-based (attached to the resource).

IAM is not just for humans: EC2 instance profiles, Lambda execution roles, ECS task roles, and cross-account role chains are all IAM. Understanding IAM's evaluation logic (the six-step chain: explicit deny → SCPs → resource policy → permission boundary → session policy → identity policy) is fundamental to debugging access issues.

| | |
|---|---|
| **Docs** | [IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html) |
| **Azure** | Azure RBAC + Microsoft Entra ID |
| **GCP** | Cloud IAM |

---

## IAM Access Analyzer
Two related tools under one name: (1) a continuous monitor that identifies resources shared outside your trust zone (S3 buckets, KMS keys, IAM roles, SQS queues, Lambda functions, Secrets Manager secrets) — any external access generates a finding; and (2) a policy analysis tool that validates policy syntax, checks for common mistakes, and generates least-privilege policies from CloudTrail activity.

Set the zone of trust to your organization — then any resource accessible from outside the org is a finding. This catches configuration drift where a bucket policy that was temporarily made public for testing was never restricted back.

| | |
|---|---|
| **Docs** | [IAM Access Analyzer](https://docs.aws.amazon.com/IAM/latest/UserGuide/what-is-access-analyzer.html) |
| **Azure** | Azure Privileged Identity Management (PIM) |
| **GCP** | Policy Analyzer |

---

## Identity Center (formerly AWS SSO)
Centralized human identity management for AWS organizations. Identity Center federates with external IdPs (Okta, Azure AD, Google Workspace) via SAML 2.0 and synchronizes users/groups via SCIM. When a user authenticates, Identity Center issues temporary credentials by assuming an IAM role (called a Permission Set) in the target account.

The operational benefit over direct IAM users: one place to onboard employees, one place to offboard them. When a user is deprovisioned in Okta, SCIM removes them from Identity Center, and their access to all AWS accounts disappears within minutes — not buried in a checklist of 20 accounts to manually update.

| | |
|---|---|
| **Docs** | [Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html) |
| **Azure** | Microsoft Entra ID + PIM |
| **GCP** | Cloud Identity + Workforce Identity Federation |

---

## IGW — Internet Gateway
The VPC resource that connects your public subnets to the internet. It's attached at the VPC level (one per VPC), is free, horizontally scaled, and highly available — AWS manages all of this for you. When an EC2 instance in a public subnet sends traffic to the internet, the IGW performs NAT between the instance's private IP and its public Elastic IP. Critically, the IGW allows inbound internet-initiated connections to instances with public IPs — making security groups on those instances the primary guard.

The common mistake: treating an IGW as equivalent to a NAT Gateway. The IGW is bidirectional (internet can reach in) and only works for resources with public IPs. The NAT Gateway is outbound-only and serves private instances.

| | |
|---|---|
| **Docs** | [Internet Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html) |
| **Azure** | Built into VNet — public IPs + NSG rules control internet access, no separate resource |
| **GCP** | Default internet gateway automatically created per VPC |

---

## Interface Endpoint
A VPC Endpoint that creates one or more ENIs in your subnets to provide private access to AWS services or custom Endpoint Services. Unlike Gateway Endpoints, Interface Endpoints override DNS: `ssm.us-east-1.amazonaws.com` resolves to your ENI's private IP instead of a public IP, so applications work without any code changes.

Interface Endpoints are the key to hybrid networking: because they're standard ENIs in your VPC, they're reachable from on-premises via Direct Connect or VPN. This means corporate laptops on VPN can use AWS Systems Manager without any internet exposure.

| | |
|---|---|
| **Docs** | [Interface endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-access-aws-services.html) |
| **Azure** | Azure Private Endpoint |
| **GCP** | Private Service Connect endpoint |

---

## KMS — Key Management Service
AWS managed cryptographic key service. Supports symmetric (AES-256) and asymmetric keys. Customer-managed keys (CMKs) give you full control over key policy, rotation schedule, and grant management. AWS-managed keys are created automatically by services but can't be controlled beyond auditing.

KMS is the revocation mechanism in cross-account data access: if you need to instantly cut off another account's access to encrypted data, remove the cross-account decrypt grant from the KMS key policy. This takes effect within seconds and makes all future decryption requests from that account fail — without touching S3 or IAM policies.

| | |
|---|---|
| **Docs** | [KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) |
| **Azure** | Azure Key Vault (keys tier) |
| **GCP** | Cloud KMS |

---

## Landing Zone
A pre-configured, security-baseline AWS multi-account environment. The term describes the *outcome* (a well-structured org with guardrails, foundational accounts, and centralized logging) rather than the specific tool used to achieve it. AWS Control Tower is the managed service for creating one; custom Terraform/CDK landing zone modules give you more flexibility but require more maintenance.

The minimum viable landing zone has: a management account (billing only), a log archive account (immutable audit logs), a security account (delegated admin for security services), and a network account (shared TGW and DNS). Everything else builds on this foundation.

| | |
|---|---|
| **Docs** | [Landing Zone in Control Tower](https://docs.aws.amazon.com/controltower/latest/userguide/landing-zone.html) |
| **Azure** | Azure Landing Zones |
| **GCP** | Google Cloud Foundation Blueprint |

---

## MFA — Multi-Factor Authentication
Authentication requiring possession of a second factor beyond a password. In AWS, MFA can be enforced on IAM users (virtual TOTP, hardware TOTP, FIDO2/passkey) and can be required as a condition in IAM policies using `aws:MultiFactorAuthPresent: true`.

For human access via Identity Center, MFA policy is enforced at the IdP level (Okta, Azure AD) — which is more consistent and centrally managed than per-account IAM policies. For root accounts, MFA is non-negotiable: a compromised root account without MFA has unlimited access to the account, including deleting all resources, changing billing info, and removing the account from the organization.

| | |
|---|---|
| **Docs** | [MFA in IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa.html) |
| **Azure** | Microsoft Entra MFA / Conditional Access |
| **GCP** | Google 2-Step Verification / Context-Aware Access |

---

## NACL — Network Access Control List
A stateless firewall applied at the subnet level. Every packet (inbound and outbound) is evaluated independently against numbered rules; the first matching rule wins. Because NACLs are stateless, you must explicitly allow both directions for any traffic — including the ephemeral return port range (1024–65535) for TCP responses.

NACLs are a secondary defense mechanism, not a primary one. Security Groups handle most east-west control; NACLs are useful for coarse-grained interventions: quarantining a compromised subnet, blocking a specific IP range across an entire subnet, or adding an extra layer below Security Groups.

| | |
|---|---|
| **Docs** | [NACLs](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html) |
| **Azure** | No direct equivalent — NSGs are stateful and operate at both subnet and NIC level |
| **GCP** | No direct equivalent — VPC Firewall Rules are stateful |

---

## NAT Gateway
A managed network address translation service that allows instances in private subnets to initiate outbound internet connections by translating their private IPs to the NAT Gateway's Elastic IP. The translation is stateful: responses to outbound connections are allowed back in, but the internet cannot initiate new connections to private instances.

Deploy one NAT Gateway per AZ: instances in a different AZ from the NAT Gateway pay $0.01/GB cross-AZ (both directions) on top of the $0.045/GB NAT processing fee. At meaningful data volumes, cross-AZ NAT costs can exceed the NAT processing costs.

| | |
|---|---|
| **Docs** | [NAT Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html) |
| **Azure** | Azure NAT Gateway |
| **GCP** | Cloud NAT |

---

## OIDC — OpenID Connect
Identity layer on top of OAuth 2.0 that allows external systems to issue identity tokens (JWTs) that AWS can verify and exchange for temporary credentials. GitHub Actions, GitLab CI, GCP service accounts, and Kubernetes service accounts all support OIDC.

The workflow: (1) the external workload requests a JWT from its native identity provider; (2) it calls `sts:AssumeRoleWithWebIdentity` presenting the JWT; (3) AWS verifies the JWT signature against the registered OIDC provider, checks the `aud` and `sub` claims against the role's trust policy; (4) AWS issues temporary credentials. No long-lived access keys are stored anywhere.

| | |
|---|---|
| **Docs** | [OIDC identity providers](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html) |
| **Azure** | Federated Identity Credentials in Microsoft Entra |
| **GCP** | Workload Identity Federation / Workforce Identity Federation |

---

## Organizations
The AWS service that manages multiple accounts under a centralized hierarchy. The hierarchy (Root → OUs → Accounts) is the foundation for everything else: SCPs cascade down the tree, consolidated billing rolls up to the management account, and organization-wide services (CloudTrail, Config, GuardDuty) can be deployed once and apply everywhere.

The management account is the keystone: it can create new accounts, move accounts between OUs, attach and detach SCPs, and close accounts. Loss of management account access — or compromise of the management account — is the highest-severity incident in a multi-account organization.

| | |
|---|---|
| **Docs** | [AWS Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html) |
| **Azure** | Azure Management Groups |
| **GCP** | GCP Resource Manager (Organization → Folders → Projects) |

---

## OU — Organizational Unit
A container within AWS Organizations that groups accounts. SCPs attached to an OU are inherited by all child OUs and accounts — this inheritance is the mechanism for applying different guardrails to different environments. An OU structure should reflect your SCP needs, not your org chart: the question is "which accounts need the same SCPs?" not "which accounts belong to the same team?"

| | |
|---|---|
| **Docs** | [OUs](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_ous.html) |
| **Azure** | Management Group |
| **GCP** | GCP Folder |

---

## Permission Boundary
An IAM managed policy attached to a role or user that caps its maximum possible permissions. No matter what identity-based policies are attached, the role can never do more than what the boundary allows. Effective permissions = identity policy ∩ boundary.

The boundary's purpose is delegation without escalation: a developer can be given `iam:CreateRole` rights, but any role they create must have the boundary attached (enforced via an IAM condition on `iam:PermissionsBoundary`). Even if the developer tries to create a role with `AdministratorAccess`, the boundary limits it to only the approved set of permissions. This is the correct mechanism for giving development teams IAM autonomy in their own accounts.

| | |
|---|---|
| **Docs** | [Permission boundaries](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html) |
| **Azure** | No direct equivalent (closest: Azure PIM with role scope restrictions) |
| **GCP** | No direct equivalent |

---

## PrivateLink
The AWS networking technology that routes traffic from a VPC endpoint to a service (AWS-managed or custom) through the AWS backbone using private IP addresses. The consumer never sees the provider's VPC CIDR; the provider never sees the consumer's CIDR. Both sides get a clean abstraction — a private IP in their own subnet.

PrivateLink is the only viable architecture for exposing a service to external customers (other companies' AWS accounts) without giving them network-level access to your VPC. It's also how all Interface Endpoints work under the hood — when you create an Interface Endpoint for `ssm.amazonaws.com`, you're connecting to an Endpoint Service that AWS operates.

| | |
|---|---|
| **Docs** | [AWS PrivateLink](https://docs.aws.amazon.com/vpc/latest/privatelink/what-is-privatelink.html) |
| **Azure** | Azure Private Link |
| **GCP** | Private Service Connect |

---

## RAM — Resource Access Manager
Service for sharing specific AWS resources across accounts without full IAM role chains or VPC peering. The most architecturally significant use case is sharing VPC subnets: create subnets in a central network account and share them to workload accounts via RAM. Workload accounts deploy their resources (EC2, ECS, RDS) into the shared subnets but cannot modify the VPC-level networking (TGW attachments, route tables, NACLs). This gives you centralized network management with distributed workload deployment.

| | |
|---|---|
| **Docs** | [AWS RAM](https://docs.aws.amazon.com/ram/latest/userguide/what-is.html) |
| **Azure** | No direct equivalent (resource sharing is per-service) |
| **GCP** | Shared VPC (equivalent for networking resources) |

---

## SCP — Service Control Policy
An Organizations policy that acts as a guardrail — it defines the maximum permissions any principal in an account can have, regardless of what IAM grants. If the SCP doesn't allow an action, no IAM policy in the account can permit it. SCPs cannot grant permissions; they only restrict.

The most important operational fact: SCPs do not apply to the management account. An admin in the management account can do anything. This is why the management account must have no workloads and tightly controlled access — it is the one account in your organization that exists entirely outside your SCP guardrails.

| | |
|---|---|
| **Docs** | [SCPs](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html) |
| **Azure** | Azure Policy (at management group scope) |
| **GCP** | Organization Policy Service |

---

## Security Group
The primary east-west access control mechanism in AWS. Security Groups are stateful (allow inbound 443 → return traffic is automatically allowed), applied at the ENI level, and only support allow rules. The most powerful feature for scalable architectures: you can reference another security group as the source in a rule. `Allow TCP 5432 from app-sg` means any ENI that belongs to `app-sg` can reach port 5432 — and this automatically includes new instances as they scale, without any rule updates.

| | |
|---|---|
| **Docs** | [Security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html) |
| **Azure** | Network Security Group (NSG) — stateful, applied at subnet or NIC level |
| **GCP** | VPC Firewall Rules — stateful, applied network-wide with target tags or service accounts |

---

## STS — Security Token Service
The AWS service that issues all temporary credentials. Every `AssumeRole` call, every `AssumeRoleWithWebIdentity` (OIDC), every `AssumeRoleWithSAML` — they all go through STS, which returns a time-limited `AccessKeyId`, `SecretAccessKey`, and `SessionToken`. These credentials expire (15 minutes to 12 hours depending on configuration) and cannot be extended — the caller must re-call STS to get fresh credentials.

The time-limited nature is the key security property: leaked STS credentials self-expire. Leaked IAM user access keys do not.

| | |
|---|---|
| **Docs** | [STS](https://docs.aws.amazon.com/STS/latest/APIReference/welcome.html) |
| **Azure** | Azure AD token endpoint / Managed Identity credential endpoint |
| **GCP** | IAM credentials API (`generateAccessToken`) |

---

## TGW — Transit Gateway
A regional networking hub that connects multiple VPCs and on-premises networks via a hub-and-spoke model. Unlike VPC peering (which is point-to-point and non-transitive), a TGW routes between all attached VPCs and supports multiple route tables for network segmentation.

The route table feature is the most powerful aspect: by associating VPCs with different route tables and controlling which routes propagate to which tables, you can enforce that prod VPCs can reach shared services but cannot reach dev VPCs — all on the same TGW. This eliminates the need for separate TGWs per environment and centralizes routing policy in one place.

| | |
|---|---|
| **Docs** | [Transit Gateway](https://docs.aws.amazon.com/vpc/latest/tgw/what-is-transit-gateway.html) |
| **Azure** | Azure Virtual WAN |
| **GCP** | Network Connectivity Center |

---

## Trust Policy
The resource-based policy attached to an IAM role that defines which principals can assume it via `sts:AssumeRole`. Without a matching trust policy entry, no one can assume the role — even if they have `sts:AssumeRole` in their identity policy.

Trust policies support conditions just like identity policies. The `sts:ExternalId` condition prevents confused deputy attacks. The `aws:PrincipalOrgID` condition restricts assumption to principals within your organization. The `sts:RoleSessionName` condition can enforce that callers set a specific session name (e.g., their username) for auditability.

| | |
|---|---|
| **Docs** | [Trust policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_terms-and-concepts.html) |
| **Azure** | Federated identity credentials / role assignment conditions |
| **GCP** | IAM allow policy with role binding conditions |

---

## VPC — Virtual Private Cloud
Your private, logically isolated section of the AWS network. A VPC spans all AZs within a region and is defined by a CIDR block. Inside the VPC you create subnets (one per AZ), route tables, security groups, and NACLs. The VPC is the security and networking boundary for most AWS resources.

Important default: new VPCs have a default security group (allow all outbound, deny all inbound except from itself) and a default NACL (allow all). Delete the default VPC in every account and every region as part of your baseline hardening — the default VPC is often misconfigured because people experiment with it, and its existence creates unnecessary attack surface.

| | |
|---|---|
| **Docs** | [VPC](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html) |
| **Azure** | Virtual Network (VNet) |
| **GCP** | VPC Network |

---

## VPC Peering
A direct networking connection between two VPCs that enables instances in either VPC to communicate using private IPs, as if they were in the same network. Non-transitive: if A peers B and B peers C, traffic cannot flow A → B → C without a separate A-C peering.

The non-transitive property is both a limitation and a security feature: you can have VPC-A peer VPC-C (shared services) and VPC-B peer VPC-C, without A and B being able to reach each other, even through C. This is useful but requires care — mismatched route table entries are the most common source of peering connectivity issues.

| | |
|---|---|
| **Docs** | [VPC Peering](https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html) |
| **Azure** | VNet Peering |
| **GCP** | VPC Network Peering |

---

## Workload Identity Federation
The modern alternative to storing long-lived cloud credentials in CI/CD systems or cross-cloud service accounts. Instead of an AWS access key stored in a GitHub secret, GitHub Actions requests an OIDC JWT from GitHub's identity provider and presents it to AWS STS via `AssumeRoleWithWebIdentity`. AWS verifies the JWT, checks the audience and subject claims against the trust policy conditions, and issues temporary credentials.

The security properties: (1) no credentials stored in GitHub; (2) credentials expire automatically (typically 1 hour); (3) the trust policy can be scoped to a specific repository, branch, and environment — meaning a workflow in `repo:org/app:environment:production` is the only identity that can assume the production deploy role.

| | |
|---|---|
| **Docs** | [Workload identity federation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_oidc.html) |
| **Azure** | Federated Identity Credentials (Azure AD workload identity) |
| **GCP** | Workload Identity Federation |

---

## AWS Fault Injection Service (FIS)
Chaos engineering service that lets you run controlled, documented fault experiments against real AWS infrastructure. The key insight FIS encodes is that theoretical RTO and actual RTO are almost always different — an untested failover plan is wishful thinking, not engineering.

FIS experiments are defined as JSON/YAML templates specifying targets (a specific EC2 Auto Scaling group, a specific AZ, all Spot instances with a certain tag) and actions (terminate, add latency, throttle API calls, block AZ network traffic). Experiments are stopped automatically if a defined safety condition is breached (e.g., if an alarm triggers, abort the experiment). This makes running experiments in production environments much safer than manual chaos.

| | |
|---|---|
| **Docs** | [AWS FIS](https://docs.aws.amazon.com/fis/latest/userguide/what-is.html) |
| **Azure** | Azure Chaos Studio |
| **GCP** | No managed equivalent — open-source tools like Chaos Toolkit or LitmusChaos |

---

## AWS Resilience Hub
Resilience Hub performs static architectural analysis of your application against declared RTO/RPO targets and produces a Resiliency Score (0–100) with specific remediation recommendations. It understands AWS resource dependencies: if your API Gateway has a Lambda backend that has an RDS dependency, and the RDS instance has no Multi-AZ, Resilience Hub surfaces that single point of failure.

The operational value is continuous monitoring: Resilience Hub can re-run assessments on a schedule or when infrastructure changes are detected, alerting you when a deployment introduces a new single point of failure. This makes HA regression visible before it causes an incident.

| | |
|---|---|
| **Docs** | [Resilience Hub](https://docs.aws.amazon.com/resilience-hub/latest/userguide/what-is.html) |
| **Azure** | Azure Business Continuity Center |
| **GCP** | No direct equivalent |

---

## Circuit Breaker
A software pattern that monitors calls to a downstream dependency and "opens" (stops sending requests) when failure rate exceeds a threshold. An open circuit lets the downstream service recover instead of being flooded with retried requests, which often makes partial failures cascade into total failures.

AWS App Mesh implements circuit breaking at the service mesh level. API Gateway has circuit breaker-like behavior via its throttling configuration. For application-level circuit breakers in Lambda or EC2 code, teams typically use libraries like Resilience4j or implement the pattern manually with state stored in ElastiCache.

| | |
|---|---|
| **Docs** | [App Mesh outlier detection](https://docs.aws.amazon.com/app-mesh/latest/userguide/virtual-node-spec.html) |
| **Azure** | Azure API Management (circuit breaker policy) |
| **GCP** | Cloud Service Mesh / Traffic Director |

---

## Cross-Zone Load Balancing
When enabled, a load balancer distributes requests evenly across all healthy targets in all AZs, regardless of which AZ the load balancer node received the request in. Without it, each LB node only sends traffic to targets in its own AZ — meaning uneven distribution if you have different numbers of targets per AZ.

The cost nuance: ALB has cross-zone enabled by default, and inter-AZ traffic from cross-zone routing is billed at $0.01/GB. For NLBs created after October 2023, cross-zone load balancing can be enabled without inter-AZ charges — a significant billing improvement. For older NLBs, enabling cross-zone load balancing generates inter-AZ charges that can be substantial for high-throughput applications.

| | |
|---|---|
| **Docs** | [Cross-zone load balancing](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html#cross-zone-load-balancing) |
| **Azure** | Zone-redundant load balancing (Standard Load Balancer) |
| **GCP** | Cloud Load Balancing is globally distributed by default |

---

## DynamoDB Global Tables
Active-active multi-region DynamoDB. Tables are replicated across selected regions; any region can accept writes. This is DynamoDB's answer to global active-active: no single-region bottleneck for writes, low latency for users in any replica region.

The cost model changes significantly with Global Tables. Normally, a write consumes 1 WRU. With Global Tables, it also consumes 1 rWRU per additional replica region. A 3-region Global Table triples the write cost. For a high-throughput table (say, 10,000 WCUs provisioned), this is the dominant cost driver — often exceeding storage and read costs combined. Factor this in before adopting Global Tables; for many workloads, active-passive cross-region replication with async promotion is a fraction of the cost with an acceptable RPO.

| | |
|---|---|
| **Docs** | [Global Tables](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html) |
| **Azure** | Azure Cosmos DB multi-region writes |
| **GCP** | Cloud Spanner (multi-region) / Firestore multi-region |

---

## ElastiCache
AWS managed in-memory data store for Redis and Memcached. For HA, ElastiCache Redis supports Multi-AZ with auto-failover: a primary node in one AZ with one or more replicas in other AZs. When the primary fails, a replica is automatically promoted (~20–30 seconds). Replication is asynchronous — there is a small window of potential data loss.

ElastiCache Global Datastore extends this cross-region: a primary cluster in one region replicates to secondary clusters in up to two additional regions (async). Secondary clusters are read-only during normal operation; on primary region failure, a secondary can be promoted to primary. This is the ElastiCache equivalent of Aurora Global Database, and like Aurora, the replication lag determines your effective RPO.

| | |
|---|---|
| **Docs** | [ElastiCache](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/WhatIs.html) |
| **Azure** | Azure Cache for Redis |
| **GCP** | Memorystore for Redis |

---

## Pilot Light
The minimum viable DR strategy. You keep data warm in the DR region (DB snapshots replicated, S3 buckets mirrored, AMIs copied) but run no compute. Infrastructure-as-code definitions exist and are tested, so you know how long provisioning takes. Route 53 records point to the primary region; the DR region has no live endpoints.

On failover, someone executes the runbook: launch EC2 instances from the copied AMIs, promote the RDS cross-region read replica to standalone (takes 10–30 minutes for the promotion plus any catch-up replication), update DNS. The total RTO is typically 30–60 minutes. The ongoing cost is near zero — just storage for snapshots and cross-region transfer for replication.

Pilot light is frequently used for regulatory compliance: organizations in regulated industries need a documented DR capability, but the actual workload doesn't justify the cost of a warm standby.

| | |
|---|---|
| **Docs** | [Pilot light DR](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html) |
| **Azure** | Azure Site Recovery (cold standby configuration) |
| **GCP** | GCP snapshot + Deployment Manager / Terraform for DR automation |

---

## RPO — Recovery Point Objective
The maximum acceptable amount of data loss, measured as the time window between the last recovered state and the point of failure. An RPO of zero means no data loss is acceptable — achievable only with synchronous replication (viable intra-region; impractical cross-region due to latency). An RPO of 1 minute means you're willing to lose up to 60 seconds of transactions.

RPO drives your replication mode. Synchronous replication (RDS Multi-AZ) approaches zero RPO but adds write latency equal to the replication round-trip. Asynchronous replication (RDS read replicas, Aurora Global Database, DynamoDB Global Tables) reduces write latency but creates a non-zero RPO equal to the current replication lag.

| | |
|---|---|
| **Docs** | [DR concepts](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-workloads-on-aws.html) |
| **Azure** | Same concept — used in Azure Site Recovery SLA definitions |
| **GCP** | Same concept |

---

## RTO — Recovery Time Objective
The maximum acceptable duration of a service outage, from the moment of failure to the moment of full restoration. RTO drives your failover strategy and, therefore, your DR infrastructure cost. An RTO of hours allows a pilot light (launch compute from snapshots on failure). An RTO of minutes requires pre-provisioned infrastructure and automated failover. An RTO of seconds requires active-active, which eliminates failover entirely.

RTO is a business SLA, not a technical preference. Derive it from revenue impact calculations: "we lose $X per minute of downtime for this service." Then choose the cheapest failover tier that satisfies the requirement. Most organizations discover that their actual RTO requirements are less stringent than their intuition suggests, and that warm standby (30-minute RTO) covers most workloads at a fraction of active-active cost.

| | |
|---|---|
| **Docs** | [DR concepts](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-workloads-on-aws.html) |
| **Azure** | Same concept |
| **GCP** | Same concept |

---

## Route 53 ARC — Application Recovery Controller
An extension of Route 53 that adds two capabilities missing from standard failover routing. Readiness checks continuously verify that your DR environment matches production specifications: same Auto Scaling group limits, same database instance class, same number of targets behind the load balancer. If something drifts (someone scaled down the DR environment and forgot to restore it), the readiness check fails and alerts you before a real disaster.

Routing controls let you manually shift traffic between regions in seconds via an API call or console click, bypassing DNS TTL entirely. This is critical for ambiguous failures where the health check isn't triggering (the endpoint responds but returns degraded results) — you can force traffic to the DR region without waiting for Route 53's failover logic to engage.

| | |
|---|---|
| **Docs** | [Route 53 ARC](https://docs.aws.amazon.com/r53recovery/latest/dg/what-is-route53-recovery.html) |
| **Azure** | Azure Traffic Manager + Azure Site Recovery (combined) |
| **GCP** | No direct equivalent |

---

## S3 Cross-Region Replication (CRR)
S3 feature that asynchronously replicates objects from a source bucket to destination buckets in other regions. Replication is triggered by new uploads and updates; existing objects can be replicated via a one-time Batch Replication job. The source and destination buckets can be in different accounts.

CRR is the data foundation for multi-region and DR architectures: replicate application artifacts to the DR region so they're available without internet dependency during a failure. The cost surprises: CRR charges per-object PUT request on the destination side (you pay to write each object again), plus the standard inter-region data transfer rate. For buckets with millions of small objects, the per-request cost can exceed the data transfer cost.

| | |
|---|---|
| **Docs** | [S3 CRR](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html) |
| **Azure** | Azure Blob geo-redundant storage (GRS / GZRS) |
| **GCP** | Cloud Storage dual-region or multi-region buckets |

---

## S3 Multi-Region Access Points (MRAP)
A single global S3 endpoint that routes each request to the nearest available bucket in an S3 replication group. Requests are routed based on network proximity; if a bucket in the nearest region is unavailable, requests fail over to the next closest bucket.

MRAP supports both Active-Active (requests go to the nearest bucket) and Active-Passive (one bucket handles all traffic; a failover control shifts to the secondary). The failover control API lets you shift traffic between buckets in seconds. The additional MRAP transfer fee ($0.0033/GB) is worth accounting for in data-heavy architectures, but it's a small fraction of the primary S3 transfer costs.

| | |
|---|---|
| **Docs** | [S3 MRAP](https://docs.aws.amazon.com/AmazonS3/latest/userguide/MultiRegionAccessPoints.html) |
| **Azure** | Azure Blob Storage with geo-redundancy (GRS / RA-GRS) |
| **GCP** | Cloud Storage multi-region bucket |

---

## Warm Standby
A DR strategy where a scaled-down version of the production environment runs continuously in the DR region. The architecture is identical to production — same services, same configuration — but sized smaller: fewer EC2 instances, smaller database instance class, lower Auto Scaling group capacity.

On failover, you scale up the Auto Scaling group to production capacity (new instances launch in 3–5 minutes) and resize the database (which involves a brief restart). The RTO is typically 10–30 minutes. The ongoing cost is proportional to the standby size — running at 20% of production adds roughly 20% to your infrastructure bill, significantly cheaper than a hot standby but with a longer RTO.

The sizing decision is non-obvious: the standby must be large enough to absorb 100% of peak production traffic after failover, not just 100% of average traffic. If you size for average load and fail over during a traffic spike, the DR environment is immediately overwhelmed.

| | |
|---|---|
| **Docs** | [Warm standby DR](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html) |
| **Azure** | Azure Site Recovery (warm standby mode) |
| **GCP** | GKE with scaled-down node pools + Cloud SQL replica in secondary region |

---

## AWS Backup
AWS Backup is a fully managed, policy-driven service that centralizes and automates data protection across AWS services including RDS, Aurora, EBS, EFS, DynamoDB, S3, FSx, and Storage Gateway. A Backup Plan defines: when to run backups (cron schedule), how long to retain them, and whether to copy them to another region or account.

The critical capability for DR is **cross-account vault copy**: backups are written to a vault in a separate AWS account under a separate SCP that denies deletion. Even if an attacker compromises the production account and has admin access, they cannot delete backups in the isolated backup account. This is the recommended architecture for ransomware protection.

**Vault Lock** (WORM mode) goes further: once applied in compliance mode, no identity — including the account root user — can delete recovery points before the retention period expires, and the lock itself cannot be removed after a 72-hour grace window.

| | |
|---|---|
| **Docs** | [AWS Backup](https://docs.aws.amazon.com/aws-backup/latest/devguide/whatisbackup.html) |
| **Azure** | Azure Backup (similar policy model; Recovery Services Vault + immutability) |
| **GCP** | Google Cloud Backup and DR (agent-based; different model from AWS Backup) |

---

## DRS — AWS Elastic Disaster Recovery
DRS provides continuous block-level replication for physical servers, VMware VMs, and EC2 instances. Unlike snapshot-based backup (which captures a point in time), DRS streams ongoing disk changes to a lightweight staging area in the target AWS region. At any moment, the staging area holds a current replica of the source disk.

When failover is triggered (drill or real), DRS provisions full-size EC2 instances using the staged data. The provisioning time — not data transfer — is the primary RTO driver, typically 5–20 minutes.

**Why block-level replication matters for complex applications:** Application-consistent backups (RDS snapshots, EBS snapshots) capture a consistent state of a single service. Multi-tier applications have state spread across multiple components (application server + database + message queue). Block-level replication captures everything simultaneously, so the recovery instances boot in a consistent cross-tier state. This is particularly valuable for legacy applications where you can't easily control each component's backup schedule.

| | |
|---|---|
| **Docs** | [AWS Elastic Disaster Recovery](https://docs.aws.amazon.com/drs/latest/userguide/what-is-drs.html) |
| **Azure** | Azure Site Recovery (similar continuous replication model) |
| **GCP** | Zerto on GCP / Google Cloud Disaster Recovery |

---

## PITR — Point-in-Time Recovery
PITR allows restoring a database to any specific second within a configurable retention window rather than only to scheduled snapshot points. RDS and Aurora PITR work by replaying transaction logs on top of the most recent automated backup. DynamoDB PITR captures per-second snapshots of table state with no performance impact on the table.

**When snapshots are insufficient:** If a developer runs `DELETE FROM orders WHERE 1=1` at 14:32:17 and your most recent snapshot is from 02:00, a snapshot restore loses 12 hours of transactions. PITR lets you restore to 14:32:16 — one second before the error — recovering everything.

**The RPO implication:** DynamoDB PITR gives a theoretical RPO of seconds (any second within 35 days). RDS PITR RPO is bounded by transaction log backup frequency, typically 5 minutes. For the absolute minimum RPO on RDS, combine PITR with synchronous Multi-AZ replication.

| | |
|---|---|
| **Docs** | [RDS PITR](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_PitrRestore.html) · [DynamoDB PITR](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/PointInTimeRecovery.html) |
| **Azure** | Automated backups with PITR for Azure SQL Database and Cosmos DB |
| **GCP** | Cloud SQL PITR · Spanner PITR |

---

## Vault Lock (AWS Backup)
Vault Lock applies a WORM (Write Once, Read Many) retention policy to an AWS Backup vault. Recovery points written to a locked vault cannot be deleted by any AWS identity — including the root user and AWS Support — before their retention expiry. In compliance mode, the lock policy itself is irremovable after a 72-hour cooling-off window.

The architectural use case is ransomware defense. A sophisticated ransomware attack targets not just production data but backup infrastructure. If backups are stored in the same account with deletable policies, the attacker can destroy them. Cross-account vaults with Vault Lock ensure that even a fully compromised production account cannot destroy the recovery point.

**Governance mode vs compliance mode:** Governance mode allows principals with specific IAM permissions to override the lock (useful for testing or administrative corrections). Compliance mode removes all override capability after the cool-off window — use it when regulatory requirements mandate immutable records.

| | |
|---|---|
| **Docs** | [AWS Backup Vault Lock](https://docs.aws.amazon.com/aws-backup/latest/devguide/vault-lock.html) |
| **Azure** | Azure Backup immutability policies (similar; applies to Recovery Services Vault) |
| **GCP** | Cloud Storage object retention locks / bucket lock |
