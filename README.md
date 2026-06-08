# Event & Media Management Platform

A full-stack platform for managing event photography — organize photos and videos into events and albums, share them via QR codes and guest links, and let attendees instantly find every picture they appear in using AWS Rekognition face recognition.

Built for clubs, photography teams, and event organizers who need a single place to upload, moderate, organize, and distribute event media.

---

## Features

- **Events & Albums** — Organize media into events, each containing one or more albums. Public/private visibility per event and album.
- **Media uploads** — Bulk upload up to 200 photos/videos at once. Automatic thumbnail generation, image compression, and metadata extraction via [`sharp`](https://sharp.pixelplumbing.com/).
- **AI face recognition (AWS Rekognition)** — Users upload a reference selfie; the platform indexes their face and lets them find every photo they appear in ("My Photos").
- **AI labels & moderation** — Automatic content labeling and unsafe-content moderation on uploaded images.
- **Photo tagging** — Tag users in photos, including positional tags pinned to a spot on the image.
- **Social features** — Likes, threaded comments, favourites, and download tracking.
- **QR codes & share tokens** — Generate a QR code / shareable link for an event or album so guests can view media without an account.
- **Real-time notifications** — Socket.IO pushes live notifications (tags, likes, comments, approvals).
- **Role-based access control** — Four roles: `ADMIN`, `PHOTOGRAPHER`, `CLUB_MEMBER`, `VIEWER`.
- **Approval workflows** — Club membership requests and photographer access requests to private events/albums, with admin approve/reject.
- **Album collaborators** — Grant additional users edit access to an album.
- **Club branding** — Configurable single-club name/settings.
- **Watermarking** — SVG text watermarks applied to downloaded photos.

---

## Tech Stack

### Backend
- **Node.js + Express** — REST API
- **Prisma ORM** + **PostgreSQL**
- **Socket.IO** — real-time notifications
- **AWS SDK v3** — S3 (storage) + Rekognition (face recognition, labels, moderation)
- **sharp** + **canvas** — image processing, thumbnails, watermarks
- **JWT** (`jsonwebtoken`) auth, **bcryptjs** password hashing
- **multer** / **multer-s3** uploads, **qrcode** generation
- **helmet**, **cors**, **express-rate-limit**, **compression**, **winston** logging

### Frontend
- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** + **Radix UI** + **lucide-react** / **Heroicons**
- **Zustand** — state management
- **axios** — API client, **socket.io-client** — realtime
- **react-hook-form** + **zod** — forms & validation
- **react-dropzone**, lightbox galleries, **react-player**, **framer-motion**

### Infrastructure
- **Docker** / **docker-compose** for the full stack
- Storage is **S3 (optional) with local filesystem fallback** — toggle with `USE_S3`

---

## Project Structure

```
.
├── docker-compose.yml          # Postgres + backend + frontend
├── backend/
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma        # Data model (User, Event, Album, Media, …)
│   │   ├── migrations/          # SQL migrations
│   │   └── seed.js              # Seeds admin/photographer/member + demo event
│   └── src/
│       ├── app.js               # Express app entry point
│       ├── config/              # database, aws, socket, logger
│       ├── controllers/         # auth, event, album, media, notification, settings
│       ├── routes/              # Express routers (mounted under /api/*)
│       ├── middleware/          # auth (JWT/RBAC), upload (multer), errorHandler
│       └── services/            # s3Service, rekognitionService, imageService, notificationService
└── frontend/
    └── src/
        ├── app/                 # Next.js App Router pages ((auth) + (main) groups)
        ├── components/          # UI, media, events, albums, layout, admin
        ├── hooks/               # useSocket
        ├── store/               # Zustand stores (auth, notifications)
        ├── lib/                 # axios client, utils
        └── types/               # shared TypeScript types
```

---

## Getting Started

### Prerequisites
- [Docker](https://www.docker.com/) & Docker Compose, **or**
- Node.js 20+ and a local PostgreSQL instance

### Option A — Run everything with Docker (recommended)

This spins up PostgreSQL, the backend (with migrations + seed), and the frontend.

```bash
# 1. Create env files from the examples
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 2. Build and start the whole stack
docker compose up --build
```

Services:
| Service   | URL                       |
|-----------|---------------------------|
| Frontend  | http://localhost:3000     |
| Backend   | http://localhost:5001/api |
| Postgres  | localhost:5433            |

On first boot the backend runs `prisma migrate deploy` and seeds the database automatically.

### Option B — Run locally without Docker

**Backend**
```bash
cd backend
cp .env.example .env          # then edit DATABASE_URL, JWT_SECRET, etc.
npm install
npx prisma migrate dev        # apply migrations
npm run prisma:seed           # seed demo users + event
npm run dev                   # starts on PORT (default 5000)
```

**Frontend**
```bash
cd frontend
cp .env.example .env          # point NEXT_PUBLIC_API_URL at your backend
npm install --legacy-peer-deps
npm run dev                   # starts on http://localhost:3000
```

---

## Environment Variables

### Backend (`backend/.env`)
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | Token lifetime (e.g. `7d`) |
| `PORT` | Backend port (default `5000`) |
| `NODE_ENV` | `development` / `production` |
| `BACKEND_URL` | Public backend URL (used to build local upload URLs) |
| `FRONTEND_URL` | Allowed CORS origin |
| `USE_S3` | `true` to store media in S3, `false` for local disk |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials (for S3 + Rekognition) |
| `AWS_REGION` | AWS region (e.g. `us-east-1`) |
| `AWS_S3_BUCKET` | S3 bucket name |
| `REKOGNITION_COLLECTION_ID` | Rekognition face collection ID |

> **Note:** AWS is optional. With `USE_S3=false` and no AWS credentials, media is stored on local disk and face-recognition features degrade gracefully (face search returns no matches, labels/moderation fall back to safe defaults). Face recognition requires S3, since Rekognition reads images from your S3 bucket.

### Frontend (`frontend/.env`)
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL (e.g. `http://localhost:5001/api`) |
| `NEXT_PUBLIC_SOCKET_URL` | Socket.IO server URL (e.g. `http://localhost:5001`) |

---

## Seeded Accounts

After seeding, you can log in with:

| Role         | Email                          | Password       |
|--------------|--------------------------------|----------------|
| Admin        | `admin@eventmedia.com`         | `Password123!` |
| Photographer | `photographer@eventmedia.com`  | `Password123!` |
| Club Member  | `member@eventmedia.com`        | `Password123!` |

> ⚠️ These are demo credentials — change or remove them before deploying to production.

---

## API Overview

Base URL: `/api`. Authenticated routes expect an `Authorization: Bearer <token>` header.

| Resource | Base path | Highlights |
|---|---|---|
| **Auth** | `/api/auth` | register, login, profile, avatar/selfie upload, users, password change, membership requests |
| **Events** | `/api/events` | CRUD, categories, QR code, share tokens, guest access by token, access requests |
| **Albums** | `/api/albums` | CRUD, rename, QR code, share tokens, guest access by token, collaborators, access requests |
| **Media** | `/api/media` | bulk upload, search, my-photos (face search), favourites, like, comment, tag, download, analytics |
| **Notifications** | `/api/notifications` | list, mark read, delete |
| **Settings** | `/api/settings` | club settings (name/branding) |

Health check: `GET /health`.

### Roles & permissions
- **ADMIN** — full control; approves membership and access requests; manages club settings.
- **PHOTOGRAPHER** — creates events, uploads/deletes media, requests access to private events/albums.
- **CLUB_MEMBER** — views content, tags, likes, comments, favourites.
- **VIEWER** — default role on registration; read/social access.

---

## Available Scripts

### Backend (`backend/`)
| Script | Description |
|---|---|
| `npm run dev` | Start with nodemon (hot reload) |
| `npm start` | Start the server |
| `npm run prisma:generate` | Regenerate Prisma client |
| `npm run prisma:migrate` | Create & apply a dev migration |
| `npm run prisma:studio` | Open Prisma Studio (DB GUI) |
| `npm run prisma:seed` | Seed the database |

### Frontend (`frontend/`)
| Script | Description |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Start the production server |
| `npm run lint` | Run ESLint |

---

## Data Model

Core entities (see [`backend/prisma/schema.prisma`](backend/prisma/schema.prisma)):

- **User** — auth, role, profile, privacy settings, reference selfie & `faceId`
- **Event** → has many **Albums**
- **Album** → has many **Media**; supports collaborators, QR code, share token
- **Media** — photo/video with thumbnail, AI caption, tags, face IDs, visibility
- **Like**, **Comment** (threaded), **Favourite**, **Download** — engagement
- **MediaTag** — user tags with optional `x`/`y` position
- **Notification** — real-time user notifications
- **AccessRequest** — photographer requests for private events/albums
- **ClubSettings** — single-row club branding

---

## License

No license file is currently included. Add one (e.g. MIT) before public distribution.
