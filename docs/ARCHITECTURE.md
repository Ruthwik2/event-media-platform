# Architecture

The Event & Media Management Platform is a three-tier web application: a Next.js
frontend, a Node.js/Express REST API, and a PostgreSQL database, with AWS S3 +
Rekognition providing cloud storage and AI, and Socket.IO providing real-time
notifications. All three tiers are containerized with Docker Compose.

## System diagram

```mermaid
graph TB
    subgraph Client["🌐 Client"]
        Browser["Browser / Guest (QR + share token)"]
    end

    subgraph Frontend["Frontend — Next.js 14 (App Router)"]
        Pages["Pages: gallery, upload, events,<br/>albums, my-photos, search, admin"]
        Store["Zustand stores (auth, notifications)"]
        SocketClient["socket.io-client"]
        Axios["axios API client"]
    end

    subgraph Backend["Backend — Node.js + Express REST API"]
        direction TB
        MW["Middleware: JWT auth + RBAC,<br/>multer upload, rate-limit, helmet"]
        Routes["Routes: /auth /events /albums<br/>/media /notifications /settings"]
        Controllers["Controllers"]
        Services["Services: s3, rekognition,<br/>image (sharp+canvas), notification"]
        SocketServer["Socket.IO server"]
    end

    subgraph Data["Data & Cloud"]
        DB[("PostgreSQL<br/>via Prisma ORM")]
        S3[("AWS S3<br/>media / thumbnails / selfies")]
        Rek["AWS Rekognition<br/>faces · labels · moderation"]
    end

    Browser --> Pages
    Pages --> Store
    Pages --> Axios
    Pages --> SocketClient

    Axios -- "HTTPS / Bearer JWT" --> MW
    MW --> Routes --> Controllers
    Controllers --> Services
    Controllers --> DB

    Services --> S3
    Services --> Rek
    Services -- "emit" --> SocketServer
    SocketServer -- "live notifications" --> SocketClient

    Rek -. "reads images from" .-> S3
```

## Request flows

### Media upload + AI pipeline

```mermaid
sequenceDiagram
    participant U as Photographer/Admin
    participant FE as Frontend (upload page)
    participant API as Express API
    participant IMG as imageService (sharp)
    participant S3 as AWS S3
    participant REK as AWS Rekognition
    participant DB as PostgreSQL

    U->>FE: Drag & drop photos/videos
    FE->>API: POST /api/media/upload (multipart, JWT)
    API->>IMG: thumbnail + metadata + compression
    API->>S3: store original + thumbnail
    API->>REK: detectLabels → tags
    API->>REK: generateCaption (from labels) → aiCaption
    API->>REK: moderateContent → flagged + moderationLabels
    API->>REK: searchFacesByImage → faceIds
    API->>DB: persist Media row (tags, aiCaption, faceIds, flagged)
    API-->>FE: 201 Created (media list)
```

### Face-recognition "My Photos"

```mermaid
sequenceDiagram
    participant U as User
    participant API as Express API
    participant S3 as AWS S3
    participant REK as AWS Rekognition
    participant DB as PostgreSQL

    U->>API: POST /api/auth/selfie (reference selfie)
    API->>S3: store selfie
    API->>REK: indexFace → faceId
    API->>DB: save user.faceId
    Note over API,REK: existing photos are background-scanned for matches
    U->>API: GET /api/media/my-photos
    API->>DB: find media whose faceIds match user.faceId
    API-->>U: personalized photo set
```

## Components

| Tier | Technology | Responsibility |
|------|-----------|----------------|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind, Radix, Zustand | UI, client-side state, realtime client |
| API | Node.js, Express | REST endpoints, auth, orchestration |
| Auth/Access | JWT, bcryptjs, RBAC middleware | 4-role access control (ADMIN/PHOTOGRAPHER/CLUB_MEMBER/VIEWER), public/private gating |
| Media processing | sharp, canvas | thumbnails, compression, dynamic watermarks |
| AI/ML | AWS Rekognition | image labels, AI captions, content moderation, facial recognition |
| Storage | AWS S3 (local-disk fallback) | media, thumbnails, avatars, selfies, covers |
| Realtime | Socket.IO | live notifications (likes, comments, tags, approvals) |
| Database | PostgreSQL + Prisma ORM | persistence and migrations |
| Infra | Docker Compose | Postgres + backend + frontend |

## Data model (high level)

```mermaid
erDiagram
    User ||--o{ Event : creates
    Event ||--o{ Album : contains
    Album ||--o{ Media : contains
    Album ||--o{ AlbumCollaborator : has
    User ||--o{ Media : uploads
    Media ||--o{ Like : receives
    Media ||--o{ Comment : receives
    Media ||--o{ Favourite : receives
    Media ||--o{ MediaTag : has
    Media ||--o{ Download : tracked_by
    User ||--o{ Notification : receives
    User ||--o{ AccessRequest : makes
```

See [`docs/DATABASE_SCHEMA.md`](DATABASE_SCHEMA.md) for the full entity-relationship
diagram and table-by-table reference,
[`backend/prisma/schema.prisma`](../backend/prisma/schema.prisma) for the
authoritative schema, and [`backend/prisma/migrations/`](../backend/prisma/migrations/)
for the migration history.
