import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocations } from "@/hooks/use-reference-data";
import { useTimezone } from "@/hooks/useTimezone";
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Package, ChevronsUpDown, Check, Truck, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Job } from "@shared/schema";

const outboundShipmentSchema = z.object({
  location: z.string().min(1, "Location is required"),
  orderNumber: z.string().min(1, "Order number is required"),
  orderNumber2: z.string().optional(),
  orderNumber3: z.string().optional(),
  orderNumber4: z.string().optional(),
  orderNumber5: z.string().optional(),
  carrier: z.string().min(1, "Carrier is required"),
  trackingNumber: z.string().min(1, "Tracking number is required"),
  expectedArrival: z.date().optional(),
  shippingNotes: z.string().optional(),
});

type OutboundShipmentFormData = z.infer<typeof outboundShipmentSchema>;

interface OutboundShipmentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  onSuccess: () => void;
}

export function OutboundShipmentModal({
  open,
  onOpenChange,
  job,
  onSuccess,
}: OutboundShipmentModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [carrierOpen, setCarrierOpen] = useState(false);
  const [expectedArrivalOpen, setExpectedArrivalOpen] = useState(false);
  
  const { data: locations = [], isLoading: isLoadingLocations } = useLocations();
  const { getTodayInTimezone } = useTimezone();
  const today = getTodayInTimezone();

  const form = useForm<OutboundShipmentFormData>({
    resolver: zodResolver(outboundShipmentSchema),
    defaultValues: {
      location: job.shopName || "",
      orderNumber: job.orderNumber || "",
      orderNumber2: job.orderNumber2 || "",
      orderNumber3: job.orderNumber3 || "",
      orderNumber4: job.orderNumber4 || "",
      orderNumber5: job.orderNumber5 || "",
      carrier: "",
      trackingNumber: "",
      expectedArrival: undefined,
      shippingNotes: "",
    },
  });

  const carrier = form.watch("carrier");

  const onSubmit = async (data: OutboundShipmentFormData) => {
    try {
      setIsSubmitting(true);

      await apiRequest("POST", `/api/jobs/${job.jobId}/outbound-shipment`, {
        location: data.location,
        orderNumber: data.orderNumber,
        orderNumber2: data.orderNumber2,
        orderNumber3: data.orderNumber3,
        orderNumber4: data.orderNumber4,
        orderNumber5: data.orderNumber5,
        carrier: data.carrier,
        trackingNumber: data.trackingNumber,
        expectedArrival: data.expectedArrival?.toISOString(),
        shippingNotes: data.shippingNotes,
      });

      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });

      toast({
        title: "Outbound Shipment",
        description: "Job has been marked as shipped",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark job as shipped",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Outbound Shipment
          </DialogTitle>
          <DialogDescription>
            Ship items for Job {job.jobId}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-200px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
                {/* Shop Name */}
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shop Name *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-outbound-location">
                            <SelectValue placeholder="Select shop" />
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

                {/* Customer Name (read-only) */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">Customer Name</label>
                  <Input
                    value={job.customerName || ""}
                    readOnly
                    disabled
                    className="bg-muted"
                    data-testid="input-customer-name-readonly"
                  />
                </div>

                {/* Customer Ship-To (read-only) */}
                <div>
                  <label className="block text-sm font-medium mb-2 text-muted-foreground">Customer Ship-To</label>
                  <Input
                    value={job.customerShipTo || ""}
                    readOnly
                    disabled
                    className="bg-muted"
                    data-testid="input-customer-ship-to-readonly"
                  />
                </div>

                {/* Order Number */}
                <FormField
                  control={form.control}
                  name="orderNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Number *</FormLabel>
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

                {/* Carrier Combobox */}
                <FormField
                  control={form.control}
                  name="carrier"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Carrier *</FormLabel>
                      <Popover open={carrierOpen} onOpenChange={setCarrierOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={carrierOpen}
                              className="w-full justify-between"
                              data-testid="combobox-carrier"
                            >
                              {field.value || "Select or type carrier..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-[400px] p-0">
                          <Command shouldFilter={false}>
                            <div className="flex items-center border-b px-3">
                              <Truck className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                              <Input
                                placeholder="Search carriers or enter custom carrier..."
                                value={field.value || ""}
                                onChange={(e) => field.onChange(e.target.value)}
                                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                                data-testid="input-carrier-search"
                              />
                            </div>
                            <CommandList>
                              {["AAA Cooper", "FedEx Freight", "XPO", "R&L Carriers", "Estes Express", "Saia", "Averitt Express", "UPS", "USPS", "Central Transport", "Southeastern Freight", "Old Dominion"]
                                .filter(c => 
                                  !field.value || 
                                  c.toLowerCase().includes((field.value || "").toLowerCase())
                                )
                                .map((c) => (
                                  <CommandItem
                                    key={c}
                                    value={c}
                                    onSelect={() => {
                                      field.onChange(c);
                                      setCarrierOpen(false);
                                    }}
                                    data-testid={`option-carrier-${c}`}
                                  >
                                    <Check className={cn("mr-2 h-4 w-4", field.value === c ? "opacity-100" : "opacity-0")} />
                                    {c}
                                  </CommandItem>
                                ))}
                              {field.value && 
                               !["AAA Cooper", "FedEx Freight", "XPO", "R&L Carriers", "Estes Express", "Saia", "Averitt Express", "UPS", "USPS", "Central Transport", "Southeastern Freight", "Old Dominion"].some(c => 
                                 c.toLowerCase() === (field.value || "").toLowerCase()
                               ) && (
                                <div className="p-2 border-t">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-start"
                                    onClick={() => {
                                      setCarrierOpen(false);
                                    }}
                                  >
                                    Add "{field.value}" as carrier
                                  </Button>
                                </div>
                              )}
                              {!field.value && (
                                <div className="py-6 text-center text-sm text-muted-foreground">Type to search or add a carrier</div>
                              )}
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tracking Number */}
                <FormField
                  control={form.control}
                  name="trackingNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tracking # / PRO # *</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder="Enter tracking number"
                          data-testid="input-tracking-number"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Expected Arrival Date */}
                <FormField
                  control={form.control}
                  name="expectedArrival"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Expected Arrival Date (Optional)</FormLabel>
                      <Popover open={expectedArrivalOpen} onOpenChange={setExpectedArrivalOpen}>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !field.value && "text-muted-foreground"
                              )}
                              data-testid="button-expected-arrival"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, "PPP") : "Select date..."}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={(date) => {
                              field.onChange(date);
                              setExpectedArrivalOpen(false);
                            }}
                            disabled={(date) => date < today}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Shipping Notes */}
                <FormField
                  control={form.control}
                  name="shippingNotes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shipping Notes (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          placeholder="Any notes about the shipment..."
                          rows={3}
                          data-testid="input-shipping-notes"
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
            data-testid="button-cancel-outbound-shipment"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-confirm-outbound-shipment"
            onClick={form.handleSubmit(onSubmit)}
          >
            {isSubmitting ? "Processing..." : "Ship Items"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
