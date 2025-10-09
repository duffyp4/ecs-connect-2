import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { List, Store, Package, Send, ChevronDown, Search, ArrowUpDown } from "lucide-react";
import JobStatusBadge from "@/components/job-status-badge";
import { CheckInModal } from "@/components/check-in-modal";
import { DeliveryDispatchModal } from "@/components/delivery-dispatch-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ActionType = {
  id: string;
  label: string;
  icon: React.ReactNode;
  requiresModal?: boolean;
};

export default function JobList() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("initiatedAt");
  const [sortOrder, setSortOrder] = useState<string>("desc");
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [deliveryDispatchModalOpen, setDeliveryDispatchModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any | null>(null);
  const { toast } = useToast();

  const { data: jobs = [], isLoading, isFetching } = useQuery<any[]>({
    queryKey: ["/api/jobs", {
      ...(statusFilter !== 'all' && { status: statusFilter }),
      ...(searchQuery && { search: searchQuery }),
      ...(dateFrom && { dateFrom }),
      ...(dateTo && { dateTo }),
      sortBy,
      sortOrder,
    }],
    refetchInterval: 30000,
  });

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
              placeholder="Search by Job ID or Customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-status-filter">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="queued_for_pickup">Queued for Pickup</SelectItem>
              <SelectItem value="picked_up">Picked Up</SelectItem>
              <SelectItem value="at_shop">At Shop</SelectItem>
              <SelectItem value="in_service">In Service</SelectItem>
              <SelectItem value="service_complete">Service Complete</SelectItem>
              <SelectItem value="ready_for_pickup">Ready for Pickup</SelectItem>
              <SelectItem value="queued_for_delivery">Queued for Delivery</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
            </SelectContent>
          </Select>

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
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Job ID</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Customer Name</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Current Status</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Initiated</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Completed</th>
                  <th className="text-left p-4 font-semibold text-[var(--ecs-dark)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center p-8 text-muted-foreground">
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
                            <span className="job-id cursor-pointer hover:underline" data-testid={`link-job-${job.jobId}`}>{job.jobId}</span>
                          </Link>
                        </td>
                        <td className="p-4">
                          <div className="font-medium">{job.customerName}</div>
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
