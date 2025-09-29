# CSR Check-in Portal

## Overview

This is a web application designed as a Customer Service Representative (CSR) Check-in Portal for Emissions and Cooling Solutions (ECS). The system provides a minimal overlay on top of ECS's existing GoCanvas workflow, allowing CSRs to initiate jobs through a web form that automatically integrates with GoCanvas and tracks completion times with accurate turnaround analytics.

The system now includes a **Pickup and Delivery Add-on** that extends the workflow to support a 7-state job lifecycle with pickup and delivery tracking, separate GoCanvas forms for each workflow stage, and comprehensive event timeline tracking.

**Last Updated**: September 29, 2025

## Recent Changes

### September 29, 2025 - Pickup and Delivery Add-on (Phase 1-3)
**Implemented Core Backend Infrastructure**:

- **Database Schema Extension**: Added 7-state job lifecycle (queued_for_pickup → picked_up → at_shop → in_service → ready_for_pickup/delivery → out_for_delivery → delivered)
  - Added state-specific timestamps (pickedUpAt, atShopAt, inServiceAt, readyAt, outForDeliveryAt)
  - Added pickup/delivery data fields (addresses, notes, driver emails, item count)
  - Added delivery method tracking and technician assignment fields

- **Job Events Service**: Created complete state machine with validation
  - Implemented all major job action methods (dispatch pickup, mark picked up, check in, start service, mark ready, dispatch delivery, mark delivered, cancel)
  - Automatic event recording to job_events table with human-readable descriptions
  - Timeline tracking with actor, email, and metadata for each event

- **Multi-Form GoCanvas Integration**: Extended FieldMapper and GoCanvas service to support three forms:
  - Form 5594156: Emissions Service Log (existing)
  - Form 5628229: Pickup Log (new - for driver pickup dispatches)
  - Form 5604777: Delivery Log (new - for driver delivery dispatches)
  - Created form-specific field mapping methods
  - Maintained backward compatibility with existing emissions workflow

**Status**: Backend infrastructure complete and tested. Ready for Phase 4 (UI implementation)

## User Preferences

Preferred communication style: Simple, everyday language.

**Critical Communication Rule**: When user explicitly says "don't make changes" or "just answer the question", NEVER proceed with code changes. Only provide the requested information. This was violated on 2025-08-21 when user asked to only answer a question about shop data but changes were made anyway.

## System Architecture

### Monorepo Structure
The application follows a monorepo pattern with clear separation of concerns:
- `/client` - React frontend application with pages, components, and hooks
- `/server` - Node.js/Express backend API with services and database layer
- `/shared` - Shared TypeScript schemas, types, and field mapping utilities
- `/scripts` - Diagnostic and maintenance scripts for GoCanvas integration

### Technology Stack
- **Frontend**: React with TypeScript, Vite for bundling, Tailwind CSS for styling
- **Backend**: Node.js with Express.js, session-based authentication
- **Database**: PostgreSQL (Neon serverless) with Drizzle ORM
- **UI Components**: Radix UI primitives with shadcn/ui design system
- **State Management**: TanStack Query for server state management
- **Form Handling**: React Hook Form with Zod validation
- **External APIs**: GoCanvas API v3, Google Sheets API, Timezone API

## Key Components

### Frontend Architecture
**Pages**: Home (CSR Form), Dashboard (metrics), Job List (management), Landing (login)
- **Component-based React application** using functional components and hooks
- **Routing**: Wouter for client-side navigation with protected routes
- **Styling**: Tailwind CSS with custom CSS variables and responsive design
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Forms**: React Hook Form with Zod schema validation and dynamic reference data
- **Authentication**: Session-based login with automatic redirect handling

### Backend Architecture
**Services**: GoCanvas integration, Reference Data management, Job Tracking, Google Sheets sync, Timezone handling
- **REST API** built with Express.js with comprehensive endpoint coverage
- **Middleware**: Custom logging, JSON parsing, error handling, authentication guards
- **Database Layer**: Drizzle ORM with PostgreSQL schema definitions and migrations
- **Storage Implementation**: PostgreSQL database storage with full CRUD operations
- **Background Processing**: Job completion polling service with 30-second intervals

### Database Schema
The system uses PostgreSQL with the following main entities:
- **Jobs**: Core job tracking with 32 CSR form fields, timestamps, and GoCanvas integration metadata
- **Technicians**: User management for job assignments (dynamically derived from job data)
- **ReferenceDataEntries**: Cached GoCanvas reference data for form dropdowns and validation

## Data Flow

### Job Creation Workflow
1. **CSR Form Submission**: CSR fills out comprehensive web form with job details using dynamic reference data
2. **Job ID Generation**: System generates unique Job ID (format: `ECS-YYYYMMDDHHMMSS-XXXX`)
3. **Database Storage**: Job data is stored in PostgreSQL database (always succeeds first)
4. **GoCanvas Dispatch**: Creates GoCanvas dispatch via API integration (may fail but job is preserved)
5. **Field Mapping**: Dynamic field mapping system maps 32 CSR fields to 164 GoCanvas form fields
6. **Technician Assignment**: Job is assigned to selected technician via GoCanvas dispatch

### GoCanvas Integration Status
**Form ID**: 5594156 (164 total fields tracked)
- **✅ COMPLETED**: Dynamic field mapping system with JSON-based field definitions
- **✅ COMPLETED**: Job ID field integration - ECS Job IDs automatically passed to GoCanvas
- **✅ COMPLETED**: Comprehensive form field mapping - All 32 CSR fields correctly mapped
- **✅ COMPLETED**: Dispatch creation system with immediate assignment to technicians  
- **✅ COMPLETED**: Reference data integration for dropdown fields (shops, customers, etc.)
- **✅ COMPLETED**: Dry-run mode for testing without affecting production GoCanvas data
- **🐛 DIAGNOSED**: "Ghost Parts" issue - Conditional logic triggers analyzed with diagnostic scripts

### Job Tracking Process
1. **Background Polling**: 30-second interval polling monitors GoCanvas submissions for completion
2. **Status Detection**: System detects when technician completes job via GoCanvas API
3. **Timestamp Recording**: Completion timestamp recorded with GPS-based timezone accuracy
4. **Turnaround Calculation**: Two metrics calculated:
   - **Full Turnaround Time**: From CSR initiation to technician completion
   - **Time with Tech**: From technician handoff to completion
5. **Data Synchronization**: Completed jobs synced to Google Sheets for reporting

### Real-time Updates
- **Frontend Polling**: Dashboard polls for job status updates every 30 seconds  
- **Live Metrics**: Dashboard displays active jobs, completion rates, average turnaround times
- **Visual Indicators**: Status badges and progress indicators provide immediate feedback

## External Dependencies

### GoCanvas Integration
- **Basic Authentication** with username/password for API access
- **Forms API** for retrieving form definitions and field mappings
- **Submissions API** for creating dispatches and monitoring job submissions
- **Reference Data API** for dropdown field population (shops, customers, etc.)
- **Background Polling** mechanism to detect job completions
- **Environment variables required**: 
  - `GOCANVAS_USERNAME` - API username
  - `GOCANVAS_PASSWORD` - API password  
  - `GOCANVAS_FORM_ID` - Form ID (currently 5594156)
  - `GOCANVAS_DRY_RUN` - Set to 'true' for testing mode

### Google Sheets Sync
- **Service Account** authentication for automated data export
- **Batch synchronization** of completed job data for reporting
- **Environment variables required**: 
  - `GOOGLE_SERVICE_ACCOUNT_KEY` - Service account JSON key
  - `GOOGLE_SHEETS_ID` - Target spreadsheet ID

### Database Connection
- **PostgreSQL** database via Neon serverless platform
- **Connection pooling** through Drizzle ORM
- **Environment variable required**: 
  - `DATABASE_URL` - Full PostgreSQL connection string

### Authentication System
- **Session-based** authentication with Express sessions
- **Environment variables required**:
  - `APP_PASSWORD` - Application password (default: "ecs2024") 
  - `SESSION_SECRET` - Session encryption key

### Timezone Services
- **TimeZone API** for GPS coordinate to timezone conversion
- **GPS parsing** for accurate technician handoff timestamps

## Deployment Strategy

### Development Setup
- **Vite dev server** for frontend with hot module replacement and alias support
- **Node.js development server** with automatic restarts via tsx
- **PostgreSQL database** connected via DATABASE_URL (no in-memory fallback)
- **Workflow**: Single `npm run dev` command starts both frontend and backend

### Production Build
- **Frontend**: Vite builds optimized React bundle to `dist/public`
- **Backend**: esbuild compiles Node.js server to `dist/index.js`
- **Static serving**: Express handles static file serving in production
- **Database**: Same PostgreSQL connection in production

### Environment Configuration
- **Development**: `NODE_ENV=development` with hot reloading and detailed logging
- **Production**: `NODE_ENV=production` with optimized builds and error handling
- **Database migrations**: Managed through Drizzle Kit with `npm run db:push`
- **Port binding**: Always binds to `0.0.0.0:5000` (required for Replit)

## Field Mapping System

### Dynamic Field Mapping
- **JSON-based configuration**: `gocanvas_field_map.json` contains all 164 form field definitions
- **Automatic updates**: `update-gocanvas-mapping.sh` script refreshes field mappings
- **Validation**: Built-in validation ensures mapping consistency with environment
- **Singleton pattern**: FieldMapper class provides consistent field ID lookups

### Field Mapping Updates
```bash
# Update field mappings (requires GOCANVAS credentials)
./update-gocanvas-mapping.sh 5594156
# OR
npm run update-field-mapping
```

## Diagnostic Infrastructure

### Diagnostic Scripts
Located in `/scripts/` directory for GoCanvas integration debugging:
- **`analyze_field_mapping.js`**: Analyzes field mapping completeness and accuracy
- **`verify_csr_payload.js`**: Validates CSR form payload generation
- **`check_conditional_toggles.js`**: Identifies conditional logic field triggers  
- **`check_loop_table_handling.js`**: Analyzes loop/table field handling
- **`minimal_repro.js`**: Minimal reproduction script for testing without production impact
- **`buildFieldMap.js`**: Builds field mapping JSON from GoCanvas API

### Known Issues & Analysis
- **"Ghost Parts" Issue**: Intermittent required field errors on Parts Log screen
- **Root Cause**: Conditional logic triggers activate required fields based on CSR inputs
- **Conditional Triggers**: "Send Clamps & Gaskets?" = "Yes" may activate Parts Log requirements
- **Status**: Diagnosed with comprehensive analysis (see `GHOST_PARTS_DIAGNOSTIC_REPORT.md`)

## API Endpoints

### Job Management
- `POST /api/jobs` - Create new job
- `GET /api/jobs` - List jobs with filtering (status, technician, limit)
- `GET /api/jobs/:id` - Get specific job details
- `PATCH /api/jobs/:id` - Update job status (for testing)
- `POST /api/jobs/export` - Export jobs to Google Sheets

### GoCanvas Integration  
- `GET /api/gocanvas/forms` - List available forms
- `GET /api/gocanvas/forms/:id` - Get form details
- `GET /api/gocanvas/submission/:id` - Get submission details
- `GET /api/gocanvas/recent-submission` - Get most recent submission with workflow data
- `GET /api/gocanvas/handoff-time/:jobId` - Get handoff time data for job

### Reference Data
- `GET /api/reference/shop-users` - Get all shop users
- `GET /api/reference/shops/:userId` - Get shops for user
- `GET /api/reference/customers` - Get customer names
- `GET /api/reference/ship-to/:customerName` - Get ship-to locations
- `GET /api/reference/ship2-ids/:customerName/:shipTo` - Get Ship2 IDs

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout  
- `GET /api/auth/status` - Check authentication status

### Metrics & Debugging
- `GET /api/metrics` - Performance metrics and job statistics
- `POST /api/debug/check-job-status` - Manual job status check
- `POST /api/debug/force-poll` - Force polling check

## Key Features
- **Dynamic Job ID Generation**: Timestamp-based unique identifiers (ECS-YYYYMMDDHHMMSS-XXXX)
- **Real-time Tracking**: Live dashboard with 30-second polling and visual status indicators
- **Comprehensive Integration**: GoCanvas dispatch creation, reference data caching, GPS-based time tracking
- **Diagnostic Tools**: Complete debugging infrastructure with analysis scripts and dry-run mode
- **Responsive Design**: Mobile-first interface with Tailwind CSS and adaptive layouts
- **Type Safety**: End-to-end TypeScript with shared schema validation and Zod form validation
- **Turnaround Analytics**: Dual metrics tracking (full turnaround and technician time) with timezone accuracy