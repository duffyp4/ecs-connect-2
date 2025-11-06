import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useSearch, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { List, Store, Package, Send, ChevronDown, Search, ArrowUpDown, Check } from "lucide-react";
import JobStatusBadge from "@/components/job-status-badge";
import { CheckInModal } from "@/components/check-in-modal";
import { DeliveryDispatchModal } from "@/components/delivery-dispatch-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Helper functions for URL query parameters
function parseQueryParams(search: string): URLSearchParams {
  return new URLSearchParams(search);
}

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

type ActionType = {
  id: string;
  label: string;
  icon: React.ReactNode;
  requiresModal?: boolean;
};

type PaginatedResponse = {
  data: any[];
  total: number;
  page: number;
  pageSize: number;
};

export default function JobList() {
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tempStatusFilter, setTempStatusFilter] = useState<string[]>([]);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('initiatedAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [deliveryDispatchModalOpen, setDeliveryDispatchModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const { toast } = useToast();
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wasFetchingRef = useRef<boolean>(false);
  const isUserTypingRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);
  
  // Initialize state from URL on mount
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
  }, []);
  
  // Available status options
  const statusOptions = [
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

  // Debounce search query - wait 500ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);

    // Clean up the timer if user types again before 500ms
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Sync state to URL parameters
  useEffect(() => {
    // Skip initial mount - only update URL after user interaction
    if (!isInitializedRef.current) return;
    
    const newSearch = updateQueryParams({
      status: statusFilter.length > 0 ? statusFilter : null,
      search: debouncedSearchQuery || null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      sortBy: sortBy !== 'initiatedAt' ? sortBy : null,
      sortOrder: sortOrder !== 'desc' ? sortOrder : null,
      page: currentPage !== 1 ? currentPage.toString() : null,
      pageSize: pageSize !== 25 ? pageSize.toString() : null,
    });
    
    // Update URL without triggering navigation
    const newUrl = '/jobs' + newSearch;
    window.history.replaceState({}, '', newUrl);
  }, [statusFilter, debouncedSearchQuery, dateFrom, dateTo, sortBy, sortOrder, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, debouncedSearchQuery, dateFrom, dateTo, sortBy, sortOrder]);

  const { data: response, isLoading, isFetching } = useQuery<PaginatedResponse>({
    queryKey: ["/api/jobs", {
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

  const jobs = response?.data ?? [];
  const total = response?.total ?? 0;
  const totalPages = Math.ceil(total / pageSize);

  // Restore focus after API completes if user was typing
  useEffect(() => {
    // Restore focus after fetch completes if user was typing
    if (!isFetching && wasFetchingRef.current && isUserTypingRef.current && searchInputRef.current) {
      console.log('API completed, restoring focus');
      // Use requestAnimationFrame to ensure React has finished rendering
      requestAnimationFrame(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          console.log('Focus restored');
        }
      });
    }
    
    wasFetchingRef.current = isFetching;
  }, [isFetching]);

  // Mutation for job actions
  const actionMutation = useMutation({
    mutationFn: async ({ jobId, action, data }: { jobId: string; action: string; data?: any }) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/${action}`, data || {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
      toast({
        title: "Success",
        description: "Job status updated successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update job status",
        variant: "destructive",
      });
    },
  });

  const getAvailableActions = (state: string): ActionType[] => {
    const actions: ActionType[] = [];

    if (state === 'picked_up') {
      actions.push({
        id: 'check-in',
        label: 'Check In at Shop',
        icon: <Store className="mr-2 h-4 w-4" />,
        requiresModal: true,
      });
    }

    if (state === 'service_complete') {
      actions.push({
        id: 'ready-pickup',
        label: 'Ready for Pickup',
        icon: <Package className="mr-2 h-4 w-4" />,
      });
      actions.push({
        id: 'dispatch-delivery',
        label: 'Dispatch for Delivery',
        icon: <Send className="mr-2 h-4 w-4" />,
        requiresModal: true,
      });
    }

    if (state === 'ready_for_pickup') {
      actions.push({
        id: 'mark-picked-up',
        label: 'Mark as Picked Up',
        icon: <Package className="mr-2 h-4 w-4" />,
      });
    }

    return actions;
  };

  const handleAction = (job: any, action: ActionType) => {
    setSelectedJob(job);
    
    if (action.id === 'check-in') {
      setCheckInModalOpen(true);
    } else if (action.id === 'dispatch-delivery') {
      setDeliveryDispatchModalOpen(true);
    } else if (action.id === 'ready-pickup') {
      actionMutation.mutate({ 
        jobId: job.jobId, 
        action: 'mark-ready', 
        data: { deliveryMethod: 'pickup' } 
      });
    } else if (action.id === 'mark-picked-up') {
      actionMutation.mutate({ 
        jobId: job.jobId, 
        action: 'mark-picked-up-from-shop'
      });
    }
  };

  const formatTurnaroundTime = (minutes: number | null): string => {
    if (!minutes) return "N/A";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <List className="h-6 w-6" />
          <h1 className="text-2xl font-bold">All Jobs</h1>
        </div>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--ecs-dark)] flex items-center">
              <List className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
              <span className="hidden sm:inline">All Jobs</span>
              <span className="sm:hidden">Jobs</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Complete list of all service jobs</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search by Job ID or Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                isUserTypingRef.current = true;
                console.log('Search input focused, isUserTyping: true');
              }}
              onBlur={() => {
                isUserTypingRef.current = false;
                console.log('Search input blurred, isUserTyping: false');
              }}
              className="pl-10"
              data-testid="input-search"
              autoComplete="off"
            />
          </div>
          
          <Popover 
            open={statusFilterOpen} 
            onOpenChange={(open) => {
              setStatusFilterOpen(open);
              if (open) {
                // Initialize temp filter with current filter when opening
                setTempStatusFilter(statusFilter);
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full sm:w-48 justify-between"
                data-testid="button-status-filter"
              >
                <span className="truncate">
                  {statusFilter.length === 0
                    ? "All Statuses"
                    : statusFilter.length === 1
                    ? statusOptions.find(opt => opt.value === statusFilter[0])?.label
                    : `${statusFilter.length} statuses`}
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
                    data-testid={`checkbox-status-${option.value}`}
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
            className="w-full sm:w-40"
            data-testid="input-date-from"
          />

          <Input
            type="date"
            placeholder="To Date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full sm:w-40"
            data-testid="input-date-to"
          />

          <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
            const [field, order] = value.split('-');
            setSortBy(field);
            setSortOrder(order);
          }}>
            <SelectTrigger className="w-full sm:w-56" data-testid="select-sort">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="initiatedAt-desc">Newest First</SelectItem>
              <SelectItem value="initiatedAt-asc">Oldest First</SelectItem>
              <SelectItem value="customerName-asc">Customer (A-Z)</SelectItem>
              <SelectItem value="customerName-desc">Customer (Z-A)</SelectItem>
              <SelectItem value="state-asc">Status (A-Z)</SelectItem>
              <SelectItem value="completedAt-desc">Recently Completed</SelectItem>
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
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Ship To</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Customer Name</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Order Number</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Current Status</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Initiated</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Completed</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center p-8 text-muted-foreground">
                      No jobs found. Try adjusting your filters or create a new job.
                    </td>
                  </tr>
                ) : (
                  jobs.map((job: any) => {
                    const availableActions = getAvailableActions(job.state);
                    
                    return (
                      <tr key={job.id} className="border-b hover:bg-gray-50">
                        <td className="p-4">
                          <Link href={`/jobs/${job.jobId}`}>
                            <span className="job-id cursor-pointer hover:underline" data-testid={`link-job-${job.jobId}`}>{job.customerShipTo || 'N/A'}</span>
                          </Link>
                        </td>
                        <td className="p-4">
                          <div className="font-medium">{job.customerName}</div>
                        </td>
                        <td className="p-4">
                          <div className="font-medium" data-testid={`text-order-number-${job.jobId}`}>
                            {(() => {
                              const orderNumbers = [
                                job.orderNumber,
                                job.orderNumber2,
                                job.orderNumber3,
                                job.orderNumber4,
                                job.orderNumber5
                              ].filter(Boolean);
                              if (orderNumbers.length === 0) return '-';
                              if (orderNumbers.length === 1) return orderNumbers[0];
                              return `${orderNumbers[0]} +${orderNumbers.length - 1} more`;
                            })()}
                          </div>
                        </td>
                        <td className="p-4">
                          <JobStatusBadge status={job.state} />
                        </td>
                        <td className="p-4">
                          {job.initiatedAt ? new Date(job.initiatedAt).toLocaleString() : '-'}
                        </td>
                        <td className="p-4">
                          {job.completedAt ? new Date(job.completedAt).toLocaleString() : '-'}
                        </td>
                        <td className="p-4">
                          {availableActions.length === 0 ? (
                            <span className="text-sm text-muted-foreground">No actions</span>
                          ) : availableActions.length === 1 ? (
                            <Button
                              size="sm"
                              onClick={() => handleAction(job, availableActions[0])}
                              disabled={actionMutation.isPending || isFetching}
                              className="btn-primary"
                              data-testid={`button-${availableActions[0].id}-${job.jobId}`}
                            >
                              {availableActions[0].icon}
                              {availableActions[0].label}
                            </Button>
                          ) : (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={actionMutation.isPending || isFetching}
                                  data-testid={`dropdown-actions-${job.jobId}`}
                                >
                                  Actions
                                  <ChevronDown className="ml-2 h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {availableActions.map((action) => (
                                  <DropdownMenuItem
                                    key={action.id}
                                    onClick={() => handleAction(job, action)}
                                    data-testid={`menuitem-${action.id}-${job.jobId}`}
                                  >
                                    {action.icon}
                                    {action.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Showing {jobs.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0} to {Math.min(currentPage * pageSize, total)} of {total} jobs
          </div>
          <Select value={String(pageSize)} onValueChange={(value) => {
            setPageSize(parseInt(value));
            setCurrentPage(1);
          }}>
            <SelectTrigger className="w-32 h-9" data-testid="select-page-size">
              <SelectValue placeholder="Per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25 per page</SelectItem>
              <SelectItem value="50">50 per page</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  data-testid="pagination-previous"
                />
              </PaginationItem>
              
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber;
                if (totalPages <= 5) {
                  pageNumber = i + 1;
                } else if (currentPage <= 3) {
                  pageNumber = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNumber = totalPages - 4 + i;
                } else {
                  pageNumber = currentPage - 2 + i;
                }
                
                return (
                  <PaginationItem key={pageNumber}>
                    <PaginationLink
                      onClick={() => setCurrentPage(pageNumber)}
                      isActive={currentPage === pageNumber}
                      className="cursor-pointer"
                      data-testid={`pagination-page-${pageNumber}`}
                    >
                      {pageNumber}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  data-testid="pagination-next"
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
      
      {/* Modals */}
      {selectedJob && (
        <>
          <CheckInModal
            open={checkInModalOpen}
            onOpenChange={setCheckInModalOpen}
            job={selectedJob}
            onSuccess={() => {
              setCheckInModalOpen(false);
              setSelectedJob(null);
            }}
          />
          <DeliveryDispatchModal
            open={deliveryDispatchModalOpen}
            onOpenChange={setDeliveryDispatchModalOpen}
            job={selectedJob}
            onSuccess={() => {
              setDeliveryDispatchModalOpen(false);
              setSelectedJob(null);
            }}
          />
        </>
      )}
    </div>
  );
}
