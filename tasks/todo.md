# ECS Connect v2 - Migration Task List

## Pre-Implementation
- [x] Update CLAUDE.md with comprehensive project instructions
- [x] Create tasks/todo.md and tasks/lessons.md

## Phase 0: Platform Setup (Railway + Clerk)
- [ ] Remove Replit-specific plugins from vite.config.ts and package.json
- [ ] Install Clerk packages (@clerk/clerk-react, @clerk/express)
- [ ] Create server/clerkAuth.ts with Clerk middleware + dev mode fallback
- [ ] Update server/index.ts to use Clerk middleware
- [ ] Update server/routes.ts - replace isAuthenticated/isAdmin middleware
- [ ] Update client/src/App.tsx - wrap with ClerkProvider
- [ ] Update client/src/hooks/useAuth.ts - use Clerk's useUser()/useAuth()
- [ ] Update client/src/pages/landing.tsx - use Clerk's SignIn component
- [ ] Remove server/replitAuth.ts and server/auth.ts
- [ ] Remove openid-client, passport, passport-local dependencies
- [ ] Verify app builds and type-checks

## Phase 1: Database Schema & API Foundation
- [ ] Add form_submissions table to shared/schema.ts
- [ ] Add form submission types and validation schemas
- [ ] Update server/storage.ts with form submission methods
- [ ] Update server/database.ts with form submission queries
- [ ] Create server/services/formDispatch.ts
- [ ] Add form submission REST endpoints to server/routes.ts
- [ ] Run db:push to apply schema changes

## Phase 2: PWA + Pickup & Delivery Forms
- [ ] Add vite-plugin-pwa to vite.config.ts
- [ ] Create client/public/manifest.json + icons
- [ ] Create client/src/lib/offlineQueue.ts (IndexedDB-backed)
- [ ] Create client/src/lib/gpsCapture.ts
- [ ] Create server/services/notificationService.ts (WebSocket)
- [ ] Create client/src/pages/tech-dashboard.tsx
- [ ] Create client/src/pages/driver-dashboard.tsx
- [ ] Create client/src/components/forms/pickup-form.tsx
- [ ] Create client/src/components/forms/delivery-form.tsx
- [ ] Add /tech and /driver routes to App.tsx
- [ ] Test offline submission + sync

## Phase 3: Emissions Service Log Form
- [ ] Create client/src/components/forms/emissions-service-form.tsx
- [ ] Create client/src/components/forms/parts-loop-section.tsx
- [ ] Implement read-only CSR section (~20 pre-filled fields)
- [ ] Implement parts loop with useFieldArray
- [ ] Add collapsible accordion per part for mobile UX
- [ ] GPS auto-capture on submit
- [ ] Server-side processing in formDispatch.ts

## Phase 4: Migration & Cutover
- [ ] Add USE_NATIVE_FORMS feature flag
- [ ] Update jobEvents.ts to use formDispatch when flag enabled
- [ ] Update check-in-modal.tsx for native dispatch
- [ ] Update delivery-dispatch-modal.tsx for native dispatch
- [ ] Parallel operation logging
- [ ] CSR portal shows native submission status

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
