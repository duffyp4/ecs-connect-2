import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Truck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocations } from "@/hooks/use-reference-data";
import type { Job } from "@shared/schema";

const deliveryDispatchSchema = z.object({
  location: z.string().min(1, "Location is required"),
  customerName: z.string(),
  customerShipTo: z.string(),
  orderNumber: z.string().optional(),
  orderNumber2: z.string().optional(),
  orderNumber3: z.string().optional(),
  orderNumber4: z.string().optional(),
  orderNumber5: z.string().optional(),
  driver: z.string().min(1, "Driver is required"),
  driverEmail: z.string(),
  deliveryNotes: z.string().optional(),
});

type DeliveryDispatchFormData = z.infer<typeof deliveryDispatchSchema>;

interface DeliveryDispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  onSuccess: () => void;
}

export function DeliveryDispatchModal({
  open,
  onOpenChange,
  job,
  onSuccess,
}: DeliveryDispatchModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch drivers from reference data
  const { data: drivers = [] } = useQuery<{ name: string; email: string }[]>({
    queryKey: ['/api/reference/driver-details'],
  });

  // Fetch locations from reference data
  const { data: locations = [], isLoading: isLoadingLocations } = useLocations();

  const form = useForm<DeliveryDispatchFormData>({
    resolver: zodResolver(deliveryDispatchSchema),
    defaultValues: {
      location: job.shopName || "",
      customerName: job.customerName || "",
      customerShipTo: job.customerShipTo || "",
      orderNumber: job.orderNumber || "",
      orderNumber2: job.orderNumber2 || "",
      orderNumber3: job.orderNumber3 || "",
      orderNumber4: job.orderNumber4 || "",
      orderNumber5: job.orderNumber5 || "",
      driver: "",
      driverEmail: "",
      deliveryNotes: job.deliveryNotes || "",
    },
  });

  const onSubmit = async (data: DeliveryDispatchFormData) => {
    try {
      setIsSubmitting(true);

      // Map form data to API format
      await apiRequest("POST", `/api/jobs/${job.jobId}/dispatch-delivery`, {
        driverEmail: data.driverEmail,
        deliveryAddress: data.customerShipTo,
        deliveryNotes: data.deliveryNotes,
        orderNumber: data.orderNumber,
        orderNumber2: data.orderNumber2,
        orderNumber3: data.orderNumber3,
        orderNumber4: data.orderNumber4,
        orderNumber5: data.orderNumber5,
      });

      // Invalidate queries to refresh data immediately
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });

      toast({
        title: "Delivery Dispatched",
        description: `Delivery dispatched to ${data.driver}`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to dispatch delivery",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Dispatch for Delivery
          </DialogTitle>
          <DialogDescription>
            Select driver and provide delivery details for Job {job.jobId}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-200px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
                {/* Location */}
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-location">
                            <SelectValue placeholder="Select location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingLocations ? (
                            <SelectItem value="loading" disabled>Loading locations...</SelectItem>
                          ) : (
                            locations.map((location) => (
                              <SelectItem key={location} value={location}>
                                {location}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Customer Name (pre-populated) */}
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled
                          data-testid="input-customer-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Customer Ship-To (pre-populated) */}
                <FormField
                  control={form.control}
                  name="customerShipTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Ship-To</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          disabled
                          data-testid="input-customer-ship-to"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Order Number */}
                <FormField
                  control={form.control}
                  name="orderNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Number</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter order number"
                          data-testid="input-order-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Order Number - #2 */}
                <FormField
                  control={form.control}
                  name="orderNumber2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Number - #2</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter order number #2"
                          data-testid="input-order-number-2"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Order Number - #3 */}
                <FormField
                  control={form.control}
                  name="orderNumber3"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Number - #3</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter order number #3"
                          data-testid="input-order-number-3"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Order Number - #4 */}
                <FormField
                  control={form.control}
                  name="orderNumber4"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Number - #4</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter order number #4"
                          data-testid="input-order-number-4"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Order Number - #5 */}
                <FormField
                  control={form.control}
                  name="orderNumber5"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Number - #5</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter order number #5"
                          data-testid="input-order-number-5"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Driver */}
                <FormField
                  control={form.control}
                  name="driver"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Driver *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          // Auto-populate driver email when driver is selected
                          const selectedDriver = drivers.find((d) => d.name === value);
                          form.setValue("driverEmail", selectedDriver?.email || "");
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-driver">
                            <SelectValue placeholder="Select driver" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {drivers.map((driver) => (
                            <SelectItem
                              key={driver.name}
                              value={driver.name}
                            >
                              {driver.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Driver Email (read-only, auto-populated) */}
                <FormField
                  control={form.control}
                  name="driverEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-muted-foreground">Driver Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          readOnly
                          disabled
                          className="bg-muted text-muted-foreground cursor-not-allowed"
                          placeholder="Auto-populated when driver is selected"
                          data-testid="input-driver-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Notes to Driver */}
                <FormField
                  control={form.control}
                  name="deliveryNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes to Driver</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Enter any notes for the driver"
                          rows={3}
                          data-testid="input-delivery-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            data-testid="button-cancel-delivery"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-confirm-delivery"
            onClick={form.handleSubmit(onSubmit)}
          >
            {isSubmitting ? "Dispatching..." : "Dispatch Delivery"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
