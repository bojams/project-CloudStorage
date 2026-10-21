# Architecture

This document explains **how** Nimbus Drive is put together and **why**. It is intended for the
next maintainer, not for marketing.

---

## 1. Design goals

1. **Security by construction.** Identifiers are UUIDs, storage keys are server-generated, and every
   database query is scoped by the authenticated user.
2. **Bytes never travel through the framework.** The application server handles metadata only;
   the payload goes straight to the object store.
3. **Predictable server boundaries.** Server Components read, Server Actions mutate, Route Handlers
   handle streaming. All three are typed.
4. **A UI that feels expensive.** Framer Motion, spring transitions, glass surfaces, an OKLCH token
   system with a first-class dark theme.

---

## 2. Runtime topology

```
┌────────────┐   HTTPS    ┌──────────────────────────────────────────┐
│  Browser   │───────────►│  Vercel / Node server                    │
│            │            │  ┌────────────────────────────────────┐  │
│            │            │  │ Edge Middleware                    │  │
│            │            │  │  • auth gate (redirect /login)     │  │
│            │            │  │  • rate limit (auth + upload)      │  │
│            │            │  └────────────────────────────────────┘  │
│            │            │  ┌────────────────────────────────────┐  │
│            │            │  │ App Router                         │  │
│            │            │  │  RSC pages  •  Server Actions      │  │
│            │            │  │  Route Handlers (upload/download)  │  │
│            │            │  └───────────────┬────────────────────┘  │
│            │            │                  │                        │
│            │            │        ┌─────────┴─────────┐              │
│            │            │        │ Prisma  → PostgreSQL│             │
│            │            │        └─────────┬─────────┘              │
│            │            │                  │                        │
│            │            │        ┌─────────┴─────────┐              │
│            │            │        │ Storage driver     │              │
│            │            │        │  local │ S3/R2     │              │
└────────────┘            │        └────────────────────┘              │
                         └──────────────────────────────────────────┘
```

The middleware imports **only** edge-safe modules. Prisma, bcrypt and the filesystem are never
pulled into the edge bundle — that is why the NextAuth configuration is split in two:

| File | Runtime | Contents |
| --- | --- | --- |
| `src/lib/auth/config.ts` | Edge | pages, session strategy, JWT/session callbacks, `providers: []` |
| `src/lib/auth/index.ts` | Node | Credentials provider, Prisma lookup, bcrypt comparison |

---

## 3. Data model

```
User ──┬──< Folder >──┐        Folder.parentId  → self relation (tree)
       │      │       └──< File                 Folder.children → self relation
       │      │
       │      └──< Share >── File / Folder       Share.token → 32 random bytes (unique)
       │
       └──< File
```

| Model | Purpose | Notable fields |
| --- | --- | --- |
| `User` | Account | `email` (unique), `passwordHash`, `role`, `storageQuota` (BigInt) |
| `Folder` | Folder tree | `nameKey` (lower-cased, for uniqueness), `parentId`, `isTrashed` (soft delete) |
| `File` | File metadata | `size` (BigInt), `storageKey` (**unique**, opaque), `status` (`PENDING`/`READY`/`FAILED`) |
| `Share` | Share links | `token` (unique, 32 bytes), `permission` (`VIEW`/`EDIT`), `recipientId`, `expiresAt` |

**Why names are duplicated as `nameKey`?** Case-insensitive uniqueness checks must not depend on
PostgreSQL collation, and the check has to happen in application code where a friendly error is
produced. `nameKey` is the lower-cased, sanitised form of `name`.

**Why is `size` a `BigInt`?** A single object may exceed 2 GiB, and `Int` overflows at 2 147 483 647.
The mappers (`src/lib/db/mappers.ts`) convert `BigInt → number` at the boundary so the client never
sees a `BigInt` (which cannot be serialised by RSC).

---

## 4. Request flows

### 4.1 Upload (three steps, bytes never touch the app server)

```
1. requestUploadAction(name, size, mimeType, folderId)
   → validates (Zod), checks the quota, creates a File row with status = PENDING
   → returns a grant:
        s3    : presigned PUT URL  (valid 15 min)
        local : HMAC-signed token  (valid 15 min)

2. Browser uploads the bytes
        s3    : PUT directly to the bucket
        local : PUT to /api/files/upload?token=…  → streamed to disk
   → the local route enforces the size limit, the MIME allow-list and the
     magic-byte signature, and removes partial files when the stream fails.

3. completeUploadAction(fileId)
   → verifies that the object exists and that its size matches
   → sets status = READY
   → abortUploadAction(fileId) cleans up when step 2 or 3 fails
```

### 4.2 Download

```
GET /api/files/:fileId/download
  → session required
  → SELECT … WHERE id = :fileId AND (ownerId = me OR shared-by-me) AND status = READY
  → s3    : 302 redirect to a short-lived presigned GET
  → local : streams the file with Content-Disposition + X-Content-Type-Options: nosniff
```

### 4.3 Share

```
createShareAction(targetId, targetType, recipientEmail?, expiresInDays?, permission)
  → verifies ownership of the target
  → token = randomBytes(32).toString("base64url")
  → Share row

GET /share/:token                      → public, read-only page
GET /api/public/share/:token/download  → public download (expiry checked)
```

A share with a `recipientId` is only visible in that account's “Shared with me” view; a share
without one is a public link. Folder access is inherited: a share on an ancestor folder grants
access to its descendants.

---

## 5. Security controls

| Threat | Control | Where |
| --- | --- | --- |
| IDOR | Every query filters by `ownerId` / share membership | `src/lib/db/queries/*` |
| Path traversal | Keys are `u/<userId>/<fileId>`; `assertSafeStorageKey()` + `resolve()` containment check | `src/lib/storage/types.ts`, `local.ts` |
| XSS | React escaping + DOMPurify sanitisation + strict CSP | `sanitize.ts`, `next.config.ts` |
| CSRF | Next.js origin verification for Server Actions; session-bound routes | framework + `middleware.ts` |
| Brute force | Rate limiting (memory / Upstash) + bcrypt cost 12 + generic error messages | `rate-limit.ts`, `auth/index.ts` |
| Enumeration | Identical response for “unknown e-mail” and “wrong password” | `auth/index.ts` |
| Clickjacking | `X-Frame-Options: DENY` + `frame-ancestors 'none'` | `next.config.ts` |
| MIME spoofing | Allow-list + magic-byte verification | `security/mime.ts`, `security/magic-bytes.ts` |
| Data exposure | `server-only` on server modules; no secrets in the client bundle | `src/lib/**` |
| Resource abuse | Upload size cap, parallel-upload cap (3), rate limits, folder depth cap (12) | `constants.ts`, `use-upload-manager.ts` |

### Environment handling

`src/lib/env.ts` parses the environment **lazily** (`getEnv()`), so `next build` never fails
because a database is unreachable from the CI sandbox. `tryGetEnv()` is the non-throwing variant
used by code paths that must degrade gracefully.

---

## 6. Front-end architecture

```
src/components/
├── ui/            Radix-based primitives (button, dialog, dropdown-menu, select, …)
├── providers/     Theme (next-themes), tooltip, toast (sonner)
├── dashboard/     drive-view, file-grid, file-list, sidebar, topbar, upload surfaces
│   └── dialogs/   new-folder, rename, move, delete, share, preview
├── share/         Public read-only share page
├── auth/          Login & register forms
└── settings/      Profile, security, appearance
```

**State ownership**

- *Server state* (folders, files, shares, quota) lives on the server and is revalidated with
  `revalidatePath()` after every mutation.
- *Client state* (view mode, open dialog, upload queue) lives in the client component that owns it.
  The grid/list preference is persisted in `localStorage`.
- *The sidebar lives outside the page tree*, so it cannot open a dialog that belongs to the page.
  It therefore triggers actions through the URL (`?action=new-folder`, `?action=upload`); the page
  consumes the flag once and removes it from the address bar.

**The upload queue** (`src/hooks/use-upload-manager.ts`) keeps at most three transfers in flight,
reports real progress through `XMLHttpRequest.upload.onprogress`, and can abort a transfer without
touching the others.

---

## 7. Design system

`src/app/globals.css` defines the tokens in OKLCH:

- Light and dark palettes exposed through `.dark` (custom variant `dark`).
- `@theme inline` maps the tokens onto Tailwind utilities (`bg-background`, `text-muted-foreground`, …).
- `@source "../../src"` keeps Tailwind’s scanner aware of the class names used in components.
- `tw-animate-css` provides the enter/exit animations used by Radix and Framer Motion.

---

## 8. Testing & CI

The CI workflow (`.github/workflows/ci.yml`) runs on every push and pull request:

1. `npm ci`
2. `npm run typecheck`
3. `npm run lint`
4. `npm run build`

A database is not required for the build: every page is `force-dynamic` and the environment is
validated lazily.

---

## 9. Decisions log

| Decision | Alternative | Reason |
| --- | --- | --- |
| UUID primary keys | Auto-increment integers | Prevents id enumeration and leaks no business information |
| Opaque storage keys | File name as key | Removes path traversal, collisions and encoding issues |
| Server Actions for mutations | REST endpoints for everything | Less boilerplate, typed end to end, automatic CSRF protection |
| Three-step upload | Base64 through an action | Base64 inflates payloads by 33 % and blocks the event loop |
| Split NextAuth config | One config with Prisma | The edge middleware must not bundle Prisma or bcrypt |
| Soft delete | Hard delete | “Trash” is a core product expectation; restores must be possible |
| `nameKey` column | Database collation | Predictable, collation-independent uniqueness checks |
