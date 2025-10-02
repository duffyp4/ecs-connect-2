# CSR Check-in Portal

## Overview
The CSR Check-in Portal is a web application for Emissions and Cooling Solutions (ECS) that streamlines the job initiation process for Customer Service Representatives (CSRs). It integrates with ECS's GoCanvas workflow, enabling CSRs to create jobs via a web form, dispatch tasks through GoCanvas, and track completion times for accurate turnaround analytics. The system includes a "Pickup and Delivery Add-on" to manage a 7-state job lifecycle, including pickup and delivery tracking, separate GoCanvas forms for each stage, and comprehensive event timeline tracking.

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
- **Backend**: REST API with Express.js, custom middleware, Drizzle ORM. Includes services for GoCanvas integration, reference data, job tracking, Google Sheets sync, and timezone handling. Background polling monitors GoCanvas submissions every 30 seconds.
- **Database Schema**: PostgreSQL with `Jobs` (core job tracking), `Technicians`, and `ReferenceDataEntries`.
- **Job Events Service**: Manages a 7-state job lifecycle (queued_for_pickup → picked_up → at_shop → in_service → ready_for_pickup/delivery → out_for_delivery → delivered) with state-specific timestamps.
- **GoCanvas Integration**: Supports three forms (Emissions Service Log, Pickup Log, Delivery Log) with dynamic field mapping and dispatches. Driver assignment uses actual driver emails from reference data.
- **Job Tracking**: Records completion timestamps with GPS-based timezone accuracy, calculates turnaround times, and synchronizes completed jobs to Google Sheets.
- **Real-time Updates**: Frontend polling every 30 seconds for job status, live metrics, and visual indicators.

### Data Flow
- **Job Creation**: CSR submits a web form. A unique Job ID is generated, data is stored in PostgreSQL, and then dispatched to GoCanvas via API using dynamic field mapping.
- **API Endpoints**: Comprehensive REST endpoints for job state transitions, job management, GoCanvas integration, reference data, and authentication.

### Diagnostic Infrastructure
Diagnostic scripts in `/scripts/` assist with GoCanvas integration debugging.

## External Dependencies

### GoCanvas Integration
- **API**: Basic Authentication for Forms, Submissions, and Reference Data APIs.

### Google Sheets Sync
- **Authentication**: Service Account.

### Database Connection
- **PostgreSQL**: Neon serverless platform.

### Authentication System
- **Session-based**: Express sessions.

### Timezone Services
- **API**: TimeZone API for GPS coordinate to timezone conversion.