# AWS Glossary

Quick-reference definitions for all terms covered in this guide. Sorted alphabetically.

---

## Active-Active
Multi-region deployment where all regions serve live traffic simultaneously. No failover required; a region failure reduces capacity but the system stays available. Requires globally replicated, conflict-tolerant data tiers (DynamoDB Global Tables, Aurora Global DB with write forwarding).

| | |
|---|---|
| **Docs** | [Active-active multi-site](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html) |
| **Azure** | Active-active with Azure Traffic Manager / Front Door |
| **GCP** | Multi-region active-active with Cloud Spanner or Cloud Load Balancing |

---

## Active-Passive
Deployment where a primary region handles all traffic and a standby region is ready to take over. Failover is triggered by a health check (Route 53) or manually. Standby may be idle (hot standby) or scaled-down (warm standby).

| | |
|---|---|
| **Docs** | [DR options — active-passive](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html) |
| **Azure** | Azure Site Recovery / Traffic Manager with priority routing |
| **GCP** | Cloud Load Balancing with failover backends |

---

## Aurora Global Database
Aurora feature that replicates a primary Aurora cluster to up to five secondary read-only regions with typical lag < 1 second. Supports managed failover (promotes a secondary to primary) with RTO typically under 1 minute.

| | |
|---|---|
| **Docs** | [Aurora Global Database](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/aurora-global-database.html) |
| **Azure** | Azure SQL Database geo-replication / Hyperscale |
| **GCP** | Cloud Spanner (multi-region) / AlloyDB cross-region replication |

---

## ABAC — Attribute-Based Access Control
Access control model where permissions are granted based on tags/attributes on the principal (user, role) and the resource, instead of explicit per-resource assignments.

| | |
|---|---|
| **Docs** | [IAM ABAC](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction_attribute-based-access-control.html) |
| **Azure** | Azure ABAC (conditions on role assignments) |
| **GCP** | IAM Conditions |

---

## Account Factory (AFT — Account Factory for Terraform)
Control Tower feature for automated, self-service AWS account provisioning. AFT uses a Git-based pipeline to apply baseline configurations to every new account.

| | |
|---|---|
| **Docs** | [Account Factory for Terraform](https://docs.aws.amazon.com/controltower/latest/userguide/aft-overview.html) |
| **Azure** | Azure Landing Zones vending (Bicep/Terraform) |
| **GCP** | GCP Project Factory |

---

## ALB — Application Load Balancer
Layer 7 (HTTP/HTTPS) load balancer supporting path-based routing, host-based routing, and WebSockets. Can be internet-facing or internal.

| | |
|---|---|
| **Docs** | [ALB](https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html) |
| **Azure** | Azure Application Gateway |
| **GCP** | Cloud Load Balancing (HTTP(S)) |

---

## ARN — Amazon Resource Name
Unique identifier for any AWS resource, formatted as `arn:aws:service:region:account-id:resource`. Used in IAM policies to specify principals and resources.

| | |
|---|---|
| **Docs** | [ARNs](https://docs.aws.amazon.com/general/latest/gr/aws-arns-and-namespaces.html) |
| **Azure** | Resource ID (`/subscriptions/.../resourceGroups/...`) |
| **GCP** | Resource name (`projects/PROJECT/...`) |

---

## Availability Zone (AZ)
An isolated data center (or group of data centers) within a region with independent power, networking, and cooling. Multiple AZs in a region enable high-availability deployments.

| | |
|---|---|
| **Docs** | [Regions and AZs](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-regions-availability-zones.html) |
| **Azure** | Availability Zone |
| **GCP** | Zone |

---

## AWS Backup
Centralized managed backup service supporting EC2, RDS, DynamoDB, EFS, and more. Supports org-wide backup policies applied via AWS Organizations.

| | |
|---|---|
| **Docs** | [AWS Backup](https://docs.aws.amazon.com/aws-backup/latest/devguide/whatisbackup.html) |
| **Azure** | Azure Backup |
| **GCP** | Google Cloud Backup and DR |

---

## AWS Config
Continuous compliance service that records resource configuration history and evaluates resources against Config rules. Supports org-wide deployment with aggregated findings.

| | |
|---|---|
| **Docs** | [AWS Config](https://docs.aws.amazon.com/config/latest/developerguide/WhatIsConfig.html) |
| **Azure** | Azure Policy |
| **GCP** | Security Command Center + Cloud Asset Inventory |

---

## BGP — Border Gateway Protocol
Standard internet routing protocol used by Direct Connect, Site-to-Site VPN, and Transit Gateway to dynamically exchange route information between networks.

| | |
|---|---|
| **Docs** | [BGP with Direct Connect](https://docs.aws.amazon.com/directconnect/latest/UserGuide/routing-and-bgp.html) |
| **Azure** | BGP (same protocol, used with ExpressRoute and VPN Gateway) |
| **GCP** | BGP (same protocol, used with Cloud Router) |

---

## Blast Radius
The scope of impact if a resource, account, or credential is compromised or misconfigured. Reducing blast radius is a primary driver for multi-account architecture.

| | |
|---|---|
| **Docs** | [Security pillar — limiting blast radius](https://docs.aws.amazon.com/wellarchitected/latest/security-pillar/welcome.html) |
| **Azure** | Same concept, mitigated via Management Groups and subscriptions |
| **GCP** | Same concept, mitigated via GCP folders and projects |

---

## CIDR — Classless Inter-Domain Routing
IP address range notation used to define VPC and subnet address spaces (e.g., `10.0.0.0/16`). The prefix length determines how many addresses are in the block.

| | |
|---|---|
| **Docs** | [VPC CIDR blocks](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-cidr-blocks.html) |
| **Azure** | Same notation for VNet address spaces |
| **GCP** | Same notation for VPC subnets |

---

## CloudTrail
Service that logs every AWS API call (from console, CLI, SDK, or other services) as an event. Primary audit trail for security, compliance, and forensics.

| | |
|---|---|
| **Docs** | [CloudTrail](https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-user-guide.html) |
| **Azure** | Azure Activity Log + Azure Monitor |
| **GCP** | Cloud Audit Logs |

---

## Compute Optimizer
AWS service that analyzes CloudWatch metrics and recommends right-sized EC2, Lambda, ECS, and EBS configurations to reduce cost and improve performance.

| | |
|---|---|
| **Docs** | [Compute Optimizer](https://docs.aws.amazon.com/compute-optimizer/latest/ug/what-is-compute-optimizer.html) |
| **Azure** | Azure Advisor |
| **GCP** | GCP Recommender |

---

## Circuit Breaker
Software pattern that wraps calls to a dependency and stops sending requests when failures exceed a threshold, allowing the dependency time to recover. AWS App Mesh and API Gateway support circuit breaking natively.

| | |
|---|---|
| **Docs** | [App Mesh circuit breaking](https://docs.aws.amazon.com/app-mesh/latest/userguide/virtual-node-spec.html) |
| **Azure** | Azure API Management (circuit breaker policy) |
| **GCP** | Cloud Service Mesh / Traffic Director |

---

## Confused Deputy
Security vulnerability where a trusted service (the "deputy") is tricked into performing actions on behalf of a less-trusted principal. Mitigated with `sts:ExternalId` in cross-account trust policies.

| | |
|---|---|
| **Docs** | [Confused deputy prevention](https://docs.aws.amazon.com/IAM/latest/UserGuide/confused-deputy.html) |
| **Azure** | Same concept — mitigated via federated identity claims |
| **GCP** | Same concept |

---

## Control Tower
AWS managed service that automates the setup of a secure, compliant multi-account environment with opinionated OU structure, guardrails (SCPs + Config rules), and Account Factory.

| | |
|---|---|
| **Docs** | [AWS Control Tower](https://docs.aws.amazon.com/controltower/latest/userguide/what-is-control-tower.html) |
| **Azure** | Azure Landing Zones (architecture pattern + Bicep/Terraform accelerators) |
| **GCP** | GCP Blueprint Factory / Assured Workloads |

---

## Cost Explorer
AWS billing tool for visualizing spend by service, account, tag, or region. Supports linked accounts in an organization and generates rightsizing recommendations.

| | |
|---|---|
| **Docs** | [Cost Explorer](https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html) |
| **Azure** | Azure Cost Management + Billing |
| **GCP** | Cloud Billing reports |

---

## Delegated Administrator
An account designated to manage an AWS service on behalf of the entire organization, replacing the management account as the admin. Recommended for GuardDuty, Security Hub, Config, and Macie.

| | |
|---|---|
| **Docs** | [Delegated admin](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_integrate_services_list.html) |
| **Azure** | Azure Lighthouse (cross-tenant delegation) |
| **GCP** | GCP folder-level IAM delegation |

---

## DynamoDB Global Tables
DynamoDB feature that replicates a table to multiple AWS regions in an active-active configuration. Writes are accepted in any region; conflicts resolved by last-writer-wins per item. Each replica region adds one rWRU per write.

| | |
|---|---|
| **Docs** | [Global Tables](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/GlobalTables.html) |
| **Azure** | Azure Cosmos DB (multi-region writes) |
| **GCP** | Cloud Spanner (multi-region) / Firestore multi-region |

---

## Direct Connect (DX)
Dedicated private network connection from an on-premises location (or colocation facility) to AWS, bypassing the public internet. Provides consistent bandwidth and lower latency than VPN.

| | |
|---|---|
| **Docs** | [AWS Direct Connect](https://docs.aws.amazon.com/directconnect/latest/UserGuide/Welcome.html) |
| **Azure** | Azure ExpressRoute |
| **GCP** | Cloud Interconnect (Dedicated) |

---

## DynamoDB
AWS managed NoSQL key-value and document database. Supports Global Tables for multi-region active-active replication. Has a free Gateway Endpoint for VPC access.

| | |
|---|---|
| **Docs** | [DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html) |
| **Azure** | Azure Cosmos DB |
| **GCP** | Cloud Firestore / Bigtable |

---

## EC2 — Elastic Compute Cloud
AWS virtual machine service. Foundational compute resource; supports instance profiles (IAM roles attached to instances), placement groups, and dozens of instance families.

| | |
|---|---|
| **Docs** | [EC2](https://docs.aws.amazon.com/ec2/index.html) |
| **Azure** | Azure Virtual Machines |
| **GCP** | Compute Engine |

---

## ECR — Elastic Container Registry
Managed Docker/OCI container image registry. Integrated with ECS, EKS, and Lambda. Requires an Interface VPC Endpoint for private network access from Fargate tasks.

| | |
|---|---|
| **Docs** | [ECR](https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html) |
| **Azure** | Azure Container Registry (ACR) |
| **GCP** | Artifact Registry |

---

## ECS — Elastic Container Service
AWS managed container orchestration service. Supports EC2 launch type (you manage nodes) and Fargate launch type (serverless). Integrates with ALB, IAM task roles, and Service Connect.

| | |
|---|---|
| **Docs** | [ECS](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html) |
| **Azure** | Azure Container Instances / Azure Container Apps |
| **GCP** | Cloud Run |

---

## EKS — Elastic Kubernetes Service
AWS managed Kubernetes control plane service. Integrates with IAM via IRSA (IAM Roles for Service Accounts). GuardDuty EKS Protection monitors the Kubernetes audit log.

| | |
|---|---|
| **Docs** | [EKS](https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html) |
| **Azure** | Azure Kubernetes Service (AKS) |
| **GCP** | Google Kubernetes Engine (GKE) |

---

## ENI — Elastic Network Interface
A virtual network card in a VPC subnet. Interface VPC Endpoints, NAT Gateways, and EC2 instances are all backed by ENIs. Each ENI gets a private IP from its subnet.

| | |
|---|---|
| **Docs** | [ENI](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-eni.html) |
| **Azure** | Network Interface (NIC) |
| **GCP** | Network Interface |

---

## Endpoint Service
The provider-side resource created to expose a service (behind an NLB) to other VPCs or accounts via AWS PrivateLink. The consumer creates an Interface Endpoint pointing to it.

| | |
|---|---|
| **Docs** | [Endpoint services](https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-share-your-services.html) |
| **Azure** | Azure Private Link Service |
| **GCP** | Private Service Connect (producer side) |

---

## Fargate
AWS serverless compute engine for containers. Runs ECS tasks or EKS pods without managing EC2 nodes. Requires Interface Endpoints for ECR, CloudWatch Logs, and Secrets Manager in private VPCs.

| | |
|---|---|
| **Docs** | [Fargate](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/AWS_Fargate.html) |
| **Azure** | Azure Container Apps / ACI (serverless containers) |
| **GCP** | Cloud Run |

---

## Gateway Endpoint
VPC Endpoint type for S3 and DynamoDB. Free; implemented via route table injection (no ENI created). Same-region only; not reachable from on-premises or peered VPCs by default.

| | |
|---|---|
| **Docs** | [Gateway endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/gateway-endpoints.html) |
| **Azure** | Service Endpoint (similar mechanism) |
| **GCP** | Private Google Access (similar concept) |

---

## Global Tables
See **DynamoDB Global Tables**.

---

## Global Accelerator
AWS networking service that routes user traffic through AWS edge locations to the AWS backbone, improving latency and availability for TCP/UDP applications across regions.

| | |
|---|---|
| **Docs** | [Global Accelerator](https://docs.aws.amazon.com/global-accelerator/latest/dg/what-is-global-accelerator.html) |
| **Azure** | Azure Front Door |
| **GCP** | Cloud CDN + external HTTP(S) Load Balancing (anycast) |

---

## GuardDuty
AWS threat detection service that analyzes CloudTrail, VPC Flow Logs, and DNS logs using ML to identify anomalous behavior, compromised credentials, and known malicious activity.

| | |
|---|---|
| **Docs** | [GuardDuty](https://docs.aws.amazon.com/guardduty/latest/ug/what-is-guardduty.html) |
| **Azure** | Microsoft Defender for Cloud |
| **GCP** | Security Command Center (Event Threat Detection) |

---

## IAM — Identity and Access Management
AWS service that controls who (principals) can do what (actions) on which resources, under what conditions. Covers users, groups, roles, and policies (identity-based and resource-based).

| | |
|---|---|
| **Docs** | [IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html) |
| **Azure** | Azure RBAC + Microsoft Entra ID |
| **GCP** | Cloud IAM |

---

## IAM Access Analyzer
Tool that identifies resources shared outside your trust boundary (org or account) and generates least-privilege IAM policies from CloudTrail activity. Also validates policy syntax.

| | |
|---|---|
| **Docs** | [IAM Access Analyzer](https://docs.aws.amazon.com/IAM/latest/UserGuide/what-is-access-analyzer.html) |
| **Azure** | Azure Privileged Identity Management (PIM) |
| **GCP** | Policy Analyzer |

---

## Identity Center (formerly AWS SSO)
Centralized human access management for all accounts in an AWS Organization. Integrates with external IdPs (Okta, Azure AD) via SAML 2.0 + SCIM and issues temporary credentials via Permission Sets.

| | |
|---|---|
| **Docs** | [Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html) |
| **Azure** | Microsoft Entra ID (Azure AD) + PIM |
| **GCP** | Cloud Identity + Workforce Identity Federation |

---

## IGW — Internet Gateway
VPC resource that enables bidirectional internet connectivity for resources with public IPs in public subnets. One IGW per VPC; free, horizontally scaled, and highly available.

| | |
|---|---|
| **Docs** | [Internet Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/VPC_Internet_Gateway.html) |
| **Azure** | Built into VNet (no separate IGW resource; public IPs + NSG rules control access) |
| **GCP** | Default internet gateway (created automatically per VPC) |

---

## Interface Endpoint
VPC Endpoint type backed by ENIs in your subnets. Supports most AWS services and custom services via PrivateLink. Accessible from on-premises over Direct Connect/VPN.

| | |
|---|---|
| **Docs** | [Interface endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/privatelink-access-aws-services.html) |
| **Azure** | Azure Private Endpoint |
| **GCP** | Private Service Connect endpoint |

---

## IPSec — Internet Protocol Security
Suite of protocols for encrypting and authenticating IP traffic. Used by AWS Site-to-Site VPN and cross-cloud VPN connections. Typically paired with IKEv2 for key exchange.

| | |
|---|---|
| **Docs** | [VPN and IPSec](https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html) |
| **Azure** | Same protocol — used by Azure VPN Gateway |
| **GCP** | Same protocol — used by Cloud VPN |

---

## KMS — Key Management Service
AWS managed service for creating and controlling encryption keys. Supports customer-managed keys (CMKs) with key policies, rotation, and cross-account grants. Integrated with most AWS services.

| | |
|---|---|
| **Docs** | [KMS](https://docs.aws.amazon.com/kms/latest/developerguide/overview.html) |
| **Azure** | Azure Key Vault (keys) |
| **GCP** | Cloud KMS |

---

## Lambda
AWS serverless function-as-a-service. Executes code in response to events without managing servers. Supports VPC attachment for private network access and IAM execution roles.

| | |
|---|---|
| **Docs** | [Lambda](https://docs.aws.amazon.com/lambda/latest/dg/welcome.html) |
| **Azure** | Azure Functions |
| **GCP** | Cloud Functions / Cloud Run (functions) |

---

## Landing Zone
A pre-configured, secure multi-account AWS environment based on best practices. Typically provisioned by AWS Control Tower or a custom Terraform/CDK implementation.

| | |
|---|---|
| **Docs** | [Landing Zone in Control Tower](https://docs.aws.amazon.com/controltower/latest/userguide/landing-zone.html) |
| **Azure** | Azure Landing Zones |
| **GCP** | Google Cloud Foundation Blueprint |

---

## Macie
AWS managed data security service that uses ML to discover, classify, and protect sensitive data (PII, credentials) in S3. Supports org-level deployment with delegated admin.

| | |
|---|---|
| **Docs** | [Macie](https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html) |
| **Azure** | Microsoft Purview |
| **GCP** | Cloud Data Loss Prevention (DLP) |

---

## MFA — Multi-Factor Authentication
Authentication requiring two or more verification factors. AWS supports virtual MFA (TOTP apps), hardware tokens, and FIDO2 passkeys. Can be enforced via IAM condition `aws:MultiFactorAuthPresent`.

| | |
|---|---|
| **Docs** | [MFA in IAM](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa.html) |
| **Azure** | Microsoft Entra MFA |
| **GCP** | Google 2-Step Verification / Context-Aware Access |

---

## NACL — Network Access Control List
Stateless subnet-level firewall that evaluates both inbound and outbound rules. Supports allow and deny rules. Processed in rule-number order; first match wins.

| | |
|---|---|
| **Docs** | [NACLs](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html) |
| **Azure** | No direct equivalent (NSGs are stateful; Azure has no stateless subnet ACL) |
| **GCP** | No direct equivalent (VPC firewall rules are stateful) |

---

## NAT Gateway
Managed network address translation service that allows resources in private subnets to initiate outbound internet connections. Inbound connections from the internet are not permitted.

| | |
|---|---|
| **Docs** | [NAT Gateway](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html) |
| **Azure** | Azure NAT Gateway |
| **GCP** | Cloud NAT |

---

## NLB — Network Load Balancer
Layer 4 (TCP/UDP/TLS) load balancer with ultra-low latency and static IP support. Required as the backend for AWS PrivateLink Endpoint Services.

| | |
|---|---|
| **Docs** | [NLB](https://docs.aws.amazon.com/elasticloadbalancing/latest/network/introduction.html) |
| **Azure** | Azure Load Balancer (Standard tier) |
| **GCP** | Cloud Load Balancing (TCP/UDP) |

---

## OIDC — OpenID Connect
Identity layer on top of OAuth 2.0. Used by AWS for Workload Identity Federation (GitHub Actions, GCP service accounts assuming AWS roles without stored credentials).

| | |
|---|---|
| **Docs** | [OIDC identity providers](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_create_oidc.html) |
| **Azure** | Microsoft Entra OIDC / Federated Identity Credentials |
| **GCP** | Workforce Identity Federation / Workload Identity Federation |

---

## Organizations
AWS service for centrally managing multiple AWS accounts under a hierarchy of OUs, consolidated billing, and organization-wide policies (SCPs, Tag Policies, Backup Policies).

| | |
|---|---|
| **Docs** | [AWS Organizations](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html) |
| **Azure** | Azure Management Groups |
| **GCP** | GCP Resource Manager (Organization → Folders → Projects) |

---

## OU — Organizational Unit
A container within AWS Organizations used to group accounts. SCPs applied to an OU are inherited by all child OUs and accounts. Does not map 1:1 to environments — one OU can contain multiple accounts.

| | |
|---|---|
| **Docs** | [OUs](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_ous.html) |
| **Azure** | Management Group |
| **GCP** | GCP Folder |

---

## Permission Boundary
An IAM policy attached to a role or user that caps the maximum effective permissions, regardless of what identity-based policies grant. Used to safely delegate IAM creation without privilege escalation risk.

| | |
|---|---|
| **Docs** | [Permission boundaries](https://docs.aws.amazon.com/IAM/latest/UserGuide/access_policies_boundaries.html) |
| **Azure** | No direct equivalent (closest: Azure PIM with role scope limits) |
| **GCP** | No direct equivalent |

---

## Permission Set
An Identity Center construct that defines an IAM role template, deployed to target accounts as an actual IAM role. Updating a Permission Set propagates the change to all assigned accounts automatically.

| | |
|---|---|
| **Docs** | [Permission sets](https://docs.aws.amazon.com/singlesignon/latest/userguide/permissionsetsconcept.html) |
| **Azure** | Azure role assignment (via PIM) |
| **GCP** | IAM role binding |

---

## Principal
An entity (IAM user, role, AWS service, or federated identity) that can make API requests to AWS. Specified in IAM trust policies and resource-based policies to control who is allowed access.

| | |
|---|---|
| **Docs** | [IAM principals](https://docs.aws.amazon.com/IAM/latest/UserGuide/intro-structure.html#intro-structure-principal) |
| **Azure** | Security principal (user, group, service principal, managed identity) |
| **GCP** | Member (user, service account, group) |

---

## PrivateLink
AWS technology that routes traffic through the AWS backbone via ENIs (Interface Endpoints), without traversing the internet. Powers both AWS-managed service endpoints and custom Endpoint Services.

| | |
|---|---|
| **Docs** | [AWS PrivateLink](https://docs.aws.amazon.com/vpc/latest/privatelink/what-is-privatelink.html) |
| **Azure** | Azure Private Link |
| **GCP** | Private Service Connect |

---

## RAM — Resource Access Manager
AWS service for sharing resources (TGW, VPC subnets, Route 53 Resolver rules, License Manager configs) across accounts without cross-account IAM roles or VPC peering.

| | |
|---|---|
| **Docs** | [AWS RAM](https://docs.aws.amazon.com/ram/latest/userguide/what-is.html) |
| **Azure** | No direct equivalent (shared resources are managed per-service) |
| **GCP** | Shared VPC (for networking resources) |

---

## RDS — Relational Database Service
AWS managed relational database service supporting PostgreSQL, MySQL, MariaDB, Oracle, and SQL Server. Supports Multi-AZ for HA and read replicas for scale. Aurora is the cloud-native RDS variant.

| | |
|---|---|
| **Docs** | [RDS](https://docs.aws.amazon.com/rds/latest/userguide/Welcome.html) |
| **Azure** | Azure SQL Database / Azure Database for PostgreSQL |
| **GCP** | Cloud SQL / AlloyDB |

---

## Reserved Instances (RI)
Commitment to a specific EC2 instance type, size, and region for 1 or 3 years in exchange for significant discounts (up to 72% vs on-demand). Less flexible than Savings Plans.

| | |
|---|---|
| **Docs** | [Reserved Instances](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-reserved-instances.html) |
| **Azure** | Azure Reserved VM Instances |
| **GCP** | Committed Use Discounts (CUDs) |

---

## Route 53
AWS managed DNS service. Supports public and private hosted zones, and routing policies including latency-based, failover, geolocation, geoproximity, and weighted.

| | |
|---|---|
| **Docs** | [Route 53](https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/Welcome.html) |
| **Azure** | Azure DNS + Azure Traffic Manager |
| **GCP** | Cloud DNS + Cloud Load Balancing |

---

## S3 — Simple Storage Service
AWS object storage service. Virtually unlimited capacity; stores objects in buckets. Supports versioning, Object Lock (WORM), Cross-Region Replication, and Intelligent-Tiering.

| | |
|---|---|
| **Docs** | [S3](https://docs.aws.amazon.com/s3/index.html) |
| **Azure** | Azure Blob Storage |
| **GCP** | Cloud Storage |

---

## S3 Object Lock
S3 feature that prevents objects from being deleted or overwritten for a defined retention period (Governance or Compliance mode). Used for WORM (Write Once Read Many) compliance requirements.

| | |
|---|---|
| **Docs** | [Object Lock](https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lock.html) |
| **Azure** | Azure Blob immutability policies |
| **GCP** | Cloud Storage object retention / bucket lock |

---

## SAML 2.0 — Security Assertion Markup Language
Standard XML-based federation protocol used to exchange authentication assertions between an IdP (Okta, Azure AD) and a service provider (AWS Identity Center). Enables SSO.

| | |
|---|---|
| **Docs** | [SAML federation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_saml.html) |
| **Azure** | Same standard — Azure AD supports SAML 2.0 |
| **GCP** | Same standard — Cloud Identity supports SAML 2.0 |

---

## Savings Plans
Flexible pricing commitment model where you commit to a $/hour spend across any EC2, Lambda, or Fargate usage for 1 or 3 years. More flexible than Reserved Instances.

| | |
|---|---|
| **Docs** | [Savings Plans](https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html) |
| **Azure** | Azure Savings Plan for Compute |
| **GCP** | Committed Use Discounts (CUDs) |

---

## SCP — Service Control Policy
Organization-level policy that sets the maximum permissions available to all accounts in an OU. Cannot grant permissions — only restricts. Does not apply to the management account.

| | |
|---|---|
| **Docs** | [SCPs](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_scps.html) |
| **Azure** | Azure Policy (at management group scope) |
| **GCP** | Organization Policy Service |

---

## SCIM — System for Cross-domain Identity Management
Standard protocol for automating user/group provisioning between an IdP (Okta) and a service provider (Identity Center). Keeps user attributes and group memberships in sync automatically.

| | |
|---|---|
| **Docs** | [SCIM with Identity Center](https://docs.aws.amazon.com/singlesignon/latest/userguide/provision-automatically.html) |
| **Azure** | Azure AD SCIM provisioning |
| **GCP** | Cloud Identity SCIM provisioning |

---

## Secrets Manager
AWS managed service for storing, rotating, and retrieving secrets (database credentials, API keys, TLS certificates). Supports automatic rotation using Lambda and cross-account access via resource policy.

| | |
|---|---|
| **Docs** | [Secrets Manager](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html) |
| **Azure** | Azure Key Vault (secrets) |
| **GCP** | Secret Manager |

---

## Security Group
Stateful virtual firewall applied at the ENI level. Supports only allow rules (no explicit deny). Rules can reference other security groups as sources, enabling dynamic scaling without CIDR-based rules.

| | |
|---|---|
| **Docs** | [Security groups](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-security-groups.html) |
| **Azure** | Network Security Group (NSG) |
| **GCP** | VPC Firewall Rules |

---

## Security Hub
AWS service that aggregates security findings from GuardDuty, Config, Inspector, Macie, and partner tools into a single dashboard. Supports standards like AWS Foundational Security Best Practices.

| | |
|---|---|
| **Docs** | [Security Hub](https://docs.aws.amazon.com/securityhub/latest/userguide/what-is-securityhub.html) |
| **Azure** | Microsoft Defender for Cloud |
| **GCP** | Security Command Center |

---

## Service-Linked Role
A special IAM role pre-defined by an AWS service, with a trust policy locked to that service. Automatically created when you enable certain services; cannot be modified beyond what the service allows.

| | |
|---|---|
| **Docs** | [Service-linked roles](https://docs.aws.amazon.com/IAM/latest/UserGuide/using-service-linked-roles.html) |
| **Azure** | Managed identities (system-assigned) |
| **GCP** | Service agent accounts |

---

## SNS — Simple Notification Service
AWS managed pub/sub messaging service. Delivers messages to subscribers (SQS, Lambda, HTTP endpoints, email). Used for fan-out patterns and alerting pipelines.

| | |
|---|---|
| **Docs** | [SNS](https://docs.aws.amazon.com/sns/latest/dg/welcome.html) |
| **Azure** | Azure Event Grid / Service Bus Topics |
| **GCP** | Cloud Pub/Sub |

---

## Spot Instances
EC2 instances that use spare AWS capacity at discounts of 60–90% vs on-demand. Can be interrupted with a 2-minute warning. Suitable for stateless, fault-tolerant, or batch workloads.

| | |
|---|---|
| **Docs** | [Spot Instances](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/using-spot-instances.html) |
| **Azure** | Azure Spot VMs |
| **GCP** | Spot VMs (formerly Preemptible) |

---

## SQS — Simple Queue Service
AWS managed message queue service for decoupling producers and consumers. Supports standard (at-least-once, best-effort ordering) and FIFO (exactly-once, strict order) queue types.

| | |
|---|---|
| **Docs** | [SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html) |
| **Azure** | Azure Service Bus Queues |
| **GCP** | Cloud Pub/Sub / Cloud Tasks |

---

## SSM — Systems Manager
Suite of operational tools for managing EC2 and on-premises servers: Session Manager (shell access without SSH), Parameter Store (config/secrets), Patch Manager, Run Command, and more.

| | |
|---|---|
| **Docs** | [Systems Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/what-is-systems-manager.html) |
| **Azure** | Azure Automation + Azure Arc |
| **GCP** | OS Config / Cloud Shell (for access) |

---

## STS — Security Token Service
AWS service that issues temporary, short-lived credentials via `AssumeRole`, `AssumeRoleWithWebIdentity` (OIDC), and `AssumeRoleWithSAML`. The backbone of all role-based access in AWS.

| | |
|---|---|
| **Docs** | [STS](https://docs.aws.amazon.com/STS/latest/APIReference/welcome.html) |
| **Azure** | Azure AD token endpoint |
| **GCP** | IAM credentials API / Security Token Service |

---

## Tag Policy
An Organizations policy that standardizes tag key names and allowed values across all accounts. Non-compliant tags appear in Config findings; combine with SCPs to hard-block untagged resources.

| | |
|---|---|
| **Docs** | [Tag policies](https://docs.aws.amazon.com/organizations/latest/userguide/orgs_manage_policies_tag-policies.html) |
| **Azure** | Azure Policy (tag inheritance and enforcement) |
| **GCP** | Resource labels + Organization Policy |

---

## TGW — Transit Gateway
Regional hub-and-spoke network routing service that connects VPCs and on-premises networks with transitive routing. Supports multiple route tables for network segmentation and cross-region peering.

| | |
|---|---|
| **Docs** | [Transit Gateway](https://docs.aws.amazon.com/vpc/latest/tgw/what-is-transit-gateway.html) |
| **Azure** | Azure Virtual WAN |
| **GCP** | Network Connectivity Center |

---

## Trust Policy
The resource-based policy attached to an IAM role that defines which principals are allowed to assume it. Required for cross-account role assumption and service-linked access.

| | |
|---|---|
| **Docs** | [Trust policies](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_terms-and-concepts.html) |
| **Azure** | Azure federated identity credentials / role assignment scope |
| **GCP** | IAM allow policy (role binding with conditions) |

---

## VGW — Virtual Private Gateway
The AWS-side endpoint for a Site-to-Site VPN or Direct Connect connection, attached to a VPC. For multi-VPC connectivity, Transit Gateway is preferred as it avoids per-VPC VGW overhead.

| | |
|---|---|
| **Docs** | [Virtual Private Gateway](https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html) |
| **Azure** | Azure VPN Gateway (VNet gateway) |
| **GCP** | Cloud Router (as BGP peer for VPN/Interconnect) |

---

## VPC — Virtual Private Cloud
Logically isolated virtual network within AWS where you launch resources. Defined by a CIDR block; subdivided into public and private subnets across Availability Zones.

| | |
|---|---|
| **Docs** | [VPC](https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html) |
| **Azure** | Virtual Network (VNet) |
| **GCP** | VPC Network |

---

## VPC Endpoint
A resource in your VPC that provides private connectivity to AWS services or custom Endpoint Services via PrivateLink, without requiring internet access, NAT, or Direct Connect.

| | |
|---|---|
| **Docs** | [VPC Endpoints](https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html) |
| **Azure** | Azure Private Endpoint |
| **GCP** | Private Service Connect endpoint |

---

## VPC Flow Logs
Captured metadata about IP traffic going to and from ENIs in a VPC. Used for network monitoring, security analysis, and troubleshooting. Can be delivered to S3 or CloudWatch Logs.

| | |
|---|---|
| **Docs** | [VPC Flow Logs](https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html) |
| **Azure** | NSG Flow Logs (via Network Watcher) |
| **GCP** | VPC Flow Logs |

---

## VPC Peering
Direct network connection between two VPCs (same or different account/region). Non-transitive; requires route table entries on both sides. No bandwidth limit; no additional cost beyond data transfer.

| | |
|---|---|
| **Docs** | [VPC Peering](https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html) |
| **Azure** | VNet Peering |
| **GCP** | VPC Network Peering |

---

## VPN — Site-to-Site VPN
IPSec-encrypted tunnel between an AWS VPC (via VGW or TGW) and an on-premises or cloud network. Two tunnels per connection for redundancy. Up to 1.25 Gbps per tunnel.

| | |
|---|---|
| **Docs** | [Site-to-Site VPN](https://docs.aws.amazon.com/vpn/latest/s2svpn/VPC_VPN.html) |
| **Azure** | Azure VPN Gateway (Site-to-Site) |
| **GCP** | Cloud VPN (HA VPN) |

---

## Workload Identity Federation
Mechanism allowing workloads (GitHub Actions, GCP service accounts, on-prem systems) to exchange their native identity tokens for temporary AWS credentials via OIDC, without storing long-lived access keys.

| | |
|---|---|
| **Docs** | [Workload identity federation](https://docs.aws.amazon.com/IAM/latest/UserGuide/id_roles_providers_oidc.html) |
| **Azure** | Federated Identity Credentials (Azure AD workload identity) |
| **GCP** | Workload Identity Federation |

---

## AWS Fault Injection Service (FIS)
Managed chaos engineering service for running controlled fault experiments: terminate instances, inject network latency, force AZ failures, interrupt Spot instances. Used to validate actual RTO under real failure conditions.

| | |
|---|---|
| **Docs** | [AWS FIS](https://docs.aws.amazon.com/fis/latest/userguide/what-is.html) |
| **Azure** | Azure Chaos Studio |
| **GCP** | No managed equivalent (use open-source Chaos Toolkit or Chaos Monkey) |

---

## AWS Resilience Hub
Service that analyzes an application's architecture against declared RTO/RPO targets, produces a Resiliency Score, and generates prioritized remediation recommendations. Re-evaluates on infrastructure changes.

| | |
|---|---|
| **Docs** | [Resilience Hub](https://docs.aws.amazon.com/resilience-hub/latest/userguide/what-is.html) |
| **Azure** | Azure Business Continuity Center |
| **GCP** | No direct equivalent |

---

## Cross-Zone Load Balancing
Load balancer setting that distributes requests evenly across targets in all AZs, regardless of which AZ the LB node receives traffic in. Default on for ALB (generates inter-AZ charges). Default off for NLB; when enabled on new NLBs (post-Oct 2023), no inter-AZ charge.

| | |
|---|---|
| **Docs** | [Cross-zone load balancing](https://docs.aws.amazon.com/elasticloadbalancing/latest/userguide/how-elastic-load-balancing-works.html#cross-zone-load-balancing) |
| **Azure** | Zone-redundant load balancing (Azure Load Balancer Standard) |
| **GCP** | Cloud Load Balancing (globally distributed by default) |

---

## ElastiCache
AWS managed in-memory cache and message broker service supporting Redis and Memcached. Multi-AZ auto-failover promotes a read replica to primary on failure (~20–30s). Global Datastore replicates Redis data cross-region.

| | |
|---|---|
| **Docs** | [ElastiCache](https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/WhatIs.html) |
| **Azure** | Azure Cache for Redis |
| **GCP** | Memorystore (Redis / Memcached) |

---

## Pilot Light
DR strategy where only core data replication runs in the DR region (DB snapshots, S3 CRR, AMI copies) but no compute. On failover, compute is launched from pre-replicated assets. RTO: 30–60 min. Lowest DR cost.

| | |
|---|---|
| **Docs** | [Pilot light DR](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html) |
| **Azure** | Azure Site Recovery (minimal replication mode) |
| **GCP** | No specific term — achieved with Cloud Storage snapshots + Deployment Manager |

---

## RPO — Recovery Point Objective
Maximum acceptable data loss measured in time. RPO = 0 requires synchronous replication (only viable intra-region). RPO of seconds to minutes is achievable cross-region with async replication (Aurora Global DB, DynamoDB Global Tables).

| | |
|---|---|
| **Docs** | [DR concepts](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-workloads-on-aws.html) |
| **Azure** | Same concept — used in Azure Site Recovery SLA definitions |
| **GCP** | Same concept |

---

## RTO — Recovery Time Objective
Maximum acceptable downtime from failure to full service restoration. Drives failover strategy: Pilot Light (hours) → Warm Standby (30 min) → Active-Passive (minutes) → Active-Active (seconds/zero).

| | |
|---|---|
| **Docs** | [DR concepts](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-workloads-on-aws.html) |
| **Azure** | Same concept |
| **GCP** | Same concept |

---

## Route 53 ARC — Application Recovery Controller
Route 53 feature that adds readiness checks (verify DR capacity matches production config) and routing controls (manually shift traffic between regions via API, bypassing DNS TTL) to failover orchestration.

| | |
|---|---|
| **Docs** | [Route 53 ARC](https://docs.aws.amazon.com/r53recovery/latest/dg/what-is-route53-recovery.html) |
| **Azure** | Azure Traffic Manager + Azure Site Recovery (combined) |
| **GCP** | No direct equivalent |

---

## S3 Cross-Region Replication (CRR)
S3 feature that automatically replicates objects from a source bucket to one or more destination buckets in different regions. Replication is asynchronous. Charged at standard PUT request rates + inter-region data transfer.

| | |
|---|---|
| **Docs** | [S3 CRR](https://docs.aws.amazon.com/AmazonS3/latest/userguide/replication.html) |
| **Azure** | Azure Blob geo-redundant storage (GRS/GZRS) |
| **GCP** | Cloud Storage dual-region or multi-region buckets |

---

## S3 Multi-Region Access Points (MRAP)
Single global S3 endpoint that routes requests to the nearest available bucket. Works with CRR to maintain synchronized copies. Supports failover controls for Active-Active or Active-Passive bucket access patterns.

| | |
|---|---|
| **Docs** | [S3 MRAP](https://docs.aws.amazon.com/AmazonS3/latest/userguide/MultiRegionAccessPoints.html) |
| **Azure** | Azure Blob Storage with geo-redundancy |
| **GCP** | Cloud Storage multi-region bucket |

---

## Warm Standby
DR strategy where a scaled-down version of production runs continuously in the DR region. On failover, the environment is scaled up to full production capacity. RTO: 10–30 min. Cost: ~20–30% overhead above single-region.

| | |
|---|---|
| **Docs** | [Warm standby DR](https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html) |
| **Azure** | Azure Site Recovery (warm standby mode) |
| **GCP** | GKE cluster with scaled-down node pools in a secondary region |
