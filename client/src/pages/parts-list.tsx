import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectLabel, SelectGroup } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Search, ArrowUpDown, ChevronDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import JobStatusBadge from "@/components/job-status-badge";
import { useLocations } from "@/hooks/use-reference-data";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { JobPart, Job } from "@shared/schema";
import { PART_DIAGNOSIS_OPTIONS, PART_STATUS_OPTIONS } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

function updateQueryParams(params: Record<string, string | string[] | null>): string {
  const searchParams = new URLSearchParams(window.location.search);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      searchParams.delete(key);
    } else if (Array.isArray(value)) {
      searchParams.set(key, value.join(','));
    } else {
      searchParams.set(key, value);
    }
  });
  
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

type PartWithJob = JobPart & { job: Job | null };

type PaginatedResponse = {
  data: PartWithJob[];
  total: number;
  page: number;
  pageSize: number;
};

export default function PartsList() {
  const { canFilterByShop, homeShop } = useAuth();
  const [shopFilter, setShopFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tempStatusFilter, setTempStatusFilter] = useState<string[]>([]);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  
  const { data: locations = [], isLoading: isLoadingLocations } = useLocations();
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wasFetchingRef = useRef<boolean>(false);
  const isUserTypingRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);
  
  // Initialize state from URL on mount, with session persistence for shop filter
  useEffect(() => {
    if (!isInitializedRef.current) {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      const search = params.get('search');
      const from = params.get('dateFrom');
      const to = params.get('dateTo');
      const sort = params.get('sortBy');
      const order = params.get('sortOrder');
      const page = params.get('page');
      const size = params.get('pageSize');
      const shop = params.get('shop');
      
      // Shop filter priority: URL param > sessionStorage > homeShop
      if (shop) {
        setShopFilter(shop);
      } else {
        const savedShop = sessionStorage.getItem('ecs-shop-filter');
        if (savedShop) {
          setShopFilter(savedShop);
        } else if (homeShop && canFilterByShop) {
          setShopFilter(homeShop);
        }
      }
      
      if (status) {
        const statuses = status.split(',');
        setStatusFilter(statuses);
        setTempStatusFilter(statuses);
      }
      if (search) {
        setSearchQuery(search);
        setDebouncedSearchQuery(search);
      }
      if (from) setDateFrom(from);
      if (to) setDateTo(to);
      if (sort) setSortBy(sort);
      if (order) setSortOrder(order);
      if (page) setCurrentPage(parseInt(page, 10));
      if (size) setPageSize(parseInt(size, 10));
      
      isInitializedRef.current = true;
    }
  }, [homeShop, canFilterByShop]);
  
  // Persist shop filter changes to sessionStorage
  useEffect(() => {
    if (isInitializedRef.current && shopFilter) {
      sessionStorage.setItem('ecs-shop-filter', shopFilter);
    }
  }, [shopFilter]);
  
  // Available filter options
  const jobStatusOptions = [
    { value: "queued_for_pickup", label: "Queued for Pickup" },
    { value: "picked_up", label: "Picked Up" },
    { value: "at_shop", label: "At Shop" },
    { value: "in_service", label: "In Service" },
    { value: "service_complete", label: "Service Complete" },
    { value: "ready_for_pickup", label: "Ready for Pickup" },
    { value: "picked_up_from_shop", label: "Picked Up from Shop" },
    { value: "queued_for_delivery", label: "Queued for Delivery" },
    { value: "delivered", label: "Delivered" },
  ];

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sync state to URL parameters
  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    const newSearch = updateQueryParams({
      shop: shopFilter || null,
      status: statusFilter.length > 0 ? statusFilter : null,
      search: debouncedSearchQuery || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      sortBy: sortBy !== 'createdAt' ? sortBy : null,
      sortOrder: sortOrder !== 'desc' ? sortOrder : null,
      page: currentPage !== 1 ? currentPage.toString() : null,
      pageSize: pageSize !== 25 ? pageSize.toString() : null,
    });
    
    const newUrl = '/parts' + newSearch;
    window.history.replaceState({}, '', newUrl);
  }, [shopFilter, statusFilter, debouncedSearchQuery, dateFrom, dateTo, sortBy, sortOrder, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [shopFilter, statusFilter, debouncedSearchQuery, dateFrom, dateTo, sortBy, sortOrder]);

  const { data: response, isLoading, isFetching } = useQuery<PaginatedResponse>({
    queryKey: ["/api/parts", {
      ...(shopFilter && { shop: shopFilter }),
      ...(statusFilter.length > 0 && { status: statusFilter.join(',') }),
      ...(debouncedSearchQuery && { search: debouncedSearchQuery }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
      sortBy,
      sortOrder,
      page: currentPage,
      pageSize,
    }],
    refetchInterval: 30000,
  });

  const parts = response?.data ?? [];
  const total = response?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Mutation for updating part internal tracking fields
  const updatePartMutation = useMutation({
    mutationFn: async ({ partId, jobId, field, value }: { partId: string; jobId: string; field: string; value: string }) => {
      const response = await apiRequest("PATCH", `/api/jobs/${jobId}/parts/${partId}`, {
        [field]: value,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parts"] });
    },
  });

  useEffect(() => {
    if (wasFetchingRef.current && !isFetching && !isUserTypingRef.current) {
      searchInputRef.current?.blur();
    }
    wasFetchingRef.current = isFetching;
  }, [isFetching]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Package className="h-6 w-6" />
          <h1 className="text-2xl font-bold">All Parts</h1>
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 max-w-full overflow-hidden">
      <div className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--ecs-dark)] flex items-center">
              <Package className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
              All Parts
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Complete list of all parts</p>
          </div>
          
          {canFilterByShop ? (
            <Select value={shopFilter} onValueChange={setShopFilter}>
              <SelectTrigger 
                className="w-full lg:w-48 border-2 border-[var(--ecs-primary)] text-[var(--ecs-dark)] bg-white hover:bg-gray-50 font-medium"
                data-testid="select-shop-filter"
              >
                <Building2 className="mr-2 h-4 w-4 text-[var(--ecs-primary)]" />
                <SelectValue placeholder="All Shops" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Shops</SelectItem>
                {isLoadingLocations ? (
                  <SelectItem value="_loading" disabled>Loading...</SelectItem>
                ) : (
                  locations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          ) : homeShop ? (
            <div className="flex items-center gap-2 px-3 py-2 border-2 border-[var(--ecs-primary)] rounded-md bg-white font-medium text-[var(--ecs-dark)]">
              <Building2 className="h-4 w-4 text-[var(--ecs-primary)]" />
              <span>{homeShop}</span>
            </div>
          ) : null}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search by Part, Job ID, or Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { isUserTypingRef.current = true; }}
              onBlur={() => { isUserTypingRef.current = false; }}
              className="pl-10 w-full"
              data-testid="input-search-parts"
              autoComplete="off"
            />
          </div>
          
          <Popover 
            open={statusFilterOpen} 
            onOpenChange={(open) => {
              setStatusFilterOpen(open);
              if (open) {
                setTempStatusFilter(statusFilter);
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between"
                data-testid="button-status-filter"
              >
                <span className="truncate">
                  {statusFilter.length === 0
                    ? "All Job Statuses"
                    : statusFilter.length === 1
                    ? jobStatusOptions.find(opt => opt.value === statusFilter[0])?.label
                    : `${statusFilter.length} statuses`}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <div className="p-2 border-b">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Filter by Job Status</h4>
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
                {jobStatusOptions.map((option) => (
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
                    data-testid={`checkbox-status-${option.value}`}
                  >
                    <Checkbox checked={tempStatusFilter.includes(option.value)} />
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
                    setStatusFilter(tempStatusFilter);
                    setStatusFilterOpen(false);
                  }}
                  data-testid="button-apply-status-filter"
                >
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Input
            type="date"
            placeholder="From Date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full"
            data-testid="input-date-from"
          />

          <Input
            type="date"
            placeholder="To Date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full"
            data-testid="input-date-to"
          />

          <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
            const [field, order] = value.split('-');
            setSortBy(field);
            setSortOrder(order);
          }}>
            <SelectTrigger className="w-full" data-testid="select-sort">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt-desc">Newest First</SelectItem>
              <SelectItem value="createdAt-asc">Oldest First</SelectItem>
              <SelectItem value="part-asc">Part Name (A-Z)</SelectItem>
              <SelectItem value="part-desc">Part Name (Z-A)</SelectItem>
              <SelectItem value="job.customerName-asc">Customer (A-Z)</SelectItem>
              <SelectItem value="job.customerName-desc">Customer (Z-A)</SelectItem>
              <SelectItem value="diagnosis-asc">Diagnosis (A-Z)</SelectItem>
              <SelectItem value="status-asc">Status (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-[var(--ecs-light)]">
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">ECS Serial</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Part Name</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Ship To</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Customer Name</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Current Job Status</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Part Diagnosis</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Part Status</th>
                </tr>
              </thead>
              <tbody>
                {parts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                      No parts found. Try adjusting your filters.
                    </td>
                  </tr>
                ) : (
                  parts.map((part) => (
                    <tr
                      key={part.id}
                      className={cn(
                        "border-b",
                        part.status === "W.O.A" && "bg-yellow-100 hover:bg-yellow-200",
                        part.status === "Approved" && "bg-green-100 hover:bg-green-200",
                        part.status === "Failed" && "bg-red-100 hover:bg-red-200",
                        !["W.O.A", "Approved", "Failed"].includes(part.status || "") && "hover:bg-gray-50"
                      )}
                      data-testid={`row-part-${part.id}`}
                    >
                      <td className="p-4">
                        {part.job?.jobId ? (
                          <Link href={`/jobs/${part.job.jobId}`}>
                            <span className="job-id cursor-pointer hover:underline font-medium" data-testid={`link-ecs-serial-${part.id}`}>
                              {part.ecsSerial || '-'}
                            </span>
                          </Link>
                        ) : (
                          <span data-testid={`text-ecs-serial-${part.id}`}>{part.ecsSerial || '-'}</span>
                        )}
                      </td>
                      <td className="p-4" data-testid={`text-part-${part.id}`}>
                        {part.part || '-'}
                      </td>
                      <td className="p-4">
                        <div className="font-medium" data-testid={`text-ship-to-${part.id}`}>
                          {part.job?.customerShipTo || '-'}
                        </div>
                      </td>
                      <td className="p-4" data-testid={`text-customer-name-${part.id}`}>
                        {part.job?.customerName || '-'}
                      </td>
                      <td className="p-4" data-testid={`text-job-status-${part.id}`}>
                        {part.job ? <JobStatusBadge status={part.job.state} /> : '-'}
                      </td>
                      <td className="p-4" data-testid={`select-diagnosis-${part.id}`}>
                        {part.job?.jobId ? (
                          <Select
                            value={part.diagnosis || ""}
                            onValueChange={(value) => {
                              updatePartMutation.mutate({
                                partId: part.id,
                                jobId: part.job!.jobId,
                                field: "diagnosis",
                                value: value,
                              });
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select diagnosis..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pass">Pass</SelectItem>
                              <SelectGroup>
                                <SelectLabel>Repairs</SelectLabel>
                                <SelectItem value="Oil soaked">Oil soaked</SelectItem>
                                <SelectItem value="Coolant soaked">Coolant soaked</SelectItem>
                                <SelectItem value="Fuel soaked">Fuel soaked</SelectItem>
                                <SelectItem value="Sintered ash">Sintered ash</SelectItem>
                                <SelectItem value="Core push">Core push</SelectItem>
                                <SelectItem value="Air deflector">Air deflector</SelectItem>
                                <SelectItem value="Ceramic repair">Ceramic repair</SelectItem>
                                <SelectItem value="Bung repair">Bung repair</SelectItem>
                                <SelectItem value="Housing repair">Housing repair</SelectItem>
                                <SelectItem value="Sealing ring damage">Sealing ring damage</SelectItem>
                                <SelectItem value="Ceramic loss during blast">Ceramic loss during blast</SelectItem>
                                <SelectItem value="Bracket mounts">Bracket mounts</SelectItem>
                              </SelectGroup>
                              <SelectGroup>
                                <SelectLabel>Failed</SelectLabel>
                                <SelectItem value="Bad cells">Bad cells</SelectItem>
                                <SelectItem value="Cracked core/shifted">Cracked core/shifted</SelectItem>
                                <SelectItem value="Melted core">Melted core</SelectItem>
                                <SelectItem value="Outer core seal">Outer core seal</SelectItem>
                                <SelectItem value="Deteriorated ceramic">Deteriorated ceramic</SelectItem>
                                <SelectItem value="Light test">Light test</SelectItem>
                                <SelectItem value="Housing damage">Housing damage</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span>{part.diagnosis || '-'}</span>
                        )}
                      </td>
                      <td className="p-4" data-testid={`select-part-status-${part.id}`}>
                        {part.job?.jobId ? (
                          <Select
                            value={part.status || ""}
                            onValueChange={(value) => {
                              updatePartMutation.mutate({
                                partId: part.id,
                                jobId: part.job!.jobId,
                                field: "status",
                                value: value,
                              });
                            }}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select status..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectGroup>
                                <SelectLabel>Standard Service Process</SelectLabel>
                                <SelectItem value="Checked In">Checked In</SelectItem>
                                <SelectItem value="Processing">Processing</SelectItem>
                                <SelectItem value="Oven">Oven</SelectItem>
                                <SelectItem value="Cooling">Cooling</SelectItem>
                                <SelectItem value="Complete">Complete</SelectItem>
                              </SelectGroup>
                              <SelectGroup>
                                <SelectLabel>Action Required</SelectLabel>
                                <SelectItem value="Failed">Failed</SelectItem>
                                <SelectItem value="Approved">Approved</SelectItem>
                                <SelectItem value="W.O.A">W.O.A</SelectItem>
                                <SelectItem value="S.A. VAT">S.A. VAT</SelectItem>
                                <SelectItem value="Daybake">Daybake</SelectItem>
                                <SelectItem value="Rebake">Rebake</SelectItem>
                                <SelectItem value="Repairing">Repairing</SelectItem>
                                <SelectItem value="Assembling">Assembling</SelectItem>
                                <SelectItem value="Denied Approval">Denied Approval</SelectItem>
                                <SelectItem value="Sold New">Sold New</SelectItem>
                                <SelectItem value="Sold Reman">Sold Reman</SelectItem>
                                <SelectItem value="Testing">Testing</SelectItem>
                                <SelectItem value="Warranty">Warranty</SelectItem>
                                <SelectItem value="Scrap">Scrap</SelectItem>
                                <SelectItem value="Customer Pickup">Customer Pickup</SelectItem>
                                <SelectItem value="Blast Only">Blast Only</SelectItem>
                                <SelectItem value="Swings">Swings</SelectItem>
                              </SelectGroup>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span>{part.status || '-'}</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, total)} of {total} parts
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <PaginationItem key={pageNum}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNum)}
                          isActive={currentPage === pageNum}
                          className="cursor-pointer"
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
