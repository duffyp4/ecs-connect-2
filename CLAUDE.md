# Project Instructions for Claude

## Workflow Rules

- **Plan mode default**: For non-trivial changes, enter plan mode first. Explore the codebase, understand existing patterns, and design an approach before writing code.
- **Verification before done**: After implementing, verify the change works (build, type-check, or test). Don't mark tasks complete until verified.
- **Autonomous bug fixing**: If you introduce a bug or type error, fix it immediately without asking. Only escalate if stuck after 2 attempts.
- **Demand elegance**: Follow existing patterns. Don't introduce new patterns without justification.
- **Minimal impact**: Make the smallest change that solves the problem. Don't refactor adjacent code unless asked.

## Git Commits

After completing each change or task, automatically commit the changes to git with a descriptive commit message. This ensures all work is logged in git history.

## Task Management

- Track progress in `tasks/todo.md` - check off items as completed
- Log lessons learned in `tasks/lessons.md` - what worked, what didn't, gotchas

## Core Principles

- **Simplicity first**: Prefer simple solutions over clever ones
- **No laziness**: Don't skip error handling, validation, or edge cases
- **Type safety**: Use TypeScript strictly. No `any` types without justification.
- **Existing patterns**: Follow the conventions already in the codebase

## Project Context

ECS Connect is a job tracking and workflow management system for Emissions and Cooling Solutions (ECS), an industrial emissions parts servicing company. It tracks jobs through an 11-state lifecycle: queued_for_pickup -> picked_up -> at_shop -> in_service -> service_complete -> ready_for_pickup -> picked_up_from_shop -> queued_for_delivery -> delivered (plus shipment_inbound and cancelled).

### Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Radix UI (Shadcn)
- **Backend**: Express.js + TypeScript
- **Database**: Neon PostgreSQL + Drizzle ORM
- **Auth**: Clerk (replacing previous Replit OIDC auth)
- **State management**: React Query (TanStack Query v5)
- **Routing**: Wouter (lightweight client-side routing)
- **Forms**: React Hook Form + Zod validation
- **Deployment**: Railway (replacing Replit)

### Key Patterns

1. **React Hook Form + Zod**: All forms use `useForm()` with `zodResolver()`. Validation schemas defined in `shared/schema.ts`.
2. **Drizzle ORM**: Schema in `shared/schema.ts`, queries in `server/database.ts`, interface in `server/storage.ts`.
3. **Service Layer**: Business logic in `server/services/` (jobEvents, formDispatch, etc.). Each service handles a specific domain.
4. **State Machine**: Job state transitions managed by `JobEventsService` with explicit transition guards.
5. **Role-Based Access**: Clerk stores roles in `publicMetadata`. Roles: driver, technician, csr, admin.
6. **API Pattern**: Express routes in `server/routes.ts`, middleware for auth (`requireAuth()` from Clerk).
7. **Query Client**: `client/src/lib/queryClient.ts` - default query function fetches from API with credentials.

### Deployment

- **Hosting**: Railway (auto-deploy from `main` branch)
- **Database**: Neon PostgreSQL (same `DATABASE_URL` as before, fully portable)
- **Auth**: Clerk (`CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)
- **Custom domain**: `app.ecsconnect.com` (Railway custom domain with auto SSL)

### GoCanvas Replacement

ECS Connect is migrating from GoCanvas (mobile forms platform) to native PWA forms. The migration plan:
- **Phase 0**: Platform setup (Railway + Clerk) - DONE
- **Phase 1**: Database schema + API for `form_submissions` table
- **Phase 2**: PWA + offline support + pickup/delivery forms
- **Phase 3**: Emissions service log form (complex, ~100 fields with parts loop)
- **Phase 4**: Migration cutover with feature flags
- **Phase 5**: Polish (push notifications, photos, signatures)

GoCanvas files to eventually remove (~2,900 lines): `server/services/gocanvas.ts`, `server/services/webhook.ts`, `server/services/submissionProcessor.ts`, `shared/fieldMapper.ts`, `shared/formVersions.ts`, 3 JSON field map files, build scripts.

### Environment Variables

```
DATABASE_URL          # Neon PostgreSQL connection string
CLERK_PUBLISHABLE_KEY # Clerk frontend key (pk_...)
CLERK_SECRET_KEY      # Clerk backend key (sk_...)
PORT                  # Server port (default: 5000)
NODE_ENV              # development or production
GOCANVAS_USERNAME     # GoCanvas API (legacy, until Phase 4 cutover)
GOCANVAS_PASSWORD     # GoCanvas API (legacy, until Phase 4 cutover)
USE_NATIVE_FORMS      # Feature flag: true = use native forms, false = GoCanvas
```

### Environments & Databases

| Environment | Purpose | Database | Status |
|-------------|---------|----------|--------|
| **Development** | Local dev on developer's machine (`localhost:3000`) | Neon dev/staging database | Active |
| **Staging** | Deployed on Railway for remote testing by team | Same Neon dev/staging database | Setting up |
| **Production** | Live app used by ECS employees daily | **Separate** Neon production database (currently used by Replit v1) | Replit v1 is live |

**Important:** The `DATABASE_URL` in `.env` / `.env.example` points to the **dev/staging** Neon database — NOT the production database. The production database is a separate Neon instance currently connected to the Replit v1 app. At full cutover, the Railway production deployment will be pointed at the production database. Never connect local dev or staging to the production database without explicit intent.
