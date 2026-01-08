# Implementation Plan: Job List Filter Persistence Demo Pages

## Overview

Create two side-by-side demo pages in the dev environment to showcase different approaches to persistent filtering. Users can interact with both options using mock data, then decide which UX pattern to implement fully.

**Goal**: Build interactive prototypes with mock data (~2 days) that demonstrate:
- **Demo 1**: Named Saved Views approach (bookmark/playlist paradigm)
- **Demo 2**: Tab-Based Sessions approach (browser tabs paradigm)

**Strategy**: Two agents can work in parallel on separate demo pages to maximize speed.

---

## Demo Pages to Create

### 1. Demo Page: Saved Views (`/jobs-demo-saved-views`)
**Route**: `/jobs-demo-saved-views`
**Component**: `client/src/pages/job-list-demo-saved-views.tsx`

**Features**:
- Full job list table with all existing filters (search, status, date range, shop, sort)
- "Saved Views" dropdown menu with:
  - List of pre-populated example presets:
    - "Morning Check" (status: picked_up, picked_up_from_shop | sort: newest first)
    - "Open Items" (status: at_shop, in_service | sort: oldest first)
    - "Weekly Review" (dateFrom: 7 days ago | sort: newest first)
    - "End of Day Cleanup" (status: service_complete, ready_for_pickup)
  - "Save Current Filters As..." button
  - Edit/Delete icons per preset
  - Star icon to set default preset
- Mock data: 50+ sample jobs with varied statuses, dates, customers
- LocalStorage persistence for demo purposes (simulate DB)

**UI Flow**:
1. Page loads with "Morning Check" preset applied (demo default)
2. User can change filters manually
3. Click "Save Current Filters As..." → prompt for name → adds to saved views list
4. Click a saved view → instantly applies those filters
5. Click star icon → sets as default (loads on page open)
6. Click edit → rename the preset
7. Click delete → removes preset with confirmation

### 2. Demo Page: Tab Sessions (`/jobs-demo-tabs`)
**Route**: `/jobs-demo-tabs`
**Component**: `client/src/pages/job-list-demo-tabs.tsx`

**Features**:
- Full job list table with all existing filters
- Horizontal tab bar above filters:
  - Pre-populated tabs:
    - "Morning" (active by default) - status: picked_up + picked_up_from_shop
    - "Open Items" - status: at_shop, in_service
    - "Weekly" - dateFrom: 7 days ago
  - [+] button to create new tab
  - [x] close button on each tab (min 1 tab required)
  - Right-click context menu: Rename, Pin, Close
- Auto-save behavior: filters automatically persist to active tab after 1 second of no changes
- Mock data: Same 50+ sample jobs
- LocalStorage persistence per tab (simulate DB)

**UI Flow**:
1. Page loads with 3 pre-configured tabs
2. User switches between tabs → filters instantly change to that tab's saved state
3. User modifies filters in a tab → after 1 second, automatically saves to that tab
4. Click [+] → creates new tab with default/empty filters
5. Right-click tab → Rename (prompt for name) / Pin (prevent auto-save) / Close
6. Close tab → removes that session (with confirmation if it's the only tab)

---

## Implementation Details

### Mock Data Structure
**File**: `client/src/data/mockJobs.ts` (new file)

```typescript
export const mockJobs = [
  {
    id: "ECS-20260108-001",
    shipTo: "123 Main St, Nashville",
    customerName: "ABC Corp",
    state: "at_shop",
    initiatedAt: "2026-01-08T08:30:00Z",
    completedAt: null,
    orderNumber: "ORD-1001",
    shopName: "Nashville"
  },
  // ... 50+ more varied examples
  // Include all status types: queued_for_pickup, picked_up, shipment_inbound,
  // at_shop, in_service, service_complete, ready_for_pickup,
  // picked_up_from_shop, queued_for_delivery, delivered, outbound_shipment
  // Various dates: today, yesterday, last week, last month
  // Multiple shops: Nashville, Memphis, Knoxville
  // Different customers: ABC Corp, XYZ Inc, Test Company, etc.
];
```

### Dev-Mode Navigation
**File**: `client/src/components/layout/sidebar.tsx` (modify existing)

Add conditional section at bottom of sidebar (only visible when dev mode active):

```typescript
{import.meta.env.DEV && (
  <>
    <Separator className="my-2" />
    <div className="px-3 py-2">
      <p className="text-xs text-muted-foreground mb-2">Filter Demos (Dev Only)</p>
      <Link href="/jobs-demo-saved-views" className="...">
        <FileText className="h-4 w-4" />
        <span>Demo: Saved Views</span>
      </Link>
      <Link href="/jobs-demo-tabs" className="...">
        <Tabs2 className="h-4 w-4" />
        <span>Demo: Tab Sessions</span>
      </Link>
    </div>
  </>
)}
```

### Shared Demo Components
**File**: `client/src/components/demos/DemoJobTable.tsx` (new file)

Reusable table component that both demo pages can use:
- Accepts filtered job data as props
- Renders the same table structure as real job-list page
- Simplified (no real actions, just display)
- Shows: Ship To, Customer Name, Status, Initiated, Completed, Order Number

### LocalStorage Keys
- Saved Views: `demo-saved-views` → stores array of presets
- Tab Sessions: `demo-tab-sessions` → stores array of tab objects
- Active Tab: `demo-active-tab-id` → stores current tab ID

---

## Files to Create

### New Files (6 total)
1. `client/src/pages/job-list-demo-saved-views.tsx` - Demo page for Approach 1
2. `client/src/pages/job-list-demo-tabs.tsx` - Demo page for Approach 2
3. `client/src/data/mockJobs.ts` - Mock job data (50+ samples)
4. `client/src/components/demos/DemoJobTable.tsx` - Shared table component
5. `client/src/components/demos/SavedViewsManager.tsx` - Saved views dropdown UI
6. `client/src/components/demos/TabSessionsBar.tsx` - Tab bar UI

### Files to Modify (2 total)
1. `client/src/components/layout/sidebar.tsx` - Add dev-mode navigation links
2. `client/src/App.tsx` or routing file - Add routes for both demo pages

---

## Parallel Implementation Strategy

**Agent 1** - Works on Saved Views Demo:
- Create `job-list-demo-saved-views.tsx`
- Create `SavedViewsManager.tsx` component
- Create `mockJobs.ts` (shared, can be done first)
- Create `DemoJobTable.tsx` (shared, can be done first)

**Agent 2** - Works on Tab Sessions Demo:
- Create `job-list-demo-tabs.tsx`
- Create `TabSessionsBar.tsx` component
- Uses `mockJobs.ts` created by Agent 1
- Uses `DemoJobTable.tsx` created by Agent 1

**No conflicts** - Agents work on completely separate files except for shared components which can be created upfront.

---

## Component Structure

### SavedViewsManager Component
```typescript
interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
  isDefault: boolean;
}

// Dropdown showing:
// - List of saved views with Apply button
// - Active view indicator (checkmark)
// - Edit/Delete icons per view
// - Star icon for setting default
// - "Save Current As..." button at bottom
```

### TabSessionsBar Component
```typescript
interface TabSession {
  id: string;
  name: string;
  filters: FilterState;
  isPinned: boolean;
  lastAccessed: string;
}

// Horizontal tab strip showing:
// - Tab buttons (click to switch)
// - Close button on each tab
// - [+] button to add new tab
// - Active tab highlighted
// - Right-click context menu
```

---

## Filter State Interface

Both demos use the same filter structure:

```typescript
interface FilterState {
  shop: string;
  status: string[];
  search: string;
  dateFrom: string;
  dateTo: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  pageSize: number;
}
```

---

## Verification Steps

### Manual Testing Checklist

**Saved Views Demo** (`/jobs-demo-saved-views`):
1. ✅ Navigate to demo page from sidebar
2. ✅ Page loads with "Morning Check" preset applied
3. ✅ Click another preset → filters change immediately
4. ✅ Modify filters manually → click "Save Current As..." → enter name → verify added to list
5. ✅ Refresh page → verify saved presets persist (localStorage)
6. ✅ Click star icon on a preset → refresh → verify that preset loads by default
7. ✅ Edit preset name → verify name updates
8. ✅ Delete preset → verify removed from list
9. ✅ Verify all filter types work: search, status multi-select, date range, shop, sort

**Tab Sessions Demo** (`/jobs-demo-tabs`):
1. ✅ Navigate to demo page from sidebar
2. ✅ Page loads with 3 tabs showing
3. ✅ Click different tabs → verify filters change per tab
4. ✅ Modify filters in "Morning" tab → wait 1 second → switch to another tab → switch back → verify filters persisted
5. ✅ Click [+] button → verify new tab created with empty/default filters
6. ✅ Right-click tab → Rename → enter new name → verify tab name updates
7. ✅ Right-click tab → Pin → modify filters → verify doesn't auto-save (pinned behavior)
8. ✅ Close a tab → verify tab removed (confirm if only one left)
9. ✅ Refresh page → verify all tabs and their states persist (localStorage)

**Dev Mode Check**:
1. ✅ Verify demo links only appear in sidebar when running `npm run dev`
2. ✅ Verify demo links do NOT appear in production build

**Data Quality**:
1. ✅ Verify mock data includes all status types
2. ✅ Verify date range filtering works with mock dates
3. ✅ Verify search works on customer names and job IDs
4. ✅ Verify sorting works on all sortable columns

---

## User Decision Process

After demos are built:

1. **Test internally** - Verify both demos work correctly
2. **User review** - Show both options to end users (CSRs, technicians)
3. **Gather feedback** - Which approach do users prefer? Why?
4. **Make decision** - Choose one approach for full implementation
5. **Cleanup** - Delete unused demo page and components
6. **Full implementation** - Build chosen approach with real backend/database

---

## Cleanup After Decision

**If Saved Views is chosen**:
- Keep: `job-list-demo-saved-views.tsx`, `SavedViewsManager.tsx`, `mockJobs.ts`
- Delete: `job-list-demo-tabs.tsx`, `TabSessionsBar.tsx`
- Remove demo routes and sidebar links
- Proceed with full Saved Views implementation (database, API, integration)

**If Tab Sessions is chosen**:
- Keep: `job-list-demo-tabs.tsx`, `TabSessionsBar.tsx`, `mockJobs.ts`
- Delete: `job-list-demo-saved-views.tsx`, `SavedViewsManager.tsx`
- Remove demo routes and sidebar links
- Proceed with full Tab Sessions implementation (database, API, integration)

---

## Next Steps After Demo Testing

Once users choose their preferred approach, the full implementation would include:

1. **Database schema** - Add appropriate table(s) per chosen approach
2. **Backend API** - Create REST endpoints for CRUD operations
3. **Database methods** - Add methods to database.ts
4. **Integration** - Integrate chosen UI pattern into real `job-list.tsx` page
5. **Real data** - Replace mock data with actual API calls
6. **Testing** - Test with real user accounts and data
7. **Deployment** - Ship to production

**Estimated timeline for full implementation**: 3-4 days (Saved Views) or 5-6 days (Tab Sessions)

---

## Why This Approach is Smart

✅ **Validates UX before investment** - Test with real users before building full backend
✅ **Low risk** - Demos are isolated, easy to delete
✅ **Fast feedback loop** - Users try both options in ~2 days instead of guessing
✅ **Parallel development** - Two agents work simultaneously on separate demos
✅ **Informed decision** - Choose based on actual user testing, not assumptions
✅ **Reusable components** - Winner's components can be adapted for production

This is excellent product development practice! 🎯
