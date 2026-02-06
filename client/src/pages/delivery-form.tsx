import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { captureGps, getDeviceInfo } from "@/lib/gpsCapture";
import { enqueue } from "@/lib/offlineQueue";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Truck, MapPin, ArrowLeft, Loader2, WifiOff } from "lucide-react";

interface FormSubmission {
  id: string;
  jobId: string;
  formType: string;
  status: string;
  prefilledData: Record<string, unknown> | null;
}

const deliveryFormSchema = z.object({
  deliveredTo: z.string().min(1, "Delivered To is required"),
  deliveryNotes: z.string().optional(),
});

type DeliveryFormValues = z.infer<typeof deliveryFormSchema>;

export default function DeliveryForm() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: submission, isLoading } = useQuery<FormSubmission>({
    queryKey: [`/api/form-submissions/${id}`],
    enabled: !!id,
  });

  const prefill = (submission?.prefilledData ?? {}) as Record<string, unknown>;

  const form = useForm<DeliveryFormValues>({
    resolver: zodResolver(deliveryFormSchema),
    defaultValues: {
      deliveredTo: "",
      deliveryNotes: "",
    },
  });

  // Mark as in_progress when form is opened
  const startMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/form-submissions/${id}/start`);
    },
  });

  if (submission?.status === "dispatched" && !startMutation.isPending && !startMutation.isSuccess) {
    startMutation.mutate();
  }

  const submitMutation = useMutation({
    mutationFn: async (values: DeliveryFormValues) => {
      const gps = await captureGps();
      const deviceInfo = getDeviceInfo();

      const payload = {
        responseData: values,
        gps: gps ? { latitude: gps.latitude, longitude: gps.longitude, accuracy: gps.accuracy } : undefined,
        deviceInfo,
      };

      if (!navigator.onLine) {
        await enqueue({
          submissionId: id!,
          responseData: values,
          gps: gps ? { latitude: gps.latitude, longitude: gps.longitude, accuracy: gps.accuracy } : undefined,
          deviceInfo,
        });
        return { offline: true };
      }

      const res = await apiRequest("POST", `/api/form-submissions/${id}/complete`, payload);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`/api/form-submissions/assigned`] });

      if (result?.offline) {
        toast({
          title: "Saved Offline",
          description: "Delivery form saved. It will sync when you're back online.",
        });
      } else {
        toast({
          title: "Delivery Complete",
          description: "Delivery form submitted successfully.",
        });
      }
      navigate("/driver");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit delivery form",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Form submission not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/driver")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/driver")}>
        <ArrowLeft className="h-4 w-4 mr-2" />Back
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Delivery Form
        </h1>
        {!navigator.onLine && (
          <span className="text-xs flex items-center gap-1 text-orange-600">
            <WifiOff className="h-3 w-3" /> Offline
          </span>
        )}
      </div>

      {/* Read-only job info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Job Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Job ID</span>
              <p className="font-medium">{submission.jobId}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Customer</span>
              <p className="font-medium">{(prefill.customerName as string) || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Ship To</span>
              <p className="font-medium">{(prefill.customerShipTo as string) || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Shop</span>
              <p className="font-medium">{(prefill.shopName as string) || "—"}</p>
            </div>
          </div>
          {prefill.deliveryAddress && (
            <div className="flex items-start gap-1 pt-1">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span>{prefill.deliveryAddress as string}</span>
            </div>
          )}
          {prefill.deliveryNotes && (
            <div className="pt-1 p-2 bg-muted rounded text-xs">
              <span className="font-medium">Delivery Notes: </span>
              {prefill.deliveryNotes as string}
            </div>
          )}
          {prefill.contactName && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-muted-foreground">Contact</span>
                <p className="font-medium">{prefill.contactName as string}</p>
              </div>
              {prefill.contactNumber && (
                <div>
                  <span className="text-muted-foreground">Phone</span>
                  <p className="font-medium">{prefill.contactNumber as string}</p>
                </div>
              )}
            </div>
          )}
          {prefill.orderNumber && (
            <div>
              <span className="text-muted-foreground">Order #</span>
              <p className="font-medium">{prefill.orderNumber as string}</p>
            </div>
          )}
          {prefill.itemCount && (
            <div className="flex items-center gap-1 text-sm">
              <span className="text-muted-foreground">Items:</span>
              <span className="font-medium">{prefill.itemCount as number}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Driver-editable fields */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Delivery Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit((v) => submitMutation.mutate(v))} className="space-y-4">
              <FormField
                control={form.control}
                name="deliveredTo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivered To *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Name of person who received delivery"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deliveryNotes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Any notes about this delivery..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
                ) : (
                  "Complete Delivery"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
