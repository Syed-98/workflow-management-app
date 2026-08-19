# WorkFlow — Customer Application & Workflow Management System

A production-quality workflow management system built for the Full Stack Developer assessment. Manages customer applications through configurable workflow stages with role-based access control, work item tracking, activity history, and reliable external system synchronization.

---

## Table of Contents

1. [Setup Instructions](#setup-instructions)
2. [Architecture](#architecture)
3. [Data Model](#data-model)
4. [Application Design](#application-design)
5. [Authentication & Authorization](#authentication--authorization)
6. [External Integration](#external-integration)
7. [Edge Cases Handled](#edge-cases-handled)
8. [Assumptions & Trade-offs](#assumptions--trade-offs)
9. [Incomplete Features](#incomplete-features)
10. [Production Considerations](#production-considerations)
11. [AI and Tools Used](#ai-and-tools-used)

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- npm 9+

### 1. Clone the Repository

```bash
git clone <repository-url>
cd workflow-management-app
```

### 2. Configure Environment Variables

Copy `.env` to `.env.local` (already provided) and update values as needed:

```bash
# .env.local
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-super-secret-key-change-in-production-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"
MOCK_EXTERNAL_SERVICE_URL="http://localhost:3000"
```

For production, generate a strong secret:
```bash
openssl rand -base64 32
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Set Up the Database

```bash
npm run db:push       # Create SQLite database from schema
npm run db:seed       # Seed with demo users and sample data
```

### 5. Run the Application

```bash
npm run dev           # Development server at http://localhost:3000
```

### Demo Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@demo.com | password123 | Admin |
| manager@demo.com | password123 | Manager |
| exec@demo.com | password123 | Executive |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Next.js App                       │
│                                                     │
│  ┌─────────────────┐    ┌──────────────────────┐   │
│  │   App Router     │    │   API Routes          │   │
│  │   (RSC + Client) │    │   (Route Handlers)    │   │
│  │                  │    │                       │   │
│  │  /               │    │  /api/applications    │   │
│  │  /applications   │    │  /api/customers       │   │
│  │  /customers      │    │  /api/users           │   │
│  │  /users          │    │  /api/sync            │   │
│  │  /teams          │    │  /api/auth            │   │
│  └─────────────────┘    └──────────────────────┘   │
│                                   │                  │
│  ┌────────────────────────────────▼──────────────┐  │
│  │              Core Libraries                     │  │
│  │  auth.ts  permissions.ts  workflow.ts  sync.ts │  │
│  └────────────────────────────────┬──────────────┘  │
│                                   │                  │
└───────────────────────────────────┼──────────────────┘
                                    │
                          ┌─────────▼──────────┐
                          │   Prisma ORM        │
                          │   SQLite (dev)      │
                          │   PostgreSQL (prod) │
                          └────────────────────┘
```

### Why This Approach?

- **Next.js App Router**: Allows mixing server components (for authenticated data fetching without round-trips) and client components (for interactive UI). A single deployable unit.
- **SQLite (dev) / PostgreSQL (prod)**: SQLite requires zero infrastructure for the assessment. The Prisma abstraction means switching to PostgreSQL is a one-line config change.
- **NextAuth v5**: Industry-standard auth with built-in JWT session management. Credentials provider gives full control over authentication logic.
- **Prisma**: Type-safe database access, excellent DX, supports migrations and seeding.

---

## Data Model

### Entity Relationship

```
User ──belongs to──► Team
User ──created──────► Application
User ──assigned to──► Application
User ──created──────► WorkItem
User ──assigned to──► WorkItem

Customer ──has many──► Application

Application ──has many──► WorkItem
Application ──has many──► ActivityLog
Application ──has many──► SyncJob
```

### Key Entities

**User**
- `role`: ADMIN | MANAGER | EXECUTIVE
- `teamId`: optional team membership
- Passwords hashed with bcrypt (cost factor 12)

**Team**
- Groups executives under a manager
- Applications are associated with a team for manager-scoped access

**Customer**
- Core customer information (name, email, phone, company, address)
- Can have multiple applications

**Application**
- The primary entity: tracks customer work through the workflow
- `status`: follows the defined workflow state machine
- `priority`: LOW | MEDIUM | HIGH | URGENT
- `version`: integer for optimistic concurrency control
- `completedAt`: set when status transitions to COMPLETED

**WorkItem**
- Discrete tasks associated with an application
- `status`: PENDING | IN_PROGRESS | COMPLETED | CANCELLED
- Tracks who created/assigned each item

**ActivityLog**
- Append-only audit trail
- Records every significant event with `action`, `description`, `userId`, and `metadata` (JSON)

**SyncJob**
- Tracks external system synchronization state
- `idempotencyKey`: prevents duplicate sync jobs
- `attempts`/`maxAttempts`: controls retry limits
- `nextRetryAt`: exponential backoff scheduling
- `status`: PENDING | IN_PROGRESS | SUCCESS | FAILED | DEAD_LETTER

---

## Application Design

### Frontend ↔ Backend Communication

All data fetching uses the Fetch API against Next.js Route Handlers (`/api/*`). The dashboard uses React Server Components for initial data (dashboard stats) to avoid client-side loading states for the initial paint. Interactive views (application list with filters, detail pages) are client components that fetch data directly.

Responses follow a consistent envelope:
```json
{ "data": { ... } }       // success
{ "error": "message" }    // failure
```

### Workflow State Machine

Defined in `lib/workflow.ts`. Valid transitions:

```
NEW → WAITING_FOR_INFORMATION | IN_PROGRESS
WAITING_FOR_INFORMATION → IN_PROGRESS | NEW
IN_PROGRESS → UNDER_REVIEW | WAITING_FOR_INFORMATION
UNDER_REVIEW → COMPLETED | IN_PROGRESS
COMPLETED → REOPENED
REOPENED → IN_PROGRESS | WAITING_FOR_INFORMATION
```

The API enforces:
1. The requested transition must be in the valid transitions map
2. The requesting user's role must be permitted for that target status
3. The application version must match (optimistic locking)

Executives cannot complete or reopen applications — only ADMIN and MANAGER roles can do so.

### Optimistic Concurrency Control

Every `PATCH` and status/assignment change requires the client to send the current `version`. If the server version differs (another user saved first), the API returns `409 Conflict` with an error asking the user to refresh. This prevents accidental overwrites without the overhead of database-level locking.

---

## Authentication & Authorization

### Authentication

NextAuth v5 with the Credentials provider. On login:
1. User record is found by email
2. bcrypt compares the submitted password against the stored hash
3. On success, a JWT session is created containing `id`, `role`, and `teamId`
4. The JWT is stored in an HTTP-only cookie

### Authorization Layers

**Middleware** (`middleware.ts`): Redirects unauthenticated requests to `/login`.

**API-level** (`lib/permissions.ts`):
- `requireAuth()`: validates the session exists
- `requireRole(roles)`: validates the user's role is in the allowed set
- `canAccessApplication(user, application)`: scopes application access

**Application Access Rules:**
| Role | Can Access |
|------|-----------|
| ADMIN | All applications |
| MANAGER | Applications in their team + personally assigned to them |
| EXECUTIVE | Only applications assigned to them |

**Action Permissions:**
| Action | ADMIN | MANAGER | EXECUTIVE |
|--------|-------|---------|-----------|
| Create application | ✓ | ✓ | ✓ |
| Edit application | ✓ | ✓ | ✓ |
| Delete application | ✓ | ✓ | ✗ |
| Assign application | ✓ | ✓ | ✗ |
| Change status to COMPLETED | ✓ | ✓ | ✗ |
| Reopen application | ✓ | ✓ | ✗ |
| Create/edit customers | ✓ | ✓ | ✗ |
| Manage users | ✓ | ✗ | ✗ |
| Manage teams | ✓ | ✗ | ✗ |

---

## External Integration

### When Synchronization Occurs

When an application's status transitions to `COMPLETED`, the API immediately enqueues a `SyncJob` record (fire-and-forget from the request's perspective). The completion response returns to the user instantly — the sync does not block it.

### Sync Architecture

```
Application completed
        │
        ▼
  SyncJob created (PENDING)
  idempotencyKey = "sync-{applicationId}"
        │
        ▼
  POST /api/sync/process (called by cron job)
        │
        ├─ success → status = SUCCESS
        │
        └─ failure → status = PENDING (retry with exponential backoff)
                     attempts >= maxAttempts → DEAD_LETTER
```

### Failure Handling

- **Transient failures**: Job stays PENDING, `nextRetryAt` = now + `2^attempts` minutes (capped at 1 hour)
- **Timeout**: 10-second timeout on the external HTTP call
- **Dead letter**: After 5 failed attempts, job moves to `DEAD_LETTER` status for manual investigation

### Duplicate Prevention

The `idempotencyKey` field has a unique database constraint (`"sync-{applicationId}"`). A second `upsert` for the same application does nothing if a job already exists. The idempotency key is also sent as `X-Idempotency-Key` header to the external service so it can deduplicate on its side.

### Mock External Service

`/api/sync/mock-external` simulates real-world conditions:
- 10% chance of 503 (temporary unavailability)
- 20% chance of 2–4 second response delay

### Production Evolution

For production:
1. Replace in-process cron with a dedicated job queue (BullMQ + Redis, or AWS SQS)
2. Add a dead-letter queue dashboard for operations team
3. Add alerting when dead-letter count exceeds threshold
4. Consider a proper outbox pattern if transaction atomicity between DB write and job creation becomes critical

---

## Edge Cases Handled

### Concurrent Updates

Optimistic locking via the `version` field. Clients must send the current version; mismatches return 409. The UI displays a clear error asking the user to refresh.

### Unauthorized Actions

Every API route validates the session and role. The access filter (`buildApplicationFilter`) ensures database queries only return records the user is permitted to see — no IDOR vulnerabilities.

### Invalid Workflow Changes

The `canChangeStatus` function in `lib/workflow.ts` validates transitions before any database write. Invalid transitions return 422 Unprocessable Entity with a human-readable reason.

### External System Failures

The sync failure is isolated from the application completion. Failures are recorded, retried with backoff, and ultimately moved to dead-letter. The application status remains COMPLETED regardless.

### Duplicate Sync Requests

Unique constraint on `idempotencyKey` at the database level. The `upsert` operation is a no-op if the job already exists, preventing double-sync.

---

## Assumptions & Trade-offs

### Assumptions

1. **One active assignment at a time**: Applications have a single `assignedTo` user. Complex multi-assignee scenarios were out of scope.
2. **Managers belong to one team**: The `teamId` on User defines their team scope. A manager sees all applications in their team.
3. **Executives can see their own assigned applications only**: Aligns with "responsible for processing assigned work."
4. **Completed applications cannot have work items added**: Prevents data mutation after the workflow terminal state.
5. **SQLite for the assessment**: Zero-infrastructure, self-contained. Prisma makes switching to PostgreSQL trivial.
6. **No email notifications**: Out of scope for this assessment.

### Trade-offs

| Decision | Trade-off |
|----------|-----------|
| SQLite (dev) | No concurrent writes, not suitable for production; trivial to swap via `DATABASE_URL` |
| In-process sync processor | Simple to reason about; in production should be an external worker |
| JWT sessions (no DB session store) | Stateless (can't revoke tokens instantly); acceptable for internal tools |
| Client-side data fetching for lists | Simpler code, allows real-time filters; adds loading states compared to RSC |

---

## Incomplete Features

### Not Implemented

1. **Email/notification system**: Would use a provider like Resend or SendGrid. Triggered via activity log events.
2. **File attachments on work items**: Would use S3/R2 for storage with signed URLs.
3. **Advanced reporting / analytics**: Dashboard shows aggregate counts; detailed reports (time-to-completion, bottleneck analysis) were out of scope.
4. **Real-time updates**: Polling or WebSockets for live collaboration. Currently requires manual refresh.
5. **User profile / password change UI**: Admin can create users; there's no self-service profile page.

---

## Production Considerations

1. **Database**: Switch `DATABASE_URL` to PostgreSQL. Add connection pooling (PgBouncer or Prisma Accelerate).
2. **Auth**: Set `NEXTAUTH_SECRET` via secret manager (AWS Secrets Manager, Vault). Add session expiry and refresh token rotation.
3. **Deployment**: Containerize with Docker. Use a process manager (PM2 or systemd) for the Node.js process.
4. **Sync Queue**: Replace in-process cron with BullMQ + Redis for reliable background job processing.
5. **Observability**: Add structured logging (Pino), APM (Datadog/Sentry), and uptime monitoring.
6. **Rate Limiting**: Add rate limiting middleware on API routes (especially auth).
7. **HTTPS**: Enforce HTTPS in production with proper CSP headers.
8. **Database Migrations**: Use `prisma migrate` (not `db push`) in production with proper migration history.
9. **Tests**: Add unit tests for `lib/workflow.ts` state machine and integration tests for critical API flows.

---

## AI and Tools Used

- **Cursor with Claude (Opus)**: Used throughout the development to scaffold the application, write boilerplate, and ensure consistent patterns. Specifically used for:
  - Initial architecture design and technology decisions
  - Writing repetitive API route handlers
  - Prisma schema design review
  - Generating seed data
  
- **Prisma documentation**: Referenced for schema syntax and query patterns.
- **Next.js documentation**: Referenced for App Router patterns, Route Handlers, and middleware.
- **NextAuth v5 documentation**: Referenced for configuration and session callbacks.

All architectural decisions, data modeling choices, and business logic were designed by me. AI assistance was used to accelerate implementation of patterns I already knew, not to make design decisions.
