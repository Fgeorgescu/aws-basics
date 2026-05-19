# AWS Architecture Diagrams

Reference diagrams using AWS standard topology conventions. Each shows the canonical shape for a common pattern — see the Full view for design rationale.

---

## 1. Multi-Account Organization Structure

```mermaid
flowchart TD
  Root(["Management Account\n(Root)"])

  Root --> SecOU(["Security OU"])
  Root --> InfraOU(["Infrastructure OU"])
  Root --> WkldOU(["Workloads OU"])
  Root --> SandboxOU(["Sandbox OU"])
  Root --> SuspendedOU(["Suspended OU"])

  SecOU --> LogArchive["Log Archive Account\nCloudTrail · Config · S3"]
  SecOU --> SecAccount["Security Account\nGuardDuty · Security Hub · Audit"]

  InfraOU --> NetAccount["Network Account\nTGW · Route 53 Resolver · RAM"]
  InfraOU --> Tooling["Tooling Account\nCI/CD · Artifact Registry"]

  WkldOU --> ProdOU(["Prod OU"])
  WkldOU --> NonProdOU(["Non-Prod OU"])

  ProdOU --> ProdApp["App Account – Prod"]
  ProdOU --> DataProd["Data Account – Prod"]
  NonProdOU --> StagingApp["App Account – Staging"]
  NonProdOU --> DevApp["App Account – Dev"]

  SandboxOU --> Sandboxes["Per-developer\nSandbox Accounts"]
  SuspendedOU --> Closed["Closed / Quarantined\nAccounts"]
```

---

## 2. Hub-and-Spoke Network (Transit Gateway)

```mermaid
flowchart LR
  OnPrem["On-Premises\nDirect Connect / VPN"]

  subgraph "AWS — us-east-1"
    TGW(["Transit Gateway"])

    subgraph "Network Account"
      InspVPC["Inspection VPC\nAWS Network Firewall"]
    end

    subgraph "Workload Account – Prod"
      ProdVPC["Prod VPC\n10.0.0.0/16"]
    end

    subgraph "Workload Account – Staging"
      StageVPC["Staging VPC\n10.1.0.0/16"]
    end

    subgraph "Shared Services Account"
      SharedVPC["Shared Services VPC\n10.2.0.0/16\nDNS · NTP · Tooling"]
    end
  end

  OnPrem -- "DX/VPN Attachment" --> TGW
  TGW -- "VPC Attachment" --> InspVPC
  TGW -- "VPC Attachment" --> ProdVPC
  TGW -- "VPC Attachment" --> StageVPC
  TGW -- "VPC Attachment" --> SharedVPC
  InspVPC -. "Egress inspection\n(default route)" .-> TGW
```

---

## 3. Cross-Account CI/CD Pipeline

```mermaid
flowchart LR
  Dev["Developer\npushes code"]

  subgraph "Tooling Account"
    Repo["CodeCommit /\nGitHub"]
    Pipeline["CodePipeline\n+ CodeBuild"]
    ArtifactBucket[("Artifact S3\nBucket")]
    DeployRole["IAM Role:\nDeployer"]
  end

  subgraph "Prod Account"
    AssumedRole["Cross-Account\nDeploy Role"]
    CFN["CloudFormation /\nTerraform"]
    App["Application\nResources"]
  end

  subgraph "Staging Account"
    AssumedRoleStg["Cross-Account\nDeploy Role"]
    CFNStg["CloudFormation /\nTerraform"]
    AppStg["Application\nResources"]
  end

  Dev --> Repo
  Repo --> Pipeline
  Pipeline --> ArtifactBucket
  Pipeline -- "sts:AssumeRole" --> DeployRole
  DeployRole -- "sts:AssumeRole\n(trust policy)" --> AssumedRoleStg
  DeployRole -- "sts:AssumeRole\n(trust policy)" --> AssumedRole
  AssumedRoleStg --> CFNStg --> AppStg
  AssumedRole --> CFN --> App
```

---

## 4. Private Access via VPC Endpoints

```mermaid
flowchart LR
  subgraph "Consumer VPC – Private Subnet"
    Lambda["Lambda /\nEC2 Workload"]
    VPCE["Interface\nVPC Endpoint\n(ENI)"]
  end

  subgraph "AWS Backbone"
    PL["AWS PrivateLink"]
  end

  subgraph "Service (same or other account)"
    S3GW["Gateway Endpoint\n(S3 / DynamoDB)\nFree · Route-table"]
    SvcNLB["NLB → Service\n(PrivateLink target)"]
  end

  Lambda -- "No IGW needed" --> VPCE
  VPCE --> PL --> SvcNLB

  Lambda -. "S3 / DynamoDB\n(gateway — free)" .-> S3GW
```

---

## 5. Identity Center with External IdP (Okta)

```mermaid
flowchart TD
  Okta["Okta\n(Identity Provider)"]

  subgraph "Management Account"
    IC["AWS IAM Identity Center"]
    PermSet1["Permission Set:\nAdministrator"]
    PermSet2["Permission Set:\nReadOnly"]
    PermSet3["Permission Set:\nDeveloper"]
  end

  subgraph "Account Assignments"
    ProdAdmin["Prod Account\n→ Administrator PS"]
    StagingDev["Staging Account\n→ Developer PS"]
    AllRO["All Accounts\n→ ReadOnly PS"]
  end

  UserLogin["User browses\nAWS Access Portal"]

  Okta -- "SCIM (user/group sync)" --> IC
  Okta -- "SAML 2.0 assertion" --> IC
  IC --> PermSet1 & PermSet2 & PermSet3
  PermSet1 --> ProdAdmin
  PermSet3 --> StagingDev
  PermSet2 --> AllRO
  UserLogin --> IC
  IC -- "Temporary credentials\n(STS)" --> ProdAdmin & StagingDev & AllRO
```

---

## 6. Multi-Region Active-Passive Failover

```mermaid
flowchart LR
  Users["Global Users"]
  R53["Route 53\nFailover Routing\n+ Health Check"]

  subgraph "us-east-1 (Primary)"
    ALBE1["ALB"]
    AppE1["App Tier\nAuto Scaling"]
    AuroraP[("Aurora\nPrimary Cluster")]
  end

  subgraph "eu-west-1 (Secondary — Warm Standby)"
    ALBW1["ALB"]
    AppW1["App Tier\n(scaled down)"]
    AuroraS[("Aurora Global DB\nSecondary Cluster")]
  end

  Users --> R53
  R53 -- "Primary (healthy)" --> ALBE1
  R53 -. "Failover (primary down)" .-> ALBW1
  ALBE1 --> AppE1 --> AuroraP
  ALBW1 --> AppW1 --> AuroraS
  AuroraP -- "Async replication\n< 1s lag" --> AuroraS
```
