# GoCanvas Webhook Migration Plan
**Migration from Polling to Push-First Architecture**

**Date**: November 14, 2025  
**Status**: Analysis Phase - No Implementation Yet  
**Author**: Technical Architecture Planning

---

## Executive Summary

This document outlines the migration plan to transition ECS Connect's GoCanvas integration from a 30-second polling-based architecture to a webhook-driven push-first system. The change will reduce API calls by ~95%, improve job completion detection latency from 30 seconds to <5 seconds, and eliminate rate limit risks.

**Expected Impact**:
- **API Call Reduction**: From ~2,160 calls/day to ~100-150 calls/day
- **Latency Improvement**: Job state updates detected in <5 seconds (vs. 0-30 seconds)
- **Cost Reduction**: Reduced rate limit exposure and infrastructure load
- **Reliability**: Elimination of polling gaps and submission search overhead

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
1. Fetch submission list for Pickup form: `GET /submissions?form_id=5640587` (max 100 submissions)
2. For each completed submission: `GET /submissions/{id}` (detailed data)
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
```
/api/metrics/gocanvas
Response:
{
  totalCalls: 5432,
  byStatus: { "200": 5200, "404": 32, "429": 0 },
  rateLimitHits: 0,
  lastRateLimitRemaining: "4876",
  lastRateLimitLimit: "5000"
}
```

---

## 2. GoCanvas Webhook Architecture

### 2.1 Webhook Capabilities (API v3)

**GoCanvas Webhook Support**:
- **API Version**: v3 (current production version used by ECS Connect)
- **Format**: JSON payloads (XML not supported in v3)
- **Events Available**:
  - `submission.created` - Fired when a new submission is started
  - `submission.updated` - Fired when a submission is saved or completed
- **Authentication**: Webhook signature verification via HMAC SHA-256
- **Delivery**: POST request to configured endpoint URL

**Webhook Registration**:
```javascript
// POST https://api.gocanvas.com/api/v3/webhooks
{
  url: 'https://ecs-connect.replit.app/api/webhooks/gocanvas',
  event_types: ['submission.updated'],
  secret: 'WEBHOOK_SECRET_KEY' // For signature verification
}
```

**Webhook Payload Structure**:
```json
{
  "event_type": "submission.updated",
  "data": {
    "id": "submission_123456",
    "form_id": "5654184",
    "status": "completed",
    "submitted_at": "2025-11-14T15:30:00Z",
    "responses": [
      {
        "entry_id": 718414001,
        "label": "Job ID",
        "value": "ECS-20251114-3001",
        "type": "Text"
      }
    ]
  },
  "timestamp": "2025-11-14T15:30:05Z"
}
```

### 2.2 Webhook Endpoint Design

**Endpoint Location**: `server/routes.ts`

**Route**: `POST /api/webhooks/gocanvas`

**Implementation Strategy**:
```typescript
// Webhook receiver (no authentication middleware - uses signature verification)
app.post('/api/webhooks/gocanvas', async (req, res) => {
  try {
    // 1. IMMEDIATE RESPONSE (acknowledge receipt within 3 seconds)
    res.status(200).json({ received: true });
    
    // 2. ASYNC PROCESSING (process after response sent)
    setImmediate(async () => {
      try {
        await webhookService.processGoCanvasWebhook(req.body, req.headers);
      } catch (error) {
        console.error('Webhook processing error:', error);
        // Log to monitoring system (do not throw - response already sent)
      }
    });
  } catch (error) {
    // Only network/parsing errors reach here
    res.status(500).json({ error: 'Internal error' });
  }
});
```

**Signature Verification**:
```typescript
// server/services/webhook.ts
function verifyGoCanvasSignature(
  payload: any,
  signature: string,
  secret: string
): boolean {
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(JSON.stringify(payload)).digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  );
}
```

### 2.3 Webhook Processing Service

**New Service**: `server/services/webhook.ts`

**Core Responsibilities**:
1. **Signature Verification**: Validate webhook authenticity
2. **Idempotency**: Prevent duplicate processing (track submission IDs)
3. **Form Routing**: Route to correct handler based on `form_id`
4. **Job ID Extraction**: Search submission responses for Job ID field
5. **State Transition**: Call appropriate jobEventsService method
6. **Error Handling**: Retry logic and dead letter queue

**Idempotency Implementation**:
```typescript
// In-memory cache for recent submission IDs (with TTL)
const processedSubmissions = new Map<string, number>();
const CACHE_TTL_MS = 3600000; // 1 hour

async function processGoCanvasWebhook(payload: any, headers: any) {
  const { event_type, data } = payload;
  const submissionId = data.id;
  
  // 1. Idempotency check
  if (processedSubmissions.has(submissionId)) {
    console.log(`Duplicate webhook for submission ${submissionId}, skipping`);
    return;
  }
  
  // 2. Mark as processed
  processedSubmissions.set(submissionId, Date.now());
  
  // 3. Clean up expired entries
  cleanupExpiredEntries();
  
  // 4. Process based on event type
  if (event_type === 'submission.updated' && data.status === 'completed') {
    await handleSubmissionCompleted(data);
  }
}
```

**Form-Based Routing**:
```typescript
async function handleSubmissionCompleted(submissionData: any) {
  const formId = submissionData.form_id;
  
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
      console.warn('Unknown form ID:', formId);
  }
}
```

**Job ID Extraction**:
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

---

## 3. Hybrid Architecture (Transition Phase)

### 3.1 Feature Flag System

**Environment Variable**: `WEBHOOK_MODE`

**Modes**:
- `polling` - Legacy mode (polling only, no webhooks)
- `hybrid` - Webhooks primary, polling as backup (reduced interval)
- `webhook` - Webhooks only, polling disabled

**Implementation**:
```typescript
// server/services/jobTracker.ts
startPolling(): void {
  const mode = process.env.WEBHOOK_MODE || 'polling';
  
  if (mode === 'webhook') {
    console.log('Webhook mode: polling disabled');
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

### 3.2 Webhook Fallback Logic

**Scenario**: Webhook fails or is delayed > 2 minutes

**Fallback Strategy**:
1. Webhook endpoint tracks last successful webhook timestamp per form
2. If no webhook received for a job state in > 2 minutes, polling catches it
3. Polling checks if state was already updated by webhook (idempotent)

**Implementation**:
```typescript
// Track last webhook received per form
const lastWebhookByForm = new Map<string, number>();

// In webhook handler
function recordWebhookReceipt(formId: string) {
  lastWebhookByForm.set(formId, Date.now());
}

// In polling logic
async function checkPendingJobs() {
  const mode = process.env.WEBHOOK_MODE || 'polling';
  
  if (mode === 'hybrid') {
    // Only poll forms that haven't received a webhook recently
    const twoMinutesAgo = Date.now() - 120000;
    
    for (const [formId, lastWebhook] of lastWebhookByForm) {
      if (lastWebhook < twoMinutesAgo) {
        console.warn(`No webhook for form ${formId} in 2+ minutes, polling as backup`);
      }
    }
  }
  
  // Continue with existing polling logic...
}
```

---

## 4. Rollout Plan

### 4.1 Phase 1: Development & Testing (2-3 days)

**Goal**: Implement webhook infrastructure without changing production behavior

**Tasks**:
1. **Create webhook service** (`server/services/webhook.ts`)
   - Signature verification
   - Idempotency cache
   - Form routing logic
   - Job ID extraction

2. **Add webhook endpoint** (`POST /api/webhooks/gocanvas`)
   - Immediate 200 response
   - Async processing with setImmediate()
   - Error logging (no throws after response)

3. **Add environment variable**:
   ```bash
   WEBHOOK_MODE=polling           # Default (no changes)
   GOCANVAS_WEBHOOK_SECRET=xxx    # For signature verification
   ```

4. **Testing**:
   - Unit tests for signature verification
   - Unit tests for idempotency logic
   - Mock webhook payload testing
   - Manual testing with GoCanvas sandbox (if available)

**Deployment**:
- Deploy to development environment
- **No production impact** (webhook endpoint exists but polling still active)

### 4.2 Phase 2: Hybrid Mode (1-2 weeks)

**Goal**: Enable webhooks alongside polling for validation

**Tasks**:
1. **Register webhooks in GoCanvas**:
   - Event: `submission.updated`
   - Forms: All 3 forms (Pickup, Emissions, Delivery)
   - URL: `https://ecs-connect.replit.app/api/webhooks/gocanvas`

2. **Set environment variable**:
   ```bash
   WEBHOOK_MODE=hybrid
   ```

3. **Monitor dual processing**:
   - Track webhook processing times
   - Compare webhook vs. polling detection times
   - Monitor for duplicate state transitions (should be prevented by idempotency)
   - Watch GoCanvas API metrics for reduced call volume

4. **Add webhook metrics to Admin Dashboard**:
   ```typescript
   // server/services/webhook.ts
   export const webhookMetrics = {
     totalReceived: 0,
     totalProcessed: 0,
     duplicatesIgnored: 0,
     errors: 0,
     byForm: {} as Record<string, number>,
     averageProcessingTime: 0,
   };
   ```

5. **Observability**:
   - Add webhook status panel to Admin Dashboard
   - Compare API call volume (before/after metrics)
   - Monitor job completion latency

**Validation Criteria** (must be met before Phase 3):
- ✅ All webhook deliveries successful (>99% success rate)
- ✅ No duplicate job state transitions detected
- ✅ Webhook latency < 5 seconds for job updates
- ✅ API call volume reduced by >80% (from ~2,160/day to <400/day)
- ✅ No jobs missed by webhooks (polling as safety net catches zero jobs)

**Duration**: Run for 1-2 weeks to validate across different submission volumes

### 4.3 Phase 3: Webhook-Only Mode (After validation)

**Goal**: Disable polling, rely 100% on webhooks

**Tasks**:
1. **Set environment variable**:
   ```bash
   WEBHOOK_MODE=webhook
   ```

2. **Remove polling infrastructure** (optional cleanup after 30 days):
   - Archive `jobTracker.ts` (keep for reference)
   - Remove polling startup code from `server/routes.ts`
   - Remove polling interval logic

3. **Final API metrics check**:
   - Expected: ~100-150 calls/day (reference data sync, dispatches, manual checks)
   - Reduction: ~95% from original polling load

**Rollback Plan**:
If issues arise in webhook-only mode:
1. Set `WEBHOOK_MODE=hybrid` (re-enable polling)
2. Investigate webhook delivery failures
3. Fix issues before re-attempting webhook-only

---

## 5. Risk Assessment & Mitigation

### 5.1 Identified Risks

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Webhook delivery failures** | High - Jobs not updated | Low | Hybrid mode with polling fallback |
| **Duplicate processing** | Medium - Double state transitions | Medium | Idempotency cache with submission ID tracking |
| **GoCanvas webhook downtime** | High - No job updates | Low | Polling fallback in hybrid mode |
| **Signature verification issues** | High - Security vulnerability | Low | Test with mock payloads, use crypto.timingSafeEqual |
| **Job ID not found in webhook** | Medium - Missed job updates | Low | Logging + fallback to polling |
| **Memory leak (idempotency cache)** | Low - Server performance | Medium | TTL-based cache cleanup (1 hour expiry) |

### 5.2 Rollback Strategy

**Immediate Rollback** (if critical issues detected):
1. Set `WEBHOOK_MODE=polling` via environment variable
2. Restart application (Replit auto-restart on env change)
3. Polling resumes with 30-second intervals
4. No code changes required

**Gradual Rollback** (if partial issues):
1. Set `WEBHOOK_MODE=hybrid` (keep webhooks, add polling safety net)
2. Investigate webhook failures in logs
3. Fix issues and re-test before returning to webhook-only

---

## 6. Technical Implementation Details

### 6.1 New Files to Create

**1. `server/services/webhook.ts`** (~200 lines)
- Webhook signature verification
- Idempotency cache management
- Form routing and job ID extraction
- Integration with jobEventsService
- Metrics tracking

**2. `server/webhookMetrics.ts`** (~50 lines)
- Webhook-specific metrics (separate from GoCanvas API metrics)
- Tracking webhook receipt, processing, errors

### 6.2 Files to Modify

**1. `server/routes.ts`** (+30 lines)
- Add `POST /api/webhooks/gocanvas` endpoint
- Add `GET /api/metrics/webhooks` endpoint (admin-only)

**2. `server/services/jobTracker.ts`** (+15 lines)
- Add WEBHOOK_MODE environment variable check
- Adjust polling interval based on mode
- Add webhook timestamp tracking for fallback logic

**3. `.env` / Replit Secrets** (+2 secrets)
- `WEBHOOK_MODE`: polling|hybrid|webhook
- `GOCANVAS_WEBHOOK_SECRET`: Secret key for signature verification

**4. `client/src/pages/admin.tsx`** (+50 lines)
- Add "Webhook Health" panel to Integration Health tab
- Display webhook metrics (received, processed, errors)
- Display webhook mode status

### 6.3 Database Changes

**Option 1: In-Memory Cache (Recommended for MVP)**
- Use `Map<string, number>` for submission ID tracking
- TTL-based cleanup (1 hour)
- No database changes required
- Limitation: Lost on server restart (acceptable - duplicate processing is idempotent)

**Option 2: Database-Backed (Future Enhancement)**
- Add `processed_webhooks` table
- Columns: submission_id, form_id, processed_at
- Cleanup old records with daily cron job
- Benefit: Survives server restarts

**Recommendation**: Start with Option 1 (in-memory), migrate to Option 2 if needed

### 6.4 Monitoring & Observability

**Admin Dashboard Enhancements**:
1. **Webhook Health Panel**:
   - Total webhooks received (last 24h)
   - Success/error rate
   - Average processing time
   - Last webhook received timestamp per form

2. **GoCanvas API Metrics Panel** (existing):
   - API call volume comparison (before/after)
   - Rate limit utilization

**Alerts** (future enhancement):
- No webhook received for form in > 5 minutes
- Webhook error rate > 1%
- Polling fallback triggered in hybrid mode

---

## 7. Testing Strategy

### 7.1 Unit Tests

**webhook.ts Tests**:
- ✅ Signature verification (valid/invalid signatures)
- ✅ Idempotency (duplicate submission IDs ignored)
- ✅ Job ID extraction (various field label formats)
- ✅ Form routing (correct handler for each form ID)

**Integration Tests**:
- ✅ Mock webhook delivery → job state update
- ✅ Webhook + polling (no duplicate transitions)

### 7.2 Manual Testing Checklist

**Development Environment**:
- [ ] Send mock webhook payload (valid signature)
- [ ] Verify job state updated in database
- [ ] Verify event recorded in JobEvents table
- [ ] Send duplicate webhook (should be ignored)
- [ ] Send invalid signature (should be rejected)
- [ ] Test all 3 form types (Pickup, Emissions, Delivery)

**Hybrid Mode Validation** (production):
- [ ] Monitor webhook delivery for 24 hours
- [ ] Verify no polling fallback triggered
- [ ] Check API call reduction in GoCanvas metrics
- [ ] Confirm no duplicate state transitions

**Webhook-Only Mode** (production):
- [ ] Disable polling, monitor for 48 hours
- [ ] Verify all jobs updated correctly
- [ ] Check job completion latency (<5 seconds)
- [ ] Confirm API calls reduced by ~95%

---

## 8. Success Metrics

### 8.1 Quantitative Goals

| Metric | Current (Polling) | Target (Webhooks) | Measurement |
|--------|-------------------|-------------------|-------------|
| **API Calls per Day** | ~2,160 - 28,800 | <150 | GoCanvas API metrics |
| **Job Update Latency** | 0-30 seconds (avg 15s) | <5 seconds | Event timestamp - submission timestamp |
| **Rate Limit Headroom** | Low (high call volume) | High (minimal calls) | Rate limit remaining header |
| **Server Load** | High (constant polling) | Low (event-driven) | CPU/memory metrics |

### 8.2 Qualitative Goals

- ✅ **Reliability**: Zero missed job completions
- ✅ **Observability**: Clear metrics for webhook health
- ✅ **Maintainability**: Reduced complexity (fewer API calls to debug)
- ✅ **Scalability**: No polling bottleneck as job volume grows

---

## 9. Timeline Summary

| Phase | Duration | Key Milestone |
|-------|----------|---------------|
| **Phase 1: Development** | 2-3 days | Webhook endpoint deployed (polling still active) |
| **Phase 2: Hybrid Mode** | 1-2 weeks | Webhooks validated, API calls reduced by 80-90% |
| **Phase 3: Webhook-Only** | Ongoing | Polling disabled, 95% API call reduction |

**Total Estimated Time**: 2-3 weeks (development + validation)

---

## 10. Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-11-14 | Use in-memory idempotency cache | Simpler implementation, acceptable duplicate risk on restart |
| 2025-11-14 | Hybrid mode with 5-minute polling | Safety net during validation period |
| 2025-11-14 | Immediate 200 response + async processing | Prevents webhook timeout (GoCanvas requires <3s response) |
| 2025-11-14 | HMAC SHA-256 signature verification | GoCanvas standard, prevents unauthorized webhooks |

---

## 11. Next Steps (Implementation Phase)

**After approval of this migration plan**:

1. **Create feature branch**: `feature/gocanvas-webhooks`
2. **Implement webhook service** (`server/services/webhook.ts`)
3. **Add webhook endpoint** (`server/routes.ts`)
4. **Add environment variables** (WEBHOOK_MODE, GOCANVAS_WEBHOOK_SECRET)
5. **Write unit tests** (signature verification, idempotency)
6. **Deploy to development** (test with mock payloads)
7. **Register webhooks in GoCanvas** (production environment)
8. **Enable hybrid mode** (WEBHOOK_MODE=hybrid)
9. **Monitor for 1-2 weeks** (validate metrics, no issues)
10. **Switch to webhook-only** (WEBHOOK_MODE=webhook)
11. **Monitor for 1 week** (confirm no issues)
12. **Archive polling code** (cleanup after 30 days of stable operation)

---

## Appendix A: GoCanvas Webhook Registration

**API Call**:
```bash
curl -X POST https://api.gocanvas.com/api/v3/webhooks \
  -H "Authorization: Basic $(echo -n 'USERNAME:PASSWORD' | base64)" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://ecs-connect.replit.app/api/webhooks/gocanvas",
    "event_types": ["submission.updated"],
    "secret": "WEBHOOK_SECRET_KEY"
  }'
```

**Expected Response**:
```json
{
  "id": "webhook_123456",
  "url": "https://ecs-connect.replit.app/api/webhooks/gocanvas",
  "event_types": ["submission.updated"],
  "created_at": "2025-11-14T15:00:00Z",
  "status": "active"
}
```

**Note**: Repeat registration for each form if GoCanvas requires form-specific webhooks (check with GoCanvas support).

---

## Appendix B: Sample Webhook Payload

**Real-world example** (based on GoCanvas API v3):
```json
{
  "event_type": "submission.updated",
  "data": {
    "id": "submission_987654",
    "form_id": "5654184",
    "status": "completed",
    "created_at": "2025-11-14T14:00:00Z",
    "updated_at": "2025-11-14T15:30:00Z",
    "submitted_at": "2025-11-14T15:30:00Z",
    "responses": [
      {
        "entry_id": 718414001,
        "label": "Job ID",
        "value": "ECS-20251114153000-3001",
        "type": "Text"
      },
      {
        "entry_id": 718414002,
        "label": "Customer Name",
        "value": "ABC Auto Parts",
        "type": "Text"
      },
      {
        "entry_id": 718414050,
        "label": "New GPS",
        "value": "Lat:41.908562,Lon:-87.677940,Time:1731600600.073100",
        "type": "GPS"
      }
    ]
  },
  "timestamp": "2025-11-14T15:30:05Z"
}
```

---

**End of Migration Plan**

**Status**: Ready for review and approval  
**Next Action**: Stakeholder review → Implementation kickoff
