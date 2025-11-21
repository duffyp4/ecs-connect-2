import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, 
  ArrowLeft, 
  Truck, 
  CheckCircle, 
  Store, 
  Wrench, 
  Package,
  Send,
  XCircle,
  Clock,
  MessageSquare,
  Settings,
  RefreshCw,
  Edit
} from "lucide-react";
import JobStatusBadge from "@/components/job-status-badge";
import { CheckInModal } from "@/components/check-in-modal";
import { DeliveryDispatchModal } from "@/components/delivery-dispatch-modal";
import { ReadyForPickupModal } from "@/components/ready-for-pickup-modal";
import { PartsManagementModal } from "@/components/parts-management-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTimezone } from "@/hooks/useTimezone";
import { useDevMode } from "@/contexts/DevModeContext";
import { PART_DIAGNOSIS_OPTIONS, PART_STATUS_OPTIONS } from "@shared/schema";

type JobEvent = {
  id: string;
  jobId: string;
  eventType: string;
  fromState: string | null;
  toState: string;
  timestamp: string;
  metadata: any;
};

type JobComment = {
  id: string;
  jobId: string;
  userId: string;
  commentText: string;
  createdAt: string;
  userEmail?: string | null;
  userFirstName?: string | null;
  userLastName?: string | null;
};

export default function JobDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { isDevMode } = useDevMode();
  const { formatDateTime } = useTimezone();
  const jobId = params.id;
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [deliveryDispatchModalOpen, setDeliveryDispatchModalOpen] = useState(false);
  const [readyForPickupModalOpen, setReadyForPickupModalOpen] = useState(false);
  const [partsManagementModalOpen, setPartsManagementModalOpen] = useState(false);
  const [editingPart, setEditingPart] = useState<any>(null);
  const [newComment, setNewComment] = useState("");

  const { data: job, isLoading: jobLoading } = useQuery<any>({
    queryKey: [`/api/jobs/${jobId}`],
    enabled: !!jobId,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<JobEvent[]>({
    queryKey: [`/api/jobs/${jobId}/events`],
    enabled: !!jobId,
  });

  const { data: comments = [], isLoading: commentsLoading } = useQuery<JobComment[]>({
    queryKey: [`/api/jobs/${jobId}/comments`],
    enabled: !!jobId,
  });

  const { data: parts = [], isLoading: partsLoading } = useQuery<any[]>({
    queryKey: [`/api/jobs/${jobId}/parts`],
    enabled: !!jobId,
  });

  // Mutation for adding comments
  const addCommentMutation = useMutation({
    mutationFn: async (commentText: string) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/comments`, { commentText });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/comments`] });
      setNewComment("");
      toast({
        title: "Success",
        description: "Comment added successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add comment",
        variant: "destructive",
      });
    },
  });

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    addCommentMutation.mutate(newComment.trim());
  };

  // Mutation for job actions
  const actionMutation = useMutation({
    mutationFn: async ({ action, data }: { action: string; data?: any }) => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/${action}`, data || {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/events`] });
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

  // Mutation for manual update check (dev mode only)
  const checkUpdatesMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/jobs/${jobId}/check-updates`, {});
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/events`] });
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      
      if (data.hasUpdate) {
        toast({
          title: "Update Found!",
          description: `Job transitioned from ${data.previousState} to ${data.currentState}`,
        });
      } else {
        toast({
          title: "No Updates",
          description: data.message || "No updates found in GoCanvas",
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to check for updates",
        variant: "destructive",
      });
    },
  });

  // Mutation for updating part internal tracking fields
  const updatePartMutation = useMutation({
    mutationFn: async ({ partId, field, value }: { partId: string; field: string; value: string }) => {
      const response = await apiRequest("PATCH", `/api/jobs/${jobId}/parts/${partId}`, {
        [field]: value,
      });
      return response.json();
    },
    onMutate: async ({ partId, field, value }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: [`/api/jobs/${jobId}/parts`] });
      
      // Snapshot the previous value
      const previousParts = queryClient.getQueryData([`/api/jobs/${jobId}/parts`]);
      
      // Optimistically update to the new value
      queryClient.setQueryData([`/api/jobs/${jobId}/parts`], (old: any) => {
        if (!old) return old;
        return old.map((part: any) => 
          part.id === partId ? { ...part, [field]: value } : part
        );
      });
      
      // Return a context object with the snapshotted value
      return { previousParts };
    },
    onError: (error: any, variables, context: any) => {
      // Rollback on error
      if (context?.previousParts) {
        queryClient.setQueryData([`/api/jobs/${jobId}/parts`], context.previousParts);
      }
      toast({
        title: "Error",
        description: error.message || "Failed to update part",
        variant: "destructive",
      });
    },
    onSettled: () => {
      // Always refetch after error or success to ensure we're in sync with server
      queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/parts`] });
    },
  });

  if (jobLoading || eventsLoading) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Loading job details...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Job not found</p>
      </div>
    );
  }

  const currentState = job.state;
  const isPending = actionMutation.isPending;

  const getEventIcon = (eventType: string) => {
    return <Clock className="h-4 w-4" />;
  };

  const getEventIconColor = (event: JobEvent, index: number, isJobCompleted: boolean, totalEvents: number) => {
    // Only apply special coloring to the most recent event (last in timeline)
    const isLastEvent = index === totalEvents - 1;
    
    if (!isLastEvent) {
      return "bg-[var(--ecs-primary)]";
    }

    // Check if this event is completing the job
    const completionStates = ['delivered', 'ready_for_pickup', 'picked_up_from_shop'];
    const isCompletionEvent = 
      event.eventType === 'delivered' || 
      event.eventType === 'ready_for_pickup' ||
      event.eventType === 'picked_up_from_shop' ||
      (event.eventType === 'state_change' && event.metadata?.newState && completionStates.includes(event.metadata.newState));

    if (isCompletionEvent) {
      return "bg-green-500";
    }

    // Yellow for in-progress/pending jobs
    if (!isJobCompleted) {
      return "bg-yellow-500";
    }

    return "bg-[var(--ecs-primary)]";
  };

  const formatEventType = (eventType: string) => {
    if (!eventType) return 'N/A';
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getEventLabel = (event: JobEvent) => {
    // For state_change events, show what actually happened
    if (event.eventType === 'state_change' && event.metadata?.newState) {
      switch (event.metadata.newState) {
        case 'picked_up':
          return 'Picked Up';
        case 'at_shop':
          return 'Checked In at Shop';
        case 'in_service':
          return 'Service Started';
        case 'service_complete':
          return 'Service Complete';
        case 'ready_for_pickup':
          return 'Ready for Pickup';
        case 'queued_for_delivery':
          return 'Queued for Delivery';
        case 'delivered':
          return 'Delivered';
        case 'cancelled':
          return 'Cancelled';
        default:
          return formatEventType(event.metadata.newState);
      }
    }
    return formatEventType(event.eventType);
  };

  const getEventDetails = (event: JobEvent) => {
    const details: string[] = [];

    // For pickup dispatched, show user who assigned it and driver
    if (event.eventType === 'pickup_dispatched') {
      // Show user who created/assigned the pickup
      if (job.userId) {
        details.push(`Assigned by: ${job.userId}`);
      }
      
      // Show driver
      if (event.metadata?.driverEmail && typeof event.metadata.driverEmail === 'string') {
        const driverEmail = event.metadata.driverEmail;
        const driverName = driverEmail.split('@')[0].replace('.', ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        details.push(`Driver: ${driverName}`);
      }
    }

    // For delivery dispatched, show driver
    if (event.eventType === 'delivery_dispatched') {
      if (event.metadata?.driverEmail && typeof event.metadata.driverEmail === 'string') {
        const driverEmail = event.metadata.driverEmail;
        const driverName = driverEmail.split('@')[0].replace('.', ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        details.push(`Driver: ${driverName}`);
      }
    }

    // For state changes, show assignment details
    if (event.eventType === 'state_change' && event.metadata) {
      const { newState } = event.metadata;

      // Picked up - show who picked it up (from submission or direct check-in)
      if (newState === 'picked_up') {
        if (event.metadata.directCheckIn) {
          details.push('Direct shop check-in (no pickup)');
        }
      }

      // Checked in at shop - show user ID and technician
      if (newState === 'at_shop') {
        // Try to get from event metadata first, fallback to job data
        const userId = event.metadata.userId || job.userId;
        const shopHandoff = event.metadata.shopHandoff || job.shopHandoff;
        
        if (userId) {
          details.push(`User: ${userId}`);
        }
        if (shopHandoff) {
          const techName = shopHandoff.split('@')[0].replace('.', ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
          details.push(`Technician: ${techName}`);
        }
      }

      // Show auto-detected for any state change detected from GoCanvas
      if (event.metadata.autoDetected) {
        details.push('Auto-detected from GoCanvas submission');
      }
    }

    return details;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            data-testid="button-back"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Jobs
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-[var(--ecs-dark)] flex items-center gap-2">
              <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
              Job {job.jobId}
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              View details and manage job status
            </p>
          </div>
        </div>
        <JobStatusBadge status={job.state} />
      </div>
      {/* Action Buttons */}
      <Card>
        <CardHeader className="card-header">
          <CardTitle className="text-white">Available Actions</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4 items-center">
            <Button 
              onClick={() => setCheckInModalOpen(true)}
              disabled={!isDevMode && (currentState !== 'picked_up' || isPending)}
              className="btn-primary"
              data-testid="button-check-in"
            >
              <Store className="mr-2 h-4 w-4" />
              Check In at Shop
            </Button>

            <Button 
              onClick={() => setReadyForPickupModalOpen(true)}
              disabled={!isDevMode && (currentState !== 'service_complete' || isPending)}
              className="btn-primary"
              data-testid="button-ready-pickup"
            >
              <Package className="mr-2 h-4 w-4" />
              Ready for Pickup
            </Button>

            <Button 
              onClick={() => setDeliveryDispatchModalOpen(true)}
              disabled={!isDevMode && (currentState !== 'service_complete' || isPending)}
              className="btn-primary"
              data-testid="button-dispatch-delivery"
            >
              <Send className="mr-2 h-4 w-4" />
              Dispatch for Delivery
            </Button>

            <Button 
              onClick={() => actionMutation.mutate({ action: 'mark-picked-up-from-shop' })}
              disabled={!isDevMode && (currentState !== 'ready_for_pickup' || isPending)}
              className="btn-primary"
              data-testid="button-mark-picked-up"
            >
              <Package className="mr-2 h-4 w-4" />
              Mark as Picked Up
            </Button>

            <Button
              variant="destructive"
              onClick={() => actionMutation.mutate({ action: 'cancel' })}
              disabled={!isDevMode && (currentState === 'delivered' || currentState === 'cancelled' || isPending)}
              data-testid="button-cancel"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Job
            </Button>

            {isDevMode && (
              <Button
                variant="outline"
                onClick={() => checkUpdatesMutation.mutate()}
                disabled={checkUpdatesMutation.isPending}
                data-testid="button-check-updates"
                className="border-blue-500 text-blue-600 hover:bg-blue-50"
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${checkUpdatesMutation.isPending ? 'animate-spin' : ''}`} />
                {checkUpdatesMutation.isPending ? 'Checking...' : 'Check for Updates'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Job Information */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="card-header">
            <CardTitle className="text-white">Customer Information</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Customer Name</div>
              <div className="font-medium">{job.customerName || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Ship To</div>
              <div className="font-medium">{job.customerShipTo || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Ship to ID</div>
              <div className="font-medium">{job.p21ShipToId || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Contact Name</div>
              <div className="font-medium">{job.contactName || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Contact Number</div>
              <div className="font-medium">{job.contactNumber || 'N/A'}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="card-header">
            <CardTitle className="text-white">Job Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Job ID</div>
              <div className="font-medium" data-testid="text-job-id">{job.jobId}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Shop Location</div>
              <div className="font-medium">{job.shopName || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Initiated At</div>
              <div className="font-medium">
                {formatDateTime(job.initiatedAt, 'PPpp')}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Order Number(s)</div>
              <div className="font-medium" data-testid="text-order-numbers">
                {(() => {
                  const orderNumbers = [
                    job.orderNumber,
                    job.orderNumber2,
                    job.orderNumber3,
                    job.orderNumber4,
                    job.orderNumber5
                  ].filter(Boolean);
                  return orderNumbers.length > 0 ? orderNumbers.join(', ') : '-';
                })()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      {/* Parts Information */}
      {parts.length > 0 && (
        <Card>
          <CardHeader className="card-header">
            <CardTitle className="text-white flex items-center gap-2">
              <Package className="h-5 w-5" />
              Parts Details
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-6">
              {parts.map((part, index) => (
                <div key={part.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-[var(--ecs-primary)]">Part {index + 1}</h3>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingPart(part);
                        setPartsManagementModalOpen(true);
                      }}
                      disabled={!isDevMode && !['queued_for_pickup', 'picked_up'].includes(currentState)}
                      data-testid={`button-edit-part-${index + 1}`}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  </div>
                  
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Part</div>
                      <div className="font-medium">{part.part || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Process Being Performed</div>
                      <div className="font-medium">{part.process || 'N/A'}</div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">ECS Serial Number</div>
                      <div className="font-medium">{part.ecsSerial || 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">ECS Part Number</div>
                      <div className="font-medium">{part.ecsPartNumber || '-'}</div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Did the Part Pass or Fail?</div>
                      <div className="font-medium">{part.passOrFail || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Did the Part Require Repairs?</div>
                      <div className="font-medium">{part.requireRepairs || '-'}</div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground">Failed Reason</div>
                      <div className="font-medium">{part.failedReason || '-'}</div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Which Repairs Were Performed?</div>
                      <div className="font-medium">{part.repairsPerformed || '-'}</div>
                    </div>
                  </div>

                  {/* ECS Internal Tracking Fields - Always Editable */}
                  <Separator className="my-4" />
                  <div className="mb-2">
                    <div className="text-xs font-medium text-muted-foreground">ECS Internal Tracking</div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Diagnosis</div>
                      <Select
                        value={part.diagnosis || ""}
                        onValueChange={(value) => {
                          updatePartMutation.mutate({
                            partId: part.id,
                            field: "diagnosis",
                            value: value,
                          });
                        }}
                      >
                        <SelectTrigger data-testid={`select-diagnosis-${index + 1}`}>
                          <SelectValue placeholder="Select diagnosis..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PART_DIAGNOSIS_OPTIONS.map((diagnosis) => (
                            <SelectItem key={diagnosis} value={diagnosis}>
                              {diagnosis}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-2">Status</div>
                      <Select
                        value={part.status || ""}
                        onValueChange={(value) => {
                          updatePartMutation.mutate({
                            partId: part.id,
                            field: "status",
                            value: value,
                          });
                        }}
                      >
                        <SelectTrigger data-testid={`select-status-${index + 1}`}>
                          <SelectValue placeholder="Select status..." />
                        </SelectTrigger>
                        <SelectContent>
                          {PART_STATUS_OPTIONS.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Pickup/Delivery Information if applicable */}
      {(job.pickupDriver || job.deliveryDriver) && (
        <Card>
          <CardHeader className="card-header">
            <CardTitle className="text-white">Pickup & Delivery Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid md:grid-cols-2 gap-6">
              {job.pickupDriver && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-[var(--ecs-primary)]">Pickup Information</h3>
                  <div>
                    <div className="text-sm text-muted-foreground">Driver</div>
                    <div className="font-medium">{job.pickupDriver}</div>
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Address</div>
                    <div className="font-medium">{job.pickupAddress || 'N/A'}</div>
                  </div>
                  {job.pickupNotes && (
                    <div>
                      <div className="text-sm text-muted-foreground">Notes</div>
                      <div className="font-medium">{job.pickupNotes}</div>
                    </div>
                  )}
                </div>
              )}
              {job.deliveryDriver && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-[var(--ecs-primary)]">Delivery Information</h3>
                  <div>
                    <div className="text-sm text-muted-foreground">Driver</div>
                    <div className="font-medium">{job.deliveryDriver}</div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {/* Event Timeline and Comments - Side by Side */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Event Timeline */}
        <Card>
          <CardHeader className="card-header">
            <CardTitle className="text-white">Event Timeline</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {events.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No events recorded yet</p>
            ) : (
              <div className="space-y-4">
                {(() => {
                  const filteredEvents = events.filter(event => {
                    // Hide "queued_for_delivery" state change since we show "delivery_dispatched" instead
                    if (event.eventType === 'state_change' && event.metadata?.newState === 'queued_for_delivery') {
                      return false;
                    }
                    // Hide "picked_up" event for direct check-ins (no actual pickup occurred)
                    if (event.eventType === 'state_change' && event.metadata?.newState === 'picked_up' && event.metadata?.directCheckIn) {
                      return false;
                    }
                    return true;
                  });
                  
                  return filteredEvents.map((event, index) => {
                    const isJobCompleted = job.state === 'delivered' || job.state === 'cancelled';
                    const iconColorClass = getEventIconColor(event, index, isJobCompleted, filteredEvents.length);
                    
                    return (
                      <div key={event.id} className="flex gap-4">
                        <div className="flex flex-col items-center">
                          <div className={`flex items-center justify-center w-8 h-8 min-w-8 min-h-8 rounded-full ${iconColorClass} text-white flex-shrink-0`}>
                            {getEventIcon(event.eventType)}
                          </div>
                          {index < filteredEvents.length - 1 && (
                            <div className="w-0.5 h-full bg-gray-300 mt-2" />
                          )}
                        </div>
                        <div className="flex-1 pb-8">
                          <div className="font-medium">{getEventLabel(event)}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatDateTime(event.timestamp, 'PPpp')}
                          </div>
                          {getEventDetails(event).length > 0 && (
                            <div className="text-sm text-muted-foreground mt-1">
                              {getEventDetails(event).map((detail, idx) => (
                                <div key={idx}>{detail}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Comments */}
        <Card>
          <CardHeader className="card-header">
            <CardTitle className="text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Comments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {/* Add Comment Form */}
            <form onSubmit={handleAddComment} className="mb-6">
              <Textarea
                data-testid="input-comment"
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="mb-2"
                rows={3}
              />
              <Button
                data-testid="button-add-comment"
                type="submit"
                disabled={!newComment.trim() || addCommentMutation.isPending}
              >
                {addCommentMutation.isPending ? "Adding..." : "Add Comment"}
              </Button>
            </form>

            {/* Comments List */}
            {commentsLoading ? (
              <p className="text-muted-foreground text-center py-4">Loading comments...</p>
            ) : comments.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">No comments yet</p>
            ) : (
              <div className="space-y-4">
                {comments.map((comment) => {
                  const displayName = comment.userFirstName || comment.userLastName
                    ? `${comment.userFirstName || ''} ${comment.userLastName || ''}`.trim()
                    : comment.userEmail || comment.userId || 'Unknown User';
                  
                  return (
                    <div key={comment.id} className="border-b pb-4 last:border-0" data-testid={`comment-${comment.id}`}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium text-sm" data-testid={`text-comment-author-${comment.id}`}>
                          {displayName}
                        </div>
                        <div className="text-xs text-muted-foreground" data-testid={`text-comment-time-${comment.id}`}>
                          {formatDateTime(comment.createdAt, 'PPp')}
                        </div>
                      </div>
                      <div className="text-sm" data-testid={`text-comment-text-${comment.id}`}>
                        {comment.commentText}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {/* Check In Modal */}
      {job && (
        <CheckInModal
          open={checkInModalOpen}
          onOpenChange={setCheckInModalOpen}
          job={job}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/events`] });
            queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
            queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
          }}
        />
      )}
      {/* Delivery Dispatch Modal */}
      {job && (
        <DeliveryDispatchModal
          open={deliveryDispatchModalOpen}
          onOpenChange={setDeliveryDispatchModalOpen}
          job={job}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/events`] });
            queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
            queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
          }}
        />
      )}
      {/* Ready for Pickup Modal */}
      {job && (
        <ReadyForPickupModal
          open={readyForPickupModalOpen}
          onOpenChange={setReadyForPickupModalOpen}
          job={job}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/events`] });
            queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
            queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
          }}
        />
      )}
      {/* Parts Management Modal */}
      {job && (
        <PartsManagementModal
          open={partsManagementModalOpen}
          onOpenChange={(open) => {
            setPartsManagementModalOpen(open);
            if (!open) {
              setEditingPart(null);
            }
          }}
          jobId={job.jobId}
          editingPart={editingPart}
          showEditLockDisclaimer={true}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}`] });
            queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/parts`] });
          }}
        />
      )}
    </div>
  );
}
