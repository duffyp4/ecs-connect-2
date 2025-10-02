# CSR Check-in Portal

## Overview
The CSR Check-in Portal is a web application for Emissions and Cooling Solutions (ECS) that streamlines the job initiation process for Customer Service Representatives (CSRs). It integrates with ECS's GoCanvas workflow, enabling CSRs to create jobs via a web form, which then dispatches tasks through GoCanvas and tracks completion times for accurate turnaround analytics. The system has been extended with a "Pickup and Delivery Add-on" to manage a 7-state job lifecycle, including pickup and delivery tracking, separate GoCanvas forms for each stage, and comprehensive event timeline tracking.

## User Preferences
Preferred communication style: Simple, everyday language.

**Critical Communication Rule**: When user explicitly says "don't make changes" or "just answer the question", NEVER proceed with code changes. Only provide the requested information.

## System Architecture
The application uses a monorepo structure with `/client` (React frontend), `/server` (Node.js/Express backend), `/shared` (TypeScript schemas), and `/scripts` (diagnostic scripts).

### Technology Stack
- **Frontend**: React with TypeScript, Vite, Tailwind CSS, Radix UI (shadcn/ui), TanStack Query, React Hook Form with Zod.
- **Backend**: Node.js with Express.js, session-based authentication.
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM.

### Key Components
- **Frontend**: Component-based React application using functional components and hooks, Wouter for routing, Tailwind CSS for styling, shadcn/ui for UI components, and session-based authentication. Supports a two-path job creation UI ("Direct Shop Check-in" vs "Dispatch Pickup") with conditional fields and validation.
- **Backend**: REST API with Express.js, custom middleware, Drizzle ORM for PostgreSQL. Includes services for GoCanvas integration, reference data, job tracking, Google Sheets sync, and timezone handling. Background polling monitors GoCanvas submissions every 30 seconds to track job completion.
- **Database Schema**: PostgreSQL with `Jobs` (core job tracking, CSR form fields, GoCanvas metadata), `Technicians`, and `ReferenceDataEntries` (cached GoCanvas data).
- **Job Events Service**: Implements a 7-state job lifecycle (queued_for_pickup → picked_up → at_shop → in_service → ready_for_pickup/delivery → out_for_delivery → delivered) with state-specific timestamps and automatic event recording.
- **GoCanvas Integration**: Supports three forms: Emissions Service Log (5594156), Pickup Log (5628229), and Delivery Log (5604777). Features dynamic field mapping (JSON-based configuration) and dispatches.
- **Job Tracking**: Records completion timestamps with GPS-based timezone accuracy, calculates "Full Turnaround Time" and "Time with Tech," and synchronizes completed jobs to Google Sheets.
- **Real-time Updates**: Frontend polling every 30 seconds for job status, live metrics display, and visual indicators.

### Data Flow
- **Job Creation**: CSR submits a web form. A unique Job ID is generated, data is stored in PostgreSQL, and then dispatched to GoCanvas via API. Field mapping handles conversion of 32 CSR fields to 164 GoCanvas fields.
- **API Endpoints**: Comprehensive REST endpoints for job state transitions (e.g., `dispatch-pickup`, `mark-picked-up`, `check-in`, `mark-ready`, `dispatch-delivery`, `mark-delivered`, `cancel`), job management, GoCanvas integration, reference data, and authentication.

### Diagnostic Infrastructure
Includes diagnostic scripts in `/scripts/` for GoCanvas integration debugging, such as `analyze_field_mapping.js`, `verify_csr_payload.js`, and `check_conditional_toggles.js`.

## External Dependencies

### GoCanvas Integration
- **API**: Basic Authentication for Forms, Submissions, and Reference Data APIs.
- **Environment Variables**: `GOCANVAS_USERNAME`, `GOCANVAS_PASSWORD`, `GOCANVAS_FORM_ID`, `GOCANVAS_DRY_RUN`.

### Google Sheets Sync
- **Authentication**: Service Account.
- **Environment Variables**: `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_SHEETS_ID`.

### Database Connection
- **PostgreSQL**: Neon serverless platform.
- **Environment Variable**: `DATABASE_URL`.

### Authentication System
- **Session-based**: Express sessions.
- **Environment Variables**: `APP_PASSWORD`, `SESSION_SECRET`.

### Timezone Services
- **API**: TimeZone API for GPS coordinate to timezone conversion.

## Recent Development - Pickup and Delivery Add-on

### Phase 4 (September 29, 2025) - Job Creation Enhancement
**Implemented Two-Path Job Creation**:
- Radio button selection: "Direct Shop Check-in" vs "Dispatch Pickup"
- Conditional pickup fields (driver, address, notes) shown only for pickup path
- Pre-submission validation prevents orphaned jobs
- Visual validation feedback with automatic error clearing
- Driver selection integrated from GoCanvas reference data (table 343087)
- API endpoints for all 8 job state transitions created

### Phase 5 (September 29, 2025) - Job Actions & Detail Page
**Implemented Job Management Interface**:
- **Job Detail Page** (`/jobs/:id`) with comprehensive job information
- **Event Timeline** showing all state transitions with timestamps and visual indicators
- **State-Specific Action Buttons**:
  - Queued for Pickup → Mark as Picked Up
  - Picked Up → Check In at Shop
  - At Shop → Start Service
  - In Service → Ready for Pickup OR Ready for Delivery
  - Ready for Delivery → Dispatch for Delivery
  - Out for Delivery → Mark as Delivered
  - Cancel Job (available for all active states)
- Clickable Job IDs from Dashboard and Job List
- Real-time updates with automatic cache invalidation
- Error handling and success notifications

**Status**: Phase 5 complete. Full pickup and delivery lifecycle now manageable through UI. Ready for integration testing (Phase 6).

### Phase 6 (September 30, 2025) - GoCanvas Assignment & Workflow Refinement
**Fixed GoCanvas Assignment and Workflow Separation**:
- **Driver Email Lookup**: Added auto-populated read-only email field in pickup form
  - When driver is selected, email automatically populates from GoCanvas reference data (table 343087)
  - New backend endpoint: `/api/reference/driver-details` returns driver name-email pairs
  - Frontend hook: `useDriverDetails` provides driver details with loading states
- **GoCanvas Assignment Fix**: Pickup dispatches now use actual driver emails for GoCanvas assignment
  - Updated `dispatchPickup()` to accept driver email, pickup address, and notes
  - GoCanvas Pickup Log (form 5628229) properly assigned to driver via email
- **Workflow Separation**: Fixed duplicate GoCanvas form creation
  - Pickup path now only creates Pickup Log at dispatch time (not Emissions Service Log)
  - Direct check-in path creates Emissions Service Log at check-in time
  - Eliminated TBD placeholder logic that was causing validation issues
- **Field Mapping**: Pickup form maintains GoCanvas field order for consistency

**Technical Implementation**:
- Backend: `server/services/referenceData.ts` - `getDriverDetails()` method
- Frontend: `client/src/hooks/use-reference-data.ts` - `useDriverDetails()` hook  
- API: `GET /api/reference/driver-details` - returns `[{name, email}]`
- GoCanvas field map: `gocanvas_field_map_5628229.json` for Pickup Log form

**Status**: Phase 6 complete. Driver assignment now uses actual emails, workflow properly separated.

### Phase 7 (October 1, 2025) - Check-In Modal for Pickup Jobs
**Completed Check-In Modal with Full Emissions Service Log Fields**:
- **Problem**: Pickup jobs only collect 3 fields (shopName, customerName, customerShipTo) initially
- **Solution**: When CSR clicks "Check In at Shop", opens modal with ALL Emissions Service Log fields
- **Pre-populated Fields**: Job ID, Shop Name, Customer Name, Customer Ship To (disabled/read-only)
- **Required Fields**: userId, permissionToStart, shopHandoff, contactName, contactNumber
- **Optional Fields**: All other Emissions Service Log fields (PO, serial numbers, instructions, etc.)
- **Validation Approach**: Uses `insertJobSchema` with manual validation (same as original CSR form)
  - Removed `zodResolver` to match original form pattern
  - Validates manually in onSubmit using `insertJobSchema.safeParse()`
  - Handles optional fields properly with empty string defaults
- **Backend Changes**:
  - Modified `/api/jobs/:jobId/check-in` endpoint to validate with `insertJobSchema`
  - Updates job with validated data before creating GoCanvas Emissions Service Log
  - Removed unused `checkInJobSchema` (no longer needed)
- **Frontend Changes**:
  - Created `CheckInModal` component in `client/src/components/check-in-modal.tsx`
  - Integrated modal into job detail page - triggered by "Check In at Shop" button
  - Pre-populates known fields from pickup job data
  - Uses same form structure and validation as original CSR form

**Technical Implementation**:
- Backend: `server/routes.ts` - check-in endpoint validates with `insertJobSchema`
- Frontend: `client/src/components/check-in-modal.tsx` - modal with manual validation
- Schema: Removed `checkInJobSchema`, uses `insertJobSchema` for consistency
- Pickup workflow: Create (9 fields) → Dispatch → Mark Picked Up → Check In (+ 47 fields) → Complete Service

**Status**: Phase 7 complete. Check-in modal works identically to original CSR form but appears in job detail page with pre-populated pickup data.

### Phase 8 (October 2, 2025) - Shared CSR Check-In Form Architecture
**Unified Form Logic Across CSR Form and Check-In Modal**:
- **Problem**: CSR form page and check-in modal had duplicate form logic, reference data hooks, and auto-population code
- **Solution**: Created shared `useCsrCheckInForm` hook that both components now use
- **Hook Features**:
  - Encapsulates react-hook-form setup with insertJobSchema validation
  - Fetches all reference data from GoCanvas (shops, users, customers, ship-to locations, drivers, etc.)
  - Handles all auto-population logic (permissions, customer instructions, ship-to IDs, etc.)
  - Accepts `initialValues` to pre-populate forms (used by check-in modal)
  - Returns form instance, reference data, and watched field values
- **Benefits**:
  - Single source of truth for form logic
  - Updates to hook automatically apply to both CSR form page and check-in modal
  - Eliminates code duplication (~100 lines of duplicate logic removed)
  - Ensures identical behavior and GoCanvas submission across both forms
- **Implementation**:
  - Hook: `client/src/hooks/use-csr-check-in-form.ts`
  - CSR Form: `client/src/components/csr-form-new.tsx` (refactored to use hook)
  - Check-In Modal: `client/src/components/check-in-modal.tsx` (refactored to use hook)
  - Both components maintain their unique submission logic while sharing form setup

**Technical Details**:
- Hook exports: `{ form, referenceData, watchedFields }`
- Reference data includes all GoCanvas lookups with loading states
- Watched fields: userId, shopName, customerName, customerShipTo, shopHandoff
- Auto-population preserved: permissions, customer data, ship-to IDs, handoff emails
- CSR form keeps pickup-specific state and two-path flow (pickup vs direct)
- Check-in modal uses hook with `disableAutoPopulation: true` to preserve pre-populated job data without clearing effects

**Status**: Phase 8 complete. Both forms now share identical logic through useCsrCheckInForm hook. Any updates to the hook automatically apply to both the CSR form page and check-in modal.