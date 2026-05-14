# Cloud-to-Cloud Connectivity

## Overview

Multi-cloud connectivity arises when:
- A client mandates workloads on Azure/GCP while your platform runs on AWS.
- M&A activity brings in another cloud estate.
- Specific services (Azure OpenAI, GCP BigQuery) are not available on AWS.

The core challenge: establish **private, encrypted, low-latency** connectivity between cloud networks without sending data over the public internet.

---

## 1. AWS ↔ Azure

### Option A: Site-to-Site VPN (IPSec over internet)
- AWS Virtual Private Gateway (or TGW) ↔ Azure VPN Gateway.
- **Setup**: create VPN connection on AWS side with BGP ASN; create Local Network Gateway + VPN Connection on Azure side.
- **Bandwidth**: up to 1.25 Gbps per tunnel; use multiple tunnels for redundancy.
- **Cost**: AWS VPN ~$0.05/hr per connection + data transfer; Azure VPN Gateway ~$27–$138/mo depending on SKU.
- **Latency**: internet-routed; variable. Suitable for management traffic or low-throughput integrations.
- **Encryption**: IKEv2 with AES-256, SHA-256.

### Option B: AWS Direct Connect + Azure ExpressRoute (Dedicated Fiber)
- Both services terminate at the **same colocation facility** (Equinix, Megaport, etc.).
- Traffic: AWS VPC → Direct Connect → colocation cross-connect → ExpressRoute → Azure VNet.
- **Bandwidth**: 1–100 Gbps; dedicated capacity, not shared.
- **Cost**: Direct Connect port (~$216/mo for 1G) + cross-connect (~$50–150/mo) + ExpressRoute circuit (~$55–$200/mo). Significant but predictable.
- **Latency**: sub-10ms for geographically co-located regions (e.g., us-east-1 and Azure East US both have presence in Ashburn, VA).
- **Use case**: high-throughput data pipelines, database replication, latency-sensitive applications.

### Option C: Network Service Providers (Megaport, Equinix Fabric)
- Managed Layer 2/3 connectivity between AWS and Azure via a software-defined exchange.
- **Megaport**: provision a Virtual Cross Connect (VXC) between AWS Direct Connect and Azure ExpressRoute in minutes via web UI.
- No need to negotiate with colocation facility directly.
- Cost: Megaport port + VXC fees on top of Direct Connect/ExpressRoute fees.
- Best for teams without dedicated network engineers.

### DNS Federation (AWS ↔ Azure)
```
Azure Private DNS Zone: api.internal.azure.corp
Route 53 Private Hosted Zone: api.internal.aws.corp

Azure DNS Resolver → Conditional Forwarder → AWS Route 53 Inbound Endpoint (IP)
Route 53 Outbound Endpoint → Azure DNS Resolver (IP) for azure.corp queries
```
Set up conditional forwarding rules in both resolvers so that each cloud can resolve the other's private DNS names.

---

## 2. AWS ↔ GCP

### Option A: Cloud VPN (IPSec)
- AWS Virtual Private Gateway (or TGW) ↔ GCP Cloud VPN.
- Uses HA VPN (Google's recommended) with two tunnels for 99.99% uptime SLA.
- **Bandwidth**: up to 3 Gbps per VPN tunnel pair.
- BGP dynamic routing supported on both sides.
- Same latency caveats as AWS-Azure VPN.

### Option B: AWS Direct Connect + GCP Cloud Interconnect
- Both terminate at the same colocation facility.
- GCP Dedicated Interconnect: 10G or 100G circuits.
- GCP Partner Interconnect: use a service provider (Megaport, Equinix) for smaller capacities (50 Mbps–10 Gbps).
- BGP sessions run end-to-end.

### BGP Routing Considerations (Both Clouds)
- Assign non-overlapping BGP ASNs: AWS uses 64512 by default; GCP uses 65535 by default — change at least one.
- Advertise only the CIDR ranges you intend to expose (don't advertise `0.0.0.0/0`).
- Use **route filtering** on both sides to prevent accidental full-mesh routing.
- For TGW-based setups: TGW BGP ASN must be unique across all connections.

---

## 3. Shared Identity Across Clouds

### Federated IdP as Single Source of Truth
Use an external IdP (Okta, Azure AD / Microsoft Entra ID) to provide identities to both AWS and GCP:

```
Okta / Azure AD
  ├── SAML 2.0 → AWS Identity Center → IAM roles in AWS accounts
  └── SAML 2.0 → GCP Workforce Identity Federation → GCP IAM roles
```

Benefits:
- Single onboarding/offboarding: remove a user in Okta → access revoked in both clouds simultaneously.
- Consistent MFA policy applied at the IdP level.
- No cloud-specific user accounts to manage.

### AWS → GCP Service Authentication (Workload Identity)
For AWS services that need to call GCP APIs without long-lived service account keys:

1. GCP **Workload Identity Federation**: configure an OIDC provider pointing to AWS STS.
2. AWS role generates a short-lived token via `sts:GetCallerIdentity`.
3. GCP exchanges the AWS token for a GCP access token (token exchange).
4. No GCP service account keys are stored on the AWS side.

### GCP → AWS Service Authentication
Use GCP Workload Identity to call AWS STS `AssumeRoleWithWebIdentity`:
1. GCP service account generates an OIDC token.
2. AWS IAM role has a trust policy accepting GCP's OIDC provider.
3. AWS returns temporary credentials scoped to the IAM role.

---

## 4. Cost and Latency Comparison

| Connectivity Option | Setup Complexity | Monthly Cost (est.) | Latency | Throughput |
|---|---|---|---|---|
| VPN (IPSec) | Low | ~$80–200 | Variable (20–80ms typical) | Up to 1.25 Gbps |
| Direct Connect + ExpressRoute | High | ~$350–1,000+ | 2–15ms | 1–100 Gbps |
| Megaport / Equinix Fabric | Medium | ~$250–600 | 2–15ms | 50 Mbps–10 Gbps |

*Costs exclude data transfer charges (~$0.02–0.09/GB depending on regions and traffic direction).*

### When to Choose Each
| Scenario | Recommendation |
|---|---|
| Low volume management traffic, getting started | VPN |
| High-throughput data pipelines (>100 GB/day) | Direct Connect + partner interconnect |
| Need dedicated bandwidth SLA for production | Direct Connect + ExpressRoute |
| Small team, no network expertise | Megaport / Equinix Fabric managed service |
| Latency < 5ms required | Dedicated interconnect, same metro colocation |

---

## 5. Security Best Practices for Multi-Cloud

- **Encrypt all cross-cloud traffic**: always use IPSec for VPN; Direct Connect/Interconnect over MACsec for dedicated links.
- **Least-privilege cross-cloud roles**: the AWS role that GCP calls should only have the minimum permissions needed for that integration.
- **Audit both sides**: ensure CloudTrail logs cross-cloud API calls on the AWS side; GCP Audit Logs on the GCP side.
- **No shared credentials**: use Workload Identity Federation to eliminate cross-cloud service account keys entirely.
- **CIDR planning**: document all VPC/VNet CIDRs before any cross-cloud peering. Overlapping CIDRs require NAT and add complexity.
- **Separate connectivity per environment**: don't share a single VPN tunnel between prod and dev — different circuits, different routes, different IAM roles.
