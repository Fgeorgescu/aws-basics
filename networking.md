# AWS Networking

## 1. Internet Gateway vs NAT Gateway

### Internet Gateway (IGW)
- Attached to a VPC; enables **bidirectional** internet access for resources with public IPs.
- Route table entry: `0.0.0.0/0 → igw-xxx` in the **public subnet**.
- **No cost per GB**, no bandwidth limit.
- One IGW per VPC; horizontally scaled and highly available by default.

### NAT Gateway
- Enables **outbound-only** internet access for resources in **private subnets** (no inbound connections initiated from internet).
- Deployed in a **public subnet**; private subnet route table points `0.0.0.0/0 → nat-xxx`.
- **Cost**: ~$0.045/hr per NAT GW + ~$0.045/GB processed.
- **High availability**: deploy one NAT GW **per AZ** — if you use a single NAT GW in one AZ, traffic from other AZs crosses AZ boundaries ($0.01/GB each way) and the NAT GW becomes a single point of failure.

### Decision Rule
| Need | Use |
|---|---|
| Public-facing resources (ALB, bastion) | IGW + public subnet |
| Private resources needing outbound internet | NAT GW in each AZ |
| Private resources accessing only AWS services | VPC Endpoints (eliminates NAT cost) |

**Cost tip**: Replace NAT GW traffic to AWS services (S3, DynamoDB, SQS, etc.) with VPC endpoints — this can cut NAT costs by 30–70% in data-heavy workloads.

---

## 2. VPC Endpoints: Gateway vs Interface

### Gateway Endpoints
- Support only **S3** and **DynamoDB**.
- **Free** — no hourly charge, no per-GB charge.
- Implemented via **route table entries** (not ENIs); no DNS change required.
- Same-region only; not accessible from on-premises or peered VPCs by default.

### Interface Endpoints (PrivateLink)
- Support **most AWS services** (SSM, Secrets Manager, KMS, ECR, STS, API Gateway, etc.) and custom services.
- Creates an **ENI** with a private IP in your subnet.
- **Cost**: ~$0.01/hr per AZ per endpoint + ~$0.01/GB.
- Accessible from **on-premises** (via Direct Connect/VPN) and from **peered VPCs** (if `enableDnsHostnames` is on).
- Supports **endpoint policies** — IAM-style JSON that restricts which principals/actions/resources are allowed through the endpoint.

### Endpoint Policies — Example
Restrict an S3 interface endpoint to a specific bucket:
```json
{
  "Statement": [{
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::my-bucket/*"
  }]
}
```

---

## 3. PrivateLink vs VPC Endpoints

These terms are often confused:

| Term | What It Is |
|---|---|
| **AWS PrivateLink** | The underlying AWS technology that routes traffic through the AWS backbone without traversing the internet |
| **VPC Endpoint** | The **consumer-side** resource in your VPC that connects to a service via PrivateLink |
| **Endpoint Service** | The **provider-side** resource — you create this to expose *your own* service to other VPCs/accounts |

### When to Use PrivateLink (Endpoint Services)
You want to expose a service (behind an NLB) to another VPC or account **without**:
- VPC peering (which exposes the full VPC address space)
- Overlapping CIDRs being a problem (PrivateLink is CIDR-independent)

**Flow**: Provider VPC → NLB → Endpoint Service → Consumer VPC Endpoint → ENI in consumer subnet.

The consumer never sees the provider's VPC CIDR. Traffic stays on the AWS backbone.

### Cross-Account PrivateLink
1. Provider creates an NLB and an **Endpoint Service**, whitelists the consumer's AWS account ID.
2. Consumer creates an **Interface Endpoint** pointing to the service name (`com.amazonaws.vpce.region.vpce-svc-xxx`).
3. Provider accepts the connection request (or enables auto-accept).

---

## 4. VPC Peering vs Transit Gateway

### VPC Peering
- **1:1** connection between two VPCs (same or different account/region).
- **Non-transitive**: if A peers B and B peers C, A cannot reach C through B.
- No bandwidth limit, no additional cost beyond standard data transfer rates.
- Route tables on both sides must be updated manually.
- **Scales poorly**: N VPCs require N*(N-1)/2 peering connections.

### Transit Gateway (TGW)
- **Hub-and-spoke**: all VPCs attach to the TGW; TGW routes between them.
- **Transitive routing**: A → TGW → B → TGW → C works.
- Supports multi-account (via RAM sharing) and multi-region (via TGW peering).
- **Cost**: ~$0.05/hr per attachment + ~$0.02/GB processed.
- Route tables on the TGW: you can create multiple route tables for segmentation (e.g., prod cannot reach dev).

### TGW Route Table Segmentation Example
```
prod-rt:   associates prod VPCs; propagates only prod and shared-services VPCs
dev-rt:    associates dev VPCs; propagates dev and shared-services VPCs
# prod and dev cannot reach each other, both reach shared-services
```

### Decision Rule
| Scenario | Recommendation |
|---|---|
| ≤5 VPCs, full mesh or simple hub | VPC Peering (cheaper) |
| >5 VPCs, or need transitive routing | Transit Gateway |
| On-premises connectivity shared across VPCs | TGW (attach VPN/DX once, share to all VPCs) |
| Strict network segmentation between environments | TGW with multiple route tables |

### TGW Connect
An attachment type for **SD-WAN appliances** that uses GRE tunnels over a VPC or Direct Connect attachment. Supports BGP and higher throughput than VPN attachments.

---

## 5. Multi-Region Communication

### Option A: TGW Inter-Region Peering
- Two TGWs in different regions connect via a **TGW peering attachment**.
- Traffic traverses the **AWS global backbone** (encrypted in transit).
- Static routes only (no dynamic route propagation across the peering link).
- Cost: standard inter-region data transfer rates (~$0.02–$0.08/GB depending on regions).

### Option B: Cross-Region VPC Peering
- Direct peering between two VPCs in different regions.
- Simpler for small topologies (2–3 VPCs); no TGW required.
- Same non-transitive limitation applies.

### Option C: AWS Global Accelerator
- Anycast entry points at AWS edge locations; routes traffic over the AWS backbone to your regional endpoints.
- Best for **latency-sensitive** or **TCP/UDP** workloads where DNS-based routing is too slow to react.
- Not a replacement for VPC-level routing — works at the application layer.

### Option D: Route 53 Routing Policies
- **Latency-based**: route users to the lowest-latency region.
- **Failover**: active-passive with health checks.
- **Geolocation/Geoproximity**: route by user location.
- DNS-based: TTL means failover is not instantaneous (use low TTLs for critical endpoints).

### Best Practice for Multi-Region
1. Deploy TGW in each region; peer them for private connectivity between workloads.
2. Share TGWs across accounts using AWS RAM.
3. Use Route 53 health checks + failover/latency routing for user-facing DNS.
4. Replicate data with DynamoDB Global Tables or S3 Cross-Region Replication.

---

## 6. Internal Traffic vs Internet Traffic

### Keeping Traffic Internal
- Place resources in **private subnets** (no public IP, no IGW route).
- Access AWS services via **VPC Endpoints** (no NAT GW required).
- Use **internal ALBs** (`scheme: internal`) for service-to-service communication.
- Use **Security Groups** for stateful east-west controls (allow port 443 from app-sg, deny everything else).

### NACLs vs Security Groups
| | Security Groups | NACLs |
|---|---|---|
| State | Stateful (return traffic automatic) | Stateless (must allow both directions) |
| Scope | Instance / ENI level | Subnet level |
| Rules | Allow only | Allow and Deny |
| Use case | Primary east-west control | Subnet-level quarantine or block known CIDRs |

### DNS Requirements for Interface Endpoints
For interface endpoints to be reachable via the AWS service's default DNS name (e.g., `s3.us-east-1.amazonaws.com`):
- VPC must have `enableDnsHostnames = true`
- VPC must have `enableDnsSupport = true`
- **Private DNS enabled** on the endpoint (on by default) — creates Route 53 private hosted zone entries that override the public DNS

### Forcing S3 to Private-Only Access
In the S3 bucket policy, use the `aws:sourceVpce` or `aws:sourceVpc` condition to deny all access not coming from your endpoint:
```json
{
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:*",
  "Resource": ["arn:aws:s3:::my-bucket", "arn:aws:s3:::my-bucket/*"],
  "Condition": {
    "StringNotEquals": {
      "aws:sourceVpce": "vpce-0abc1234"
    }
  }
}
```

---

## Quick Reference: Cost Impact of Networking Choices

| Choice | Monthly Cost Driver |
|---|---|
| NAT GW (single AZ) | $32/mo + $0.045/GB — add cross-AZ charges if multi-AZ workloads |
| NAT GW per AZ (3 AZ) | ~$96/mo fixed, eliminates cross-AZ charges |
| Gateway Endpoint (S3/DDB) | Free |
| Interface Endpoint | ~$7.30/mo per endpoint per AZ + $0.01/GB |
| TGW Attachment | ~$36/mo per attachment |
| TGW Data Processing | $0.02/GB |
| VPC Peering | Free (only pay data transfer) |
| Inter-AZ Data Transfer | $0.01/GB each direction |
| Internet Egress | ~$0.09/GB (first 10TB) |
