# ReachInbox Email Job Scheduler

Full-stack email scheduling and delivery service built for the ReachInbox.ai Software Development Intern assignment. Users can sign in with Google OAuth or email/password, configure multiple sender accounts, upload recipient CSVs, compose rich-text emails, and schedule delayed campaigns with per-sender throttling and hourly rate limits.

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router, Axios, TipTap, React Hook Form, Zod, React Hot Toast, Lucide Icons
- **Backend:** Node.js, Express, TypeScript, Prisma ORM, Zod, Helmet
- **Database:** MySQL 8 / MariaDB 10.4+
- **Queue & Rate Limiting:** Redis, BullMQ, IORedis, Bull Board (`/admin/queues`)
- **Email:** Nodemailer + Ethereal Email (plus optional per-sender custom SMTP)
- **Search & Alerts:** Elasticsearch 8 (with MySQL fallback), Slack OAuth (`chat.postMessage`)
- **Tests:** Vitest, Supertest, React Testing Library

## Architecture

```mermaid
flowchart LR
  UI["React Frontend"] -->|HTTP-only Cookie + REST| API["Express API"]
  API -->|Prisma| DB["MySQL"]
  API -->|Delayed Jobs + Lua| REDIS["Redis / BullMQ"]
  API -->|Index & Search| ES["Elasticsearch"]
  API -->|Queue UI| BB["Bull Board (/admin/queues)"]

  WORKER["BullMQ Worker"] -->|Consume / Defer| REDIS
  WORKER -->|Claim & Update| DB
  WORKER -->|Send| SMTP["Ethereal / Custom SMTP"]
  WORKER -->|Rate-limit Alert| SLACK["Slack Web API"]
  WORKER -->|Sync Status| ES
```

## Project Layout

```text
reachinbox-scheduler/
├── backend/
│   ├── prisma/              # schema.prisma and seed.ts
│   ├── src/
│   │   ├── config/          # env validation, Prisma client, Redis factory
│   │   ├── controllers/     # auth, email, sender, slack, health
│   │   ├── integrations/    # Google OAuth, Slack, Nodemailer/Ethereal, Elasticsearch
│   │   ├── middleware/      # JWT cookie auth, error handler, rate limiter, Zod validation
│   │   ├── queues/          # BullMQ queues and Bull Board setup
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # business logic and Redis Lua rate-limiting
│   │   ├── utils/           # AES-256-GCM secret encryption, errors, html helpers
│   │   ├── workers/         # emailProcessor.ts
│   │   ├── app.ts
│   │   ├── server.ts
│   │   └── worker.ts
│   └── tests/
├── frontend/
│   └── src/
│       ├── components/      # Sidebar, Header, EmailList, Compose, CSVUploader, SchedulePopover, TipTap editor
│       ├── context/         # AuthContext
│       ├── layouts/         # DashboardLayout
│       ├── pages/           # Login, Dashboard, Scheduled, Sent, EmailDetails, Compose, Settings
│       ├── services/        # Axios API wrappers
│       ├── tests/
│       └── utils/           # CSV parser and date/size formatters
├── docker-compose.yml
└── package.json
```

## Local Setup

### 1. Prerequisites
- Node.js >= 20 and npm >= 10
- Docker & Docker Compose (or local MySQL/MariaDB + Redis)

### 2. Install dependencies & env files

```bash
npm --prefix backend install
npm --prefix frontend install

cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### 3. Start infrastructure (Docker)

```bash
docker compose up -d
```

This brings up MySQL, Redis (with AOF persistence and `noeviction`), and Elasticsearch 8.

### 4. Push schema & seed

Update `DATABASE_URL` in `backend/.env` if you aren't using the Docker MySQL defaults:

```env
DATABASE_URL=mysql://reachinbox:reachinbox_pass@localhost:3306/reachinbox_db
```

Then generate the Prisma client, apply the schema, and optionally seed a demo account (`oliver.brown@domain.io` / `DemoPass123!`):

```bash
npm --prefix backend run prisma:generate
npm --prefix backend run prisma:push
npm --prefix backend run prisma:seed
```

### 5. Run the app

Start the API, worker, and frontend in separate terminals:

```bash
npm run dev:backend   # http://localhost:5000
npm run dev:worker    # BullMQ worker process
npm run dev:frontend  # http://localhost:5173
```

## Optional Integrations

- **Google OAuth 2.0:** Create a Web OAuth client in Google Cloud Console with JS origin `http://localhost:5173` and redirect URI `http://localhost:5000/api/auth/google/callback`. Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `backend/.env`.
- **Ethereal / Custom SMTP:** If `ETHEREAL_USER` and `ETHEREAL_PASS` are left blank in development, the mailer auto-generates an Ethereal test account and saves preview URLs on each sent email. You can also configure per-sender SMTP credentials (e.g. Gmail App Password) in **Settings**.
- **Slack OAuth:** Create a Slack app with `chat:write`, `channels:read`, and `groups:read` scopes, set the redirect URI to `http://localhost:5000/api/slack/callback`, and add `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET` to `backend/.env`.
- **Bull Board:** Accessible at `http://localhost:5000/admin/queues` for users whose email is listed in `ADMIN_EMAILS` (or with `ADMIN` role).

## How Scheduling, Throttling & Persistence Work

- **No cron jobs:** Every scheduled email is enqueued as a BullMQ delayed job (`jobId = email.id`) backed by Redis AOF, so pending jobs survive backend and worker restarts.
- **Per-sender minimum delay:** `acquirePerSenderSendSlot` uses a Redis Lua script (`sender:next_slot:<senderId>`) to space sends for the same sender by at least `delayBetweenEmailsMs` (default `2000` ms) without blocking worker threads across other senders.
- **Hourly rate limit:** `consumeSenderHourlyQuota` atomically tracks `ratelimit:sender:<senderId>:hour:<YYYYMMDDHH>`. When a sender hits its hourly limit, remaining jobs are deferred via `job.moveToDelayed()` + `DelayedError` into the next UTC hour window (spaced by `delayBetweenEmailsMs`), their `scheduledAt` is updated in MySQL, and a single deduplicated Slack alert is sent for that window.
- **Idempotency:** Duplicate schedule requests are blocked by a SHA-256 `idempotencyKey`, BullMQ deduplicates by `jobId`, and the worker atomically claims each row (`SCHEDULED -> PROCESSING`) before calling SMTP. If a worker crashes after SMTP delivery before updating the DB, `PROCESSING` rows are intentionally skipped rather than retried to avoid duplicate emails.
- **Search fallback:** Searches query Elasticsearch (`reachinbox_emails`) first and fall back to MySQL if Elasticsearch is offline, while queuing missed index updates on `email-index-queue`.

## API Overview

- **Auth:** `GET /api/auth/google`, `GET /api/auth/google/callback`, `POST /api/auth/google`, `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- **Emails & Search:** `POST /api/emails/schedule`, `POST /api/emails/parse-csv`, `GET /api/emails`, `GET /api/emails/scheduled`, `GET /api/emails/sent`, `GET /api/emails/:id`, `PATCH /api/emails/:id/star`, `DELETE /api/emails/:id`, `GET /api/search/emails`, `GET /api/dashboard/stats`
- **Senders, Slack & Health:** `GET/POST /api/senders`, `PATCH/DELETE /api/senders/:id`, `GET /api/slack/connect`, `GET /api/slack/callback`, `GET /api/slack/status`, `POST /api/slack/disconnect`, `GET /api/health`

## Tests

```bash
npm --prefix backend run typecheck
npm --prefix backend test
npm --prefix frontend run build
npm --prefix frontend test
```
