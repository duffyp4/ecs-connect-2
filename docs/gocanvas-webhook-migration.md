# GoCanvas Push Notification Migration Plan
**Migration from Polling to Push-First Architecture**

**Date**: November 14, 2025  
**Status**: Analysis Phase - No Implementation Yet  
**Author**: Technical Architecture Planning  
**Updated**: November 14, 2025 - Corrected based on GoCanvas API v2 Documentation

---

## Executive Summary

This document outlines the migration plan to transition ECS Connect's GoCanvas integration from a 30-second polling-based architecture to a push notification-driven system using GoCanvas's **Submission Push Notifications** feature (API v2).

The change will reduce API calls by ~95%, improve job completion detection latency from 30 seconds to <5 seconds, and eliminate rate limit risks from excessive polling.

**Expected Impact**:
- **API Call Reduction**: From ~2,160-28,800 calls/day to ~50-150 calls/day
- **Latency Improvement**: Job state updates detected in <5 seconds (vs. 0-30 seconds)
- **Cost Reduction**: Reduced rate limit exposure and infrastructure load
- **Reliability**: Real-time notifications eliminate polling gaps

**Important Note**: GoCanvas push notifications send **metadata only** (form ID, submission GUID, dispatch ID). The full submission data must still be fetched via API, resulting in 1 API call per job completion instead of polling all submissions every 30 seconds.

---

## 1. Current State Analysis

### 1.1 Polling Implementation

**Location**: `server/services/jobTracker.ts`

**Current Architecture**:
```typescript
// Poll interval: 30 seconds
private readonly POLL_INTERVAL_MS = 30000;

// Three polling checks per cycle:
checkPendingJobs() {
  1. Check pickup form completions (queued_for_pickup → picked_up)
     - Form ID: 5640587 (Pickup Log)
     
  2. Check service form completions (at_shop/in_service → service_complete)
     - Form ID: 5654184 (Emissions Service Log)
     
  3. Check delivery form completions (queued_for_delivery → delivered)
     - Form ID: 5657146 (Delivery Log)
}
```

**API Call Pattern per Poll Cycle**:
1. Fetch submission list for Pickup form: `GET /apiv2/submissions.xml?form_id=5640587` (max 100 submissions)
2. For each completed submission: `GET /apiv2/submissions/{id}.xml` (detailed data)
3. Search through submission responses to find Job ID match
4. Repeat steps 1-3 for Emissions form (5654184)
5. Repeat steps 1-3 for Delivery form (5657146)

**Cost Analysis**:
- **Polls per day**: 2,880 (24 hours × 60 minutes × 2 polls/min)
- **Forms checked per poll**: 3
- **Minimum API calls per poll**: 3 (if no submissions)
- **Typical API calls per poll**: 3-10 (list + detail fetches for completed submissions)
- **Daily API calls**: ~2,160 - 28,800 calls (depending on submission volume)

### 1.2 Job Completion Flow

**Current Process**:
```
1. Polling loop detects completed submission
   ↓
2. checkSubmissionStatusForForm() searches for Job ID in submission fields
   ↓
3. On match, extract metadata (submittedAt, submissionId)
   ↓
4. Call jobEventsService to transition job state:
   - markPickedUp()
   - transitionJobState('in_service')
   - transitionJobState('service_complete')
   - markDelivered()
   ↓
5. Update job timestamps in database
   ↓
6. Record event in JobEvents table
   ↓
7. Trigger Google Sheets sync (for completed jobs)
```

**State Transitions Detected by Polling**:
- `queued_for_pickup` → `picked_up` (Pickup form completion)
- `at_shop` → `in_service` → `service_complete` (Emissions form in_progress/completed)
- `queued_for_delivery` → `delivered` (Delivery form completion)

### 1.3 GoCanvas API Metrics Tracking

**Observability Infrastructure**:
- All API calls wrapped with `rawGoCanvasRequest()` wrapper
- In-memory metrics tracked: `goCanvasMetrics` object
- Metrics exposed via: `GET /api/metrics/gocanvas` (admin-only)
- Tracked data:
  - Total API calls
  - Calls by HTTP status code
  - Rate limit hits (429 responses)
  - Rate limit headers (limit, remaining, reset)

**Current Metrics Endpoint** (Admin Dashboard):
```json
{
  "totalCalls": 5432,
  "byStatus": { "200": 5200, "404": 32, "429": 0 },
  "rateLimitHits": 0,
  "lastRateLimitRemaining": "4876",
  "lastRateLimitLimit": "5000"
}
```

---

## 2. GoCanvas Push Notification Architecture

### 2.1 Submission Push Notifications (API v2)

**GoCanvas Feature**: Submission Push Notifications  
**Documentation**: GoCanvas Web Services v2 (Page 41-42)  
**API Version**: v2 (XML-based)

**How It Works**:
1. Configure a webhook URL per form in GoCanvas web UI ("Integration Options")
2. When a submission is uploaded, GoCanvas sends an HTTP POST with XML metadata
3. Your endpoint receives **metadata only** (not full submission data)
4. Your endpoint must fetch full submission data via `GET /apiv2/submissions/{id}.xml`
5. Extract Job ID and process state transition

**Key Characteristics**:
- **Format**: XML (not JSON)
- **Content**: Metadata only (form ID, submission GUID, dispatch item ID)
- **No Authentication**: No signature verification mentioned in documentation
- **Retry Logic**: Built-in (15-min intervals, up to 10 attempts)
- **Response Requirement**: HTTP 200-205 status code (no redirects)
- **Setup**: Per-form configuration in GoCanvas web UI

**GoCanvas Push Notification Payload**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<submission-notification>
  <form>
    <id type="integer">5654184</id>
    <name>Emissions Service Log</name>
    <guid>FORM_GUID_HERE</guid>
    <tag></tag>
  </form>
  <submission>
    <id type="integer">123456</id>
    <guid>SUBMISSION_GUID_HERE</guid>
  </submission>
  <dispatch-item>
    <id type="integer">789</id>
  </dispatch-item>
</submission-notification>
```

**Important**: This payload contains **no field data** - just identifiers. To get Job ID and other fields, we must fetch the full submission:

```
GET https://www.gocanvas.com/apiv2/submissions/{submission_id}.xml
```

### 2.2 Two-Step Processing Flow

**New Architecture** (Push Notifications):
```
1. GoCanvas sends XML notification to our endpoint
   ↓
2. Parse XML → extract form_id and submission_id
   ↓
3. Fetch full submission data:
   GET /apiv2/submissions/{submission_id}.xml
   ↓
4. Search submission responses for Job ID field
   ↓
5. Route to appropriate handler based on form_id:
   - 5640587 (Pickup) → handlePickupCompletion()
   - 5654184 (Emissions) → handleServiceCompletion()
   - 5657146 (Delivery) → handleDeliveryCompletion()
   ↓
6. Call jobEventsService to transition job state
   ↓
7. Update job timestamps in database
   ↓
8. Record event in JobEvents table
   ↓
9. Trigger Google Sheets sync (if job completed)
```

**API Calls per Job Completion**:
- **Old (polling)**: 3 list calls + N detail calls per 30 seconds (wasteful)
- **New (push)**: 1 detail call per job completion (efficient)

### 2.3 Push Notification Endpoint Design

**Endpoint Location**: `server/routes.ts`

**Route**: `POST /api/gocanvas/push-notification`

**Implementation Strategy**:
```typescript
// Push notification receiver (no auth - GoCanvas doesn't support signature verification in v2)
app.post('/api/gocanvas/push-notification', async (req, res) => {
  try {
    // 1. IMMEDIATE RESPONSE (acknowledge receipt)
    // GoCanvas expects 200-205 status code (treats others as failure)
    res.status(200).send('OK');
    
    // 2. ASYNC PROCESSING (process after response sent)
    setImmediate(async () => {
      try {
        await pushNotificationService.processGoCanvasPushNotification(
          req.body,
          req.headers['content-type']
        );
      } catch (error) {
        console.error('Push notification processing error:', error);
        // Log to monitoring system (do not throw - response already sent)
      }
    });
  } catch (error) {
    // Only network/parsing errors reach here
    res.status(500).send('Internal error');
  }
});
```

**XML Parsing**:
```typescript
import { parseStringPromise } from 'xml2js';

async function parseNotificationXML(xmlBody: string) {
  const result = await parseStringPromise(xmlBody, {
    explicitArray: false,
    mergeAttrs: true,
    trim: true,
  });
  
  return {
    formId: result['submission-notification'].form.id,
    formName: result['submission-notification'].form.name,
    formGuid: result['submission-notification'].form.guid,
    submissionId: result['submission-notification'].submission.id,
    submissionGuid: result['submission-notification'].submission.guid,
    dispatchItemId: result['submission-notification']['dispatch-item']?.id,
  };
}
```

### 2.4 Push Notification Processing Service

**New Service**: `server/services/pushNotification.ts`

**Core Responsibilities**:
1. **XML Parsing**: Parse GoCanvas notification payload
2. **Idempotency**: Prevent duplicate processing (track submission IDs)
3. **Submission Fetching**: Call GoCanvas API to get full submission data
4. **Form Routing**: Route to correct handler based on `form_id`
5. **Job ID Extraction**: Search submission responses for Job ID field
6. **State Transition**: Call appropriate jobEventsService method

**Idempotency Implementation**:
```typescript
// In-memory cache for recent submission IDs (with TTL)
const processedSubmissions = new Map<string, number>();
const CACHE_TTL_MS = 3600000; // 1 hour

async function processGoCanvasPushNotification(
  xmlBody: string,
  contentType?: string
) {
  // 1. Parse XML notification
  const notification = await parseNotificationXML(xmlBody);
  const submissionId = notification.submissionId;
  
  // 2. Idempotency check
  if (processedSubmissions.has(submissionId)) {
    console.log(`Duplicate notification for submission ${submissionId}, skipping`);
    return;
  }
  
  // 3. Mark as processed
  processedSubmissions.set(submissionId, Date.now());
  
  // 4. Clean up expired entries
  cleanupExpiredEntries();
  
  // 5. Fetch full submission data
  const submissionData = await goCanvasService.getSubmissionById(submissionId);
  
  // 6. Process submission
  await handleSubmissionCompleted(notification.formId, submissionData);
}
```

**Fetching Full Submission Data**:
```typescript
// Add to goCanvasService
async getSubmissionByIdV2(submissionId: string): Promise<any> {
  const response = await rawGoCanvasRequest(
    `/apiv2/submissions/${submissionId}.xml`,
    {
      headers: {
        'Authorization': this.getAuthHeader(),
      },
    }
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch submission ${submissionId}: ${response.status}`);
  }
  
  const xmlData = await response.text();
  const parsed = await parseStringPromise(xmlData);
  
  // Convert XML structure to same format as existing checkSubmissionStatusForForm
  return {
    id: submissionId,
    status: 'completed', // Notifications are only sent on upload (completed)
    submitted_at: parsed.Submission?.Date?.[0],
    responses: extractResponsesFromXML(parsed),
  };
}
```

**Form-Based Routing**:
```typescript
async function handleSubmissionCompleted(
  formId: string,
  submissionData: any
) {
  // Extract Job ID from submission responses
  const jobId = extractJobId(submissionData.responses);
  if (!jobId) {
    console.warn('No Job ID found in submission:', submissionData.id);
    return;
  }
  
  // Route to appropriate handler
  switch (formId) {
    case '5640587': // Pickup Log
      await handlePickupCompletion(jobId, submissionData);
      break;
      
    case '5654184': // Emissions Service Log
      await handleServiceCompletion(jobId, submissionData);
      break;
      
    case '5657146': // Delivery Log
      await handleDeliveryCompletion(jobId, submissionData);
      break;
      
    default:
      console.warn('Unknown form ID in push notification:', formId);
  }
}
```

**Job ID Extraction** (reuse existing logic):
```typescript
function extractJobId(responses: any[]): string | null {
  // Search for field labeled "Job ID" containing ECS-formatted ID
  const jobIdField = responses.find(r => 
    r.label?.toLowerCase().includes('job') && 
    r.value?.startsWith('ECS-')
  );
  
  return jobIdField?.value || null;
}
```

### 2.5 GoCanvas Built-in Retry Logic

**From Documentation** (Page 42):
- **First failure**: GoCanvas waits 15 minutes, then retries
- **Subsequent failures**: Adds +15 minutes to wait time each retry
- **Max retries**: 10 attempts
- **After 10 failures**: Email sent to account admin automatically
- **Success criteria**: HTTP status code 200-205
- **Failure criteria**: Any status code outside 200-205 range (including redirects)

**Important**: GoCanvas does **not** follow HTTP redirects. Redirects are treated as failures.

**Our Response Strategy**:
```typescript
// Always return 200 immediately
res.status(200).send('OK');

// Process asynchronously (errors won't affect response)
setImmediate(async () => {
  // If this fails, GoCanvas doesn't know and won't retry
  // But we log errors for monitoring
});
```

---

## 3. Hybrid Architecture (Transition Phase)

### 3.1 Feature Flag System

**Environment Variable**: `PUSH_NOTIFICATION_MODE`

**Modes**:
- `polling` - Legacy mode (polling only, no push notifications)
- `hybrid` - Push notifications primary, polling as backup (reduced interval)
- `push` - Push notifications only, polling disabled

**Implementation**:
```typescript
// server/services/jobTracker.ts
startPolling(): void {
  const mode = process.env.PUSH_NOTIFICATION_MODE || 'polling';
  
  if (mode === 'push') {
    console.log('Push notification mode: polling disabled');
    return;
  }
  
  if (mode === 'hybrid') {
    // Reduce polling frequency (safety net only)
    this.POLL_INTERVAL_MS = 300000; // 5 minutes
    console.log('Hybrid mode: polling reduced to 5-minute intervals');
  } else {
    // Default: 30 seconds (current behavior)
    this.POLL_INTERVAL_MS = 30000;
  }
  
  // Start polling
  this.pollingInterval = setInterval(() => {
    this.checkPendingJobs();
  }, this.POLL_INTERVAL_MS);
}
```

### 3.2 Push Notification Fallback Logic

**Scenario**: Push notification fails or is delayed > 2 minutes

**Fallback Strategy**:
1. Push notification endpoint tracks last successful notification timestamp per form
2. If no notification received for a job state in > 2 minutes, polling catches it
3. Polling checks if state was already updated by push notification (idempotent)

**Implementation**:
```typescript
// Track last push notification received per form
const lastPushNotificationByForm = new Map<string, number>();

// In push notification handler
function recordPushNotificationReceipt(formId: string) {
  lastPushNotificationByForm.set(formId, Date.now());
}

// In polling logic
async function checkPendingJobs() {
  const mode = process.env.PUSH_NOTIFICATION_MODE || 'polling';
  
  if (mode === 'hybrid') {
    // Only poll forms that haven't received a notification recently
    const twoMinutesAgo = Date.now() - 120000;
    
    for (const [formId, lastNotification] of lastPushNotificationByForm) {
      if (lastNotification < twoMinutesAgo) {
        console.warn(`No push notification for form ${formId} in 2+ minutes, polling as backup`);
      }
    }
  }
  
  // Continue with existing polling logic...
}
```

---

## 4. Rollout Plan

### 4.1 Phase 1: Development & Testing (2-3 days)

**Goal**: Implement push notification infrastructure without changing production behavior

**Tasks**:
1. **Install XML parser dependency**:
   ```bash
   npm install xml2js
   npm install --save-dev @types/xml2js
   ```

2. **Create push notification service** (`server/services/pushNotification.ts`)
   - XML parsing with xml2js
   - Idempotency cache
   - Submission fetching logic
   - Form routing logic
   - Job ID extraction (reuse existing)

3. **Add API v2 submission fetch** to `goCanvasService`
   - `getSubmissionByIdV2(submissionId: string)`
   - XML parsing and response normalization
   - Integrate with existing rawGoCanvasRequest wrapper

4. **Add push notification endpoint** (`POST /api/gocanvas/push-notification`)
   - Immediate 200 response
   - Async processing with setImmediate()
   - XML content-type handling

5. **Add environment variable**:
   ```bash
   PUSH_NOTIFICATION_MODE=polling  # Default (no changes)
   ```

6. **Testing**:
   - Unit tests for XML parsing
   - Unit tests for idempotency logic
   - Mock push notification payload testing
   - Manual testing with webhook.site or similar

**Deployment**:
- Deploy to development environment
- **No production impact** (endpoint exists but polling still active)

### 4.2 Phase 2: GoCanvas Configuration (15 minutes)

**Goal**: Configure push notifications in GoCanvas UI for all 3 forms

**Per-Form Setup** (repeat for each form):

1. **Log into GoCanvas** web interface
2. **Navigate to form**:
   - Pickup Log (Form ID: 5640587)
   - Emissions Service Log (Form ID: 5654184)
   - Delivery Log (Form ID: 5657146)
3. **Open "Integration Options"** section
4. **Activate Custom Integration**:
   - Click "Activate" button (may need to deactivate existing integrations)
   - Enter URL: `https://ecs-connect.replit.app/api/gocanvas/push-notification`
   - Optional tag: (leave empty or use form name for debugging)
5. **Test the endpoint**:
   - Click "Test" button
   - Verify 200 status code response
   - Check server logs for test notification receipt
6. **Save configuration**

**Important Notes**:
- GoCanvas only allows **one integration per form** at a time
- If other integrations (e.g., Salesforce) are active, they must be deactivated first
- Test button sends sample metadata - use this to validate XML parsing

### 4.3 Phase 3: Hybrid Mode Validation (1-2 weeks)

**Goal**: Enable push notifications alongside polling for validation

**Tasks**:
1. **Set environment variable**:
   ```bash
   PUSH_NOTIFICATION_MODE=hybrid
   ```

2. **Monitor dual processing**:
   - Track push notification processing times
   - Compare push vs. polling detection times
   - Monitor for duplicate state transitions (should be prevented by idempotency)
   - Watch GoCanvas API metrics for reduced call volume

3. **Add push notification metrics to Admin Dashboard**:
   ```typescript
   // server/services/pushNotification.ts
   export const pushNotificationMetrics = {
     totalReceived: 0,
     totalProcessed: 0,
     duplicatesIgnored: 0,
     errors: 0,
     byForm: {} as Record<string, number>,
     averageProcessingTime: 0,
     lastReceivedByForm: {} as Record<string, string>,
   };
   ```

4. **Observability**:
   - Add push notification status panel to Admin Dashboard
   - Compare API call volume (before/after metrics)
   - Monitor job completion latency

**Validation Criteria** (must be met before Phase 4):
- ✅ All push notifications received successfully (>99% success rate)
- ✅ No duplicate job state transitions detected
- ✅ Push notification latency < 5 seconds for job updates
- ✅ API call volume reduced by >80% (from ~2,160/day to <400/day)
- ✅ No jobs missed by push notifications (polling as safety net catches zero jobs)

**Duration**: Run for 1-2 weeks to validate across different submission volumes

### 4.4 Phase 4: Push-Only Mode (After validation)

**Goal**: Disable polling, rely 100% on push notifications

**Tasks**:
1. **Set environment variable**:
   ```bash
   PUSH_NOTIFICATION_MODE=push
   ```

2. **Remove polling infrastructure** (optional cleanup after 30 days):
   - Archive `jobTracker.ts` (keep for reference)
   - Remove polling startup code from `server/routes.ts`
   - Remove polling interval logic

3. **Final API metrics check**:
   - Expected: ~50-150 calls/day (1 fetch per job completion + reference data sync + dispatches)
   - Reduction: ~95% from original polling load

**Rollback Plan**:
If issues arise in push-only mode:
1. Set `PUSH_NOTIFICATION_MODE=hybrid` (re-enable polling)
2. Investigate push notification delivery failures
3. Fix issues before re-attempting push-only

---

## 5. Risk Assessment & Mitigation

### 5.1 Identified Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Push notification delivery failures** | High - Jobs not updated | Low | Hybrid mode with polling fallback + GoCanvas built-in retry (10 attempts) |
| **Duplicate processing** | Medium - Double state transitions | Medium | Idempotency cache with submission ID tracking |
| **GoCanvas push notification downtime** | High - No job updates | Low | Polling fallback in hybrid mode |
| **No signature verification** | Medium - Unauthorized notifications | Low | Monitor for suspicious patterns, restrict by IP if needed |
| **Submission ID not found in notification** | Medium - Missed job updates | Low | Logging + fallback to polling |
| **Job ID not found in fetched submission** | Medium - Missed job updates | Low | Logging + fallback to polling |
| **Memory leak (idempotency cache)** | Low - Server performance | Medium | TTL-based cache cleanup (1 hour expiry) |
| **XML parsing failures** | Medium - Notifications rejected | Low | Error handling + retry via GoCanvas built-in logic |

### 5.2 Rollback Strategy

**Immediate Rollback** (if critical issues detected):
1. Set `PUSH_NOTIFICATION_MODE=polling` via environment variable
2. Restart application (Replit auto-restart on env change)
3. Polling resumes with 30-second intervals
4. No code changes required

**Gradual Rollback** (if partial issues):
1. Set `PUSH_NOTIFICATION_MODE=hybrid` (keep push notifications, add polling safety net)
2. Investigate push notification failures in logs
3. Fix issues and re-test before returning to push-only

**GoCanvas Configuration Rollback**:
1. Log into GoCanvas web interface
2. Navigate to form "Integration Options"
3. Deactivate custom integration
4. Polling will continue to work (already enabled via feature flag)

---

## 6. Technical Implementation Details

### 6.1 New Dependencies

**npm packages**:
```bash
npm install xml2js
npm install --save-dev @types/xml2js
```

### 6.2 New Files to Create

**1. `server/services/pushNotification.ts`** (~250 lines)
- XML parsing (xml2js)
- Idempotency cache management
- Submission fetching via GoCanvas API
- Form routing and job ID extraction
- Integration with jobEventsService
- Metrics tracking

**2. `server/pushNotificationMetrics.ts`** (~50 lines)
- Push notification-specific metrics (separate from GoCanvas API metrics)
- Tracking notifications received, processed, errors

### 6.3 Files to Modify

**1. `server/routes.ts`** (+30 lines)
- Add `POST /api/gocanvas/push-notification` endpoint (no auth)
- Add `GET /api/metrics/push-notifications` endpoint (admin-only)

**2. `server/services/gocanvas.ts`** (+60 lines)
- Add `getSubmissionByIdV2(submissionId: string)` method
- XML parsing for API v2 submissions
- Response normalization

**3. `server/services/jobTracker.ts`** (+15 lines)
- Add PUSH_NOTIFICATION_MODE environment variable check
- Adjust polling interval based on mode
- Add push notification timestamp tracking for fallback logic

**4. `.env` / Replit Secrets** (+1 secret)
- `PUSH_NOTIFICATION_MODE`: polling|hybrid|push

**5. `client/src/pages/admin.tsx`** (+50 lines)
- Add "Push Notification Health" panel to Integration Health tab
- Display push notification metrics (received, processed, errors)
- Display push notification mode status
- Show last notification received timestamp per form

**6. `package.json`** (automatic via npm install)
- Add xml2js dependency
- Add @types/xml2js dev dependency

### 6.4 Database Changes

**Option 1: In-Memory Cache (Recommended for MVP)**
- Use `Map<string, number>` for submission ID tracking
- TTL-based cleanup (1 hour)
- No database changes required
- Limitation: Lost on server restart (acceptable - duplicate processing is idempotent)

**Option 2: Database-Backed (Future Enhancement)**
- Add `processed_push_notifications` table
- Columns: submission_id, form_id, processed_at
- Cleanup old records with daily cron job
- Benefit: Survives server restarts

**Recommendation**: Start with Option 1 (in-memory), migrate to Option 2 if needed

### 6.5 Monitoring & Observability

**Admin Dashboard Enhancements**:
1. **Push Notification Health Panel**:
   - Total notifications received (last 24h)
   - Success/error rate
   - Average processing time
   - Last notification received timestamp per form
   - Current mode (polling/hybrid/push)

2. **GoCanvas API Metrics Panel** (existing):
   - API call volume comparison (before/after)
   - Rate limit utilization

**Alerts** (future enhancement):
- No push notification received for form in > 5 minutes
- Push notification error rate > 1%
- Polling fallback triggered in hybrid mode

---

## 7. API Call Comparison

### 7.1 Current State (Polling)

**Per 30 seconds**:
- 3 form list calls: `GET /apiv2/submissions.xml?form_id={id}` (×3)
- N detail calls for completed submissions: `GET /apiv2/submissions/{id}.xml` (×N)

**Daily estimates**:
- **Minimum**: 3 calls/poll × 2,880 polls = 8,640 calls/day
- **With 5 completions/day**: 8,640 + (5 × 3) = 8,655 calls/day
- **With 20 completions/day**: 8,640 + (20 × 3) = 8,700 calls/day

### 7.2 New State (Push Notifications)

**Per job completion**:
- 1 push notification received (free - no API call)
- 1 detail call to fetch submission: `GET /apiv2/submissions/{id}.xml`

**Daily estimates** (assuming 20 job completions/day):
- **Job completions**: 20 calls/day
- **Dispatches**: ~20 calls/day (unchanged)
- **Reference data sync**: ~10 calls/day (unchanged)
- **Total**: ~50 calls/day

**Reduction**: From ~8,700 calls/day to ~50 calls/day = **99.4% reduction**

---

## 8. Testing Strategy

### 8.1 Unit Tests

**pushNotification.ts Tests**:
- ✅ XML parsing (valid/invalid XML)
- ✅ Idempotency (duplicate submission IDs ignored)
- ✅ Job ID extraction (various field label formats)
- ✅ Form routing (correct handler for each form ID)

**Integration Tests**:
- ✅ Mock push notification → fetch submission → job state update
- ✅ Push notification + polling (no duplicate transitions)

### 8.2 Manual Testing Checklist

**Development Environment**:
- [ ] Send mock push notification payload (valid XML)
- [ ] Verify submission fetched from GoCanvas API
- [ ] Verify job state updated in database
- [ ] Verify event recorded in JobEvents table
- [ ] Send duplicate notification (should be ignored)
- [ ] Test all 3 form types (Pickup, Emissions, Delivery)
- [ ] Test XML parsing error handling

**GoCanvas Configuration** (production):
- [ ] Configure push notification for Pickup form (5640587)
- [ ] Configure push notification for Emissions form (5654184)
- [ ] Configure push notification for Delivery form (5657146)
- [ ] Use "Test" button to verify endpoint responds with 200
- [ ] Check server logs for test notification receipt

**Hybrid Mode Validation** (production):
- [ ] Monitor push notification delivery for 24 hours
- [ ] Verify no polling fallback triggered
- [ ] Check API call reduction in GoCanvas metrics
- [ ] Confirm no duplicate state transitions

**Push-Only Mode** (production):
- [ ] Disable polling, monitor for 48 hours
- [ ] Verify all jobs updated correctly
- [ ] Check job completion latency (<5 seconds)
- [ ] Confirm API calls reduced by ~95%

---

## 9. Success Metrics

### 9.1 Quantitative Goals

| Metric | Current (Polling) | Target (Push) | Measurement |
|--------|-------------------|---------------|-------------|
| **API Calls per Day** | ~8,640 - 28,800 | <150 | GoCanvas API metrics |
| **Job Update Latency** | 0-30 seconds (avg 15s) | <5 seconds | Event timestamp - submission timestamp |
| **Rate Limit Headroom** | Low (high call volume) | High (minimal calls) | Rate limit remaining header |
| **Server Load** | High (constant polling) | Low (event-driven) | CPU/memory metrics |

### 9.2 Qualitative Goals

- ✅ **Reliability**: Zero missed job completions
- ✅ **Observability**: Clear metrics for push notification health
- ✅ **Maintainability**: Reduced complexity (fewer API calls to debug)
- ✅ **Scalability**: No polling bottleneck as job volume grows

---

## 10. Timeline Summary

| Phase | Duration | Key Milestone |
|-------|----------|---------------|
| **Phase 1: Development** | 2-3 days | Push notification endpoint deployed (polling still active) |
| **Phase 2: GoCanvas Config** | 15 minutes | Push notifications configured for all 3 forms |
| **Phase 3: Hybrid Mode** | 1-2 weeks | Push notifications validated, API calls reduced by 95% |
| **Phase 4: Push-Only** | Ongoing | Polling disabled, 99% API call reduction |

**Total Estimated Time**: 2-3 weeks (development + validation)

---

## 11. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-11-14 | Use GoCanvas Submission Push Notifications (API v2) | Official feature, built-in retry logic, proven reliability |
| 2025-11-14 | Use in-memory idempotency cache | Simpler implementation, acceptable duplicate risk on restart |
| 2025-11-14 | Hybrid mode with 5-minute polling | Safety net during validation period |
| 2025-11-14 | Immediate 200 response + async processing | Prevents notification timeout, leverages GoCanvas retry |
| 2025-11-14 | Two-step flow (notification → fetch) | Required - push notification contains metadata only |
| 2025-11-14 | Per-form manual configuration | GoCanvas UI-based setup, one integration per form limit |

---

## 12. Next Steps (Implementation Phase)

**After approval of this migration plan**:

1. **Create feature branch**: `feature/gocanvas-push-notifications`
2. **Install XML parser**: `npm install xml2js @types/xml2js`
3. **Implement push notification service** (`server/services/pushNotification.ts`)
4. **Add submission fetch v2** to goCanvasService
5. **Add push notification endpoint** (`server/routes.ts`)
6. **Add environment variable** (PUSH_NOTIFICATION_MODE=polling)
7. **Write unit tests** (XML parsing, idempotency)
8. **Deploy to development** (test with mock payloads)
9. **Configure push notifications in GoCanvas UI** (all 3 forms)
10. **Enable hybrid mode** (PUSH_NOTIFICATION_MODE=hybrid)
11. **Monitor for 1-2 weeks** (validate metrics, no issues)
12. **Switch to push-only** (PUSH_NOTIFICATION_MODE=push)
13. **Monitor for 1 week** (confirm no issues)
14. **Archive polling code** (cleanup after 30 days of stable operation)

---

## Appendix A: GoCanvas Push Notification Setup

**Per-Form Configuration** (repeat for each of 3 forms):

1. **Login to GoCanvas** web interface
2. **Navigate to form**:
   - Pickup Log (Form ID: 5640587)
   - Emissions Service Log (Form ID: 5654184)  
   - Delivery Log (Form ID: 5657146)
3. **Go to "Integration Options"** section
4. **Click "Activate"** button (under GoCanvas logo, right of Salesforce Integration)
   - Note: Only one integration can be active per form
   - If another integration is active, deactivate it first
5. **Enter configuration**:
   - **URL**: `https://ecs-connect.replit.app/api/gocanvas/push-notification`
   - **Tag** (optional): Leave empty or use form name for debugging
6. **Click "Test"** button:
   - GoCanvas sends sample metadata to your URL
   - Displays response status, headers, body
   - Verify 200 status code
7. **Check server logs** for test notification receipt
8. **Click "Save"** to activate push notifications

**Important**:
- Test button is crucial for validation before going live
- Push notifications start immediately after clicking Save
- Can deactivate anytime by deleting the integration

---

## Appendix B: Sample Push Notification XML

**Actual payload from GoCanvas** (based on documentation):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<submission-notification>
  <form>
    <id type="integer">5654184</id>
    <name>Emissions Service Log</name>
    <guid>abc123-form-guid-xyz789</guid>
    <tag></tag>
  </form>
  <submission>
    <id type="integer">987654</id>
    <guid>def456-submission-guid-uvw012</guid>
  </submission>
  <dispatch-item>
    <id type="integer">111222</id>
  </dispatch-item>
</submission-notification>
```

**What we do with this**:
1. Parse XML → extract `submission.id = 987654`
2. Fetch full data: `GET /apiv2/submissions/987654.xml`
3. Parse submission XML → find Job ID field
4. Route based on `form.id = 5654184` → Emissions handler
5. Process job state transition

---

## Appendix C: GoCanvas API v2 Submission Fetch

**Endpoint**:
```
GET https://www.gocanvas.com/apiv2/submissions/{submission_id}.xml
```

**Authentication**: Basic Auth (username + password)

**Sample Response** (abbreviated):
```xml
<?xml version="1.0" encoding="utf-8"?>
<CanvasResult>
  <Submission Id="987654" Department="Service Department">
    <Form Id="5654184">
      <Name>Emissions Service Log</Name>
      <Status>active</Status>
      <Version>12</Version>
    </Form>
    <Date>2025.11.14 15:30:00</Date>
    <DeviceDate>2025.11.14 15:29:45</DeviceDate>
    <UserName>tech@ecsconnect.com</UserName>
    <ResponseID>unique-response-id-here</ResponseID>
    <SubmissionStatus>Completed</SubmissionStatus>
    <Sections>
      <Section>
        <Name>Check-In</Name>
        <Screens>
          <Screen>
            <Name>Job Information</Name>
            <Responses>
              <Response Guid="field-guid-1">
                <Label>Job ID</Label>
                <Value>ECS-20251114153000-3001</Value>
                <Type>Text</Type>
              </Response>
              <Response Guid="field-guid-2">
                <Label>Customer Name</Label>
                <Value>ABC Auto Parts</Value>
                <Type>Text</Type>
              </Response>
              <!-- More responses... -->
            </Responses>
          </Screen>
        </Screens>
      </Section>
    </Sections>
  </Submission>
</CanvasResult>
```

**What we extract**:
- Job ID: `ECS-20251114153000-3001` (from Responses)
- Submission date: `2025.11.14 15:30:00`
- Status: `Completed`

---

**End of Migration Plan**

**Status**: Ready for review and approval  
**Next Action**: Stakeholder review → Implementation kickoff  
**Estimated Development Time**: 2-3 days  
**Estimated Validation Time**: 1-2 weeks in hybrid mode  
**Expected API Call Reduction**: ~99% (from ~8,700/day to ~50/day)
