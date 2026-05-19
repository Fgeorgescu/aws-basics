# System Design Diagrams — Full Reference

## Three-Tier Web Architecture

```mermaid
graph TD
    subgraph Internet
        Users[Users / Clients]
    end
    subgraph Edge
        DNS[Route 53\nLatency-based routing]
        CDN[CloudFront CDN\nStatic assets + API caching]
        WAF[WAF + Shield\nDDoS protection]
    end
    subgraph Load Balancing
        ALB[Application Load Balancer\nL7, path routing, health checks]
    end
    subgraph Compute
        App1[App Server 1]
        App2[App Server 2]
        App3[App Server 3]
    end
    subgraph Data
        Redis[(Redis\nSession + Cache)]
        Primary[(Primary DB\nPostgres)]
        Replica[(Read Replica)]
        S3[(S3\nObject Storage)]
    end

    Users --> DNS
    DNS --> CDN
    CDN --> WAF
    WAF --> ALB
    ALB --> App1 & App2 & App3
    App1 & App2 & App3 --> Redis
    App1 & App2 & App3 -->|writes| Primary
    App1 & App2 & App3 -.->|reads| Replica
    Primary --> Replica
    App1 & App2 & App3 --> S3
```

## Microservices Architecture

```mermaid
graph TD
    Client[Web / Mobile Client]
    Client --> GW[API Gateway\nAuth · Rate Limit · SSL]
    
    GW --> US[User Service\nPostgres]
    GW --> OS[Order Service\nPostgres]
    GW --> PS[Product Service\nMongoDB]
    GW --> SS[Search Service\nElasticsearch]
    
    OS -->|OrderPlaced| Kafka[(Kafka\nEvent Bus)]
    Kafka --> NS[Notification Service]
    Kafka --> IS[Inventory Service]
    Kafka --> AnalyticsPipeline[Analytics Pipeline]
    
    US & OS & PS & SS --> ServiceMesh[Service Mesh\nEnvoy Sidecar mTLS]
```

## Data Pipeline Architecture

```mermaid
graph LR
    subgraph Ingestion
        App[Application] -->|events| Kafka[(Kafka\nEvent Stream)]
        DB[(Postgres)] -->|CDC Debezium| Kafka
        Logs[Server Logs] -->|Fluentd| Kafka
    end
    subgraph Processing
        Kafka --> Flink[Apache Flink\nStream Processing]
        Kafka --> Spark[Spark Structured\nStreaming]
    end
    subgraph Storage
        Flink --> S3[(S3 Data Lake\nParquet / Delta)]
        Spark --> DW[(Redshift\nData Warehouse)]
    end
    subgraph Serving
        S3 --> Athena[Athena\nAd-hoc queries]
        DW --> BI[BI Tools\nTableau / Looker]
    end
```

## CQRS + Event Sourcing

```mermaid
graph TD
    subgraph Write Side
        Client -->|Command| CommandAPI[Command API]
        CommandAPI -->|Validate| Domain[Domain Model]
        Domain -->|Emit| EventStore[(Event Store\nPostgres append-only)]
    end
    subgraph Projections
        EventStore -->|Stream| Proj1[Projection:\nUser View]
        EventStore -->|Stream| Proj2[Projection:\nAdmin Dashboard]
        EventStore -->|Stream| Proj3[Projection:\nSearch Index]
    end
    subgraph Read Side
        Proj1 --> ReadDB1[(Read Model\nRedis)]
        Proj2 --> ReadDB2[(Read Model\nPostgres)]
        Proj3 --> ReadDB3[(Elasticsearch)]
        QueryClient[Client] -->|Query| ReadAPI[Query API]
        ReadAPI --> ReadDB1 & ReadDB2 & ReadDB3
    end
```

## Distributed Cache (Redis Cluster)

```mermaid
graph TD
    App[Application] --> HashSlot{Consistent Hash\n16384 slots}
    HashSlot -->|slots 0-5460| Primary1[Primary 1\n+ Replica 1a\n+ Replica 1b]
    HashSlot -->|slots 5461-10922| Primary2[Primary 2\n+ Replica 2a\n+ Replica 2b]
    HashSlot -->|slots 10923-16383| Primary3[Primary 3\n+ Replica 3a\n+ Replica 3b]
    Primary1 <-->|Gossip| Primary2
    Primary2 <-->|Gossip| Primary3
    Primary1 <-->|Gossip| Primary3
```

## Saga Pattern (Orchestration)

```mermaid
sequenceDiagram
    participant O as Saga Orchestrator
    participant F as Flight Service
    participant H as Hotel Service
    participant P as Payment Service

    O->>F: BookFlight(userId, flightId)
    F-->>O: FlightBooked ✓

    O->>H: BookHotel(userId, hotelId)
    H-->>O: HotelBooked ✓

    O->>P: ChargeCard(userId, amount)
    P-->>O: PaymentFailed ✗

    O->>H: CancelHotel(bookingId)
    H-->>O: Compensated ✓

    O->>F: CancelFlight(bookingId)
    F-->>O: Compensated ✓
```

## Message Fan-Out (SNS + SQS)

```mermaid
graph LR
    Order[Order Service] -->|Publish| SNS[SNS Topic\norder.placed]
    SNS --> SQS1[(SQS Queue\nemail-worker)]
    SNS --> SQS2[(SQS Queue\ninventory-worker)]
    SNS --> SQS3[(SQS Queue\nanalytics-worker)]
    SQS1 --> Email[Email Workers\nAuto-scales]
    SQS2 --> Inventory[Inventory Workers]
    SQS3 --> Analytics[Analytics Workers]
    SQS1 -.->|failed after 3 retries| DLQ1[(DLQ)]
    SQS2 -.->|failed after 3 retries| DLQ2[(DLQ)]
```

## Distributed Rate Limiter (Sliding Window in Redis)

```mermaid
sequenceDiagram
    participant C as Client
    participant GW as API Gateway
    participant R as Redis
    participant S as Service

    C->>GW: GET /api/data (user_id=123)
    GW->>R: ZADD rl:123 timestamp timestamp
    GW->>R: ZREMRANGEBYSCORE rl:123 0 (now-60s)
    GW->>R: ZCARD rl:123
    R-->>GW: count=45
    alt count ≤ 100
        GW->>S: Forward request
        S-->>GW: 200 OK
        GW-->>C: 200 OK
    else count > 100
        GW-->>C: 429 Too Many Requests\nRetry-After: 15s
    end
```

## Service Mesh Traffic Flow

```mermaid
graph LR
    subgraph Kubernetes Node A
        subgraph Pod 1
            App1[Service A\nApp]
            Sidecar1[Envoy\nSidecar]
        end
    end
    subgraph Kubernetes Node B
        subgraph Pod 2
            App2[Service B\nApp]
            Sidecar2[Envoy\nSidecar]
        end
    end
    subgraph Control Plane
        Istiod[Istiod\nConfig + Certs]
    end

    App1 <-->|localhost| Sidecar1
    App2 <-->|localhost| Sidecar2
    Sidecar1 <-->|mTLS| Sidecar2
    Istiod -.->|push config\n+ rotate certs| Sidecar1 & Sidecar2
```

## Blue-Green Deployment

```mermaid
graph TD
    LB[Load Balancer\n100% traffic]
    LB -->|current| Blue[Blue Environment\nv1.2.0 — LIVE]
    LB -.->|0% traffic| Green[Green Environment\nv1.3.0 — STAGING]
    
    Green -->|smoke tests\npass| Switch{Switch\ntraffic}
    Switch -->|instant cutover| LB2[Load Balancer\n100% → Green]
    LB2 --> Green
    Blue -->|standby for\ninstant rollback| Blue
```

## Canary Deployment

```mermaid
graph TD
    LB[Load Balancer]
    LB -->|95% traffic| Stable[Stable Pods\nv1.2.0 — 19 pods]
    LB -->|5% traffic| Canary[Canary Pods\nv1.3.0 — 1 pod]
    
    Canary --> Monitor{Monitor\nError Rate\nLatency\np99}
    Monitor -->|healthy after\n30 min| Rollout[Roll out to all pods]
    Monitor -->|errors spike| Rollback[Delete canary pods\nInstant rollback]
```
