# Cloud-to-Cloud Connectivity — In Depth

## Why Cloud-to-Cloud Architecture Is Hard

Connecting two public clouds sounds straightforward until you realize that each cloud has its own networking primitives, DNS systems, IAM models, and security boundaries — and none of them were designed to interoperate. The challenge isn't just establishing a network path; it's building a coherent security model where identities, policies, and audit trails span both clouds without creating gaps or seams that attackers can exploit.

---

## 1. AWS ↔ Azure: Connectivity Options

### Understanding the Tradeoff Space

The fundamental tradeoff is cost/complexity vs reliability/throughput. A VPN over the internet is cheap to set up and flexible, but it shares the public internet's congestion and unpredictability. Dedicated interconnects (Direct Connect + ExpressRoute) are expensive and require physical infrastructure commitments, but they give you a dedicated, predictable, low-latency path with guaranteed bandwidth.

For most workloads, the decision point is around **100GB/day** of cross-cloud traffic. Below that, VPN is usually sufficient and the cost savings don't justify the operational overhead of dedicated circuits. Above it, the dedicated interconnect often pays for itself in transfer cost predictability and better application performance.

### Site-to-Site VPN: When It's Enough

A VPN between AWS (Virtual Private Gateway or TGW) and Azure (Azure VPN Gateway) works over the public internet using IPSec/IKEv2 encryption. AWS terminates the VPN at the VGW or TGW; Azure terminates it at the Azure VPN Gateway in your Virtual Network.

**BGP makes this dynamic**: configure BGP on both sides, advertise your CIDRs, and routing updates automatically when new subnets are added. This is far more maintainable than static route configuration.

For redundancy: AWS automatically creates two tunnels per VPN connection (two endpoints in different AZs). Azure HA VPN Gateway creates two gateway instances. Enable all four tunnel combinations for N+1 redundancy — if one tunnel fails, traffic automatically shifts to another.

The practical limitation of VPN isn't security (IPSec is strong) — it's bandwidth. Each VPN tunnel supports up to ~1.25 Gbps on AWS. For most management traffic, API integrations, or moderate data pipelines, this is ample. For bulk data transfer (data warehouse loading, ML training data, disaster recovery replication), you'll hit this ceiling.

### Direct Connect + ExpressRoute: Enterprise-Grade Connectivity

Both AWS Direct Connect and Azure ExpressRoute terminate at the same network colocation facilities (Equinix Ashburn, Equinix London, etc.). A cross-connect cable at the colo joins the two circuits at Layer 2, creating an end-to-end private path that never traverses the public internet.

The connectivity path: your services in AWS VPCs → Direct Connect virtual interface → cross-connect at colo → ExpressRoute circuit → Azure Virtual Network. The entire path is private, encrypted with MACsec at the physical layer if required.

**Latency**: with co-located facilities, round-trip latency is consistently 2–5ms. Compare to internet-routed VPN where latency varies between 20ms (good day) and 200ms (congestion).

**Setup complexity**: you need to establish the physical cross-connect at the facility, configure BGP sessions, advertise routes on both sides, and coordinate with both AWS and Azure support. Managed provider services (Megaport, Equinix Fabric) abstract most of this — you provision a virtual cross-connect in a web UI and they handle the physical layer. For organizations without dedicated network engineers, this is the practical path.

### DNS Federation Between AWS and Azure

DNS is often the forgotten piece of cloud-to-cloud architecture. Once you have a network path, you still need services in each cloud to be able to resolve the other cloud's private hostnames.

The solution is conditional DNS forwarding:

In AWS, Route 53 Resolver has inbound endpoints (ENIs with private IPs that accept DNS queries from outside the VPC) and outbound endpoints (which can forward DNS queries to external resolvers). Configure the outbound endpoints to forward `*.azure.internal.yourcompany.com` queries to Azure's DNS resolver IP addresses.

In Azure, configure the custom DNS server (or Azure DNS Private Resolver) to forward `*.aws.internal.yourcompany.com` queries to the Route 53 Inbound Endpoint IPs.

The result: an application in AWS calling `payments-api.azure.internal.yourcompany.com` gets the Azure service's private IP from Azure DNS via the forwarding chain, and the connection routes over your Direct Connect/ExpressRoute path.

---

## 2. AWS ↔ GCP

### The BGP Routing Considerations

GCP Cloud VPN with HA configuration uses BGP and creates two tunnel pairs (four tunnels total) for redundancy. AWS site-to-site VPN creates two tunnels. The connectivity is similar to AWS-Azure VPN, with the same bandwidth and latency tradeoffs.

The BGP ASN conflict is a practical gotcha: AWS uses 64512 by default for VGW/TGW; GCP uses 65535 by default for Cloud Router. These must be different. Change one (or both) to avoid the conflict. If you're also connecting to Azure (ASN 65515 by default) or on-premises (often 65000), plan your ASN assignments upfront.

Route filtering is critical when connecting three or more clouds or connecting clouds to on-premises. You don't want AWS to learn GCP routes and re-advertise them to on-premises, or vice versa. Configure explicit prefix lists on each BGP session to allow only the routes that should flow in each direction.

### GCP Dedicated Interconnect at Scale

For high-volume AWS-to-GCP connections, the path is similar to AWS-Azure: AWS Direct Connect + GCP Dedicated Interconnect at the same colo facility, connected via cross-connect. GCP also offers Partner Interconnect through providers like Megaport — particularly useful for 1G and 10G capacity needs that don't justify a full 10G or 100G Dedicated Interconnect.

---

## 3. Identity Federation Across Clouds

### Why a Single IdP Matters

Each cloud has its own IAM system with its own concepts, primitives, and APIs. Managing identities separately in AWS IAM, Azure RBAC, and GCP IAM means three onboarding workflows, three offboarding workflows, three MFA configurations, and three places where a departed employee might still have access. In a regulated environment, this is a compliance nightmare.

The solution is a single canonical identity source — typically Okta or Azure AD / Microsoft Entra ID — that federation into each cloud. The cloud IAM systems become *consumers* of identity, not sources of it.

```
Okta (canonical identity)
  ├── SAML 2.0 → AWS Identity Center → temporary IAM roles in AWS accounts
  ├── SAML 2.0 → Azure AD (if Okta, federate into Azure) → Azure RBAC assignments
  └── SAML 2.0 → GCP Workforce Identity Federation → GCP IAM bindings
```

When an employee joins, you add them to Okta with the correct group memberships. Within minutes, SCIM provisioning syncs their identity to all three cloud IAM systems, and they have access to the resources matching their role. When they leave, deprovisioning in Okta cascades to all three clouds.

### Workload Identity: No Service Account Keys Across Clouds

Long-lived credentials (AWS access keys, GCP service account keys) stored in one cloud to access another cloud are a significant security risk. If the storage location is compromised (an environment variable, a secret manager, a misconfigured S3 bucket), the credentials give persistent cross-cloud access.

Modern cloud IAM systems support short-lived credential exchange via OIDC. The pattern eliminates stored credentials entirely:

**AWS → GCP**: Configure GCP Workload Identity Federation with an OIDC provider pointing to AWS STS (`https://sts.amazonaws.com`). AWS services generate an OIDC token via `GetCallerIdentity`. GCP's token exchange endpoint accepts this token and issues a short-lived GCP access token scoped to a specific service account. The AWS role ID is the only trust anchor — no keys stored anywhere.

**GCP → AWS**: GCP services generate OIDC tokens via the metadata service. Configure an IAM OIDC identity provider in AWS pointing to Google's OIDC endpoint. The IAM role's trust policy accepts GCP-issued tokens from specific service accounts. The GCP service calls `sts:AssumeRoleWithWebIdentity` and gets temporary AWS credentials.

The short-lived nature of these credentials (15 minutes to 1 hour) means a leak has a bounded window of exposure, and the exchange audit trail in both CloudTrail and GCP Audit Logs gives you visibility into every cross-cloud credential issuance.

---

## 4. Security Architecture for Multi-Cloud

### The Seam Problem

The biggest security risk in multi-cloud architecture is the boundary between the clouds — the seam where your security tools have visibility on each side but may miss activity that spans both. An attacker who exfiltrates data from GCP and stores it in AWS may not trigger alerts on either side individually.

Mitigations:
- **Centralized SIEM**: forward CloudTrail, GCP Audit Logs, and Azure Activity Logs to a single SIEM (Splunk, Datadog, or a custom OpenTelemetry pipeline). Write correlation rules that detect cross-cloud patterns.
- **Unified identity events**: all authentication events — AWS console sign-ins, GCP console sign-ins, Okta auth events — should flow into the SIEM. A single Okta user suddenly authenticating to both clouds from different geographies within minutes is a signal worth detecting.
- **Network monitoring at the boundary**: if traffic crosses clouds via a dedicated interconnect, the colo facility or managed provider (Megaport) may offer flow log data. Capture it.

### Shared Responsibility Across Clouds

Each cloud has a different shared responsibility model. AWS's model places more responsibility on the customer (e.g., OS patching for EC2) compared to Azure Managed Services or GCP's serverless products. When you operate across clouds, your team must maintain competency in each cloud's security model rather than assuming consistency.

For a client engagement, document clearly: which cloud is the primary security control plane, how cross-cloud findings are correlated, and which team owns the security posture for each cloud estate.

---

## 5. Cost Optimization in Multi-Cloud

### The Data Transfer Trap, Amplified

Within AWS, inter-region data transfer costs $0.02–$0.09/GB. Cross-cloud data transfer adds another layer: AWS charges for egress from AWS ($0.09/GB for the first 10TB to internet), and the destination cloud charges for ingress (GCP and Azure typically charge nothing for ingress, but the egress charge from AWS is real).

For 10TB/month of AWS-to-GCP transfers over the internet: 10TB × $0.09/GB = $900/month just in AWS egress fees. If the same traffic runs over Direct Connect/Partner Interconnect: AWS charges $0.02/GB for Direct Connect data transfer out = $200/month. The $700/month savings justify the ~$100–300/month interconnect cost within the first month.

### Avoid Duplication of Services

A common inefficiency: running two separate data lakes (one in S3, one in GCS) with full replication between them "for resilience." In practice, this doubles storage costs, replication costs, and management overhead, while providing resilience for a scenario (both S3 and GCS being simultaneously unavailable) that has never occurred in AWS or GCP history.

Deliberately choose a primary cloud for each capability and use cross-cloud access sparingly. The networking investment (interconnect, DNS federation, workload identity) should enable targeted cross-cloud integration, not wholesale duplication.
