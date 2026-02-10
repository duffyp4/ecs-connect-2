# ECS Connect v2 - Migration Task List

## Pre-Implementation
- [x] Update CLAUDE.md with comprehensive project instructions
- [x] Create tasks/todo.md and tasks/lessons.md

## Phase 0: Platform Setup (Railway + Clerk)
- [x] Remove Replit-specific plugins from vite.config.ts and package.json
- [x] Install Clerk packages (@clerk/clerk-react, @clerk/express)
- [x] Create server/clerkAuth.ts with Clerk middleware + dev mode fallback
- [x] Update server/index.ts to use Clerk middleware
- [x] Update server/routes.ts - replace isAuthenticated/isAdmin middleware
- [x] Update client/src/App.tsx - wrap with ClerkProvider
- [x] Update client/src/hooks/useAuth.ts - use Clerk's useUser()/useAuth()
- [x] Update client/src/pages/landing.tsx - use Clerk's SignIn component
- [x] Remove server/replitAuth.ts and server/auth.ts
- [x] Remove openid-client, passport, passport-local dependencies
- [x] Verify app builds and type-checks

## Phase 1: Database Schema & API Foundation
- [x] Add form_submissions table to shared/schema.ts
- [x] Add form submission types and validation schemas
- [x] Update server/storage.ts with form submission methods
- [x] Update server/database.ts with form submission queries
- [x] Create server/services/formDispatch.ts
- [x] Add form submission REST endpoints to server/routes.ts
- [x] Run db:push to apply schema changes

## Phase 2: PWA + Pickup & Delivery Forms
- [x] Add vite-plugin-pwa to vite.config.ts
- [x] Create client/public/manifest.json + icons
- [x] Create client/src/lib/offlineQueue.ts (IndexedDB-backed)
- [x] Create client/src/lib/gpsCapture.ts
- [x] Create server/services/notificationService.ts (WebSocket)
- [x] Create client/src/pages/tech-dashboard.tsx
- [x] Create client/src/pages/driver-dashboard.tsx
- [x] Create client/src/pages/pickup-form.tsx
- [x] Create client/src/pages/delivery-form.tsx
- [x] Add /tech and /driver routes to App.tsx
- [ ] Test offline submission + sync

## Phase 3: Emissions Service Log Form
- [x] Create client/src/pages/emissions-form.tsx
- [x] Create client/src/components/forms/parts-loop-section.tsx
- [x] Implement read-only CSR section (~20 pre-filled fields)
- [x] Implement parts loop with collapsible accordion
- [x] Add collapsible accordion per part for mobile UX
- [x] GPS auto-capture on submit
- [x] Server-side processing in formDispatch.ts

## Phase 4: Migration & Cutover
- [x] Add USE_NATIVE_FORMS feature flag
- [x] Update jobEvents.ts to use formDispatch when flag enabled
- [x] Update routes.ts check-in endpoint for native dispatch
- [ ] Update check-in-modal.tsx for native dispatch (no client changes needed - server handles routing)
- [ ] Update delivery-dispatch-modal.tsx for native dispatch (no client changes needed - server handles routing)
- [ ] Parallel operation logging
- [ ] CSR portal shows native submission status

## GoCanvas Form Reference Dumps
- [x] Create scripts/dumpGoCanvasForm.js (flat + nested + ref data merge)
- [x] Dump emissions form (189 fields, 237 conditions, 8 operations, 20 ref data tables)
- [x] Dump pickup form (15 fields, 2 ref data tables)
- [x] Dump delivery form (18 fields, 4 conditions, 2 ref data tables)

## Phase 5: Polish & Enhancements
- [ ] Web Push Notifications (Firebase Cloud Messaging or Web Push API)
- [ ] Signature capture (canvas-based pad)
- [ ] Photo capture (camera input fields)
- [ ] Admin metrics (replace GoCanvas metrics)
- [ ] Offline data prefetch (IndexedDB reference data cache)

## Post-Cutover Cleanup
- [ ] Delete gocanvas.ts, webhook.ts, submissionProcessor.ts
- [ ] Delete fieldMapper.ts, formVersions.ts
- [ ] Delete 3 JSON field map files
- [ ] Delete build scripts (buildFieldMap.js, update-gocanvas-mapping.sh)
- [ ] Remove GoCanvas-specific routes
- [ ] Remove xml2js dependency
- [ ] Clean GoCanvas columns from jobs table
