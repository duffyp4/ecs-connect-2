import { useState, useEffect, useMemo } from "react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Truck, Database, ChevronsUpDown, Check, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocations, useCustomerNames, useShipToForCustomer, useDriversForShop } from "@/hooks/use-reference-data";
import { cn } from "@/lib/utils";
import type { Job } from "@shared/schema";
import { generateJobId } from "@shared/shopCodes";

const deliveryDispatchSchema = z.object({
  location: z.string().min(1, "Location is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerShipTo: z.string().min(1, "Customer ship-to is required"),
  orderNumber: z.string().min(1, "Order number is required"),
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
  job?: Job;
  onSuccess: () => void;
  mode?: 'existing' | 'new';
}

export function DeliveryDispatchModal({
  open,
  onOpenChange,
  job,
  onSuccess,
  mode = 'existing',
}: DeliveryDispatchModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [shipToSearchOpen, setShipToSearchOpen] = useState(false);
  const [generatedJobId, setGeneratedJobId] = useState<string>("");

  const isNewMode = mode === 'new';

  const { data: locations = [], isLoading: isLoadingLocations } = useLocations();
  const { data: customerNames = [], isLoading: isLoadingCustomers } = useCustomerNames();

  const form = useForm<DeliveryDispatchFormData>({
    resolver: zodResolver(deliveryDispatchSchema),
    defaultValues: {
      location: job?.shopName || "",
      customerName: job?.customerName || "",
      customerShipTo: job?.customerShipTo || "",
      orderNumber: job?.orderNumber || "",
      orderNumber2: job?.orderNumber2 || "",
      orderNumber3: job?.orderNumber3 || "",
      orderNumber4: job?.orderNumber4 || "",
      orderNumber5: job?.orderNumber5 || "",
      driver: "",
      driverEmail: "",
      deliveryNotes: job?.deliveryNotes || "",
    },
  });

  const watchedCustomerName = form.watch("customerName");
  const watchedLocation = form.watch("location");
  const { data: shipToOptions = [], isLoading: isLoadingShipTo } = useShipToForCustomer(
    isNewMode ? watchedCustomerName : undefined
  );
  const { data: drivers = [], isLoading: isLoadingDrivers } = useDriversForShop(watchedLocation || undefined);

  useEffect(() => {
    if (isNewMode && watchedLocation) {
      setGeneratedJobId(generateJobId(watchedLocation));
    }
  }, [isNewMode, watchedLocation]);

  useEffect(() => {
    if (isNewMode && watchedCustomerName) {
      form.setValue("customerShipTo", "");
    }
  }, [isNewMode, watchedCustomerName, form]);

  useEffect(() => {
    if (open) {
      form.reset({
        location: job?.shopName || "",
        customerName: job?.customerName || "",
        customerShipTo: job?.customerShipTo || "",
        orderNumber: job?.orderNumber || "",
        orderNumber2: job?.orderNumber2 || "",
        orderNumber3: job?.orderNumber3 || "",
        orderNumber4: job?.orderNumber4 || "",
        orderNumber5: job?.orderNumber5 || "",
        driver: "",
        driverEmail: "",
        deliveryNotes: job?.deliveryNotes || "",
      });
      if (isNewMode) {
        setGeneratedJobId("");
      }
    }
  }, [open, job, form, isNewMode]);

  const onSubmit = async (data: DeliveryDispatchFormData) => {
    try {
      setIsSubmitting(true);

      if (isNewMode) {
        const response = await apiRequest("POST", "/api/jobs/direct-delivery", {
          shopName: data.location,
          customerName: data.customerName,
          customerShipTo: data.customerShipTo,
          driverEmail: data.driverEmail,
          driverName: data.driver,
          deliveryNotes: data.deliveryNotes,
          orderNumber: data.orderNumber,
          orderNumber2: data.orderNumber2,
          orderNumber3: data.orderNumber3,
          orderNumber4: data.orderNumber4,
          orderNumber5: data.orderNumber5,
        });
        
        // Use the actual jobId from the response, not the pre-generated one
        const createdJob = await response.json();

        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });

        toast({
          title: "Dispatch Delivery Created",
          description: `Job ${createdJob.jobId} created and delivery dispatched to ${data.driver}`,
        });
      } else {
        await apiRequest("POST", `/api/jobs/${job!.jobId}/dispatch-delivery`, {
          driverEmail: data.driverEmail,
          deliveryAddress: data.customerShipTo,
          deliveryNotes: data.deliveryNotes,
          orderNumber: data.orderNumber,
          orderNumber2: data.orderNumber2,
          orderNumber3: data.orderNumber3,
          orderNumber4: data.orderNumber4,
          orderNumber5: data.orderNumber5,
        });

        queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${job!.jobId}/comments`] });
        queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });

        toast({
          title: "Delivery Dispatched",
          description: `Delivery dispatched to ${data.driver}`,
        });
      }

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
            {isNewMode ? "Dispatch Delivery" : "Dispatch for Delivery"}
          </DialogTitle>
          <DialogDescription>
            {isNewMode 
              ? "Create a new job and dispatch delivery directly to customer"
              : `Select driver and provide delivery details for Job ${job?.jobId}`
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-200px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
                {isNewMode && generatedJobId && (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Job ID:</strong> <span className="job-id">{generatedJobId}</span>
                      <div className="text-xs text-muted-foreground mt-1">
                        Automatically generated based on location
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shop Name *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-location">
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

                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        {isNewMode && <Database className="h-3 w-3 text-muted-foreground" />}
                        Customer Name *
                      </FormLabel>
                      {isNewMode ? (
                        <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={customerSearchOpen}
                                className="w-full justify-between"
                                data-testid="select-customer-name"
                              >
                                {field.value || "Select or type customer name..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                            <Command shouldFilter={false}>
                              <div className="flex items-center border-b px-3">
                                <Database className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <Input
                                  placeholder="Search customers or enter custom name..."
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                                  data-testid="input-customer-search"
                                />
                              </div>
                              <CommandList>
                                {isLoadingCustomers ? (
                                  <div className="py-6 text-center text-sm">Loading customers...</div>
                                ) : (
                                  <>
                                    {customerNames
                                      .filter((customer) =>
                                        customer.toLowerCase().includes((field.value || "").toLowerCase())
                                      )
                                      .slice(0, 100)
                                      .map((customer) => (
                                        <CommandItem
                                          key={customer}
                                          value={customer}
                                          onSelect={() => {
                                            field.onChange(customer);
                                            setCustomerSearchOpen(false);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              field.value === customer ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {customer}
                                        </CommandItem>
                                      ))}
                                    {field.value && 
                                     !customerNames.some(c => 
                                       c.toLowerCase() === field.value.toLowerCase()
                                     ) && (
                                      <div className="p-2 border-t">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full"
                                          onClick={() => setCustomerSearchOpen(false)}
                                        >
                                          Use "{field.value}" as custom name
                                        </Button>
                                      </div>
                                    )}
                                    {customerNames
                                      .filter((c) =>
                                        c.toLowerCase().includes((field.value || "").toLowerCase())
                                      ).length === 0 && !field.value && (
                                      <div className="py-6 text-center text-sm">No customers found</div>
                                    )}
                                  </>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <FormControl>
                          <Input
                            {...field}
                            disabled
                            data-testid="input-customer-name"
                          />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerShipTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        {isNewMode && <Database className="h-3 w-3 text-muted-foreground" />}
                        Customer Ship-To *
                      </FormLabel>
                      {isNewMode ? (
                        <Popover open={shipToSearchOpen} onOpenChange={setShipToSearchOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={shipToSearchOpen}
                                className="w-full justify-between"
                                data-testid="select-ship-to"
                                disabled={!watchedCustomerName}
                              >
                                {field.value || (watchedCustomerName ? "Select or type ship-to..." : "Select customer first")}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                            <Command shouldFilter={false}>
                              <div className="flex items-center border-b px-3">
                                <Database className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <Input
                                  placeholder="Search ship-to or enter custom address..."
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                                  data-testid="input-ship-to-search"
                                />
                              </div>
                              <CommandList>
                                {isLoadingShipTo ? (
                                  <div className="py-6 text-center text-sm">Loading ship-to options...</div>
                                ) : (
                                  <>
                                    {shipToOptions
                                      .filter((shipTo) =>
                                        shipTo.toLowerCase().includes((field.value || "").toLowerCase())
                                      )
                                      .slice(0, 100)
                                      .map((shipTo) => (
                                        <CommandItem
                                          key={shipTo}
                                          value={shipTo}
                                          onSelect={() => {
                                            field.onChange(shipTo);
                                            setShipToSearchOpen(false);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              field.value === shipTo ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {shipTo}
                                        </CommandItem>
                                      ))}
                                    {field.value && 
                                     !shipToOptions.some(s => 
                                       s.toLowerCase() === field.value.toLowerCase()
                                     ) && (
                                      <div className="p-2 border-t">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full"
                                          onClick={() => setShipToSearchOpen(false)}
                                        >
                                          Use "{field.value}" as custom address
                                        </Button>
                                      </div>
                                    )}
                                    {shipToOptions
                                      .filter((s) =>
                                        s.toLowerCase().includes((field.value || "").toLowerCase())
                                      ).length === 0 && !field.value && (
                                      <div className="py-6 text-center text-sm">
                                        {watchedCustomerName ? "No ship-to locations found for this customer" : "Select a customer first"}
                                      </div>
                                    )}
                                  </>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      ) : (
                        <FormControl>
                          <Input
                            {...field}
                            disabled
                            data-testid="input-customer-ship-to"
                          />
                        </FormControl>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

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

                <FormField
                  control={form.control}
                  name="driver"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Driver *</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
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
                          {isLoadingDrivers ? (
                            <SelectItem value="_loading" disabled>Loading drivers...</SelectItem>
                          ) : !watchedLocation ? (
                            <SelectItem value="_no_location" disabled>Select a location first</SelectItem>
                          ) : drivers.length === 0 ? (
                            <SelectItem value="_no_drivers" disabled>No drivers for this location</SelectItem>
                          ) : (
                            drivers.map((driver) => (
                              <SelectItem
                                key={driver.name}
                                value={driver.name}
                              >
                                {driver.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
            {isSubmitting 
              ? (isNewMode ? "Creating..." : "Dispatching...") 
              : (isNewMode ? "Create & Dispatch" : "Dispatch Delivery")
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
