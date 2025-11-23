import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Search, ArrowUpDown, ChevronDown } from "lucide-react";
import JobStatusBadge from "@/components/job-status-badge";
import type { JobPart, Job } from "@shared/schema";

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
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [tempStatusFilter, setTempStatusFilter] = useState<string[]>([]);
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [diagnosisFilter, setDiagnosisFilter] = useState<string[]>([]);
  const [tempDiagnosisFilter, setTempDiagnosisFilter] = useState<string[]>([]);
  const [diagnosisFilterOpen, setDiagnosisFilterOpen] = useState(false);
  const [partStatusFilter, setPartStatusFilter] = useState<string[]>([]);
  const [tempPartStatusFilter, setTempPartStatusFilter] = useState<string[]>([]);
  const [partStatusFilterOpen, setPartStatusFilterOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const wasFetchingRef = useRef<boolean>(false);
  const isUserTypingRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);
  
  // Initialize state from URL on mount
  useEffect(() => {
    if (!isInitializedRef.current) {
      const params = new URLSearchParams(window.location.search);
      const status = params.get('status');
      const diagnosis = params.get('diagnosis');
      const partStatus = params.get('partStatus');
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
      if (diagnosis) {
        const diagnoses = diagnosis.split(',');
        setDiagnosisFilter(diagnoses);
        setTempDiagnosisFilter(diagnoses);
      }
      if (partStatus) {
        const statuses = partStatus.split(',');
        setPartStatusFilter(statuses);
        setTempPartStatusFilter(statuses);
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

  const diagnosisOptions = [
    { value: "Regen Required", label: "Regen Required" },
    { value: "Regen & Bake Required", label: "Regen & Bake Required" },
    { value: "Bake Required", label: "Bake Required" },
    { value: "Replace Filter", label: "Replace Filter" },
    { value: "Coolant & Pressure Test", label: "Coolant & Pressure Test" },
    { value: "Pressure Test", label: "Pressure Test" },
    { value: "Thermal Imaging", label: "Thermal Imaging" },
    { value: "Other", label: "Other" },
  ];

  const partStatusOptions = [
    { value: "At ECS Location", label: "At ECS Location" },
    { value: "In Transit", label: "In Transit" },
    { value: "Delivered to Customer", label: "Delivered to Customer" },
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
      status: statusFilter.length > 0 ? statusFilter : null,
      diagnosis: diagnosisFilter.length > 0 ? diagnosisFilter : null,
      partStatus: partStatusFilter.length > 0 ? partStatusFilter : null,
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
  }, [statusFilter, diagnosisFilter, partStatusFilter, debouncedSearchQuery, dateFrom, dateTo, sortBy, sortOrder, currentPage, pageSize]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, diagnosisFilter, partStatusFilter, debouncedSearchQuery, dateFrom, dateTo, sortBy, sortOrder]);

  const { data: response, isLoading, isFetching } = useQuery<PaginatedResponse>({
    queryKey: ["/api/parts", {
      ...(statusFilter.length > 0 && { status: statusFilter.join(',') }),
      ...(diagnosisFilter.length > 0 && { diagnosis: diagnosisFilter.join(',') }),
      ...(partStatusFilter.length > 0 && { partStatus: partStatusFilter.join(',') }),
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
    <div className="space-y-4 sm:space-y-6">
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--ecs-dark)] flex items-center">
              <Package className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
              <span className="hidden sm:inline">All Parts</span>
              <span className="sm:hidden">Parts</span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">Complete list of all parts</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Search by Part, Job ID, or Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { isUserTypingRef.current = true; }}
              onBlur={() => { isUserTypingRef.current = false; }}
              className="pl-10"
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
                className="w-full sm:w-48 justify-between"
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

          <Popover 
            open={diagnosisFilterOpen} 
            onOpenChange={(open) => {
              setDiagnosisFilterOpen(open);
              if (open) {
                setTempDiagnosisFilter(diagnosisFilter);
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full sm:w-48 justify-between"
                data-testid="button-diagnosis-filter"
              >
                <span className="truncate">
                  {diagnosisFilter.length === 0
                    ? "All Diagnoses"
                    : diagnosisFilter.length === 1
                    ? diagnosisOptions.find(opt => opt.value === diagnosisFilter[0])?.label
                    : `${diagnosisFilter.length} diagnoses`}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <div className="p-2 border-b">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Filter by Diagnosis</h4>
                  {tempDiagnosisFilter.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 text-xs"
                      onClick={() => setTempDiagnosisFilter([])}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {diagnosisOptions.map((option) => (
                  <div
                    key={option.value}
                    className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                    onClick={() => {
                      if (tempDiagnosisFilter.includes(option.value)) {
                        setTempDiagnosisFilter(tempDiagnosisFilter.filter(s => s !== option.value));
                      } else {
                        setTempDiagnosisFilter([...tempDiagnosisFilter, option.value]);
                      }
                    }}
                    data-testid={`checkbox-diagnosis-${option.value}`}
                  >
                    <Checkbox checked={tempDiagnosisFilter.includes(option.value)} />
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
                    setDiagnosisFilter(tempDiagnosisFilter);
                    setDiagnosisFilterOpen(false);
                  }}
                  data-testid="button-apply-diagnosis-filter"
                >
                  Apply
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <Popover 
            open={partStatusFilterOpen} 
            onOpenChange={(open) => {
              setPartStatusFilterOpen(open);
              if (open) {
                setTempPartStatusFilter(partStatusFilter);
              }
            }}
          >
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full sm:w-48 justify-between"
                data-testid="button-part-status-filter"
              >
                <span className="truncate">
                  {partStatusFilter.length === 0
                    ? "All Part Statuses"
                    : partStatusFilter.length === 1
                    ? partStatusOptions.find(opt => opt.value === partStatusFilter[0])?.label
                    : `${partStatusFilter.length} statuses`}
                </span>
                <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-0" align="start">
              <div className="p-2 border-b">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm">Filter by Part Status</h4>
                  {tempPartStatusFilter.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-auto p-1 text-xs"
                      onClick={() => setTempPartStatusFilter([])}
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-2">
                {partStatusOptions.map((option) => (
                  <div
                    key={option.value}
                    className="flex items-center space-x-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer"
                    onClick={() => {
                      if (tempPartStatusFilter.includes(option.value)) {
                        setTempPartStatusFilter(tempPartStatusFilter.filter(s => s !== option.value));
                      } else {
                        setTempPartStatusFilter([...tempPartStatusFilter, option.value]);
                      }
                    }}
                    data-testid={`checkbox-part-status-${option.value}`}
                  >
                    <Checkbox checked={tempPartStatusFilter.includes(option.value)} />
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
                    setPartStatusFilter(tempPartStatusFilter);
                    setPartStatusFilterOpen(false);
                  }}
                  data-testid="button-apply-part-status-filter"
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
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Part Name</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Job Name</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Customer Name</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Current Job Status</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Part Diagnosis</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Part Status</th>
                </tr>
              </thead>
              <tbody>
                {parts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
                      No parts found. Try adjusting your filters.
                    </td>
                  </tr>
                ) : (
                  parts.map((part) => (
                    <tr
                      key={part.id}
                      className="border-b hover:bg-gray-50"
                      data-testid={`row-part-${part.id}`}
                    >
                      <td className="p-4">
                        {part.job?.jobId ? (
                          <Link href={`/jobs/${part.job.jobId}`}>
                            <span className="job-id cursor-pointer hover:underline" data-testid={`link-part-${part.id}`}>
                              {part.part || '-'}
                            </span>
                          </Link>
                        ) : (
                          <span>{part.part || '-'}</span>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="font-medium" data-testid={`text-job-name-${part.id}`}>
                          {part.job?.shipToName || '-'}
                        </div>
                      </td>
                      <td className="p-4" data-testid={`text-customer-name-${part.id}`}>
                        {part.job?.customerName || '-'}
                      </td>
                      <td className="p-4" data-testid={`text-job-status-${part.id}`}>
                        {part.job ? <JobStatusBadge status={part.job.state} /> : '-'}
                      </td>
                      <td className="p-4" data-testid={`text-diagnosis-${part.id}`}>
                        {part.diagnosis || '-'}
                      </td>
                      <td className="p-4" data-testid={`text-part-status-${part.id}`}>
                        {part.status || '-'}
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
