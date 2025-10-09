# Check-In Modal Cache Refresh Fix

## Issues Identified

### 1. ✅ Cache Invalidation Bug (FIXED)
**Problem**: After submitting the check-in modal, the page didn't refresh to show:
- Updated job state
- New event in timeline
- Disabled "Check in at shop" button

**Root Cause**: Query key mismatch in cache invalidation
- Actual query keys: `['/api/jobs/${jobId}']` (template string)
- Invalidation keys: `['/api/jobs', jobId]` (array format)

**Fix Applied**: Updated `client/src/pages/job-detail.tsx` line 451-457 to use correct template string format:
```typescript
onSuccess={() => {
  queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
  queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/events`] });
  queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
  queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
}}
```

**Status**: ✅ Applied and hot-reloaded to frontend

---

### 2. ⚠️ Old Form ID Being Used (REQUIRES SECRET UPDATE)
**Problem**: Check-in dispatches are using old Emissions form ID **5628226** instead of new **5640674**

**Root Cause**: Replit secret `GOCANVAS_FORM_ID` is set to `5628226`

**Solution**: Update the Replit secret:
1. Go to Replit Secrets (Tools → Secrets)
2. Find `GOCANVAS_FORM_ID`
3. Update value from `5628226` → `5640674`
4. Restart the application

**Alternatively**: Delete the `GOCANVAS_FORM_ID` secret entirely - the system will default to 5640674

**Status**: ⚠️ Requires manual secret update

---

## Testing After Secret Update

1. Update/remove `GOCANVAS_FORM_ID` secret
2. Restart application
3. Test check-in flow:
   - Click "Check in at shop" on a picked-up job
   - Fill out and submit the modal
   - **Verify**: Page updates immediately (no manual refresh needed)
   - **Verify**: Event timeline shows check-in event
   - **Verify**: "Check in at shop" button is disabled
   - **Verify**: GoCanvas dispatch uses form ID 5640674

---

## Summary

| Issue | Status | Action Required |
|-------|--------|----------------|
| Cache invalidation bug | ✅ Fixed | None - already applied |
| Old form ID (5628226) | ⚠️ Pending | Update `GOCANVAS_FORM_ID` secret to 5640674 |

