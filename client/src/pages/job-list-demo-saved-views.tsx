import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, ChevronDown, ArrowUpDown, Info, Building2 } from "lucide-react";
import DemoJobTable from "@/components/demos/DemoJobTable";
import SavedViewsManager, { FilterState } from "@/components/demos/SavedViewsManager";
import { mockJobs, filterMockJobs } from "@/data/mockJobs";

export default function JobListDemoSavedViews() {
  const [filters, setFilters] = useState<FilterState>({
    shop: 'all',
    status: [],
    search: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'initiatedAt',
    sortOrder: 'desc',
    pageSize: 25
  });

  const [tempStatusFilter, setTempStatusFilter] = useState<string[]>([]);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);

  // Available status options
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

  const shopOptions = [
    { value: "all", label: "All Shops" },
    { value: "Nashville", label: "Nashville" },
    { value: "Memphis", label: "Memphis" },
    { value: "Knoxville", label: "Knoxville" },
  ];

  // Load default view on mount
  useEffect(() => {
    const stored = localStorage.getItem('demo-saved-views');
    if (stored) {
      try {
        const savedViews = JSON.parse(stored);
        const defaultView = savedViews.find((v: any) => v.isDefault);
        if (defaultView) {
          setFilters(defaultView.filters);
          setTempStatusFilter(defaultView.filters.status);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }, []);

  const handleApplyView = (viewFilters: FilterState) => {
    setFilters(viewFilters);
    setTempStatusFilter(viewFilters.status);
  };

  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyStatusFilter = () => {
    setFilters(prev => ({ ...prev, status: tempStatusFilter }));
    setStatusFilterOpen(false);
  };

  const handleSortChange = (value: string) => {
    const [sortBy, sortOrder] = value.split('-');
    setFilters(prev => ({
      ...prev,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc'
    }));
  };

  // Filter the mock jobs
  const filteredJobs = filterMockJobs(mockJobs, {
    shop: filters.shop,
    status: filters.status,
    search: filters.search,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder
  });

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      {/* Demo Banner */}
      <Alert className="border-blue-200 bg-blue-50">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-900">
          <strong>DEMO: Saved Views Approach</strong> - This prototype demonstrates filter persistence
          using localStorage. Save your current filter settings as named views, set a default view,
          and quickly switch between different filter configurations.
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--ecs-dark)]">
              Job List - Saved Views Demo
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Test filter persistence with saved view presets
            </p>
          </div>

          {/* Saved Views Manager */}
          <SavedViewsManager
            currentFilters={filters}
            onApplyView={handleApplyView}
          />
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
          {/* Shop Filter */}
          <Select value={filters.shop} onValueChange={(value) => handleFilterChange('shop', value)}>
            <SelectTrigger className="w-full">
              <Building2 className="mr-2 h-4 w-4 text-[var(--ecs-primary)]" />
              <SelectValue placeholder="All Shops" />
            </SelectTrigger>
            <SelectContent>
              {shopOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Search Input */}
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by Job ID or Customer..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className="pl-10 w-full"
              autoComplete="off"
            />
          </div>

          {/* Status Filter */}
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
              <Button variant="outline" className="w-full justify-between">
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
                <Button className="w-full" onClick={handleApplyStatusFilter}>
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
            onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            className="w-full"
          />

          {/* Date To */}
          <Input
            type="date"
            placeholder="To Date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            className="w-full"
          />

          {/* Sort */}
          <Select
            value={`${filters.sortBy}-${filters.sortOrder}`}
            onValueChange={handleSortChange}
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

        {/* Active Filters Summary */}
        {(filters.status.length > 0 || filters.search || filters.dateFrom || filters.dateTo || filters.shop !== 'all') && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-medium">Active Filters:</span>
            {filters.shop !== 'all' && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                Shop: {filters.shop}
              </span>
            )}
            {filters.status.length > 0 && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                {filters.status.length} status{filters.status.length !== 1 ? 'es' : ''}
              </span>
            )}
            {filters.search && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                Search: {filters.search}
              </span>
            )}
            {filters.dateFrom && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                From: {filters.dateFrom}
              </span>
            )}
            {filters.dateTo && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">
                To: {filters.dateTo}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-auto p-1 text-xs underline"
              onClick={() => {
                setFilters({
                  shop: 'all',
                  status: [],
                  search: '',
                  dateFrom: '',
                  dateTo: '',
                  sortBy: 'initiatedAt',
                  sortOrder: 'desc',
                  pageSize: 25
                });
                setTempStatusFilter([]);
              }}
            >
              Clear All
            </Button>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredJobs.length} of {mockJobs.length} jobs
      </div>

      {/* Job Table */}
      <DemoJobTable jobs={filteredJobs} />
    </div>
  );
}
