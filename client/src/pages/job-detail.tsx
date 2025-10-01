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

  const currentState = job.currentState;
  const isPending = actionMutation.isPending;

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'pickup_dispatched':
        return <Truck className="h-4 w-4" />;
      case 'picked_up':
        return <CheckCircle className="h-4 w-4" />;
      case 'checked_in':
        return <Store className="h-4 w-4" />;
      case 'service_started':
        return <Wrench className="h-4 w-4" />;
      case 'ready_for_pickup':
      case 'ready_for_delivery':
        return <Package className="h-4 w-4" />;
      case 'delivery_dispatched':
        return <Send className="h-4 w-4" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const formatEventType = (eventType: string) => {
    if (!eventType) return 'N/A';
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
        <JobStatusBadge status={job.currentState} />
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
              onClick={() => actionMutation.mutate({ action: 'mark-ready', data: { readyFor: 'pickup' } })}
              disabled={currentState !== 'in_service' || isPending}
              className="btn-primary"
              data-testid="button-ready-pickup"
            >
              <Package className="mr-2 h-4 w-4" />
              Ready for Pickup
            </Button>

            <Button 
              onClick={() => actionMutation.mutate({ action: 'mark-ready', data: { readyFor: 'delivery' } })}
              disabled={currentState !== 'in_service' || isPending}
              className="btn-primary"
              data-testid="button-ready-delivery"
            >
              <Truck className="mr-2 h-4 w-4" />
              Ready for Delivery
            </Button>

            <Button 
              onClick={() => actionMutation.mutate({ action: 'dispatch-delivery' })}
              disabled={currentState !== 'ready_for_delivery' || isPending}
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
              {events.map((event, index) => (
                <div key={event.id} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--ecs-primary)] text-white">
                      {getEventIcon(event.eventType)}
                    </div>
                    {index < events.length - 1 && (
                      <div className="w-0.5 h-full bg-gray-300 mt-2" />
                    )}
                  </div>
                  <div className="flex-1 pb-8">
                    <div className="font-medium">{formatEventType(event.eventType)}</div>
                    <div className="text-sm text-muted-foreground">
                      {event.timestamp ? format(new Date(event.timestamp), 'PPpp') : 'N/A'}
                    </div>
                    {event.fromState && event.toState && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {formatEventType(event.fromState)} → {formatEventType(event.toState)}
                      </div>
                    )}
                    {event.metadata && Object.keys(event.metadata).length > 0 && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {JSON.stringify(event.metadata)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
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
            queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId] });
            queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "events"] });
            queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
            queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
          }}
        />
      )}
    </div>
  );
}
