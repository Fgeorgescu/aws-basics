# AWS Networking — In Depth

## The Mental Model: VPCs Are Private Data Centers

A VPC is best understood as your own isolated section of AWS's physical network — like a private data center that you configure in software. By default, nothing inside a VPC can reach the internet, and nothing on the internet can reach inside it. Every piece of connectivity you add (IGW, NAT Gateway, peering, endpoints) is an explicit hole you punch in that isolation. Understanding networking in AWS is largely about understanding *which* holes exist, *in which direction* they work, and *what they cost*.

---

## 1. Internet Gateway vs NAT Gateway

### The Problem They Solve

Imagine you have a web server that needs to serve traffic from the internet (an ALB), and a database that should never be reachable from outside but needs to download software updates. These are two completely different requirements: one is *bidirectional public access*, the other is *outbound-only access with no inbound attack surface*.

AWS solves these with two distinct resources.

### Internet Gateway (IGW)

The IGW is attached at the VPC level and enables any resource in a **public subnet** that has a public IP address to communicate bidirectionally with the internet. When a packet leaves an EC2 instance destined for the internet, it hits the route `0.0.0.0/0 → igw-xxx` in the route table, goes through the IGW, and AWS performs NAT between the private IP and the public IP — but only because both are assigned to the same instance. Critically, the internet can also initiate connections *into* that instance via its public IP.

The IGW itself is free, horizontally scaled, and managed by AWS. You only pay for data transfer on the way out.

### NAT Gateway

A NAT Gateway sits in a **public subnet** and acts as the outbound proxy for resources in **private subnets**. Private instances have no public IP and no route to the IGW — their default route points to the NAT Gateway instead. The NAT Gateway then forwards their traffic through the IGW using its own Elastic IP.

The key property is that this is *stateful one-way translation*: outbound connections are allowed and their responses come back, but the internet cannot initiate a new connection to a private instance because there is no public IP to reach.

**Why NAT Gateway costs matter in practice**: At ~$0.045/GB processed plus an hourly charge, NAT Gateway costs sneak up fast in data-heavy architectures. A workload that pulls 10TB/month through NAT (e.g., container images, OS updates, API calls to `api.stripe.com`) pays ~$450/month in NAT processing alone — before you even count compute. The fix for AWS service traffic is VPC Endpoints; for true internet traffic, NAT is unavoidable.

**The per-AZ trap**: AWS charges for cross-AZ data transfer at $0.01/GB in each direction. If you run a NAT Gateway in `us-east-1a` but your ECS tasks are in `us-east-1b`, every byte they send to the internet crosses AZs twice (once to reach the NAT GW, once for the response). For high-volume workloads, the cross-AZ charge can exceed the NAT processing charge. The solution is to deploy one NAT Gateway per AZ and route each AZ's private subnet to its local NAT Gateway.

---

## 2. VPC Endpoints: Keeping AWS Traffic Private

### The Problem

When an EC2 instance calls `s3.amazonaws.com`, that DNS name resolves to a public IP. The request leaves your VPC, traverses the internet (or at minimum AWS's public edge network), and then arrives at S3. This creates three problems: it requires a route to the internet (NAT GW or IGW), it costs money per GB at the NAT Gateway, and it puts your traffic on a path you don't fully control.

VPC Endpoints solve all three: they route AWS service traffic *through the AWS backbone*, keeping it entirely private, requiring no internet route, and often eliminating the NAT cost.

### Gateway Endpoints (S3 and DynamoDB)

Gateway endpoints are free and work by injecting prefix list entries into your route table — essentially overriding the path for S3/DynamoDB IPs without creating any new network interface. When your instance calls S3, the route table sees the destination matches the S3 prefix list and routes it to `vpce-xxx` instead of the NAT Gateway or IGW. AWS handles the rest internally.

Because there's no ENI, there's no per-AZ consideration and no hourly cost. The only limitation is that they're same-region and can't be reached from on-premises connections (Direct Connect, VPN) or from VPC peers without additional configuration.

### Interface Endpoints (Everything Else)

Interface endpoints create actual ENIs in your subnets — one per AZ you enable. These ENIs get private IP addresses in your VPC, and DNS for that service is overridden to point to those private IPs. When `ssm.us-east-1.amazonaws.com` resolves inside your VPC, it now returns `10.0.2.45` (your endpoint's ENI) instead of a public IP.

This works over Direct Connect and VPN because it's just a normal IP in your VPC. A corporate laptop connected via VPN can reach `ssm.amazonaws.com` through the endpoint without touching the internet at all. This is a key architectural enabler for hybrid setups.

The cost (~$0.01/hr + $0.01/GB) is worth it for high-volume services or strict compliance environments. For EC2 Systems Manager in private instances (a very common pattern), the SSM, SSMMessages, and EC2Messages endpoints are all required — plan for three interface endpoints per AZ.

### Endpoint Policies

Endpoint policies are often overlooked but are a powerful security control. They function like IAM policies applied at the network level. You can create an endpoint that *only* allows access to a specific S3 bucket, meaning even if a compromised instance in your VPC calls S3, it can only reach the bucket you intended — not exfiltrate data to `s3://attacker-bucket`.

---

## 3. AWS PrivateLink: Exposing Services Without Exposing Networks

### The Problem VPC Peering Doesn't Solve

If you want a consumer VPC to call an API running in your VPC, the instinctive answer is VPC peering. But peering has a fundamental property: it connects *entire CIDR ranges*. The consumer gains routing access to all of your VPC's address space, not just the API. For multi-tenant SaaS platforms or client-facing APIs, this is unacceptable — you don't want client A to accidentally (or deliberately) reach client B's resources.

PrivateLink solves this by exposing a single service (behind a Network Load Balancer) as a named endpoint, while hiding everything else about your VPC. The consumer connects to an ENI in *their own* subnet; they never see your VPC's CIDR, and your VPC never sees theirs. This means overlapping CIDRs aren't a problem — a common issue in enterprise environments where every team has `10.0.0.0/16`.

### How It Works

On the **provider side**: you place your service behind a Network Load Balancer, then create an Endpoint Service pointing to that NLB. You whitelist the AWS account IDs of consumers who are allowed to connect.

On the **consumer side**: you create an Interface Endpoint, specifying the service name (`com.amazonaws.vpce.us-east-1.vpce-svc-0abc123`). AWS creates ENIs in the consumer's subnets, and DNS for the service points to those ENIs. The consumer's application calls `api.yourcompany.com` → resolves to the ENI private IP → traffic goes to your NLB → reaches your application. Your VPC is never exposed.

### When PrivateLink vs Peering

Use **VPC peering** when two VPCs you fully trust need broad connectivity — e.g., a shared services VPC with internal tools that all your engineering teams use.

Use **PrivateLink** when you're exposing a specific service to an external party (a client, a business partner, a different org unit) and you need the principle of least exposure. Also use PrivateLink when you're building a SaaS product on AWS that other AWS customers will consume.

---

## 4. VPC Peering vs Transit Gateway

### Building Intuition from the 2-VPC Case

With two VPCs, peering is clearly the right choice. You create a peering connection, add route table entries on both sides, and done — traffic flows directly between them, billed only at normal data transfer rates. No additional infrastructure, no managed service to pay for.

### Why Peering Breaks Down at Scale

The problem is non-transitivity and combinatorial explosion. With 5 VPCs, full connectivity requires 10 peering connections. With 10 VPCs, it's 45. Each connection needs route table entries on both sides. Now imagine adding a sixth VPC — you need to create 5 new peering connections and update route tables in all 6 VPCs. Operations become error-prone and slow.

More importantly, peering is non-transitive. If VPC-A peers VPC-B and VPC-B peers VPC-C, packets cannot travel A → B → C. This matters for the centralized egress pattern (where all outbound internet traffic goes through a shared firewall VPC) — that topology simply cannot be built with peering alone.

### Transit Gateway as a Hub

The Transit Gateway solves both problems. All VPCs attach to the TGW; the TGW routes between them. Adding a new VPC means one new attachment and one set of route table entries on the TGW — not N new connections across all existing VPCs.

Transitivity is built in: A → TGW → B → TGW → C works. This enables topologies like centralized inspection (all traffic flows through a firewall VPC attached to the TGW) and centralized egress (all outbound internet traffic funnels through a shared NAT Gateway VPC).

### TGW Route Tables for Segmentation

A TGW can have multiple route tables — this is its most powerful and underappreciated feature. You can create a `prod-rt` that only routes between prod VPCs and shared services, and a `dev-rt` that routes between dev VPCs and shared services, but has no route to prod VPCs. Even though all VPCs are attached to the same TGW, the route tables enforce the segmentation. This is far simpler than maintaining separate TGWs or using NACLs on every subnet.

### The Cost Conversation

TGW is not free. At ~$0.05/hr per attachment and $0.02/GB processed, a setup with 10 VPC attachments costs ~$360/month before counting any data. For most organizations this is easily justified, but it's important to go in with eyes open. One common optimization: use a Gateway Endpoint for S3 to bypass TGW processing entirely — if 50% of your TGW traffic is S3, you can cut data processing costs in half for free.

---

## 5. Multi-Region Communication

### Why Multi-Region Is Different from Multi-AZ

Multi-AZ is about high availability within a region — AWS guarantees AZs are close enough (single-digit millisecond latency) that synchronous replication is practical. Multi-region is about geographic distribution or disaster recovery, where latency between regions is 60–200ms and synchronous replication is often impractical.

This shapes the networking choices: you need a reliable, encrypted, low-latency path between regions, but you also need to accept that it's a WAN link with meaningful latency.

### TGW Inter-Region Peering

The cleanest approach for private VPC-to-VPC connectivity across regions. Each region has its own TGW; you create a peering attachment between them. Traffic travels over the AWS global backbone, which is private to AWS's infrastructure and encrypted. This is the default recommendation for most multi-region setups because it gives you a single place to manage routing in each region, and the backbone connection is more reliable and consistent than internet routing.

The one limitation: no dynamic route propagation across the peering link. You must manually add static routes on each TGW for the other region's CIDRs. This is manageable but means adding a new CIDR in one region requires a manual update in the other.

### When to Choose Cross-Region VPC Peering Instead

If you only have two VPCs across the two regions and your topology is simple, direct cross-region VPC peering avoids the TGW attachment costs. The routing is simpler too — just update route tables in both VPCs. But you lose centralized routing control as you add more VPCs.

### DNS and Traffic Management Across Regions

For user-facing services, network-level connectivity is only half the story. Route 53 routing policies determine which region serves each request:
- **Latency-based routing** is the most common: users are automatically sent to the region with the lowest measured latency from their location.
- **Failover routing** designates one region as primary and one as secondary, with health checks triggering automatic DNS failover.
- **Geolocation routing** is useful for compliance (EU data must stay in EU) or localization.

The critical nuance with DNS-based failover: TTLs determine how quickly clients pick up the change. A 300-second TTL means it takes up to 5 minutes for all clients to fail over — and some resolvers don't honor TTLs faithfully. For RTO requirements under a few minutes, DNS alone is insufficient; you need application-level failover or active-active architectures.

---

## 6. Internal Traffic vs Internet Traffic

### The Private-by-Default Philosophy

The security posture of well-architected AWS environments is that *all traffic is private by default*, and internet exposure is something you explicitly add only where required. This means:
- All application tiers (app servers, databases, caches, queues) are in private subnets with no public IPs.
- The only public-facing resources are load balancers and, occasionally, bastion hosts.
- AWS service calls (to S3, SSM, Secrets Manager, etc.) go through VPC Endpoints, never over the internet.
- Cross-VPC traffic goes through TGW or peering, never over the internet.

### Security Groups vs NACLs: When Each Applies

Security groups are the primary control for east-west traffic. They operate at the ENI level, are stateful (you only need to allow the outbound direction, and return traffic is automatically permitted), and support referencing other security groups as sources (not just IP ranges). The SG-to-SG reference is particularly powerful: `allow tcp 5432 from app-sg` means that as your application tier auto-scales, new instances automatically get access to RDS without any rule changes.

NACLs are subnet-level, stateless, and both allow and deny. Because they're stateless, you must explicitly allow both directions for any protocol you want to work — easy to get wrong with ephemeral ports. NACLs are best reserved for coarse-grained subnet isolation: quarantining a compromised subnet, blocking a known-malicious CIDR range, or providing a defense-in-depth layer below security groups.

### The Endpoint DNS Requirement

A common operational pitfall when deploying interface endpoints: if you deploy an endpoint but traffic still routes to the public IP, the likely cause is missing DNS configuration. For private DNS to work (so that `s3.amazonaws.com` resolves to your endpoint's private IP instead of the public IP), the VPC needs both `enableDnsHostnames` and `enableDnsSupport` set to true, *and* private DNS must be enabled on the endpoint itself.

In peered VPCs, the DNS override only applies in the VPC that owns the endpoint — a common source of confusion when teams share an endpoint across multiple VPCs.
