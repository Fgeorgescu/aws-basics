# AWS Security — In Depth

## The Foundation: AWS Shared Responsibility

AWS secures the physical infrastructure and the managed services themselves. You are responsible for everything you put *on* that infrastructure: who can access it, how it's configured, how data is protected. Understanding AWS security is largely about understanding the layers of access control AWS provides and how they interact.

---

## 1. IAM: The Permission System

### How Permissions Are Evaluated

Every API call in AWS goes through IAM, which makes a binary decision: allow or deny. What makes IAM subtle is that the decision is not made by a single policy — it's the product of up to six different policy types evaluated in a specific order. Understanding this order explains otherwise confusing behaviors.

**The evaluation chain:**

1. **Explicit deny**: If *any* policy attached to *any* layer explicitly denies this action, the request is denied immediately, no exceptions. This is the highest priority rule in the entire system.

2. **SCPs (Organizations)**: If the account is in an AWS Organization, the request must be allowed by the effective SCP. SCPs can only restrict — they cannot grant. If the SCP doesn't mention the action at all, and there's no explicit deny, processing continues.

3. **Resource-based policy**: If the resource being accessed has a resource-based policy (e.g., an S3 bucket policy or a KMS key policy) and it explicitly allows the requesting principal, the request may be allowed at this step — but only for same-account access. For cross-account access, both the resource-based policy *and* an identity-based policy in the calling account must allow it.

4. **Permission boundary**: If the IAM principal has a permission boundary attached, the requested action must also be allowed by the boundary. If the boundary doesn't allow the action, it's denied — even if the identity policy would allow it.

5. **Identity-based policy**: The policies attached to the IAM role or user must allow the action.

6. **Default deny**: If nothing has explicitly allowed the action, it is denied.

The practical implication: having the right IAM policy is *necessary but not sufficient*. An action can be blocked by an SCP in an OU above you, by a missing entry in a KMS key policy, or by a permission boundary you forgot about. When debugging access denied errors, work through this chain systematically.

### Roles vs Users: Why Roles Are the Right Default

IAM users have long-lived credentials (access key ID + secret access key) that exist until explicitly deleted or rotated. If these credentials are leaked — through a misconfigured S3 bucket, a public GitHub repo, or a compromised developer machine — the attacker has persistent access until you notice and rotate. In practice, credential rotation is often neglected.

IAM roles issue *temporary* credentials via STS, valid for 15 minutes to 12 hours. If these credentials are leaked, they expire on their own. Roles also have no password or access key to manage — the trust relationship (which entity can assume the role) is defined in the trust policy, and the actual credential issuance is handled by AWS.

Use roles for: EC2 instance profiles, Lambda execution roles, ECS task roles, cross-account access, CI/CD pipelines (via OIDC), and human access via Identity Center. The only legitimate use case for IAM users today is a break-glass emergency account with MFA and credentials stored in a vault.

### Condition Keys: The Power of Contextual Permissions

IAM condition keys let you write policies that say not just "allow this action" but "allow this action *only when*..." This is how you build policies that are both permissive enough to be useful and restrictive enough to be secure.

Key conditions for critical infrastructure:

- `aws:RequestedRegion` — deny all API calls outside your approved regions. This prevents resources from being created in unexpected regions where you have no monitoring.
- `aws:MultiFactorAuthPresent` — require MFA for sensitive operations like deleting resources or accessing secrets. Combine with `aws:TokenIssueTime` to require re-authentication within the last hour.
- `aws:PrincipalOrgID` — when writing resource policies that should only be accessible within your organization, this is far more maintainable than enumerating account IDs.
- `aws:CalledVia` — allow an action only when it's invoked by a specific AWS service on your behalf. For example, allow KMS decryption only when called via CloudFormation, preventing direct calls from a compromised role.

---

## 2. Service Control Policies (SCPs)

### The Guardrail Mental Model

The critical insight about SCPs is that they are *guardrails*, not *grants*. They set the outer boundary of what's possible in an account or OU — they do not give anyone permissions. A developer in an account still needs an IAM policy granting them `ec2:RunInstances`; the SCP just ensures that even if the IAM policy is overly permissive, certain actions remain impossible.

Think of it this way: the management account defines the *rules of the game* for all accounts below it. The SCP says "in this OU, nobody can disable CloudTrail, nobody can work outside these regions, and nobody can leave the organization." Individual accounts then grant their users and services whatever IAM permissions make sense within those rules.

### The Management Account Blind Spot

SCPs do not apply to the management account. This is the most important operational fact about SCPs, and it's the reason why you must treat the management account as a highly privileged, access-restricted account — not a convenient place to run workloads. An attacker who compromises the management account bypasses every SCP guardrail in your organization.

### Deny-List vs Allow-List: Why Deny-List Wins in Practice

**Allow-list**: Remove the default `FullAWSAccess` SCP and attach SCPs that explicitly allow specific services. This is the more restrictive posture — anything not explicitly allowed is denied. The problem is operational: every time a team wants to use a new AWS service (e.g., they want to try Amazon Bedrock), you need to update the SCP. This creates a bottleneck at the platform team and slows innovation.

**Deny-list**: Keep `FullAWSAccess` attached and add SCPs that deny specific dangerous actions. Teams can use any AWS service unless it's on the deny list. New services are available by default. You deny specific high-risk operations: disabling security tooling, changing billing settings, creating IAM users (if you want Identity Center only), and anything outside approved regions.

For most organizations, the deny-list approach is more maintainable and less disruptive. The allow-list approach makes sense for highly regulated environments where any unauthorized service usage creates compliance risk.

### Essential SCPs for a Critical Infrastructure Engagement

The minimum set of SCPs you should have on any production OU:

**Protect the audit trail**: `Deny` on `cloudtrail:StopLogging`, `cloudtrail:DeleteTrail`, `cloudtrail:UpdateTrail` (to change delivery destination), and `cloudtrail:PutEventSelectors` (to reduce event scope). Your audit trail is only useful if it can't be tampered with by someone who gains access to the account.

**Restrict regions**: Use `aws:RequestedRegion` NotIn your approved region list to deny all API calls outside those regions. This limits your blast radius (a compromised credential can't create resources in every AWS region) and keeps your monitoring/compliance posture clean.

**Prevent org escape**: Deny `organizations:LeaveOrganization`. This ensures accounts can't be removed from the organization (and thus removed from SCPs and billing) without going through the management account.

**Enforce tagging**: Deny `ec2:RunInstances` and other resource-creation actions unless the required cost allocation tags are provided at creation time. This is more aggressive than Tag Policies alone, which report non-compliance rather than preventing it.

---

## 3. Permission Boundaries: Safe Delegation

### The Privilege Escalation Problem

Imagine you want to give your development teams the ability to create IAM roles for their applications. The naive approach is to grant `iam:*`, but that means a developer could create a role with `AdministratorAccess`, assume it, and bypass any restrictions on their own account. Even `iam:CreateRole` with `iam:AttachRolePolicy` is dangerous — a developer could attach `AdministratorAccess` to a new role.

Permission boundaries exist specifically to solve this. They let you say: "You can create IAM roles, but any role you create can only ever do X, Y, and Z — never more than what I define in this boundary policy."

### How Boundaries Actually Work

A permission boundary is an IAM managed policy that you attach to a role (or user). It defines the *maximum permissions* that role can ever have, regardless of what identity policies are later attached to it.

The effective permissions are the *intersection* of the identity policy and the boundary. If the identity policy allows S3 full access but the boundary only allows `s3:GetObject`, the effective permission is only `s3:GetObject`. The boundary cannot grant anything — it can only constrain.

### The Delegation Pattern in Practice

The standard pattern for safe developer IAM delegation works like this:

1. The platform team creates a permission boundary policy (`AppRoleBoundary`) that defines what application roles are allowed to do: access specific S3 buckets, read from Secrets Manager, publish to SQS, etc.

2. The platform team grants developers a policy allowing `iam:CreateRole` and `iam:AttachRolePolicy`, but with a condition: `iam:PermissionsBoundary` must equal the ARN of `AppRoleBoundary`. If the developer tries to create a role without attaching the boundary, the API call is denied.

3. Developers can now freely create IAM roles for their Lambda functions, ECS tasks, etc. But every role they create is capped by the boundary — none of them can ever have admin access, delete other teams' resources, or modify IAM policies.

This pattern is particularly valuable in landing zone designs where the platform team wants to give account administrators autonomy without giving them the ability to escalate to organization-level access.

---

## 4. AWS Identity Center

### Why Centralized Identity Matters at Scale

In a single-account world, you manage IAM users directly. In a 20-account organization, "directly" means 20x the management overhead: 20 places to create users, 20 places to set up MFA, 20 places to offboard a departing employee. And in practice, offboarding is the critical failure mode — organizations routinely find former employee accounts still active months later.

Identity Center solves this by making your organization's AWS access a *projection* of a single identity source, whether that's Identity Center's built-in directory or an external IdP like Okta or Azure AD. One place to add a user, one place to remove them.

### The Mechanics

Identity Center works by creating temporary IAM roles in each target account, one per Permission Set. When a user logs in and chooses an account + permission set combination, Identity Center calls `sts:AssumeRole` on their behalf and returns temporary credentials (or a console session). The IAM roles in each account are created and managed by Identity Center — you never touch them directly.

**Permission Sets** are role templates. You define `ReadOnlyAccess` once (attach the `ReadOnlyAccess` managed policy), then assign it to the platform team across all accounts. If you need to add a permission to `ReadOnlyAccess`, you update the Permission Set once and it propagates to every account automatically.

**Account Assignments** map users/groups → permission sets → accounts. The recommended pattern is to manage this via *groups*, with group membership managed in your IdP. A developer joins the `team-payments` group in Okta; SCIM automatically syncs this to Identity Center; the group already has an assignment to the payments-dev and payments-prod accounts. Access is granted automatically within minutes.

### ABAC: Scaling Beyond Per-Account Assignments

Once you have more than ~30 accounts, manually maintaining account assignments becomes unwieldy. Attribute-Based Access Control is the solution.

The idea: instead of assigning `team-payments` group to each of their accounts individually, you tag each account with `Team=payments` and write IAM policies in those accounts that use `aws:PrincipalTag/Team` as a condition. The SCIM provisioning from Okta passes through user attributes (department, team, role) as session tags. Now, a developer with `Team=payments` in their Okta profile automatically gets appropriately scoped access to any account tagged `Team=payments` — no manual assignment update required when accounts are created or reorganized.

This scales to hundreds of accounts without increasing management complexity.

### Session Duration and Security Posture

Session duration is a security parameter that's often set to whatever default AWS ships with and then forgotten. For critical infrastructure, it deserves deliberate configuration:

Short sessions (1–2 hours for prod) mean that a stolen session token expires quickly. The friction is real — developers have to re-authenticate more often — but it significantly limits the window for token-based attacks. For a production financial services account, this is a reasonable tradeoff.

Long sessions (8–12 hours for dev/sandbox) acknowledge that developers need a working session for a full workday without constant interruption. The risk is lower because there's less sensitive data and fewer blast-radius resources in non-production environments.

The break-glass pattern is important: keep one IAM user per account in a vault (Secrets Manager with strict access + CloudTrail alerts on retrieval), rotated quarterly, for use when Identity Center is unavailable. This sounds paranoid until the day your identity provider is down and a production incident needs access.

---

## 5. Cross-Account Access: Patterns and Pitfalls

### Why Cross-Account Needs Two Policy Layers

A common misconception: "if I add the cross-account role ARN to my S3 bucket policy, they can access it." This is only half true. For cross-account access to work, *both sides must allow it*:

- The **resource-based policy** (S3 bucket policy, KMS key policy) must allow the principal from the other account.
- The **identity-based policy** in the calling account must grant the role permission to perform that action.

This two-policy requirement is a deliberate security design: neither account can unilaterally grant cross-account access. The resource owner must explicitly allow the caller, and the caller's account admin must explicitly allow the calling role to use that cross-account permission.

The exception: for some resource types (Lambda, SQS, SNS), a resource-based policy alone is sufficient for cross-account access if the principal is a root account ARN — but best practice is always to require both.

### The Confused Deputy Problem

When a third party (a SaaS vendor, an audit tool) needs cross-account access to your account, you create an IAM role and give them your account ID so they can assume it. But consider: if the vendor serves 1000 customers, they could — accidentally or maliciously — assume *your* role while acting on behalf of a *different customer*. This is the confused deputy problem.

The solution is the `ExternalId` condition. You generate a unique external ID (a UUID), share it with the vendor, and add a condition to your trust policy: `"StringEquals": { "sts:ExternalId": "your-unique-id" }`. The vendor must provide this ID when assuming your role. Even if they know your account ID, they can't assume your role without the external ID — and the external ID is unique to your relationship with them.

### AWS RAM: Sharing Without Exposing

AWS Resource Access Manager lets you share specific resources across accounts without the complexity of cross-account IAM roles. The most important use case in a multi-account network architecture is sharing VPC subnets.

With RAM-shared subnets, you create the VPC and subnets in a network account and share specific subnets to workload accounts. Workloads in those accounts deploy their resources (EC2, ECS, RDS) into the shared subnets, but they don't own or control the networking layer. This centralizes network management (TGW attachments, NACLs, route tables, VPC flow logs) in one account while giving workload accounts the subnet they need.

---

## 6. Detective and Preventive Controls

### Layered Defense

The philosophy behind AWS security tooling is defense in depth: preventive controls (SCPs, IAM policies, bucket policies) ideally stop bad things from happening; detective controls (CloudTrail, GuardDuty, Config) ensure that if something slips through, you know about it quickly. Neither layer is sufficient alone.

### CloudTrail as the Source of Truth

Every AWS API call — from the console, CLI, SDK, or another AWS service — generates a CloudTrail event. This is your audit trail. A well-designed CloudTrail setup has several properties:

**Org-wide trail**: configured in the management or delegated admin account, captures events from all accounts automatically. New accounts added to the organization are immediately enrolled.

**Immutable delivery**: events go to an S3 bucket in the Log Archive account, which has an SCP denying any delete operations. Log file integrity validation means each log file contains a hash chain — any tampering (modification or deletion) is detectable.

**Protection via SCP**: deny `cloudtrail:StopLogging`, `cloudtrail:DeleteTrail`, and `cloudtrail:PutEventSelectors` in all non-management OUs. This means an attacker who compromises an account cannot cover their tracks by disabling logging.

### GuardDuty: Behavioral Anomaly Detection

GuardDuty continuously analyzes CloudTrail events, VPC Flow Logs, and DNS queries to detect anomalous behavior: unusual API call patterns, known malicious IPs, credential use from unexpected geographies, cryptocurrency mining activity, and more. It's machine learning-based, so it adapts to your environment's baseline over time.

The organizational pattern is important: with a delegated admin in the security account, member accounts cannot disable their own GuardDuty enrollment. This is enforced at the Organizations level, not by an SCP — even if the SCP is misconfigured, GuardDuty stays on.

Enable the add-ons: S3 Protection (detects suspicious S3 API patterns), EKS Protection (audits Kubernetes control plane), and RDS Protection (detects credential brute-forcing). These are incremental costs but cover the common attack surfaces of modern architectures.

### IAM Access Analyzer: Finding Unintended Exposure

Access Analyzer answers a specific question: "Which of my resources are accessible from outside my trust boundary?" Configure the zone of trust as your organization, and Access Analyzer continuously evaluates S3 bucket policies, KMS key policies, IAM roles with trust policies, SQS queues, SNS topics, Lambda function policies, and Secrets Manager secrets. Any resource with a policy granting access to a principal outside your org generates a finding.

This is particularly valuable after acquisitions, team transitions, or any period of rapid infrastructure change — these are the moments when resources accidentally become externally accessible.

Use Access Analyzer's **policy generation** feature during role design: run your workload for a few days with CloudTrail, then ask Access Analyzer to generate the minimum IAM policy based on what was actually called. This produces a least-privilege policy without requiring manual enumeration of API calls.
