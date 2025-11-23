import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Package, Search, ArrowUpDown, Check } from "lucide-react";
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

  const handleToggleJobStatus = (value: string) => {
    setTempStatusFilter(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleToggleDiagnosis = (value: string) => {
    setTempDiagnosisFilter(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const handleTogglePartStatus = (value: string) => {
    setTempPartStatusFilter(prev =>
      prev.includes(value)
        ? prev.filter(v => v !== value)
        : [...prev, value]
    );
  };

  const applyStatusFilter = () => {
    setStatusFilter(tempStatusFilter);
    setStatusFilterOpen(false);
  };

  const applyDiagnosisFilter = () => {
    setDiagnosisFilter(tempDiagnosisFilter);
    setDiagnosisFilterOpen(false);
  };

  const applyPartStatusFilter = () => {
    setPartStatusFilter(tempPartStatusFilter);
    setPartStatusFilterOpen(false);
  };

  const clearStatusFilter = () => {
    setTempStatusFilter([]);
    setStatusFilter([]);
    setStatusFilterOpen(false);
  };

  const clearDiagnosisFilter = () => {
    setTempDiagnosisFilter([]);
    setDiagnosisFilter([]);
    setDiagnosisFilterOpen(false);
  };

  const clearPartStatusFilter = () => {
    setTempPartStatusFilter([]);
    setPartStatusFilter([]);
    setPartStatusFilterOpen(false);
  };

  const clearAllFilters = () => {
    setStatusFilter([]);
    setTempStatusFilter([]);
    setDiagnosisFilter([]);
    setTempDiagnosisFilter([]);
    setPartStatusFilter([]);
    setTempPartStatusFilter([]);
    setSearchQuery('');
    setDebouncedSearchQuery('');
    setDateFrom('');
    setDateTo('');
    setSortBy('createdAt');
    setSortOrder('desc');
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-[var(--ecs-primary)]">Parts List</h1>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader className="card-header">
          <CardTitle className="text-white flex items-center gap-2">
            <Package className="h-5 w-5" />
            Filter Parts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          {/* Search and Filter Row */}
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Search by Part Name, Job ID, or Customer"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  isUserTypingRef.current = true;
                }}
                onFocus={() => { isUserTypingRef.current = true; }}
                onBlur={() => { isUserTypingRef.current = false; }}
                className="pl-10"
                data-testid="input-search-parts"
              />
            </div>

            {/* Job Status Filter */}
            <Popover open={statusFilterOpen} onOpenChange={setStatusFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2" data-testid="button-filter-job-status">
                  Job Status
                  {statusFilter.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 text-xs bg-[var(--ecs-primary)] text-white rounded-full">
                      {statusFilter.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4" align="start">
                <div className="space-y-3">
                  <h3 className="font-medium">Filter by Job Status</h3>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {jobStatusOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`job-status-${option.value}`}
                          checked={tempStatusFilter.includes(option.value)}
                          onCheckedChange={() => handleToggleJobStatus(option.value)}
                          data-testid={`checkbox-job-status-${option.value}`}
                        />
                        <label
                          htmlFor={`job-status-${option.value}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={clearStatusFilter} className="flex-1">
                      Clear
                    </Button>
                    <Button size="sm" onClick={applyStatusFilter} className="flex-1">
                      <Check className="mr-1 h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Diagnosis Filter */}
            <Popover open={diagnosisFilterOpen} onOpenChange={setDiagnosisFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2" data-testid="button-filter-diagnosis">
                  Diagnosis
                  {diagnosisFilter.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 text-xs bg-[var(--ecs-primary)] text-white rounded-full">
                      {diagnosisFilter.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4" align="start">
                <div className="space-y-3">
                  <h3 className="font-medium">Filter by Diagnosis</h3>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {diagnosisOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`diagnosis-${option.value}`}
                          checked={tempDiagnosisFilter.includes(option.value)}
                          onCheckedChange={() => handleToggleDiagnosis(option.value)}
                          data-testid={`checkbox-diagnosis-${option.value}`}
                        />
                        <label
                          htmlFor={`diagnosis-${option.value}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={clearDiagnosisFilter} className="flex-1">
                      Clear
                    </Button>
                    <Button size="sm" onClick={applyDiagnosisFilter} className="flex-1">
                      <Check className="mr-1 h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Part Status Filter */}
            <Popover open={partStatusFilterOpen} onOpenChange={setPartStatusFilterOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2" data-testid="button-filter-part-status">
                  Part Status
                  {partStatusFilter.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 text-xs bg-[var(--ecs-primary)] text-white rounded-full">
                      {partStatusFilter.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4" align="start">
                <div className="space-y-3">
                  <h3 className="font-medium">Filter by Part Status</h3>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {partStatusOptions.map((option) => (
                      <div key={option.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`part-status-${option.value}`}
                          checked={tempPartStatusFilter.includes(option.value)}
                          onCheckedChange={() => handleTogglePartStatus(option.value)}
                          data-testid={`checkbox-part-status-${option.value}`}
                        />
                        <label
                          htmlFor={`part-status-${option.value}`}
                          className="text-sm cursor-pointer flex-1"
                        >
                          {option.label}
                        </label>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={clearPartStatusFilter} className="flex-1">
                      Clear
                    </Button>
                    <Button size="sm" onClick={applyPartStatusFilter} className="flex-1">
                      <Check className="mr-1 h-4 w-4" />
                      Apply
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {(statusFilter.length > 0 || diagnosisFilter.length > 0 || partStatusFilter.length > 0 || searchQuery || dateFrom || dateTo) && (
              <Button
                variant="ghost"
                onClick={clearAllFilters}
                className="text-muted-foreground hover:text-foreground"
                data-testid="button-clear-all-filters"
              >
                Clear All
              </Button>
            )}
          </div>

          {/* Date Range Row */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[150px]">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="From Date"
                data-testid="input-date-from"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="To Date"
                data-testid="input-date-to"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parts Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[var(--ecs-primary)] text-white">
                <tr>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-[var(--ecs-primary-dark)]" onClick={() => handleSort('part')}>
                    <div className="flex items-center gap-2">
                      Part Name
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-[var(--ecs-primary-dark)]" onClick={() => handleSort('job.shipToName')}>
                    <div className="flex items-center gap-2">
                      Job Name
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-[var(--ecs-primary-dark)]" onClick={() => handleSort('job.customerName')}>
                    <div className="flex items-center gap-2">
                      Customer Name
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left">
                    Job Status
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-[var(--ecs-primary-dark)]" onClick={() => handleSort('diagnosis')}>
                    <div className="flex items-center gap-2">
                      Diagnosis
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left cursor-pointer hover:bg-[var(--ecs-primary-dark)]" onClick={() => handleSort('status')}>
                    <div className="flex items-center gap-2">
                      Part Status
                      <ArrowUpDown className="h-4 w-4" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      Loading parts...
                    </td>
                  </tr>
                ) : parts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      No parts found. Try adjusting your filters.
                    </td>
                  </tr>
                ) : (
                  parts.map((part) => (
                    <tr
                      key={part.id}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => {
                        if (part.job?.jobId) {
                          window.location.href = `/jobs/${part.job.jobId}`;
                        }
                      }}
                      data-testid={`row-part-${part.id}`}
                    >
                      <td className="px-4 py-3 font-medium" data-testid={`text-part-name-${part.id}`}>
                        {part.part || '-'}
                      </td>
                      <td className="px-4 py-3" data-testid={`text-job-name-${part.id}`}>
                        {part.job?.shipToName || '-'}
                      </td>
                      <td className="px-4 py-3" data-testid={`text-customer-name-${part.id}`}>
                        {part.job?.customerName || '-'}
                      </td>
                      <td className="px-4 py-3" data-testid={`text-job-status-${part.id}`}>
                        {part.job ? <JobStatusBadge status={part.job.state} /> : '-'}
                      </td>
                      <td className="px-4 py-3" data-testid={`text-diagnosis-${part.id}`}>
                        {part.diagnosis || '-'}
                      </td>
                      <td className="px-4 py-3" data-testid={`text-part-status-${part.id}`}>
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
