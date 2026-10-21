# Nimbus Drive

A secure, production-grade **web-based cloud storage** platform built with Next.js 15 (App Router),
TypeScript, PostgreSQL/Prisma and a pluggable object-storage layer — with an Apple/Linear-grade
interface, a hardened security posture and a full audit trail of the decisions that led there.

> Storage for humans: fast uploads, real-time progress, drag & drop, sharing links, trash,
> dark mode, keyboard-friendly dialogs and a responsive layout that works from a phone to a desktop.

---

## Table of contents

- [Highlights](#highlights)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Storage drivers](#storage-drivers)
- [Scripts](#scripts)
- [Security model](#security-model)
- [Project structure](#project-structure)
- [Deployment](#deployment)
- [License](#license)

---

## Highlights

| Area | What you get |
| --- | --- |
| **Drive UI** | Grid & list views, breadcrumbs, sorting, persisted view preference, per-item context menu, keyboard-friendly dialogs |
| **Uploads** | Drag & drop, multi-file queue (3 parallel), real-time progress, abort, size/type validation, magic-byte verification |
| **Storage** | Local filesystem driver for development, S3-compatible driver (AWS, R2, Supabase) for production |
| **Sharing** | Unguessable 32-byte share links, optional e-mail restriction, optional expiry, public read-only page |
| **Organisation** | Unlimited folder depth (capped at 12), rename, move, soft delete → trash → restore, permanent delete, empty trash |
| **Account** | E-mail + password (bcrypt, cost 12), profile editing, password change, JWT sessions (7 days) |
| **Security** | CSP + HSTS + frame-ancestors, rate limiting (memory or Upstash), Zod validation, server-only modules, scoped queries (anti-IDOR), path-traversal-proof object keys |
| **DX** | Strict TypeScript (no `any`), ESLint flat config, typed `ActionResult` envelope, CI workflow, DB seed |

---

## Tech stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js 15 (App Router, React Server Components, Server Actions) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 (CSS-first `@theme`), Radix UI primitives, `tailwind-merge` |
| Motion | Framer Motion (layout & progress animations) |
| Icons | Lucide React |
| Database | PostgreSQL 16 + Prisma 6 |
| Auth | NextAuth v5 (Credentials provider, JWT sessions) |
| Validation | Zod 4 |
| Security | bcryptjs, isomorphic-dompurify, `node:crypto` HMAC grants |
| Object storage | Local filesystem **or** S3-compatible (AWS S3 / Cloudflare R2 / Supabase Storage) |

---

## Architecture

```
Browser ──► Edge Middleware (auth gate + rate limit)
              │
              ▼
        Next.js App Router
        ├── RSC pages        ── read through Prisma (always owner-scoped)
        ├── Server Actions   ── typed ActionResult envelope, Zod validation
        └── API routes       ── upload streaming, authorised downloads
              │
              ▼
        PostgreSQL (Prisma)          Object storage (local | S3)
```

Three principles drive the whole design:

1. **The server never trusts the client.** Every mutation is validated with Zod, authorised against
   the database, and scoped by `ownerId`. File ids alone never grant access.
2. **Names are data, not paths.** A file's storage key is `u/<userId>/<fileId>` — generated on the
   server. User input is validated against `assertSafeStorageKey()` before it ever touches the
   filesystem, which removes path traversal by construction.
3. **Bytes bypass the framework.** Uploads go straight to the object store (presigned PUT for S3,
   a signed grant for the local driver); only the metadata travels through a Server Action.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full breakdown, data model and request flows.

---

## Getting started

### 1. Requirements

- Node.js **20.11+** (tested on 22.x)
- npm 10+ / pnpm / yarn
- Docker (optional, only for the local PostgreSQL)

### 2. Install

```bash
git clone https://github.com/bojams/project-CloudStorage.git
cd Project_CloudStorage
npm install
```

### 3. Configure

```bash
cp .env.example .env
# generate the two secrets
openssl rand -base64 32   # -> AUTH_SECRET
openssl rand -hex 32      # -> UPLOAD_SIGNING_SECRET
```

### 4. Start the database

```bash
docker compose up -d postgres
```

### 5. Create the schema and seed a demo account

```bash
npm run db:deploy   # apply prisma/migrations
npm run db:seed     # demo@nimbus.local / Demo1234
```

### 6. Run

```bash
npm run dev
```

Open <http://localhost:3000>, register a new account or sign in with the seeded demo user.

---

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | PostgreSQL connection string |
| `AUTH_SECRET` | ✅ | NextAuth signing secret (≥ 32 chars) |
| `AUTH_TRUST_HOST` | — | `true` in production behind a proxy |
| `NEXT_PUBLIC_APP_URL` | ✅ | Public origin, used to build share links |
| `STORAGE_DRIVER` | — | `local` (default) or `s3` |
| `STORAGE_LOCAL_PATH` | — | Where local uploads are written (`.storage/uploads`) |
| `UPLOAD_SIGNING_SECRET` | ✅ (local) | HMAC secret for local upload/download grants (≥ 16 chars) |
| `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_BUCKET` | ✅ (s3) | S3 credentials |
| `AWS_S3_ENDPOINT` | — | Custom endpoint for R2 / Supabase / MinIO |
| `AWS_S3_FORCE_PATH_STYLE` | — | `true` for MinIO and some self-hosted gateways |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | — | Distributed rate limiting (falls back to in-memory) |

---

## Storage drivers

The application talks to storage through a single interface
(`src/lib/storage/types.ts`), so switching backends is a one-line environment change.

**`local`** (development) — files are written to `STORAGE_LOCAL_PATH`. The client asks the server for
a short-lived, HMAC-signed grant and PUTs the bytes to `/api/files/upload?token=…`; the server
streams the request to disk, verifies the magic bytes and deletes partial files on failure.

**`s3`** (production) — the server returns a presigned `PUT` URL, the browser uploads directly to
S3/R2/Supabase, then calls `completeUploadAction`, which verifies that the object exists and that
its size matches the announced size before the row is flipped to `READY`.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | `prisma generate` + production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint (flat config) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | typecheck → lint → build |
| `npm run db:generate` | Regenerate the Prisma client |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:deploy` | Apply migrations in production |
| `npm run db:seed` | Seed a demo user and folder tree |
| `npm run db:studio` | Prisma Studio |

---

## Security model

The application is written against the OWASP Top 10:

- **Broken access control** — every query is scoped to the session user; share tokens are 32 random
  bytes and are checked for expiry and revocation on each use.
- **Injection** — Prisma parameterises every query; no string-built SQL anywhere.
- **Path traversal** — object keys are server-generated (`u/<userId>/<fileId>`) and validated with
  `assertSafeStorageKey()`; the resolved path is verified to stay inside the storage root.
- **XSS** — React escapes by default, user-supplied text is additionally sanitised with DOMPurify,
  and the CSP forbids third-party scripts.
- **CSRF** — Server Actions are protected by Next.js origin checks; state-changing API routes are
  session-bound.
- **Authentication abuse** — rate limiting on sign-in, registration and uploads (in-memory or
  Upstash), bcrypt hashing, generic error messages that do not disclose whether an account exists.
- **Security misconfiguration** — security headers on every response, `server-only` on server
  modules, `robots` disabled, no secrets in the client bundle.

---

## Project structure

```
src/
├── app/                     # App Router: pages, layouts, route handlers
│   ├── (app)/               # Authenticated shell (sidebar + topbar)
│   ├── (auth)/              # Login & register
│   ├── api/                 # Upload, download, auth, health, public share
│   └── share/[token]/       # Public read-only share page
├── components/
│   ├── dashboard/           # Drive UI, dialogs, sidebar, upload surfaces
│   ├── providers/           # Theme, tooltip, toast providers
│   ├── share/               # Public share view
│   └── ui/                  # Radix-based design-system primitives
├── hooks/                   # useUploadManager (queue, progress, abort)
├── lib/
│   ├── actions/             # Server Actions (folders, uploads, trash, shares, account)
│   ├── auth/                # NextAuth split config, password hashing, session
│   ├── db/                  # Prisma client, mappers, queries
│   ├── security/            # Sanitisation, MIME allow-list, magic bytes, rate limit
│   ├── storage/             # Storage drivers, key building, HMAC grants
│   ├── validation/          # Zod schemas
│   ├── env.ts               # Lazy, validated environment contract
│   └── result.ts            # Typed ActionResult envelope
├── middleware.ts            # Edge auth gate + rate limiting
└── types/                   # Shared types & NextAuth augmentation
```

---

## Deployment

1. Provision PostgreSQL and set `DATABASE_URL`.
2. Set `AUTH_SECRET`, `UPLOAD_SIGNING_SECRET` and `NEXT_PUBLIC_APP_URL`.
3. Configure the `s3` storage driver and the AWS variables.
4. `npm run build && npm start` (or deploy to Vercel — the project is Next.js native).
5. Run `npm run db:deploy` as a release step.

The CI workflow (`.github/workflows/ci.yml`) runs typecheck, lint and build on every push.

---

## License

MIT © [bojams](https://github.com/bojams)
