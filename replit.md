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
- **Frontend**: Component-based React application supporting a four-path job creation UI with conditional fields and validation for service jobs and direct delivery. Features a Job Detail Page with an Event Timeline and state-specific action buttons.
- **Backend**: REST API with Express.js, custom middleware, Drizzle ORM. Includes services for GoCanvas integration, reference data, job tracking, Google Sheets sync, timezone handling, and webhooks.
- **Database Schema**: PostgreSQL with tables for `Jobs`, `Technicians`, `ReferenceDataEntries`, `JobEvents`, `Users`, `Sessions`, and `Whitelist`. `JobEvents` uses ECS-formatted job IDs for consistent tracking.
- **Job Events Service**: Manages an 8-state job lifecycle (e.g., `queued_for_pickup` → `delivered`) with state-specific timestamps.
- **GoCanvas Integration**: Supports three forms (Emissions Service Log, Pickup Log, Delivery Log) with dynamic field mapping and dispatches.
- **Job Tracking**: Records completion timestamps, calculates turnaround times, and synchronizes to Google Sheets.
- **Parts Management System**: Allows CSRs to add part details to jobs, with auto-generated and editable ECS Serial Numbers, and integrates with GoCanvas loop screens. Parts become read-only after check-in.
  - **Serial Number Format**: `XX.MMDDYYYY.ZZ` where XX=shop code (2 digits with leading zero), MMDDYYYY=8-digit date, ZZ=daily sequence (2 digits with leading zero). Example: `01.12092025.01`
  - **Parts Loop Fields**: Part name, process, filter PN, PO number, mileage, unit/VIN, gasket/clamps, EC/EG/EK checkboxes. Uses `multi_key` (serial number) to associate fields with specific part rows in GoCanvas.
- **Dispatch Delivery Workflow**: Enables direct delivery of parts, starting jobs in a `queued_for_delivery` state and dispatching immediately via GoCanvas. Includes Contact Name and Contact Number fields with phone formatting.
- **Inbound Shipment Workflow**: Creates jobs for customer-shipped parts, starting in a `shipment_inbound` state, bypassing driver pickup.
- **Outbound Shipment Workflow**: Allows shipping completed parts back to customers via carriers, marking the job as `outbound_shipment` (a terminal state).

### Access Control
- **Whitelist Management**: Access restricted to users with whitelisted email addresses stored in the `Whitelist` table.
- **Admin Roles**: Users with `role = 'admin'` can access the Admin Dashboard to manage the email whitelist.

### Webhook System
- Supports real-time job completion detection via GoCanvas webhooks, significantly reducing API calls and improving latency.
- Features `polling`, `hybrid`, and `push` modes, configurable via `WEBHOOK_MODE` environment variable.
- Includes monitoring tools in the Admin Dashboard for webhook metrics.

## External Dependencies

### GoCanvas Integration
- **API**: Basic Authentication for Forms, Submissions, and Reference Data APIs.
- **Form IDs**: Managed in `shared/formVersions.ts` (NOT environment variables - see Architecture Decisions below).
- **Dynamic Field Mapping**: Uses JSON files and `shared/fieldMapper.ts` for dynamic field ID lookups.
- **Push Notifications**: XML-based API v2 submission notifications.

### GoCanvas Reference Data (December 2024)

| ID | Name | Purpose | Column Mapping |
|----|------|---------|----------------|
| **1017141** | ECS Team CSRs | Shop Name dropdown | 0=Name, 1=Location, 2=Dispatch Email, 3=Handoff Email, 4=Permission to Start |
| **1017142** | ECS Team Technicians | Shop Handoff dropdown | 0=Name, 1=Location, 2=Dispatch Email, 3=Handoff Email, 4=Permission to Start |
| **1017125** | Customer List | Customer Name, Ship To, etc. | 0=User Group, 1=Corp Name, 2=Customer ID, 3=Customer Name, 4=Ship2 Add1, 5=Ship2 City, 6=Ship2 ID, 7=Ship to Combined, 8=Ship2 Contact, 9=Specific Instructions, 10=Default Service, 11=Send Clamps/Gaskets?, 12=Customer Notes |
| **343087** | Drivers | Driver list | - |
| **947586** | ECS Locations - Drivers | Pickup/Delivery Location dropdown | - |
| **246465** | Parts | Parts list | - |
| **176530** | Process | Process options | - |
| **452576** | Emission_pn_w kits | Filter Part Numbers | - |

### Google Sheets Sync
- **Authentication**: Service Account.

### Database Connection
- **PostgreSQL**: Neon serverless platform.

### Authentication System
- **Replit Auth**: OpenID Connect-based authentication (Google, GitHub, Apple, email).
- **Session-based**: PostgreSQL-backed Express sessions.

### Timezone Services
- **API**: TimeZone API for GPS coordinate to timezone conversion.

## Documentation

### Ghost Parts History
See `GHOST_PARTS_HISTORY.md` for consolidated documentation of all "ghost parts" investigations, including:
- September 2025: Conditional logic triggers causing required field errors
- November 2025: Internal form validation change (Cleaning Phase requirement)
- December 2025: Serial number mismatch from manual GoCanvas edits

**Key insight:** "Ghost parts" can have multiple root causes. Always check for form changes and manual edits before assuming a code bug.

### Known Issues

**PO Number Dual-Mapping (Low Priority):** Job-level PO Number is sent to both `'PO Number (Check In)'` (correct) and `'PO Number'` parts loop field (incorrect, without multi_key). GoCanvas silently ignores the parts loop value since it lacks a multi_key. No visible impact, but should be cleaned up. Affected lines: 820 and 1514 in `server/services/gocanvas.ts`.

## Key Files Reference

| Area | Primary Files |
|------|---------------|
| **Database Schema** | `shared/schema.ts` |
| **API Routes** | `server/routes.ts` |
| **GoCanvas Dispatch** | `server/services/gocanvas.ts` |
| **Field Mapping** | `shared/fieldMapper.ts`, `gocanvas_field_map_*.json` |
| **Job State Machine** | `server/services/jobEvents.ts` |
| **Parts Management UI** | `client/src/components/parts-management-modal.tsx` |
| **Job Creation Form** | `client/src/components/csr-form-new.tsx` |
| **Shop Codes & Job IDs** | `shared/shopCodes.ts` |
| **Form Version History** | `shared/formVersions.ts` |

## Environment Variables

### Required
- `DATABASE_URL` - PostgreSQL connection string
- `GOCANVAS_USERNAME`, `GOCANVAS_PASSWORD` - GoCanvas API credentials

### Optional
- `WEBHOOK_MODE` - `polling`, `hybrid`, or `push` (default: polling)
- `DRY_RUN` - Set to `true` to skip actual GoCanvas API calls (for testing)

## Architecture Decisions

### GoCanvas Form IDs in Code, Not Env Vars (December 2024)

**Decision:** Store GoCanvas form IDs in `shared/formVersions.ts`, not environment variables.

**Reasons:**
1. Form IDs aren't secrets - no security reason to hide them
2. They're the same in dev and production
3. They must stay in sync with field mappings - storing them together prevents mistakes
4. We need version history for webhooks to catch submissions from older form versions
5. Git tracks code changes but not env var changes

**History Management (Rolling Window):**
- Each form keeps a rolling window of the last **20 historical form IDs**
- When adding a new form ID, the current ID moves to the front of history
- If history exceeds 20 entries, the oldest entry is automatically removed
- This ensures we catch submissions from recent form versions without unbounded growth

**Update Workflow:**
When updating a GoCanvas form, tell the agent: *"Remap the [EMISSIONS/PICKUP/DELIVERY] form to new ID [new_id]"*

The agent will automatically:
1. Move the current ID to the FRONT of history array in `formVersions.ts`
2. If history exceeds 20 entries, remove the oldest (last) entry
3. Set the new ID as current
4. Call GoCanvas API to get new field mappings
5. Update the corresponding `gocanvas_field_map_*.json` file

### Job ID Format (December 2024)

**Decision:** All job IDs use format `ECS-YYYYMMDDHHMMSS-XX` where XX is the 2-digit shop code.

**Reasons:**
1. Consistent format across all 4 job creation paths
2. Shop code embedded for easy identification
3. Centralized generator in `shared/shopCodes.ts`

## Development Commands

- `npm run dev` - Start development server (frontend + backend)
- `npm run db:push` - Push schema changes to database
- `npm run db:push --force` - Force push schema (use when db:push warns about data loss)

## Multi-Shop Expansion (Planned)

Currently deployed for Nashville only. Planning to add Birmingham, Charlotte, Knoxville, Chattanooga, and potentially more shops.

### What's Already Shop-Aware
- **Shop codes** in `shared/shopCodes.ts` - 5 shops already defined with 2-digit codes
- **Jobs have `shopName` field** - Each job tracks its shop
- **Serial number format** - `XX.MMDDYYYY.ZZ` includes shop code
- **`ecs_serial_tracking` table** - Has `shopCode` column for per-shop sequence tracking
- **GoCanvas reference data** - Shop/user associations managed in GoCanvas

### Confirmed: Shared GoCanvas Forms
All shops will submit to the same GoCanvas forms (Emissions Service Log, Pickup Log, Delivery Log). No per-shop form configuration needed.

### Changes Needed for Multi-Shop

| Area | Priority | Description |
|------|----------|-------------|
| **User Access Control** | High | Filter jobs by user's assigned shop(s). Use GoCanvas reference data for shop assignments. |
| **UI Shop Filtering** | High | Add shop selector to job list, dashboard. Let users filter by shop. |
| **Dashboard Metrics** | Medium | Per-shop statistics, ability to compare shops. |
| **Job ID Format** | ✅ Done | Unified to `ECS-YYYYMMDDHHMMSS-XX` format with 2-digit shop code. |
| **Google Sheets** | Low | Add "Shop" column to existing sheet, or create per-shop sheets. |
| **Technician Dropdown** | Medium | Confirm if technicians are shop-specific. May need to filter dropdown by shop. |

### Key Files for Multi-Shop Work
- `shared/shopCodes.ts` - Shop code mappings (add new shops here)
- `server/services/referenceData.ts` - Loads shop/user associations from GoCanvas
- `client/src/pages/job-list.tsx` - Job list filtering
- `client/src/components/csr-form-new.tsx` - Job creation form
- `server/storage.ts` - Database queries (add shop filtering)