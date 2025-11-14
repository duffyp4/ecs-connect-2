# ECS Connect - GoCanvas API Integration Report

**Generated:** November 14, 2025  
**System Version:** ECS Connect v1.0

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Authentication](#authentication)
4. [GoCanvas Forms Used](#gocanvas-forms-used)
5. [API Interaction Types](#api-interaction-types)
6. [The Polling Mechanism (Detailed)](#the-polling-mechanism-detailed)
7. [Rate Limiting](#rate-limiting)
8. [Data Flow](#data-flow)
9. [Limitations & Known Issues](#limitations--known-issues)
10. [Recommendations](#recommendations)

---

## Executive Summary

ECS Connect integrates with the GoCanvas API to dispatch work orders to technicians and track job completion status. The integration operates in **two directions**:

- **Outbound (ECS → GoCanvas):** Creating dispatches when jobs are initiated or state changes occur
- **Inbound (GoCanvas → ECS):** Polling GoCanvas every 30 seconds to detect when forms are submitted/completed

The system uses **HTTP Basic Authentication** and makes **REST API calls** to GoCanvas v3 endpoints.

---

## Architecture Overview

### Components

```
┌─────────────────┐
│  ECS Connect    │
│  Web App        │
└────────┬────────┘
         │
         ├─── Job Creation/State Changes (Outbound)
         │    └─> Create GoCanvas Dispatches
         │
         └─── Background Polling (Inbound - Every 30s)
              └─> Check GoCanvas Submission Status
                  └─> Update Job States in ECS Database
```

### Key Files

| File | Purpose |
|------|---------|
| `server/services/gocanvas.ts` | GoCanvas API service - all API calls |
| `server/services/jobTracker.ts` | Polling service - runs every 30 seconds |
| `server/routes.ts` | API endpoints that trigger GoCanvas dispatches |
| `gocanvas_field_map_*.json` | Field mappings for each form |

---

## Authentication

### Method: HTTP Basic Authentication

```typescript
Authorization: Basic base64(username:password)
```

- **Username:** Stored in `process.env.GOCANVAS_USERNAME`
- **Password:** Stored in `process.env.GOCANVAS_PASSWORD`
- **Base URL:** `https://api.gocanvas.com/api/v3`

### Credentials Flow

1. Credentials are read from environment variables on server startup
2. For each API request, credentials are base64-encoded and sent in the `Authorization` header
3. If credentials are missing, the service operates in "mock mode" (returns fake data)

---

## GoCanvas Forms Used

ECS Connect dispatches to **three different GoCanvas forms**:

| Form Name | Form ID | Purpose | When Dispatched |
|-----------|---------|---------|----------------|
| **Emissions Service Log** | 5654184 | Main service form filled out by technician | When CSR checks job in at shop |
| **Pickup Log** | 5640587 | Driver picks up unit from customer | When CSR creates job with "Dispatch Pickup" option |
| **Delivery Log** | 5657146 | Driver delivers unit back to customer | When CSR marks job "Ready for Delivery" |

### Field Mapping

Each form has a JSON mapping file (e.g., `gocanvas_field_map_5654184.json`) that maps:

```
ECS Field Name → GoCanvas Entry ID
```

Example:
```json
{
  "jobId": "123456789",           // Maps to GoCanvas field entry_id
  "customerName": "987654321",    // Maps to different entry_id
  ...
}
```

---

## API Interaction Types

### 1. Dispatch Creation (Outbound)

**Endpoint:** `POST /api/v3/dispatches`

**When It Happens:**
- CSR checks job in at shop → Creates Emissions Service Log dispatch
- CSR creates job with pickup → Creates Pickup Log dispatch
- CSR marks job ready for delivery → Creates Delivery Log dispatch

**Request Payload:**
```json
{
  "dispatch_type": "immediate_dispatch",
  "form_id": 5654184,
  "name": "ECS Job: ECS-20251114-1234",
  "description": "Job for Customer XYZ - Shop ABC",
  "assignee_id": 123456,  // GoCanvas user ID (looked up by email)
  "responses": [
    { "entry_id": "123456789", "value": "ECS-20251114-1234" },
    { "entry_id": "987654321", "value": "Customer Name" }
    // ... more field responses
  ],
  "send_notification": true
}
```

**Flow:**
1. CSR triggers action (e.g., clicks "Check In at Shop")
2. Backend validates required fields (e.g., technician email)
3. Look up technician's GoCanvas user ID by email (`GET /api/v3/users`)
4. Build responses array by mapping ECS fields to GoCanvas entry IDs
5. **Attempt dispatch creation FIRST** (before updating database)
6. If GoCanvas returns success → Update job state in database
7. If GoCanvas returns error → Return error to user, do NOT update database

**Critical Design Decision:**
> **API calls happen BEFORE database updates** to prevent orphaned jobs (jobs marked as checked-in in ECS but never dispatched to GoCanvas)

---

### 2. Submission Status Checking (Inbound - Polling)

**Endpoint:** `GET /api/v3/submissions?form_id={formId}`

**When It Happens:**
- Background polling service runs **every 30 seconds**
- Checks for job state changes based on GoCanvas form submissions

**Request:**
```
GET /api/v3/submissions?form_id=5654184
Authorization: Basic {credentials}
```

**Response:**
```json
[
  {
    "id": 123456,
    "status": "completed",
    "submitted_at": "2025-11-14T12:34:56Z",
    "form_id": 5654184,
    ...
  }
  // ... up to 100 submissions (first page only)
]
```

**Then For Each Submission:**
```
GET /api/v3/submissions/{submissionId}
```

This returns detailed field data to check if the Job ID matches.

---

## The Polling Mechanism (Detailed)

### Overview

The polling mechanism is a **background process** that runs continuously on the server. It checks GoCanvas every 30 seconds to see if technicians have completed forms, then automatically updates job states in the ECS database.

### Startup

```typescript
// server/routes.ts (line 121)
jobTrackerService.startPolling();
```

When the Express server starts, it immediately:
1. Logs environment info (timezone, date settings)
2. Sets up a 30-second interval timer
3. Runs an initial check immediately (doesn't wait 30 seconds)

### The Polling Loop

```typescript
// server/services/jobTracker.ts
private readonly POLL_INTERVAL_MS = 30000; // 30 seconds

startPolling(): void {
  this.pollingInterval = setInterval(() => {
    this.checkPendingJobs();
  }, this.POLL_INTERVAL_MS);
  
  // Run initial check
  this.checkPendingJobs();
}
```

**Every 30 seconds, the system:**

```
┌─────────────────────────────────────────────────────┐
│   Polling Cycle (runs every 30 seconds)             │
├─────────────────────────────────────────────────────┤
│                                                      │
│  1. Get jobs in "queued_for_pickup" state            │
│     └─> Check Pickup Log (form 5640587)             │
│         └─> If completed → Mark job as "picked_up"  │
│                                                      │
│  2. Get jobs in "at_shop" or "in_service" state      │
│     └─> Check Emissions Service Log (form 5654184)  │
│         ├─> If in_progress → Mark as "in_service"   │
│         └─> If completed → Mark as "service_complete"│
│                                                      │
│  3. Get jobs in "queued_for_delivery" state          │
│     └─> Check Delivery Log (form 5657146)           │
│         └─> If completed → Mark job as "delivered"  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Detailed Polling Steps

#### Step 1: Query Database for Jobs in Specific States

```typescript
const queuedForPickupJobs = await storage.getJobsByState('queued_for_pickup');
const atShopJobs = await storage.getJobsByState('at_shop');
const inServiceJobs = await storage.getJobsByState('in_service');
const queuedForDeliveryJobs = await storage.getJobsByState('queued_for_delivery');
```

#### Step 2: For Each Job, Check GoCanvas

For example, checking pickup completion:

```typescript
// 1. Call GoCanvas API
const result = await goCanvasService.checkSubmissionStatusForForm(
  job.jobId,     // e.g., "ECS-20251114-1234"
  '5640587'      // Pickup Log form ID
);

// 2. Check result status
if (result.status === 'completed') {
  // 3. Transition job state in database
  await jobEventsService.markPickedUp(job.jobId, 1, {
    metadata: {
      submittedAt: result.submittedAt,
      autoDetected: true
    }
  });
}
```

### What `checkSubmissionStatusForForm()` Does

This is the core polling function:

```typescript
async checkSubmissionStatusForForm(jobId: string, formId: string): Promise<{
  status: 'pending' | 'completed' | 'in_progress',
  submittedAt?: string,
  submissionId?: string
}>
```

**Step-by-Step Process:**

1. **Fetch submissions list from GoCanvas**
   ```
   GET /api/v3/submissions?form_id={formId}
   ```
   - Returns up to 100 most recent submissions (first page only)
   - No pagination is implemented

2. **Log the count**
   ```
   Found 100 submissions for form 5654184
   ```

3. **Loop through completed submissions**
   ```typescript
   for (const submission of submissions) {
     if (submission.status === 'completed') {
       // Get detailed data...
     }
   }
   ```

4. **For each completed submission, fetch detailed data**
   ```
   GET /api/v3/submissions/{submissionId}
   ```
   This returns all field values for that submission

5. **Search for Job ID match**
   ```typescript
   // Look through all fields in the submission
   const jobIdField = fields.find(f => f.value === jobId);
   
   if (jobIdField) {
     return {
       status: submission.status,
       submittedAt: submission.submitted_at,
       submissionId: submission.id
     };
   }
   ```

6. **Return result**
   - If Job ID found → Return status ('completed' or 'in_progress')
   - If Job ID not found → Return { status: 'pending' }

### Special Handling: GPS Timestamp Extraction

When the Emissions Service Log is completed, the system:

1. Extracts the "handoff time" from the GPS field
2. Parses the GPS string:
   ```
   "Lat:41.908562,Lon:-87.677940,...,Time:1759423565.073100"
   ```
3. Uses the `Time` value as the actual "Service Started" timestamp
4. This provides GPS-accurate UTC timestamps instead of relying on submission time

---

## Rate Limiting

### GoCanvas Rate Limits

According to GoCanvas API documentation:

- **Rate limit headers** are included in every API response:
  - `RateLimit-Limit` - Total allowed requests
  - `RateLimit-Remaining` - Requests remaining
  - `RateLimit-Reset` - When the limit resets (Unix timestamp)

- **Error code:** `429 Too Many Requests` when limit exceeded

- **Best practices:**
  - Avoid concurrent API calls
  - Respect retry-after times
  - Monitor rate limit headers

### ECS Connect's API Call Frequency

**Polling (Every 30 Seconds):**
- 1 call per form to get submissions list
- N calls to get detailed submission data (where N = number of completed submissions in last 100)

**Estimated Calls Per Polling Cycle:**
- Minimum: 3 calls (one per form if no submissions)
- Typical: 10-20 calls (3 list calls + 7-17 detail calls)
- Maximum: 300+ calls (if all 100 submissions need detail fetching for all 3 forms)

**Per Hour:**
- 120 polling cycles (every 30 seconds)
- 1,200 - 24,000 API calls per hour (depending on submission volume)

**User-Triggered Calls:**
- Each job creation: 2-3 calls (user lookup + dispatch creation)
- Each check-in: 2-3 calls
- Each delivery dispatch: 2-3 calls

### Current Issue

ECS Connect **does not currently log or monitor** rate limit headers. When the rate limit is hit:
- Users see error message: "429 Too Many Requests - Throttle..."
- The system does not back off or retry
- Multiple rapid clicks can create duplicate dispatches

---

## Data Flow

### Outbound Flow (ECS → GoCanvas)

```
┌──────────────┐
│ CSR creates  │
│ or updates   │
│ job in UI    │
└──────┬───────┘
       │
       v
┌──────────────────────────────┐
│ Frontend sends POST request   │
│ to backend API                │
└──────┬───────────────────────┘
       │
       v
┌──────────────────────────────┐
│ Backend validates data        │
│ (e.g., technician assigned?)  │
└──────┬───────────────────────┘
       │
       v
┌──────────────────────────────┐
│ Look up technician's          │
│ GoCanvas user ID by email     │
│ GET /api/v3/users             │
└──────┬───────────────────────┘
       │
       v
┌──────────────────────────────┐
│ Build dispatch payload        │
│ - Map ECS fields to           │
│   GoCanvas entry IDs          │
│ - Include assignee_id         │
└──────┬───────────────────────┘
       │
       v
┌──────────────────────────────┐
│ POST /api/v3/dispatches       │
│ (BEFORE updating database)    │
└──────┬───────────────────────┘
       │
       ├─── SUCCESS ──> Update job state in database
       │                Return success to frontend
       │
       └─── FAILURE ──> Return error to frontend
                        DO NOT update database
```

### Inbound Flow (GoCanvas → ECS)

```
┌────────────────────────┐
│ Technician fills out   │
│ form in GoCanvas app   │
└───────┬────────────────┘
        │
        v
┌────────────────────────┐
│ Form saved/submitted   │
│ in GoCanvas            │
└───────┬────────────────┘
        │
        │ (Waits for next polling cycle)
        v
┌────────────────────────────────┐
│ ECS polling service (every 30s)│
│ GET /api/v3/submissions?form_id│
└───────┬────────────────────────┘
        │
        v
┌────────────────────────────────┐
│ Find completed submissions     │
│ (up to 100 most recent)        │
└───────┬────────────────────────┘
        │
        v
┌────────────────────────────────┐
│ For each completed submission: │
│ GET /api/v3/submissions/{id}   │
│ Check if Job ID field matches  │
└───────┬────────────────────────┘
        │
        ├─── MATCH FOUND ──> Parse submission data
        │                     Extract timestamps
        │                     Update job state in database
        │                     Create job event
        │                     Update turnaround times
        │                     Sync to Google Sheets
        │
        └─── NO MATCH ──> Continue to next submission
```

---

## Limitations & Known Issues

### 1. **100 Submission Limit (Pagination Not Implemented)**

**Issue:** GoCanvas returns only the first 100 submissions per form. ECS Connect does not paginate through older submissions.

**Impact:**
- If a job is completed after 100+ newer submissions exist, it will never be detected
- High-volume operations risk missing completed jobs

**Workaround:** None currently implemented

**Fix Needed:** Implement pagination to check all submissions, not just first page

---

### 2. **No Rate Limit Monitoring**

**Issue:** The system does not check or log `RateLimit-*` headers from GoCanvas

**Impact:**
- Can't predict when rate limit will be hit
- No automatic backoff or retry logic
- Users experience sudden failures

**Fix Needed:** 
- Log rate limit headers on each API call
- Implement exponential backoff
- Add circuit breaker pattern

---

### 3. **Duplicate Dispatches on Error**

**Issue:** If check-in button is clicked multiple times before modal closes, multiple dispatches are created in GoCanvas

**Impact:**
- Creates duplicate work orders for technicians
- Confuses job tracking

**Status:** **FIXED** (as of November 14, 2025)
- Added safe error checking for non-string values
- Button now properly disabled during submission

---

### 4. **30-Second Delay in Status Updates**

**Issue:** Job state changes in GoCanvas are only detected on next polling cycle (up to 30 seconds later)

**Impact:**
- Dashboard and job list show stale data for up to 30 seconds
- CSRs may not see immediate feedback

**Workaround:** Frontend polls every 30 seconds to refresh data

**Alternatives:**
- Reduce polling interval (increases API calls, risks rate limiting)
- Implement webhooks (if GoCanvas supports them)

---

### 5. **Concurrent API Calls During Polling**

**Issue:** The polling service makes multiple API calls in parallel:
- 3 submissions list calls (one per form)
- Multiple detail calls for each completed submission

**Impact:**
- Increases rate limit consumption
- May hit rate limits during high-volume periods

**Fix Needed:** 
- Add sequential processing with delays
- Batch requests intelligently
- Implement request queuing

---

### 6. **No Retry Logic**

**Issue:** If a GoCanvas API call fails (network error, timeout, etc.), it's not retried

**Impact:**
- Transient errors can cause jobs to be missed
- Manual intervention required to recover

**Fix Needed:**
- Implement exponential backoff retry logic
- Add dead letter queue for failed checks
- Alert on repeated failures

---

### 7. **Dry Run Mode Not Fully Tested**

**Issue:** `GOCANVAS_DRY_RUN=true` mode skips API calls but may not accurately simulate all scenarios

**Impact:**
- Difficult to test without hitting real GoCanvas API
- Can't validate changes without production impact

---

## Recommendations

### Immediate (High Priority)

1. **Implement Pagination**
   - Modify `checkSubmissionStatusForForm()` to check all pages, not just first 100
   - Use `Link` headers from GoCanvas to navigate pages

2. **Add Rate Limit Monitoring**
   - Log `RateLimit-*` headers on every API call
   - Display remaining quota in admin dashboard
   - Alert when approaching limit

3. **Implement Retry Logic**
   - Use exponential backoff for failed API calls
   - Retry transient errors (network, timeout)
   - Don't retry 4xx errors (bad request, auth)

### Medium Priority

4. **Optimize Polling Strategy**
   - Reduce concurrent API calls
   - Add delays between requests
   - Consider adaptive polling (faster when jobs are active)

5. **Add Circuit Breaker**
   - Stop making API calls if rate limit hit
   - Automatically resume after reset time
   - Prevent cascading failures

6. **Improve Error Messages**
   - Parse GoCanvas error responses
   - Show user-friendly messages
   - Include actionable next steps

### Long-Term

7. **Investigate Webhooks**
   - Check if GoCanvas supports webhook notifications
   - Would eliminate need for polling
   - Reduce API call volume by 90%+

8. **Add Request Queuing**
   - Queue all GoCanvas API calls
   - Process sequentially with rate limiting
   - Provide visibility into queue depth

9. **Implement Caching**
   - Cache user ID lookups (email → GoCanvas user ID)
   - Cache form field mappings
   - Reduce redundant API calls

---

## Summary Statistics

| Metric | Value |
|--------|-------|
| **Polling Interval** | 30 seconds |
| **Forms Monitored** | 3 (Emissions, Pickup, Delivery) |
| **API Calls Per Cycle** | 10-300 (varies by submission count) |
| **API Calls Per Hour** | 1,200 - 24,000 |
| **Authentication Method** | HTTP Basic Auth |
| **Pagination Support** | No (first 100 only) |
| **Rate Limit Monitoring** | No |
| **Retry Logic** | No |
| **Webhook Support** | No |

---

**End of Report**
