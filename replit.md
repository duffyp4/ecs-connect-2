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
- **Dispatch Delivery Workflow**: Enables direct delivery of parts, starting jobs in a `queued_for_delivery` state and dispatching immediately via GoCanvas.
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
- **Form IDs**: Configured via environment variables (`GOCANVAS_FORM_ID_EMISSIONS`, `GOCANVAS_FORM_ID_PICKUP`, `GOCANVAS_FORM_ID_DELIVERY`).
- **Dynamic Field Mapping**: Uses JSON files and `shared/fieldMapper.ts` for dynamic field ID lookups.
- **Push Notifications**: XML-based API v2 submission notifications.

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