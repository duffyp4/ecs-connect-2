import { useParams, useLocation } from "wouter";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  Clock
} from "lucide-react";
import JobStatusBadge from "@/components/job-status-badge";
import { CheckInModal } from "@/components/check-in-modal";
import { DeliveryDispatchModal } from "@/components/delivery-dispatch-modal";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type JobEvent = {
  id: string;
  jobId: string;
  eventType: string;
  fromState: string | null;
  toState: string;
  timestamp: string;
  metadata: any;
};

export default function JobDetail() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const jobId = params.id;
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [deliveryDispatchModalOpen, setDeliveryDispatchModalOpen] = useState(false);

  const { data: job, isLoading: jobLoading } = useQuery<any>({
    queryKey: [`/api/jobs/${jobId}`],
    enabled: !!jobId,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<JobEvent[]>({
    queryKey: [`/api/jobs/${jobId}/events`],
    enabled: !!jobId,
  });

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
    const completionStates = ['delivered', 'ready_for_pickup', 'ready_for_delivery'];
    const isCompletionEvent = 
      event.eventType === 'delivered' || 
      event.eventType === 'ready_for_pickup' ||
      event.eventType === 'ready_for_delivery' ||
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
        case 'ready_for_delivery':
          return 'Ready for Delivery';
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
            onClick={() => setLocation('/jobs')}
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
              disabled={currentState !== 'picked_up' || isPending}
              className="btn-primary"
              data-testid="button-check-in"
            >
              <Store className="mr-2 h-4 w-4" />
              Check In at Shop
            </Button>

            <Button 
              onClick={() => actionMutation.mutate({ action: 'mark-ready', data: { deliveryMethod: 'pickup' } })}
              disabled={currentState !== 'service_complete' || isPending}
              className="btn-primary"
              data-testid="button-ready-pickup"
            >
              <Package className="mr-2 h-4 w-4" />
              Ready for Pickup
            </Button>

            <Button 
              onClick={() => setDeliveryDispatchModalOpen(true)}
              disabled={currentState !== 'service_complete' || isPending}
              className="btn-primary"
              data-testid="button-dispatch-delivery"
            >
              <Send className="mr-2 h-4 w-4" />
              Dispatch for Delivery
            </Button>

            <Button
              variant="destructive"
              onClick={() => actionMutation.mutate({ action: 'cancel' })}
              disabled={currentState === 'delivered' || currentState === 'cancelled' || isPending}
              data-testid="button-cancel"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Cancel Job
            </Button>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="card-header">
            <CardTitle className="text-white">Job Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">Shop Location</div>
              <div className="font-medium">{job.shopName || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Initiated At</div>
              <div className="font-medium">
                {job.initiatedAt ? format(new Date(job.initiatedAt), 'PPpp') : 'N/A'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
                          {event.timestamp ? format(new Date(event.timestamp), 'PPpp') : 'N/A'}
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
    </div>
  );
}
