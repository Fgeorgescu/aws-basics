# System Design Diagrams

## Read-Heavy Service (Cache-Aside)

```mermaid
graph LR
    Client --> LB[Load Balancer]
    LB --> App1[App Server]
    LB --> App2[App Server]
    App1 & App2 --> Cache[(Redis Cache)]
    App1 & App2 --> DB[(Primary DB)]
    DB --> Replica[(Read Replica)]
    App1 & App2 -.->|read| Replica
```

## Write-Heavy Service (Queue + Workers)

```mermaid
graph LR
    Client --> API[API Layer]
    API --> Queue[(Message Queue\nSQS / Kafka)]
    Queue --> W1[Worker]
    Queue --> W2[Worker]
    Queue --> W3[Worker]
    W1 & W2 & W3 --> DB[(Database)]
    W1 & W2 & W3 --> DLQ[(Dead Letter Queue)]
```

## Microservices with API Gateway

```mermaid
graph TD
    Client --> GW[API Gateway\nAuth · Rate Limit · Routing]
    GW --> US[User Service]
    GW --> OS[Order Service]
    GW --> PS[Product Service]
    US --> UserDB[(User DB\nPostgres)]
    OS --> OrderDB[(Order DB\nPostgres)]
    PS --> ProductDB[(Product DB\nMongoDB)]
    OS -->|publish event| Bus[Event Bus\nKafka]
    Bus --> NS[Notification Service]
    Bus --> IS[Inventory Service]
```

## Event Sourcing + CQRS

```mermaid
graph LR
    Client -->|command| WriteAPI[Command API]
    WriteAPI -->|validate + emit| ES[(Event Store\nKafka / Postgres)]
    ES -->|project| ReadDB[(Read Model\nElasticsearch)]
    Client2[Client] -->|query| ReadAPI[Query API]
    ReadAPI --> ReadDB
```

## URL Shortener Architecture

```mermaid
graph TD
    User -->|POST /shorten| API[API Servers]
    User2[User] -->|GET /abc123| CDN[CDN / Edge]
    CDN -->|miss| API
    API --> Cache[(Redis\nshort→long URL)]
    API --> DB[(Database\nURL mappings)]
    API -->|analytics| Queue[(Kafka)]
    Queue --> Analytics[Analytics Service]
    Analytics --> DW[(Data Warehouse)]
```

## Social Feed (Fan-out on Write)

```mermaid
graph LR
    Author -->|post| WriteService[Write Service]
    WriteService --> DB[(Post DB)]
    WriteService -->|fan-out job| Queue[(Queue)]
    Queue --> FanOut[Fan-out Workers]
    FanOut --> FeedCache[(Feed Cache\nRedis per user)]
    Reader -->|GET feed| ReadService[Read Service]
    ReadService --> FeedCache
```

## Distributed Rate Limiter

```mermaid
graph LR
    Client --> Gateway[API Gateway]
    Gateway --> RL[Rate Limit Check]
    RL --> Redis[(Redis\nToken Bucket)]
    Redis -->|allowed| Service[Backend Service]
    Redis -->|blocked| Response[429 Response]
```

## Notification System

```mermaid
graph TD
    Trigger[Trigger Service] -->|event| Kafka[(Kafka)]
    Kafka --> NS[Notification Service]
    NS --> Router{Channel Router}
    Router -->|email| Email[Email Provider\nSES / SendGrid]
    Router -->|push| Push[Push Provider\nFCM / APNs]
    Router -->|SMS| SMS[SMS Provider\nTwilio]
    Router -->|in-app| WS[WebSocket Server]
    WS --> Client[Connected Client]
```

## Web Crawler Architecture

```mermaid
graph TD
    Seeds[Seed URLs] --> Scheduler[URL Scheduler\nPriority Queue]
    Scheduler --> Fetchers[Fetcher Workers]
    Fetchers --> Parser[HTML Parser]
    Parser -->|new URLs| Frontier[URL Frontier\nBloom Filter dedup]
    Frontier --> Scheduler
    Parser -->|content| Storage[(Content Store\nS3)]
    Parser -->|index| Indexer[Indexer]
    Indexer --> SearchIndex[(Search Index)]
```

## Multi-Region Active-Active

```mermaid
graph TD
    User1[Users US] --> DNS[Global DNS\nLatency routing]
    User2[Users EU] --> DNS
    DNS --> RegUS[US Region\nALB + Services]
    DNS --> RegEU[EU Region\nALB + Services]
    RegUS <-->|async replication| RegEU
    RegUS --> USDB[(US Database\nPrimary)]
    RegEU --> EUDB[(EU Database\nPrimary)]
    USDB <-->|CRDTs / conflict resolution| EUDB
```

## Service Mesh (Sidecar Pattern)

```mermaid
graph LR
    subgraph Pod A
        AppA[App Container] <--> ProxyA[Envoy Sidecar]
    end
    subgraph Pod B
        AppB[App Container] <--> ProxyB[Envoy Sidecar]
    end
    ProxyA <-->|mTLS| ProxyB
    ProxyA & ProxyB --> CP[Control Plane\nIstio / Consul]
```
