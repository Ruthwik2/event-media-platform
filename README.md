# Event & Media Management Platform

A full-stack app for managing event photography. You organize photos and videos into events and albums, share them with guests over QR codes or token links, and people can find the pictures they show up in using face recognition (AWS Rekognition). I built this for a club setting where one team shoots a lot of events and everyone wants their own photos back without scrolling through a thousand images.

## What it does

Events hold albums, albums hold media, and visibility (public or private) is set per event and per album. Photographers and admins upload in bulk — up to 200 files in one go — and `sharp` handles thumbnails and compression on the way in.

The face-recognition piece is the part I cared most about. A user uploads a reference selfie, the backend indexes their face into a Rekognition collection, and after that the "My Photos" view returns every image they appear in. On upload, Rekognition also pulls labels off each image (which feeds tag-based search), and those labels get turned into a short auto caption. The same upload path runs content moderation and flags anything questionable for an admin to look at.

Other things that are in here:

- Tagging people in photos, including positional tags pinned to a spot on the image.
- The usual social layer: likes, threaded comments, favourites, and download tracking.
- QR codes and share tokens so guests can view an event or album without an account.
- Live notifications over Socket.IO for tags, likes, comments, and approvals.
- Approval workflows. Club membership requests and photographer access requests to private events/albums both go through an admin approve/reject queue.
- Album collaborators, so you can give someone else edit rights on a single album.
- A single configurable club name/branding row.
- SVG text watermarks composited onto downloaded photos.

Roles are `ADMIN`, `PHOTOGRAPHER`, `CLUB_MEMBER`, and `VIEWER`. More on what each can do further down.

## Tech stack

Backend is Node + Express with Prisma over PostgreSQL. Real-time is Socket.IO. AWS comes in through the v3 SDK — S3 for storage and Rekognition for faces, labels, captions, and moderation. Image work (thumbnails, watermarks) is all `sharp`; the watermark is an SVG composited on with `sharp`'s `.composite()`. Auth is JWT (`jsonwebtoken`) with `bcryptjs` for hashing, uploads go through `multer`/`multer-s3`, QR codes via `qrcode`, plus the usual `helmet`/`cors`/`express-rate-limit`/`compression` and `winston` for logs.

Heads up on one thing: `canvas` and `node-cron` are still in `backend/package.json` but nothing in `src` imports them. They're leftovers, not part of the actual pipeline — don't go looking for cron jobs or a `canvas` render path, there aren't any.

Frontend is Next.js 14 (App Router) with React 18 and TypeScript. Styling is Tailwind plus Radix UI and lucide/Heroicons for icons. State lives in Zustand, data fetching is `axios`, realtime is `socket.io-client`, and forms are `react-hook-form` + `zod`. Uploads use `react-dropzone`, and there's `react-player` and a couple of lightbox libraries for the gallery viewing.

For infra it's Docker / docker-compose for the whole stack. Storage is local disk by default and S3 when you flip `USE_S3=true`.

## Project layout

```
.
├── docker-compose.yml          # Postgres + backend + frontend
├── backend/
│   ├── Dockerfile
│   ├── prisma/
│   │   ├── schema.prisma        # data model (User, Event, Album, Media, …)
│   │   ├── migrations/          # SQL migrations
│   │   └── seed.js              # seeds admin/photographer/member + a demo event
│   └── src/
│       ├── app.js               # Express entry point
│       ├── config/              # database, aws, socket, logger
│       ├── controllers/         # auth, event, album, media, notification, settings
│       ├── routes/              # routers mounted under /api/*
│       ├── middleware/          # auth (JWT/RBAC), upload (multer), errorHandler
│       └── services/            # s3Service, rekognitionService, imageService, notificationService
└── frontend/
    └── src/
        ├── app/                 # App Router pages, in (auth) and (main) groups
        ├── components/          # ui, media, events, albums, layout, admin
        ├── hooks/               # useSocket
        ├── store/               # Zustand stores (auth, notifications)
        ├── lib/                 # axios client, utils
        └── types/               # shared TS types
```

## Getting started

You'll need either Docker + Docker Compose, or Node 20+ with a Postgres instance you can point at.

### With Docker

This is the fastest path. It brings up Postgres, the backend (running migrations and the seed), and the frontend in one shot.

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build
```

Once it's up:

| Service  | URL                       |
|----------|---------------------------|
| Frontend | http://localhost:3000     |
| Backend  | http://localhost:5001/api |
| Postgres | localhost:5433            |

The backend host port is 5001 mapped to 5000 in the container, and Postgres is on 5433 to stay out of the way of any local Postgres on 5432. One thing worth knowing: the frontend service in `docker-compose.yml` hard-codes `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` in its `environment:` block, so for the Docker path those two values come from compose, not from `frontend/.env`.

### Locally, without Docker

Backend:

```bash
cd backend
cp .env.example .env          # set DATABASE_URL, JWT_SECRET, etc.
npm install
npx prisma migrate dev
npm run prisma:seed
npm run dev                   # listens on PORT, which defaults to 5000
```

Frontend:

```bash
cd frontend
cp .env.example .env          # point NEXT_PUBLIC_API_URL at your backend
npm install --legacy-peer-deps
npm run dev
```

The `--legacy-peer-deps` isn't optional — a couple of the frontend libraries have peer-dependency ranges that npm will otherwise refuse to resolve, and you'll hit an install error without it. If you're running the backend on a different host/port than the frontend expects, set `FRONTEND_URL` on the backend so CORS lets the browser through. I lost a chunk of time to CORS early on; the allowed origins are `http://localhost:3000` plus whatever you put in `FRONTEND_URL` (it accepts a comma-separated list and strips trailing slashes).

## Environment variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | secret for signing JWTs |
| `JWT_EXPIRES_IN` | token lifetime, e.g. `7d` |
| `PORT` | backend port, defaults to 5000 |
| `NODE_ENV` | `development` or `production` |
| `BACKEND_URL` | public backend URL, used to build local upload URLs |
| `FRONTEND_URL` | allowed CORS origin(s), comma-separated |
| `USE_S3` | `true` to store media in S3, `false` for local disk |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | AWS credentials, for S3 and Rekognition |
| `AWS_REGION` | AWS region, e.g. `us-east-1` |
| `AWS_S3_BUCKET` | S3 bucket name |
| `REKOGNITION_COLLECTION_ID` | Rekognition face collection ID |

AWS setup is fiddly and you don't need it to develop locally — skip it. With `USE_S3=false` and no credentials, media goes to local disk, face search just returns no matches, and the labels/captions/moderation step is skipped. The catch is that face recognition is coupled to S3: Rekognition reads the images out of your bucket, so if you want "My Photos" working you need both `USE_S3=true` and the AWS keys.

### Frontend (`frontend/.env`)

Two vars: `NEXT_PUBLIC_API_URL` (the backend API base, `http://localhost:5001/api`) and `NEXT_PUBLIC_SOCKET_URL` (the Socket.IO server, `http://localhost:5001`).

## Seeded accounts

After the seed runs, these three accounts exist:

| Role         | Email                          | Password       |
|--------------|--------------------------------|----------------|
| Admin        | `admin@eventmedia.com`         | `Password123!` |
| Photographer | `photographer@eventmedia.com`  | `Password123!` |
| Club Member  | `member@eventmedia.com`        | `Password123!` |

These are obviously just for local dev — change or remove them before anything goes near production. The seed is idempotent (it upserts), and it also creates a demo event ("Annual Cultural Fest 2024") with one album ("Opening Ceremony") so the app isn't empty on first run. There's no seeded VIEWER; VIEWER is the default role you get when you register yourself.

## API overview

Everything is under `/api`, and authenticated routes want an `Authorization: Bearer <token>` header.

| Resource | Base path | Highlights |
|---|---|---|
| Auth | `/api/auth` | register, login, profile, avatar/selfie upload, users, password change, membership requests |
| Events | `/api/events` | CRUD, categories, QR code, share tokens, guest access by token, access requests |
| Albums | `/api/albums` | CRUD, rename, QR code, share tokens, guest access by token, collaborators, access requests |
| Media | `/api/media` | bulk upload, search, my-photos (face search), favourites, like, comment, tag, download, analytics |
| Notifications | `/api/notifications` | list, mark read, delete |
| Settings | `/api/settings` | club name / branding |

The health check is `GET /health`, and note it's not under `/api`.

### Who can do what

- ADMIN has full control, approves membership and access requests, and owns club settings.
- PHOTOGRAPHER creates events, uploads and deletes media, and can request access to private events/albums.
- CLUB_MEMBER views private and public content and does the social stuff: tagging, liking, commenting, favouriting.
- VIEWER is the default on registration, with read and social access.

## Scripts

Backend:

| Script | What it does |
|---|---|
| `npm run dev` | start with nodemon |
| `npm start` | start the server |
| `npm run prisma:generate` | regenerate the Prisma client |
| `npm run prisma:migrate` | create and apply a dev migration |
| `npm run prisma:studio` | open Prisma Studio |
| `npm run prisma:seed` | seed the database |
| `npm test` | run the Jest suite |
| `npm run test:watch` | Jest in watch mode |

Frontend: `npm run dev`, `npm run build`, `npm start`, and `npm run lint` — the standard Next.js four.

## Tests

```bash
cd backend
npm test
```

The Jest suite is small and deliberately doesn't touch the database or AWS. It covers two things: the access-control logic in `utils/permissions.js` (role-based album and media visibility, and the Prisma `where` filters it builds), and the caption synthesis in `rekognitionService.js` (`buildCaptionFromLabels`). Both are pure functions, so the tests run anywhere without any setup.

## Data model

The source of truth is [backend/prisma/schema.prisma](backend/prisma/schema.prisma). The short version of the core entities:

- **User** — auth, role, profile, privacy flags, reference selfie and `faceId`.
- **Event** has many **Albums**; **Album** has many **Media** and can have collaborators, a QR code, and a share token.
- **Media** is a photo or video with a thumbnail, AI caption, tags, face IDs, visibility, and a moderation flag plus labels.
- **Like**, **Comment** (threaded via `parentId`), **Favourite**, and **Download** make up the engagement side.
- **MediaTag** is a user tag with an optional `x`/`y` position.
- **Notification**, **AccessRequest** (photographer requests for private events/albums), and a single-row **ClubSettings** round it out.
