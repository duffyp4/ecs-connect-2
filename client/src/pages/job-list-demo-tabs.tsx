import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, ArrowUpDown, ChevronDown, Info } from "lucide-react";
import TabSessionsBar, { FilterState, TabSession } from "@/components/demos/TabSessionsBar";
import DemoJobTable from "@/components/demos/DemoJobTable";
import { mockJobs, filterMockJobs } from "@/data/mockJobs";

const ACTIVE_TAB_KEY = 'demo-active-tab-id';

// Status options
const statusOptions = [
  { value: "queued_for_pickup", label: "Queued for Pickup" },
  { value: "picked_up", label: "Picked Up" },
  { value: "shipment_inbound", label: "Inbound Shipment" },
  { value: "at_shop", label: "At Shop" },
  { value: "in_service", label: "In Service" },
  { value: "service_complete", label: "Service Complete" },
  { value: "ready_for_pickup", label: "Ready for Pickup" },
  { value: "picked_up_from_shop", label: "Picked Up from Shop" },
  { value: "queued_for_delivery", label: "Queued for Delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "outbound_shipment", label: "Outbound Shipment" },
];

// Shop options
const shopOptions = [
  { value: "all", label: "All Shops" },
  { value: "Nashville", label: "Nashville" },
  { value: "Memphis", label: "Memphis" },
  { value: "Knoxville", label: "Knoxville" },
];

// Default filters
const getDefaultFilters = (): FilterState => ({
  shop: 'all',
  status: [],
  search: '',
  dateFrom: '',
  dateTo: '',
  sortBy: 'initiatedAt',
  sortOrder: 'desc',
  pageSize: 25,
});

export default function JobListDemoTabs() {
  const [tabs, setTabs] = useState<TabSession[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [filters, setFilters] = useState<FilterState>(getDefaultFilters());
  const [tempStatusFilter, setTempStatusFilter] = useState<string[]>([]);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);

  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Initialize active tab from localStorage
  useEffect(() => {
    const savedActiveTabId = localStorage.getItem(ACTIVE_TAB_KEY);
    if (savedActiveTabId) {
      setActiveTabId(savedActiveTabId);
    }
  }, []);

  // Handle tab change - load that tab's filters
  const handleTabChange = (tabId: string) => {
    setActiveTabId(tabId);

    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setFilters(tab.filters);
      setTempStatusFilter(tab.filters.status);
    }
  };

  // Handle tabs update from TabSessionsBar
  const handleTabsUpdate = (updatedTabs: TabSession[]) => {
    setTabs(updatedTabs);

    // If no active tab yet, set the first one
    if (!activeTabId && updatedTabs.length > 0) {
      const firstTab = updatedTabs[0];
      setActiveTabId(firstTab.id);
      setFilters(firstTab.filters);
      setTempStatusFilter(firstTab.filters.status);
    }
  };

  // Debounced auto-save: save current filters to active tab after 1 second of no changes
  useEffect(() => {
    if (!activeTabId) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      // The TabSessionsBar component handles the actual update via currentFilters prop
      console.log('Auto-saving filters to active tab');
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [filters, activeTabId]);

  // Filter jobs
  const filteredJobs = filterMockJobs(mockJobs, {
    shop: filters.shop !== 'all' ? filters.shop : undefined,
    status: filters.status.length > 0 ? filters.status : undefined,
    search: filters.search || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });

  return (
    <div className="space-y-4 max-w-full overflow-hidden p-6">
      {/* Banner */}
      <Alert className="bg-blue-50 border-blue-200">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          <strong>DEMO: Tab Sessions Approach</strong> - This is a prototype demonstrating filter persistence using browser tabs.
          Each tab maintains its own set of filters, which are saved automatically as you make changes.
        </AlertDescription>
      </Alert>

      {/* Tab Sessions Bar */}
      <Card className="border-2 border-[var(--ecs-primary)]">
        <TabSessionsBar
          activeTabId={activeTabId}
          onTabChange={handleTabChange}
          onTabsUpdate={handleTabsUpdate}
          currentFilters={filters}
        />

        {/* Filters */}
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
            {/* Search */}
            <div className="relative sm:col-span-2 lg:col-span-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Job ID or Customer..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10 w-full"
              />
            </div>

            {/* Status Multi-Select */}
            <Popover
              open={statusFilterOpen}
              onOpenChange={(open) => {
                setStatusFilterOpen(open);
                if (open) {
                  setTempStatusFilter(filters.status);
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between"
                >
                  <span className="truncate">
                    {filters.status.length === 0
                      ? "All Statuses"
                      : filters.status.length === 1
                      ? statusOptions.find(opt => opt.value === filters.status[0])?.label
                      : `${filters.status.length} statuses`}
                  </span>
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-0" align="start">
                <div className="p-2 border-b">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-sm">Filter by Status</h4>
                    {tempStatusFilter.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-1 text-xs"
                        onClick={() => setTempStatusFilter([])}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                <div className="max-h-64 overflow-y-auto p-2">
                  {statusOptions.map((option) => (
                    <div
                      key={option.value}
                      className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                      onClick={() => {
                        if (tempStatusFilter.includes(option.value)) {
                          setTempStatusFilter(tempStatusFilter.filter(s => s !== option.value));
                        } else {
                          setTempStatusFilter([...tempStatusFilter, option.value]);
                        }
                      }}
                    >
                      <Checkbox
                        checked={tempStatusFilter.includes(option.value)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setTempStatusFilter([...tempStatusFilter, option.value]);
                          } else {
                            setTempStatusFilter(tempStatusFilter.filter(s => s !== option.value));
                          }
                        }}
                      />
                      <label className="text-sm cursor-pointer flex-1">
                        {option.label}
                      </label>
                    </div>
                  ))}
                </div>
                <div className="p-2 border-t">
                  <Button
                    className="w-full"
                    onClick={() => {
                      setFilters(prev => ({ ...prev, status: tempStatusFilter }));
                      setStatusFilterOpen(false);
                    }}
                  >
                    Apply
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Date From */}
            <Input
              type="date"
              placeholder="From Date"
              value={filters.dateFrom}
              onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              className="w-full"
            />

            {/* Date To */}
            <Input
              type="date"
              placeholder="To Date"
              value={filters.dateTo}
              onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              className="w-full"
            />

            {/* Sort */}
            <Select
              value={`${filters.sortBy}-${filters.sortOrder}`}
              onValueChange={(value) => {
                const [field, order] = value.split('-');
                setFilters(prev => ({
                  ...prev,
                  sortBy: field,
                  sortOrder: order as 'asc' | 'desc'
                }));
              }}
            >
              <SelectTrigger className="w-full">
                <ArrowUpDown className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="initiatedAt-desc">Newest First</SelectItem>
                <SelectItem value="initiatedAt-asc">Oldest First</SelectItem>
                <SelectItem value="customerName-asc">Customer (A-Z)</SelectItem>
                <SelectItem value="customerName-desc">Customer (Z-A)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Shop Filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium">Shop:</label>
            <Select
              value={filters.shop}
              onValueChange={(value) => setFilters(prev => ({ ...prev, shop: value }))}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Select shop" />
              </SelectTrigger>
              <SelectContent>
                {shopOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredJobs.length} of {mockJobs.length} jobs
          </div>
        </CardContent>
      </Card>

      {/* Job Table */}
      <DemoJobTable jobs={filteredJobs} />
    </div>
  );
}
