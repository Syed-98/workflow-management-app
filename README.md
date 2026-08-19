# WorkFlow — Customer Application & Workflow Management System

`WorkFlow` is a focused internal operations application for managing customer applications from intake through completion. The implementation covers customer management, application tracking, assignment, workflow enforcement, work item management, audit history, and resilient synchronization with an external system.

The goal of this solution was not to maximize framework usage, but to build something clear, maintainable, and appropriate for the scope of the assessment. The design favors explicit business rules, predictable data flow, and a modest amount of infrastructure that can realistically be evolved into a production system.

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

The repository already includes working local defaults in `.env` / `.env.local`, so no manual setup is required for local evaluation. The values below are included for clarity:

```bash
# .env.local
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="your-super-secret-key-change-in-production-min-32-chars"
NEXTAUTH_URL="http://localhost:3000"
MOCK_EXTERNAL_SERVICE_URL="http://localhost:3000"
```

If you want to override them, update `.env.local`. For production, the auth secret should be replaced with a strong generated value:
```bash
openssl rand -base64 32
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Set Up the Database

```bash
npm run db:push       # Create the SQLite schema
npm run db:seed       # Seed demo users and sample business data
```

### 5. Run the Application

```bash
npm run dev           # Starts the app at http://localhost:3000
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

### Why This Approach

- **Next.js App Router**: Keeps the frontend and backend in one deployable unit while still allowing a clean separation between server-rendered data and interactive client flows.
- **Prisma**: Provides a strongly typed persistence layer with a schema that is easy to read, evolve, and migrate.
- **SQLite for local assessment scope**: Keeps setup friction close to zero. For a time-boxed exercise, that is a better trade-off than introducing database infrastructure that is not essential to demonstrate product thinking or backend design.
- **NextAuth with credentials**: Simple, explicit, and sufficient for an internal tool. It also leaves room to swap to SSO or an enterprise identity provider later without having to redesign the authorization model.

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

The application uses Next.js Route Handlers (`/api/*`) as its backend boundary. That keeps the surface area explicit and makes the business rules easy to trace from UI action to persistence.

For rendering strategy, I used:
- **Server components** where initial authenticated page load benefits from server-side data access
- **Client components** where users need immediate interaction, local state, filtering, or modal workflows

That split keeps the initial experience fast without over-complicating the implementation with unnecessary client-side state infrastructure.

Responses follow a consistent envelope:
```json
{ "data": { ... } }       // success
{ "error": "message" }    // failure
```

### Workflow State Machine

Workflow rules are centralized in `lib/workflow.ts`. I deliberately kept them as explicit code rather than scattering them across UI conditions or ad hoc API checks. That makes the process easier to reason about and safer to extend.

Valid transitions:

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

Executives cannot complete or reopen applications. Those actions are reserved for `ADMIN` and `MANAGER`, which reflects the separation between day-to-day processing and supervisory approval.

### Optimistic Concurrency Control

I used optimistic concurrency control via the `version` field on `Application`. Every mutating request must include the current version. If another user updates the record first, the API returns `409 Conflict`.

This is a pragmatic fit for the assessment:
- simple to implement
- easy to explain
- protects against silent overwrites
- avoids introducing locking complexity that would be disproportionate for this scope

---

## Authentication & Authorization

### Authentication

Authentication is implemented with NextAuth v5 using the Credentials provider. On login:
1. User record is found by email
2. bcrypt compares the submitted password against the stored hash
3. On success, a JWT session is created containing `id`, `role`, and `teamId`
4. The JWT is stored in an HTTP-only cookie

### Authorization Layers

Authorization is enforced in layers:

**Middleware** (`middleware.ts`)
- Redirects unauthenticated users to `/login`

**API-level guards** (`lib/permissions.ts`)
- `requireAuth()`: validates the session exists
- `requireRole(roles)`: validates the user's role is in the allowed set
- `canAccessApplication(user, application)`: scopes application access

The important design choice here is that authorization is not treated as a UI concern. The UI hides actions where appropriate, but the API remains the source of truth.

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

When an application transitions to `COMPLETED`, the main transaction succeeds first and a `SyncJob` is then enqueued for background processing. The user does not wait for the external dependency, and a failure in the downstream system does not roll back the business action in the core application.

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

- **Transient failures**: the job is retried with exponential backoff using `nextRetryAt`
- **Slow downstream responses**: external calls are capped with a 10-second timeout
- **Persistent failures**: after 5 attempts, the job is moved to `DEAD_LETTER` so it is visible and recoverable rather than retried indefinitely

### Duplicate Prevention

The `idempotencyKey` field has a unique database constraint (`"sync-{applicationId}"`). A second `upsert` for the same application does nothing if a job already exists. The idempotency key is also sent as `X-Idempotency-Key` header to the external service so it can deduplicate on its side.

### Mock External Service

`/api/sync/mock-external` simulates real-world conditions:
- 10% chance of 503 (temporary unavailability)
- 20% chance of 2–4 second response delay

### Production Evolution

For a production version, I would evolve this into:
1. Replace in-process cron with a dedicated job queue (BullMQ + Redis, or AWS SQS)
2. Add a dead-letter queue dashboard for operations team
3. Add alerting when dead-letter count exceeds threshold
4. Consider a proper outbox pattern if transaction atomicity between DB write and job creation becomes critical

---

## Edge Cases Handled

### Concurrent Updates

Handled with optimistic locking via the `version` field. This avoids silent overwrites and gives users a clear recovery path when another update wins the race.

### Unauthorized Actions

Every API route validates the session and role. Query scoping happens at the data access layer as well, so users do not merely lose buttons in the UI; they are prevented from retrieving unauthorized records in the first place.

### Invalid Workflow Changes

The `canChangeStatus` function in `lib/workflow.ts` validates transitions before any database write. Invalid transitions return 422 Unprocessable Entity with a human-readable reason.

### External System Failures

The synchronization path is intentionally decoupled from the application workflow. The application can be completed successfully even if the external system is unavailable, slow, or temporarily returning errors.

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
| SQLite (dev) | Minimal setup and good enough for evaluation; not the right production database for a multi-user internal system |
| In-process sync processor | Easy to understand for the assessment; a dedicated worker/queue would be more robust in production |
| JWT sessions | Simple and stateless; less control over immediate revocation than a database-backed session model |
| Mixed server/client rendering | Keeps the UX responsive without over-engineering global state, but introduces two rendering patterns to manage |

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

- **Claude Code**: Used to accelerate implementation, especially repetitive scaffolding, boilerplate route handlers, and documentation refinement.
- **Framework documentation**: Prisma, Next.js, and NextAuth documentation were referenced where version-specific behavior mattered.

AI was used as a development accelerator, not as a substitute for system design. The architecture, domain modeling, permission model, workflow rules, and integration approach were intentionally designed and reviewed as engineering decisions rather than generated blindly.
