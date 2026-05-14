# AWS Security

## 1. IAM Fundamentals

### Identity-Based vs Resource-Based Policies

| Type | Attached To | Controls |
|---|---|---|
| **Identity-based** | IAM user, group, or role | What that principal can do |
| **Resource-based** | S3 bucket, KMS key, SQS queue, etc. | Who can access this resource |

Resource-based policies are required for **cross-account access** to resources like S3 and KMS — you can't grant cross-account access using only an identity-based policy.

### Permission Evaluation Order
AWS evaluates policies in this order for every API call:

```
1. Explicit Deny (any policy)         → DENY immediately
2. SCP (Organizations)                → must allow; if missing → DENY
3. Resource-based policy              → if allows same-account principal → ALLOW
4. Permission Boundary (if set)       → must allow; if missing → DENY
5. Session Policy (if assumed role)   → must allow
6. Identity-based policy              → must allow
→ Default: DENY
```

**Critical**: An explicit deny anywhere overrides all allows. The management account is exempt from SCPs.

### Roles vs Users
- **Prefer roles** for everything: EC2 instance profiles, Lambda execution roles, cross-account access, CI/CD.
- **IAM users** should be limited to break-glass scenarios or service accounts that can't use roles, always with MFA enforced.
- Use IAM **Access Analyzer** to identify unused permissions and generate least-privilege policies from CloudTrail activity.

### Key Condition Keys
```
aws:RequestedRegion    — restrict API calls to specific regions
aws:MultiFactorAuthPresent — require MFA for sensitive actions
aws:PrincipalOrgID     — allow only principals within your AWS Organization
aws:SourceIp / aws:VpcSourceIp — restrict to IP ranges
aws:CalledVia          — allow only when called through a specific service (e.g., CloudFormation)
```

---

## 2. Service Control Policies (SCPs)

SCPs are **org-level guardrails** that set the maximum permissions available to accounts/OUs. They cannot grant permissions — they only restrict what IAM can grant.

### Key Properties
- Apply to **OUs or individual accounts** (not the management account).
- Evaluated **before** IAM policies — if an SCP denies an action, no IAM policy can allow it.
- By default, the root has a `FullAWSAccess` SCP attached. Attaching more specific SCPs is additive restriction.

### Deny-List vs Allow-List Strategy

**Deny-list** (recommended): Start with `FullAWSAccess`, then attach SCPs that deny specific things.
```json
{
  "Effect": "Deny",
  "Action": ["cloudtrail:StopLogging", "cloudtrail:DeleteTrail"],
  "Resource": "*"
}
```

**Allow-list**: Remove `FullAWSAccess`, then explicitly allow specific services. Safer but operationally heavy — you must allow every service before teams can use it.

### Essential SCPs for Critical Infrastructure

| SCP | What It Does |
|---|---|
| Deny leaving organization | Prevents accounts from being removed from the org |
| Deny disabling CloudTrail | Protects audit trail |
| Restrict regions | `Deny` on all actions with `aws:RequestedRegion` not in approved list |
| Require MFA for root | `Deny` sensitive actions unless `aws:MultiFactorAuthPresent = true` |
| Deny IAM user creation | Force all access through Identity Center |
| Deny tag removal on critical resources | Protect cost allocation tags |
| Deny S3 Block Public Access changes | Prevent accidental public exposure |

### SCP Does NOT Apply To
- Management account
- Service-linked roles
- Actions performed by AWS services on your behalf (e.g., Config remediation)

---

## 3. Permission Boundaries

A permission boundary is an IAM policy attached to a **role or user** that defines the **maximum permissions** that role can have — regardless of what identity-based policies grant.

### Formula
```
Effective Permissions = Identity Policy ∩ Permission Boundary
```

### Primary Use Case: Delegated IAM Administration
Allow a developer to create IAM roles for their application **without** allowing privilege escalation:

1. Create a permission boundary policy that limits roles to only what the app needs (e.g., S3 read, SQS send).
2. Attach a policy to the developer's role that allows `iam:CreateRole` and `iam:AttachRolePolicy` **only if** the new role has the boundary attached:
```json
{
  "Effect": "Allow",
  "Action": ["iam:CreateRole", "iam:AttachRolePolicy"],
  "Resource": "*",
  "Condition": {
    "StringEquals": {
      "iam:PermissionsBoundary": "arn:aws:iam::123456789012:policy/AppBoundary"
    }
  }
}
```

Now the developer can create roles, but none of those roles can exceed the boundary — they can't escalate to admin.

---

## 4. AWS Identity Center (formerly AWS SSO)

Identity Center provides **centralized human access** to all accounts in your organization via a single portal.

### Architecture
```
External IdP (Okta / Azure AD)
    ↓ SAML 2.0 / SCIM provisioning
Identity Center
    ↓ Permission Sets → IAM Roles
Target AWS Accounts (any account in the org)
```

### Key Concepts

| Concept | Description |
|---|---|
| **Permission Set** | A template that becomes an IAM role in each assigned account. Attach managed or inline policies. |
| **Account Assignment** | Maps a user/group → permission set → account |
| **SCIM** | Automatic user/group sync from IdP (Okta, Azure AD) — no manual user management |
| **ABAC** | Attribute-based access control — use IdP attributes (department, team) as tags to dynamically control access |

### Best Practices
- **Short session durations**: 1 hr for prod accounts, 4–8 hrs for non-prod.
- **Use groups, not individual users** for assignments — manage access in IdP.
- **Break-glass**: one IAM user per account with MFA, stored in a vault (Secrets Manager or physical), for use when Identity Center is unavailable.
- **Principle of least privilege**: create narrow Permission Sets per role (read-only, deploy, admin) rather than one `AdministratorAccess` set.
- **ABAC at scale**: instead of creating one account assignment per team×account, use tags: `Team=payments` on the IdP user syncs as a tag on the session → IAM policies can reference `aws:PrincipalTag/Team`.

---

## 5. Cross-Account Access Patterns

### Pattern 1: IAM Role Assumption
Used for: service-to-service, CI/CD, cross-account resource access.

1. **Target account** creates a role with a **trust policy** allowing the source account/role:
```json
{
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::SOURCE_ACCOUNT:role/DeployRole" },
  "Action": "sts:AssumeRole"
}
```
2. **Source account** role calls `sts:AssumeRole` and receives temporary credentials.
3. Temporary credentials are scoped to the target role's permissions.

Add `sts:ExternalId` condition for third-party cross-account access (prevents confused deputy attacks).

### Pattern 2: Resource-Based Policies
For S3, KMS, SQS, SNS, Lambda — grant access directly in the resource policy:
```json
{
  "Effect": "Allow",
  "Principal": { "AWS": "arn:aws:iam::OTHER_ACCOUNT:role/ProcessorRole" },
  "Action": ["s3:GetObject"],
  "Resource": "arn:aws:s3:::my-bucket/*"
}
```
The cross-account role also needs `s3:GetObject` in its identity policy.

### Pattern 3: AWS Resource Access Manager (RAM)
Share AWS resources across accounts **without** full VPC peering or cross-account roles:
- VPC subnets (shared services subnet accessible by multiple accounts)
- Transit Gateway attachments
- Route 53 Resolver rules
- License Manager configurations

RAM sharing respects the boundary of the shared resource — a shared subnet doesn't expose the whole VPC.

---

## 6. VPC-Level Service Restriction

### Endpoint Policies
Limit what can be done through a VPC endpoint:
- Restrict to specific S3 buckets, DynamoDB tables, or SQS queues.
- Restrict to specific IAM principals.
- Effective even if the IAM policy is permissive — endpoint policy is an additional gate.

### Bucket Policy with VPC Source Condition
Enforce that S3 is only accessible from within your VPC:
```json
{
  "Effect": "Deny",
  "Principal": "*",
  "Action": "s3:*",
  "Resource": ["arn:aws:s3:::critical-bucket", "arn:aws:s3:::critical-bucket/*"],
  "Condition": {
    "StringNotEquals": { "aws:sourceVpc": "vpc-0abc1234" }
  }
}
```
Use `aws:sourceVpce` to restrict to a specific endpoint (more targeted than VPC ID).

### Security Groups as Service Boundary
- Create a **dedicated security group** for each service tier (web-sg, app-sg, db-sg).
- Allow only specific SG references (not CIDRs) for east-west rules — this auto-updates as instances scale.
- For RDS: only allow inbound 5432/3306 from app-sg; deny all else.

---

## 7. Detective and Preventive Controls

### CloudTrail
- Enable an **org-wide trail** in the management or delegated-admin account.
- Deliver logs to the **Log Archive account** S3 bucket (cross-account write, deny delete via SCP).
- Enable **log file integrity validation** — detects tampering.
- Protect with SCP: deny `cloudtrail:StopLogging`, `cloudtrail:DeleteTrail`, `cloudtrail:PutEventSelectors` (to prevent scope reduction).

### AWS Config
- Enable in all accounts/regions via **org-level Config** with a delegated administrator.
- Use **conformance packs** for grouped compliance rules (e.g., AWS Operational Best Practices for S3).
- Key rules for critical infra: `restricted-ssh`, `s3-bucket-public-read-prohibited`, `root-account-mfa-enabled`, `iam-no-inline-policy`, `ec2-instances-in-vpc`.

### GuardDuty
- Enable at org level with a **delegated administrator** in the security account.
- Member accounts cannot disable or alter their own GuardDuty — protected by the org enrollment.
- Findings auto-aggregated in the security account.
- Integrate with Security Hub for unified view.
- Enable **S3 Protection**, **EKS Protection**, **RDS Protection** add-ons for broader coverage.

### Security Hub
- Aggregates findings from GuardDuty, Config, Inspector, Macie, IAM Access Analyzer, and partner tools.
- Use **org-level Security Hub** with delegated admin in security account.
- Enable **AWS Foundational Security Best Practices** standard as baseline.
- Route critical findings to SNS → PagerDuty/Slack for incident response.

### Access Analyzer
- Identifies resources shared externally (S3 buckets, KMS keys, IAM roles, SQS queues).
- Set the **zone of trust** to the organization — anything shared outside the org appears as a finding.
- Use **IAM Access Analyzer policy validation** in CI/CD pipelines to catch overly permissive policies before deployment.
