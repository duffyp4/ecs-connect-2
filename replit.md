# CSR Check-in Portal

## Overview

This is a web application designed as a Customer Service Representative (CSR) Check-in Portal for Emissions and Cooling Solutions (ECS). The system provides a minimal overlay on top of ECS's existing GoCanvas workflow, allowing CSRs to initiate jobs through a web form that automatically integrates with GoCanvas and tracks completion times.

## User Preferences

Preferred communication style: Simple, everyday language.

**Critical Communication Rule**: When user explicitly says "don't make changes" or "just answer the question", NEVER proceed with code changes. Only provide the requested information. This was violated on 2025-08-21 when user asked to only answer a question about shop data but changes were made anyway.

## System Architecture

### Monorepo Structure
The application follows a monorepo pattern with clear separation of concerns:
- `/client` - React frontend application
- `/server` - Node.js/Express backend API
- `/shared` - Shared TypeScript schemas and types

### Technology Stack
- **Frontend**: React with TypeScript, Vite for bundling, Tailwind CSS for styling
- **Backend**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **UI Components**: Radix UI primitives with shadcn/ui design system
- **State Management**: TanStack Query for server state
- **Form Handling**: React Hook Form with Zod validation

## Key Components

### Frontend Architecture
- **Component-based React application** using functional components and hooks
- **Routing**: Wouter for client-side navigation
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Forms**: React Hook Form with Zod schema validation for type safety

### Backend Architecture
- **REST API** built with Express.js
- **Middleware**: Custom logging, JSON parsing, error handling
- **Database Layer**: Drizzle ORM with PostgreSQL schema definitions
- **Storage Abstraction**: Interface-based storage layer (currently using in-memory implementation)

### Database Schema
The system uses PostgreSQL with the following main entities:
- **Jobs**: Core job tracking with CSR form fields, timestamps, and GoCanvas integration
- **Technicians**: User management for job assignments
- **Users**: Basic user authentication structure (prepared for future use)

## Data Flow

### Job Creation Workflow
1. CSR fills out web form with job details
2. System generates unique Job ID (format: `ECS-YYYYMMDDHHMMSS-XXXX`)
3. Job data is stored in PostgreSQL database (always succeeds)
4. GoCanvas submission is created via API integration (may fail but job is still saved)
5. Job ID is automatically passed to GoCanvas Job ID field when available
6. Job is assigned to selected technician

### GoCanvas Integration Status
- **✅ COMPLETED**: Job ID field integration fully working - ECS Job IDs automatically passed to GoCanvas Job ID field (entry_id: 712668557)
- **✅ COMPLETED**: Core data mapping working correctly - Shop Name and Customer Ship To fields properly pass through
- **✅ COMPLETED**: Storage layer resolved - Fixed field name mismatches that were causing data corruption
- **✅ COMPLETED**: Using Testing Copy form (5568544) with proper dispatch creation instead of direct submissions
- **✅ COMPLETED**: All 14 form fields correctly mapped and transmitted with consistent Testing Copy form IDs (712668xxx)
- **✅ SUCCESS**: GoCanvas dispatches successfully created (e.g., dispatch ID: 45762587) with pre-populated ECS Job IDs

### Job Tracking Process
1. Background polling service monitors GoCanvas submissions
2. System detects when technician completes job
3. Completion timestamp is recorded
4. Turnaround time is calculated automatically
5. Data is synced to Google Sheets for reporting

### Real-time Updates
- Frontend polls for job status updates every 30 seconds
- Dashboard displays live metrics and recent job activity
- Status badges provide visual job state indicators

## External Dependencies

### GoCanvas Integration
- **OAuth 2.0 authentication** for API access
- **Submission API** for creating and monitoring job submissions
- **Polling mechanism** to detect job completions
- Environment variables required: `GOCANVAS_CLIENT_ID`, `GOCANVAS_CLIENT_SECRET`, `GOCANVAS_FORM_ID`

### Google Sheets Sync
- Service account authentication for automated data export
- Batch synchronization of job data for reporting
- Environment variables required: `GOOGLE_SERVICE_ACCOUNT_KEY`, `GOOGLE_SHEETS_ID`

### Database Connection
- PostgreSQL database with connection pooling
- Neon Database serverless integration
- Environment variable required: `DATABASE_URL`

## Deployment Strategy

### Development Setup
- Vite dev server for frontend with hot module replacement
- Node.js development server with automatic restarts
- In-memory storage fallback for development without database

### Production Build
- Frontend: Vite builds optimized React bundle to `dist/public`
- Backend: esbuild compiles Node.js server to `dist/index.js`
- Static file serving handled by Express in production

### Environment Configuration
- Development: Uses `NODE_ENV=development` with local development tools
- Production: Uses `NODE_ENV=production` with optimized builds
- Database migrations managed through Drizzle Kit

### Key Features
- **Job ID Generation**: Automatic unique identifier creation with timestamp and random suffix
- **Real-time Tracking**: Live dashboard with job status monitoring
- **External Integrations**: Seamless GoCanvas workflow integration and Google Sheets reporting
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS
- **Type Safety**: End-to-end TypeScript with shared schema validation