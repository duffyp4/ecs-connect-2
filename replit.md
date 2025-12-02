# ECS Connect

## Overview
ECS Connect is a web application for Emissions and Cooling Solutions (ECS) that streamlines the job initiation process for Customer Service Representatives (CSRs). It integrates with ECS's GoCanvas workflow, enabling CSRs to create jobs via a web form, dispatch tasks through GoCanvas, and track completion times for accurate turnaround analytics. The system includes a "Pickup and Delivery Add-on" to manage a 7-state job lifecycle, including pickup and delivery tracking, separate GoCanvas forms for each stage, and comprehensive event timeline tracking.

## User Preferences
Preferred communication style: Simple, everyday language.

Critical Communication Rule: When user explicitly says "don't make changes" or "just answer the question", NEVER proceed with code changes. Only provide the requested information.

## System Architecture
The application uses a monorepo structure with `/client` (React frontend), `/server` (Node.js/Express backend), `/shared` (TypeScript schemas), and `/scripts` (diagnostic scripts).

### Technology Stack
- **Frontend**: React with TypeScript, Vite, Tailwind CSS, Radix UI (shadcn/ui), TanStack Query, React Hook Form with Zod, Wouter for routing.
- **Backend**: Node.js with Express.js, session-based authentication.
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM.

### Key Components
- **Frontend**: Component-based React application supporting a two-path job creation UI ("Direct Shop Check-in" vs "Dispatch Pickup") with conditional fields and validation. It features a Job Detail Page with an Event Timeline and state-specific action buttons for managing the 7-state job lifecycle. Form logic is unified across job creation and check-in via a shared hook (`useCsrCheckInForm`) and a shared form fields component (`CsrCheckInFormFields`) to ensure consistency and reduce duplication.
- **Backend**: REST API with Express.js, custom middleware, Drizzle ORM. Includes services for GoCanvas integration, reference data, job tracking, Google Sheets sync, timezone handling, and webhooks. Job completion detection uses configurable modes (polling/hybrid/push) with 30-second polling as default.
- **Database Schema**: PostgreSQL with `Jobs` (core job tracking), `Technicians`, `ReferenceDataEntries`, `JobEvents`, `Users`, `Sessions`, and `Whitelist`. The `JobEvents` table uses ECS-formatted job IDs exclusively (foreign key to `jobs.job_id`) for consistent event tracking across the system. The `Users` table stores user profiles with role-based permissions. The `Whitelist` table controls application access by approved email addresses.
- **Job Events Service**: Manages a 7-state job lifecycle (queued_for_pickup → picked_up → at_shop → in_service → ready_for_pickup/delivery → queued_for_delivery → delivered) with state-specific timestamps. All job events are stored using ECS-formatted job IDs (e.g., `ECS-20251001220953-3011`) for consistency with user-facing APIs and external integrations.
- **GoCanvas Integration**: Supports three forms (Emissions Service Log, Pickup Log, Delivery Log) with dynamic field mapping and dispatches. Driver assignment uses actual driver emails from reference data.
- **Job Tracking**: Records completion timestamps with GPS-based timezone accuracy, calculates turnaround times, and synchronizes completed jobs to Google Sheets.
- **Real-time Updates**: Frontend polling every 30 seconds for job status, live metrics, and visual indicators.

### Data Flow
- **Job Creation**: CSR submits a web form. A unique Job ID is generated, data is stored in PostgreSQL, and then dispatched to GoCanvas via API using dynamic field mapping.
- **API Endpoints**: Comprehensive REST endpoints for job state transitions, job management, GoCanvas integration, reference data, and authentication.

### Parts Management System
- **Purpose**: Allows CSRs to add part details to jobs before dispatching emissions service logs to technicians
- **Database**: `job_parts` table with 11 fields linked to jobs (part, process, ecs_serial, filter_pn, po_number, mileage, unit_vin, gasket_clamps, ec, eg, ek) + `ecs_serial_tracking` table for serial number sequence management
- **ECS Serial Numbers**: Auto-generated unique identifiers (format: XX.MMDDYYYY.ZZ) where XX = shop code (01=Nashville, 02=Birmingham, etc), MMDDYYYY = date, ZZ = sequential number (01, 02, ...). Numbers are auto-populated but remain editable for manual override/future-dating scenarios.
- **Serial Number Matching**: Webhook matches parts by ECS Serial Number (not part name) to prevent data loss when multiple parts share the same name
- **Workflow**: 
  1. CSR creates job (either via Dispatch Pickup or Direct Shop Check-in)
  2. BEFORE check-in at shop: CSR can manage parts via "Manage Parts" button on job detail page
  3. When adding a part, ECS Serial Number is auto-generated using shop code + today's date + next sequential number
  4. Parts are optional, but if added, 4 required fields must be completed: Part, Process, ECS Serial, Gasket/Clamps
  5. During check-in: Emissions service log dispatch validates parts completeness
  6. Parts are sent to GoCanvas as loop screen rows using multi_key format
  7. AFTER check-in: Parts become read-only (already dispatched to technician)
  8. Webhook updates parts by matching ECS Serial Number from GoCanvas submissions (GoCanvas is source of truth)
- **Validation**: Emissions dispatch will fail if parts exist but required fields are incomplete
- **GoCanvas Integration**: Parts pre-populate loop screen in emissions form (ID: 5695685) using dynamically mapped field IDs with multi_key grouping
- **Edit States**: Parts editable when job state is `queued_for_pickup` or `picked_up` (BEFORE emissions dispatch)

### Diagnostic Infrastructure
Diagnostic scripts in `/scripts/` assist with GoCanvas integration debugging.

## External Dependencies

### GoCanvas Integration
- **API**: Basic Authentication for Forms, Submissions, and Reference Data APIs.
- **Form IDs**: Loaded from environment variables for easy configuration:
  - `GOCANVAS_FORM_ID_EMISSIONS` - Emissions Service Log form (default: 5695685)
  - `GOCANVAS_FORM_ID_PICKUP` - Pickup Log form (default: 5640587)
  - `GOCANVAS_FORM_ID_DELIVERY` - Delivery Log form (default: 5657146)
- **Dynamic Field Mapping**: All field IDs are loaded dynamically from JSON files instead of hardcoded values. This enables form updates without code changes:
  - Files: `gocanvas_field_map_emissions.json`, `gocanvas_field_map_pickup.json`, `gocanvas_field_map_delivery.json`
  - FieldMapper singleton (`shared/fieldMapper.ts`) provides type-safe field ID lookups
  - To regenerate mappings after GoCanvas form changes: `./update-gocanvas-mapping.sh <type> [form_id]`
  - Example: `./update-gocanvas-mapping.sh emissions 5695685`
- **Push Notifications**: XML-based submission notifications (API v2) with automatic job state transitions. Supports three notification modes:
  - `polling` (default): 30-second polling of GoCanvas API
  - `hybrid`: Both polling + webhooks for validation
  - `push`: Push notifications only, ~99% reduction in API calls
- **Historical Issue - "Ghost Parts"**: Previously experienced an issue where dispatching an invalid value to the "Submission Status" dropdown field (field ID 736433785) triggered GoCanvas's Parts Log conditional logic, creating a "ghost part" that technicians couldn't edit. **FIXED**: We no longer dispatch to the "Submission Status" field, preventing this issue.

### Google Sheets Sync
- **Authentication**: Service Account.

### Database Connection
- **PostgreSQL**: Neon serverless platform.

### Authentication System
- **Replit Auth**: OpenID Connect-based authentication with Google, GitHub, Apple, and email login support.
- **Session-based**: PostgreSQL-backed Express sessions for secure user session management.
- **Email Whitelist**: Access control system restricting application access to pre-approved email addresses.
- **Role-based Access**: Admin users can manage the whitelist and control user permissions.

### Timezone Services
- **API**: TimeZone API for GPS coordinate to timezone conversion.

## Access Control

### Whitelist Management
- Only users with whitelisted email addresses can access the application.
- On login attempt, the system checks if the user's email is in the whitelist table.
- Users without whitelisted emails are redirected to an "Access Denied" page.
- Admin users can add/remove email addresses via the Admin Dashboard (`/admin`).

### Admin Roles
- Users with `role = 'admin'` can access the Admin Dashboard.
- Admin features include:
  - Managing the email whitelist (add/remove approved emails)
  - Viewing all whitelisted users
  - Future: Granting admin permissions to other users
  
### Initial Setup
- To bootstrap the first admin user:
  1. Add their email to the whitelist via direct database access
  2. After their first login, update their role to 'admin' via SQL: `UPDATE users SET role = 'admin' WHERE email = 'admin@example.com'`

## Webhook System

### Architecture
The application supports real-time job completion detection via GoCanvas webhooks, reducing API calls by ~99% (from ~8,700/day to ~50/day) and improving latency from 30 seconds to <5 seconds.

### Implementation Details
- **Webhook Endpoint**: `POST /api/gocanvas/webhook` (unauthenticated, called by GoCanvas)
- **XML Parsing**: Uses `xml2js` to parse API v2 submission notifications
- **Two-step Process**: Parse minimal XML notification → Fetch full submission data via API v3 → Extract Job ID → Trigger state transition
- **Idempotency**: In-memory cache (1-hour TTL) prevents duplicate processing
- **Form Routing**: Automatically routes to pickup/service/delivery handlers based on form ID
- **Metrics**: Real-time metrics dashboard in Admin Panel showing received/processed/errors/performance

### Feature Flag Modes
Set via `WEBHOOK_MODE` environment variable:
- `polling` (default): 30-second polling only, no behavior change from original system
- `hybrid`: Both polling + webhooks for validation and comparison
- `push`: Push notifications only, disables polling entirely

### GoCanvas Configuration
To enable webhooks:
1. Log into GoCanvas web interface
2. For each form (Pickup, Emissions, Delivery):
   - Navigate to Form Settings → Submission Webhooks
   - Set webhook URL: `https://your-domain.replit.app/api/gocanvas/webhook`
   - GoCanvas will send XML notifications on form submission
3. Monitor health via Admin Dashboard → Push Notifications tab

### Monitoring
- Admin Dashboard shows real-time metrics: total received, processed, errors, duplicates, avg processing time
- Per-form breakdowns with last received timestamps
- Success rate tracking and performance metrics
- Auto-refreshes every 60 seconds