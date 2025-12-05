import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insertJobSchema, pickupJobSchema } from "@shared/schema";
import { type LocalPart } from "@/components/parts-management-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCsrCheckInForm } from "@/hooks/use-csr-check-in-form";
import { useTimezone } from "@/hooks/useTimezone";
import { useLocations } from "@/hooks/use-reference-data";
import { CsrCheckInFormFields } from "@/components/csr-check-in-form-fields";
import { PartsManagementModal } from "@/components/parts-management-modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClipboardList, Send, X, Info, Clock, Database, Check, ChevronsUpDown, Truck, Store, ArrowLeft, Settings, Plus, Package, BoxIcon, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { DeliveryDispatchModal } from "@/components/delivery-dispatch-modal";
import { cn } from "@/lib/utils";
import type { z } from "zod";

type FormData = z.infer<typeof insertJobSchema>;

export default function CSRForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatedJobId, setGeneratedJobId] = useState<string>("");
  const [currentTimestamp, setCurrentTimestamp] = useState<string>("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [shipToSearchOpen, setShipToSearchOpen] = useState(false);
  const [arrivalPath, setArrivalPath] = useState<'pickup' | 'direct' | 'delivery' | 'shipment'>('direct');
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // Fetch technicians
  const { data: technicians = [] } = useQuery<any[]>({
    queryKey: ["/api/technicians"],
  });

  // Use shared CSR Check-In form hook
  const { form, referenceData, watchedFields } = useCsrCheckInForm();
  
  // Destructure reference data for easier access
  const {
    shopUsers,
    isLoadingShopUsers,
    allShops,
    isLoadingAllShops,
    customerNames,
    isLoadingCustomers,
    shipToOptions,
    isLoadingShipTo,
    usersForSelectedShop,
    isLoadingShopHandoffUsers,
    ship2Ids,
    isLoadingShip2Ids,
    techComments,
    isLoadingComments,
    sendClampsOptions,
    isLoadingSendClamps,
    preferredProcesses,
    isLoadingProcesses,
    driverDetails,
    isLoadingDrivers,
  } = referenceData;
  
  // Extract watched fields
  const { userId, shopName, customerName, customerShipTo, shopHandoff } = watchedFields;
  
  // Locations is still needed separately for this form
  const { data: locations = [], isLoading: isLoadingLocations } = useLocations();
  
  // Timezone for date picker
  const { getTodayInTimezone } = useTimezone();
  const today = getTodayInTimezone();
  
  // Map drivers for the driver select dropdown
  const drivers = driverDetails.map(d => d.name);

  // Pickup fields state
  const [pickupDriver, setPickupDriver] = useState<string>("");
  const [pickupDriverEmail, setPickupDriverEmail] = useState<string>("");
  const [pickupNotes, setPickupNotes] = useState<string>("");
  const [pickupContactName, setPickupContactName] = useState<string>("");
  const [pickupContactNumber, setPickupContactNumber] = useState<string>("");
  const [pickupPoNumber, setPickupPoNumber] = useState<string>("");
  const [pickupFieldErrors, setPickupFieldErrors] = useState<{ driver?: string }>({});
  
  // Shipment notes state (for Inbound Shipment path)
  const [shipmentNotes, setShipmentNotes] = useState<string>("");
  const [shipmentCarrier, setShipmentCarrier] = useState<string>("");
  const [shipmentCarrierOpen, setShipmentCarrierOpen] = useState(false);
  const [shipmentCarrierSearch, setShipmentCarrierSearch] = useState("");
  const [shipmentTrackingNumber, setShipmentTrackingNumber] = useState<string>("");
  const [shipmentExpectedArrival, setShipmentExpectedArrival] = useState<Date | undefined>(undefined);
  const [shipmentExpectedArrivalOpen, setShipmentExpectedArrivalOpen] = useState(false);

  // Delivery fields state (for Dispatch Delivery path)
  const [deliveryDriver, setDeliveryDriver] = useState<string>("");
  const [deliveryDriverEmail, setDeliveryDriverEmail] = useState<string>("");
  const [deliveryNotes, setDeliveryNotes] = useState<string>("");
  const [deliveryContactName, setDeliveryContactName] = useState<string>("");
  const [deliveryContactNumber, setDeliveryContactNumber] = useState<string>("");
  const [deliveryOrderNumber, setDeliveryOrderNumber] = useState<string>("");
  const [deliveryOrderNumber2, setDeliveryOrderNumber2] = useState<string>("");
  const [deliveryOrderNumber3, setDeliveryOrderNumber3] = useState<string>("");
  const [deliveryOrderNumber4, setDeliveryOrderNumber4] = useState<string>("");
  const [deliveryOrderNumber5, setDeliveryOrderNumber5] = useState<string>("");
  const [deliveryFieldErrors, setDeliveryFieldErrors] = useState<{ driver?: string; orderNumber?: string }>({});

  // Parts management state
  const [partsModalOpen, setPartsModalOpen] = useState(false);
  const [tempJobIdForParts, setTempJobIdForParts] = useState<string>("temp-new-job");
  const [localParts, setLocalParts] = useState<LocalPart[]>([]);

  // Clear parts when switching between arrival paths
  useEffect(() => {
    setLocalParts([]);
  }, [arrivalPath]);

  // All auto-population logic is now handled by the shared useCsrCheckInForm hook

  const createJobMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Step 1: Validate pickup fields BEFORE creating job
      if (arrivalPath === 'pickup') {
        const errors: { driver?: string } = {};
        if (!pickupDriver) errors.driver = "Driver is required for pickup dispatch";
        
        if (Object.keys(errors).length > 0) {
          setPickupFieldErrors(errors);
          throw new Error("Please complete all required pickup fields");
        }
        setPickupFieldErrors({});
      }
      
      // Step 1b: Validate delivery fields BEFORE creating job
      if (arrivalPath === 'delivery') {
        const errors: { driver?: string; orderNumber?: string } = {};
        if (!deliveryDriver) errors.driver = "Driver is required for delivery dispatch";
        if (!deliveryOrderNumber) errors.orderNumber = "At least one order number is required";
        
        if (Object.keys(errors).length > 0) {
          setDeliveryFieldErrors(errors);
          throw new Error("Please complete all required delivery fields");
        }
        setDeliveryFieldErrors({});
        
        // For delivery path, use the direct-delivery endpoint
        const deliveryPayload = {
          jobId: generatedJobId,
          shopName: data.shopName,
          customerName: data.customerName,
          customerShipTo: data.customerShipTo,
          contactName: deliveryContactName,
          contactNumber: deliveryContactNumber,
          driverName: deliveryDriver,
          driverEmail: deliveryDriverEmail,
          orderNumber: deliveryOrderNumber,
          orderNumber2: deliveryOrderNumber2,
          orderNumber3: deliveryOrderNumber3,
          orderNumber4: deliveryOrderNumber4,
          orderNumber5: deliveryOrderNumber5,
          deliveryNotes,
        };
        
        const response = await apiRequest("POST", "/api/jobs/direct-delivery", deliveryPayload);
        const job = await response.json();
        return job;
      }
      
      // Step 1c: Validate parts for direct shop check-in
      if (arrivalPath === 'direct' && localParts.length === 0) {
        throw new Error("At least one part is required before checking in at shop. Please add parts to this job first.");
      }
      
      // Step 2: Create the job with arrivalPath (and pickup details for pickup jobs)
      let jobPayload;
      if (arrivalPath === 'pickup') {
        jobPayload = { 
          ...data, 
          arrivalPath, 
          pickupDriverEmail, 
          pickupNotes,
          contactName: pickupContactName,
          contactNumber: pickupContactNumber,
          poNumber: pickupPoNumber
        };
      } else if (arrivalPath === 'shipment') {
        // Shipment uses same fields as pickup but no driver dispatch
        jobPayload = { 
          ...data, 
          arrivalPath,
          contactName: pickupContactName,
          contactNumber: pickupContactNumber,
          poNumber: pickupPoNumber,
          shipmentNotes,
          shipmentCarrier: shipmentCarrier || undefined,
          shipmentTrackingNumber: shipmentTrackingNumber || undefined,
          shipmentExpectedArrival: shipmentExpectedArrival?.toISOString() || undefined
        };
      } else {
        jobPayload = { ...data, arrivalPath };
      }
        
      const response = await apiRequest("POST", "/api/jobs", jobPayload);
      const job = await response.json();
      
      // Step 3: Save local parts to the job FIRST (before check-in)
      // This ensures parts are in the database when GoCanvas dispatch is created
      if (localParts.length > 0) {
        console.log(`Saving ${localParts.length} parts to job ${job.jobId}...`);
        for (const part of localParts) {
          await apiRequest("POST", `/api/jobs/${job.jobId}/parts`, {
            jobId: job.jobId,
            ...part,
          });
        }
        console.log(`✅ Saved ${localParts.length} parts successfully`);
      }
      
      // Step 4: Handle direct arrival path (pickup dispatch is now handled in job creation)
      // Parts are now in database and will be included in GoCanvas dispatch
      if (arrivalPath === 'direct') {
        try {
          // Direct check-in at shop - must pass userId and shopHandoff for event metadata
          await apiRequest("POST", `/api/jobs/${job.jobId}/check-in`, {
            userId: data.userId,
            shopHandoff: data.shopHandoff,
          });
        } catch (checkInError) {
          // If check-in fails, delete the job to prevent stuck jobs
          console.error("Check-in failed, rolling back job creation:", checkInError);
          try {
            await apiRequest("DELETE", `/api/jobs/${job.jobId}`, {});
            console.log(`Job ${job.jobId} deleted after failed check-in`);
          } catch (deleteError) {
            console.error("Failed to delete job during rollback:", deleteError);
          }
          // Re-throw the original error
          throw checkInError;
        }
      }
      
      // Return the original job object for success handling
      return job;
    },
    onSuccess: (job) => {
      let pathDescription;
      if (arrivalPath === 'pickup') {
        pathDescription = 'and dispatched for pickup';
      } else if (arrivalPath === 'shipment') {
        pathDescription = '- awaiting inbound shipment';
      } else if (arrivalPath === 'delivery') {
        pathDescription = 'and dispatched for delivery';
      } else {
        pathDescription = 'and checked in at shop';
      }
      toast({
        title: "Job Created Successfully",
        description: `Job ${job.jobId} has been created ${pathDescription}.`,
      });
      form.reset();
      setPickupDriver("");
      setPickupDriverEmail("");
      setPickupNotes("");
      setPickupContactName("");
      setPickupContactNumber("");
      setPickupPoNumber("");
      setPickupFieldErrors({});
      setShipmentNotes("");
      setShipmentCarrier("");
      setShipmentCarrierSearch("");
      setShipmentTrackingNumber("");
      setDeliveryDriver("");
      setDeliveryDriverEmail("");
      setDeliveryNotes("");
      setDeliveryContactName("");
      setDeliveryContactNumber("");
      setDeliveryOrderNumber("");
      setDeliveryOrderNumber2("");
      setDeliveryOrderNumber3("");
      setDeliveryOrderNumber4("");
      setDeliveryOrderNumber5("");
      setDeliveryFieldErrors({});
      setLocalParts([]);
      setArrivalPath('direct');
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create job. Please try again.",
        variant: "destructive",
      });
      console.error("Job creation error:", error);
    },
  });

  // Update timestamp every second
  useEffect(() => {
    const updateTimestamp = () => {
      const now = new Date();
      setCurrentTimestamp(
        now.toLocaleString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: 'UTC'
        }) + ' UTC'
      );
    };

    updateTimestamp();
    const interval = setInterval(updateTimestamp, 1000);
    return () => clearInterval(interval);
  }, []);

  // Generate preview job ID
  useEffect(() => {
    const generateJobId = () => {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `ECS-${timestamp}-${random}`;
    };

    setGeneratedJobId(generateJobId());
  }, []);

  const onSubmit = async (data: FormData) => {
    console.log("=== onSubmit called ===");
    console.log("arrivalPath:", arrivalPath);
    console.log("Form data:", data);
    console.log("pickupContactName:", pickupContactName);
    console.log("pickupContactNumber:", pickupContactNumber);
    
    // For pickup and shipment paths, merge local state fields before validation
    // These fields are not controlled by react-hook-form
    // Note: Contact fields are only required for pickup, not for shipment
    let dataToValidate = data;
    if (arrivalPath === 'pickup') {
      dataToValidate = {
        ...data,
        contactName: pickupContactName,
        contactNumber: pickupContactNumber,
      };
    } else if (arrivalPath === 'shipment') {
      // For shipment, only include contact fields if provided (they're optional)
      dataToValidate = {
        ...data,
        ...(pickupContactName ? { contactName: pickupContactName } : {}),
        ...(pickupContactNumber ? { contactNumber: pickupContactNumber } : {}),
      };
    }
    
    console.log("dataToValidate:", dataToValidate);
    
    // Validate using the appropriate schema
    // Pickup, Shipment, and Delivery use the relaxed schema (no userId, poNumber, shopHandoff required)
    // Only Direct uses insertJobSchema which requires those fields for shop check-in
    // Delivery has additional validation in the mutation function
    const schema = (arrivalPath === 'pickup' || arrivalPath === 'shipment' || arrivalPath === 'delivery') ? pickupJobSchema : insertJobSchema;
    const result = schema.safeParse(dataToValidate);
    
    console.log("Validation result:", result.success);
    
    if (!result.success) {
      // Show validation errors
      const errors = result.error.flatten().fieldErrors;
      console.log("Validation errors:", errors);
      Object.entries(errors).forEach(([field, messages]) => {
        if (messages && messages.length > 0) {
          // For pickup fields that are in local state, show toast instead of form error
          // Contact fields are only required for pickup, not for shipment
          if (arrivalPath === 'pickup' && 
              (field === 'contactName' || field === 'contactNumber')) {
            toast({
              title: "Validation Error",
              description: messages[0],
              variant: "destructive",
            });
          } else if (arrivalPath === 'shipment' && 
              (field === 'contactName' || field === 'contactNumber')) {
            // Skip contact field errors for shipment - they're optional
          } else {
            form.setError(field as any, { message: messages[0] });
          }
        }
      });
      return;
    }
    
    console.log("Calling createJobMutation.mutate");
    createJobMutation.mutate(data);
  };

  const clearForm = () => {
    form.reset();
    setPickupDriver("");
    setPickupDriverEmail("");
    setPickupNotes("");
    setPickupContactName("");
    setPickupContactNumber("");
    setPickupPoNumber("");
    setGeneratedJobId(() => {
      const now = new Date();
      const timestamp = now.toISOString().replace(/[-T:\.Z]/g, '').slice(0, 14);
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      return `ECS-${timestamp}-${random}`;
    });
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-[var(--ecs-dark)] flex items-center">
          <ClipboardList className="mr-2 h-5 w-5 sm:h-6 sm:w-6" />
          <span className="hidden sm:inline">ECS Connect</span>
          <span className="sm:hidden">New Service Job</span>
        </h1>
      </div>

      {currentStep === 2 && (
        <Button
          type="button"
          variant="ghost"
          onClick={() => setCurrentStep(1)}
          className="text-sm"
          data-testid="button-back-to-step1"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Change Path Selection
        </Button>
      )}

      <Card>
        <CardHeader className="card-header">
          <h2 className="text-lg font-semibold flex items-center">
            <ClipboardList className="mr-2 h-5 w-5" />
            {currentStep === 1 ? 'New Job' : arrivalPath === 'direct' ? 'Direct Shop Check-in' : arrivalPath === 'pickup' ? 'Dispatch Pickup' : arrivalPath === 'shipment' ? 'Inbound Shipment' : 'Dispatch Delivery'}
          </h2>
          <p className="text-sm opacity-90">{arrivalPath === 'shipment' ? 'Not connected to GoCanvas' : 'Connected to GoCanvas'}</p>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-4 sm:px-6 space-y-6">
          {/* Step 1: Path Selection */}
          {currentStep === 1 && (
            <div className="space-y-8">
              {/* Service Jobs Section */}
              <div className="space-y-4">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold">How will items arrive at the shop?</h3>
                </div>
                
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Direct Shop Check-in Card */}
                  <Card 
                    className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 hover:border-[var(--ecs-primary)]"
                    onClick={() => {
                      setArrivalPath('direct');
                      setCurrentStep(2);
                    }}
                    data-testid="card-arrival-direct"
                  >
                    <CardContent className="pt-6 pb-6 text-center space-y-4">
                      <div className="flex justify-center">
                        <div className="p-4 bg-[var(--ecs-primary)]/10 rounded-full">
                          <Store className="h-10 w-10 text-[var(--ecs-primary)]" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold mb-2">Direct Shop Check-in</h4>
                        <p className="text-sm text-muted-foreground">
                          Items are already at the shop or will be dropped off directly by the customer
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Dispatch Pickup Card */}
                  <Card 
                    className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 hover:border-[var(--ecs-primary)]"
                    onClick={() => {
                      setArrivalPath('pickup');
                      setCurrentStep(2);
                    }}
                    data-testid="card-arrival-pickup"
                  >
                    <CardContent className="pt-6 pb-6 text-center space-y-4">
                      <div className="flex justify-center">
                        <div className="p-4 bg-[var(--ecs-primary)]/10 rounded-full">
                          <Truck className="h-10 w-10 text-[var(--ecs-primary)]" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold mb-2">Dispatch Pickup</h4>
                        <p className="text-sm text-muted-foreground">
                          Send a driver to pick up items from customer location
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Inbound Shipment Card */}
                  <Card 
                    className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 hover:border-[var(--ecs-primary)]"
                    onClick={() => {
                      setArrivalPath('shipment');
                      setCurrentStep(2);
                    }}
                    data-testid="card-arrival-shipment"
                  >
                    <CardContent className="pt-6 pb-6 text-center space-y-4">
                      <div className="flex justify-center">
                        <div className="p-4 bg-[var(--ecs-primary)]/10 rounded-full">
                          <BoxIcon className="h-10 w-10 text-[var(--ecs-primary)]" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold mb-2">Inbound Shipment</h4>
                        <p className="text-sm text-muted-foreground">
                          Customer is shipping items to the shop via carrier
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 italic">
                          Not connected to GoCanvas
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>

              {/* Dispatch Delivery Section */}
              <div className="space-y-4">
                <div className="flex justify-center">
                  <Card 
                    className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 hover:border-[var(--ecs-primary)] max-w-md w-full"
                    onClick={() => {
                      setArrivalPath('delivery');
                      setCurrentStep(2);
                    }}
                    data-testid="card-arrival-delivery"
                  >
                    <CardContent className="pt-6 pb-6 text-center space-y-4">
                      <div className="flex justify-center">
                        <div className="p-4 bg-[var(--ecs-primary)]/10 rounded-full">
                          <Package className="h-10 w-10 text-[var(--ecs-primary)]" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold mb-2">Dispatch Delivery</h4>
                        <p className="text-sm text-muted-foreground">
                          Send a driver to deliver parts to a customer without service
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Form */}
          {currentStep === 2 && (
            <>
              {/* Job ID Display */}
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <strong>Job ID:</strong> <span className="job-id">{generatedJobId}</span>
                  <div className="text-xs text-muted-foreground mt-1">
                    Automatically generated on form submission
                  </div>
                </AlertDescription>
              </Alert>


              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
                  
                  {/* PICKUP/SHIPMENT PATH - Match GoCanvas field order */}
                  {(arrivalPath === 'pickup' || arrivalPath === 'shipment') && (
                    <>
                      {/* Location */}
                      <FormField
                        control={form.control}
                        name="shopName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <Database className="h-3 w-3 text-muted-foreground" /> Location *
                            </FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger data-testid="select-shop-name">
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

                      {/* Customer Name */}
                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <Database className="h-3 w-3 text-muted-foreground" /> Customer Name *
                            </FormLabel>
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
                                         !customerNames.some(customer => 
                                           customer.toLowerCase() === field.value.toLowerCase()
                                         ) && (
                                          <div className="p-2 border-t">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="w-full justify-start"
                                              onClick={() => {
                                                setCustomerSearchOpen(false);
                                              }}
                                            >
                                              Add "{field.value}" as a new customer
                                            </Button>
                                          </div>
                                        )}
                                        {!isLoadingCustomers && 
                                         customerNames
                                           .filter((customer) =>
                                             customer.toLowerCase().includes((field.value || "").toLowerCase())
                                           ).length === 0 && !field.value && (
                                          <div className="py-6 text-center text-sm">No customers found</div>
                                        )}
                                      </>
                                    )}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Customer Ship-To */}
                      <FormField
                        control={form.control}
                        name="customerShipTo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              <Database className="h-3 w-3 text-muted-foreground" /> Customer Ship-To *
                            </FormLabel>
                            <Popover open={shipToSearchOpen} onOpenChange={setShipToSearchOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={shipToSearchOpen}
                                    className="w-full justify-between"
                                    data-testid="select-ship-to"
                                  >
                                    {field.value || "Select or type ship to location..."}
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0">
                                <Command shouldFilter={false}>
                                  <div className="flex items-center border-b px-3">
                                    <Database className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <Input
                                      placeholder="Search ship to locations or enter custom location..."
                                      value={field.value || ""}
                                      onChange={(e) => field.onChange(e.target.value)}
                                      className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                                    />
                                  </div>
                                  <CommandList>
                                    {isLoadingShipTo ? (
                                      <div className="py-6 text-center text-sm">Loading ship to options...</div>
                                    ) : !customerName ? (
                                      <div className="py-6 text-center text-sm">Select Customer first</div>
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
                                         !shipToOptions.some(shipTo => 
                                           shipTo.toLowerCase() === field.value.toLowerCase()
                                         ) && (
                                          <div className="p-2 border-t">
                                            <Button
                                              variant="outline"
                                              size="sm"
                                              className="w-full justify-start"
                                              onClick={() => {
                                                setShipToSearchOpen(false);
                                              }}
                                            >
                                              Add "{field.value}" as a new ship to location
                                            </Button>
                                          </div>
                                        )}
                                        {!isLoadingShipTo && 
                                         shipToOptions
                                           .filter((shipTo) =>
                                             shipTo.toLowerCase().includes((field.value || "").toLowerCase())
                                           ).length === 0 && !field.value && (
                                          <div className="py-6 text-center text-sm">No ship to locations found</div>
                                        )}
                                      </>
                                    )}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Contact Name */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Contact Name{arrivalPath === 'shipment' ? ' (Optional)' : ''}
                        </label>
                        <Input
                          placeholder="Contact person"
                          value={pickupContactName}
                          onChange={(e) => setPickupContactName(e.target.value)}
                          data-testid="input-pickup-contact-name"
                        />
                      </div>

                      {/* Contact Number */}
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Contact Number{arrivalPath === 'shipment' ? ' (Optional)' : ''}
                        </label>
                        <Input
                          placeholder="(555) 555-5555"
                          value={pickupContactNumber}
                          onChange={(e) => {
                            const digits = e.target.value.replace(/\D/g, '');
                            const limitedDigits = digits.substring(0, 10);
                            
                            let formatted = '';
                            if (limitedDigits.length === 0) formatted = '';
                            else if (limitedDigits.length <= 3) formatted = `(${limitedDigits}`;
                            else if (limitedDigits.length <= 6) formatted = `(${limitedDigits.substring(0, 3)}) ${limitedDigits.substring(3)}`;
                            else formatted = `(${limitedDigits.substring(0, 3)}) ${limitedDigits.substring(3, 6)}-${limitedDigits.substring(6)}`;
                            
                            setPickupContactNumber(formatted);
                          }}
                          data-testid="input-pickup-contact-number"
                        />
                      </div>

                      {/* PO Number */}
                      <div>
                        <label className="block text-sm font-medium mb-2">PO Number</label>
                        <Input
                          placeholder="Purchase order number"
                          value={pickupPoNumber}
                          onChange={(e) => setPickupPoNumber(e.target.value)}
                          data-testid="input-pickup-po-number"
                        />
                      </div>

                      {/* Shipment-specific fields - Only show for shipment path */}
                      {arrivalPath === 'shipment' && (
                        <>
                          {/* Carrier combobox */}
                          <div>
                            <label className="block text-sm font-medium mb-2">Carrier (Optional)</label>
                            <Popover open={shipmentCarrierOpen} onOpenChange={setShipmentCarrierOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  role="combobox"
                                  aria-expanded={shipmentCarrierOpen}
                                  className="w-full justify-between"
                                  data-testid="combobox-shipment-carrier"
                                >
                                  {shipmentCarrier || "Select or type carrier..."}
                                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px] p-0">
                                <Command shouldFilter={false}>
                                  <div className="flex items-center border-b px-3">
                                    <Truck className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                    <Input
                                      placeholder="Search carriers or enter custom carrier..."
                                      value={shipmentCarrier}
                                      onChange={(e) => setShipmentCarrier(e.target.value)}
                                      className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                                      data-testid="input-carrier-search"
                                    />
                                  </div>
                                  <CommandList>
                                    {["AAA Cooper", "FedEx Freight", "XPO", "R&L Carriers", "Estes Express", "Saia", "Averitt Express", "UPS", "USPS", "Central Transport", "Southeastern Freight", "Old Dominion"]
                                      .filter(carrier => 
                                        !shipmentCarrier || 
                                        carrier.toLowerCase().includes(shipmentCarrier.toLowerCase())
                                      )
                                      .map((carrier) => (
                                        <CommandItem
                                          key={carrier}
                                          value={carrier}
                                          onSelect={() => {
                                            setShipmentCarrier(carrier);
                                            setShipmentCarrierOpen(false);
                                          }}
                                          data-testid={`option-carrier-${carrier}`}
                                        >
                                          <Check className={cn("mr-2 h-4 w-4", shipmentCarrier === carrier ? "opacity-100" : "opacity-0")} />
                                          {carrier}
                                        </CommandItem>
                                      ))}
                                    {shipmentCarrier && 
                                     !["AAA Cooper", "FedEx Freight", "XPO", "R&L Carriers", "Estes Express", "Saia", "Averitt Express", "UPS", "USPS", "Central Transport", "Southeastern Freight", "Old Dominion"].some(carrier => 
                                       carrier.toLowerCase() === shipmentCarrier.toLowerCase()
                                     ) && (
                                      <div className="p-2 border-t">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full justify-start"
                                          onClick={() => {
                                            setShipmentCarrierOpen(false);
                                          }}
                                        >
                                          Add "{shipmentCarrier}" as carrier
                                        </Button>
                                      </div>
                                    )}
                                    {!shipmentCarrier && (
                                      <div className="py-6 text-center text-sm text-muted-foreground">Type to search or add a carrier</div>
                                    )}
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>

                          {/* Tracking Number */}
                          <div>
                            <label className="block text-sm font-medium mb-2">Tracking # / PRO # (Optional)</label>
                            <Input
                              placeholder="Enter tracking number"
                              value={shipmentTrackingNumber}
                              onChange={(e) => setShipmentTrackingNumber(e.target.value)}
                              data-testid="input-shipment-tracking"
                            />
                          </div>

                          {/* Expected Arrival Date */}
                          <div>
                            <label className="block text-sm font-medium mb-2">Expected Arrival Date (Optional)</label>
                            <Popover open={shipmentExpectedArrivalOpen} onOpenChange={setShipmentExpectedArrivalOpen}>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !shipmentExpectedArrival && "text-muted-foreground"
                                  )}
                                  data-testid="button-shipment-expected-arrival"
                                >
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {shipmentExpectedArrival ? format(shipmentExpectedArrival, "PPP") : "Select date..."}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={shipmentExpectedArrival}
                                  onSelect={(date) => {
                                    setShipmentExpectedArrival(date);
                                    setShipmentExpectedArrivalOpen(false);
                                  }}
                                  disabled={(date) => date < today}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </div>

                          {/* Shipment Notes */}
                          <div>
                            <label className="block text-sm font-medium mb-2">Shipment Notes (Optional)</label>
                            <Textarea
                              placeholder="Any notes about the incoming shipment..."
                              value={shipmentNotes}
                              onChange={(e) => setShipmentNotes(e.target.value)}
                              rows={2}
                              data-testid="input-shipment-notes"
                            />
                          </div>
                        </>
                      )}

                      {/* Driver - Only show for pickup path */}
                      {arrivalPath === 'pickup' && (
                        <>
                          <div>
                            <label className="block text-sm font-medium mb-2">Driver *</label>
                            <Select value={pickupDriver} onValueChange={(value) => {
                              setPickupDriver(value);
                              // Auto-populate driver email when driver is selected
                              const selectedDriver = driverDetails.find(d => d.name === value);
                              setPickupDriverEmail(selectedDriver?.email || "");
                              setPickupFieldErrors(prev => ({ ...prev, driver: undefined }));
                            }}>
                              <SelectTrigger data-testid="select-pickup-driver" className={pickupFieldErrors.driver ? "border-red-500" : ""}>
                                <SelectValue placeholder="Select driver" />
                              </SelectTrigger>
                              <SelectContent>
                                {isLoadingDrivers ? (
                                  <SelectItem value="_loading" disabled>Loading drivers...</SelectItem>
                                ) : (
                                  drivers.map((driver) => (
                                    <SelectItem key={driver} value={driver} data-testid={`option-driver-${driver}`}>
                                      {driver}
                                    </SelectItem>
                                  ))
                                )}
                              </SelectContent>
                            </Select>
                            {pickupFieldErrors.driver && (
                              <p className="text-sm text-red-500 mt-1" data-testid="error-pickup-driver">{pickupFieldErrors.driver}</p>
                            )}
                          </div>

                          {/* Driver Email (read-only, auto-populated) */}
                          <div>
                            <label className="block text-sm font-medium mb-2 text-muted-foreground">Driver Email</label>
                            <Input
                              value={pickupDriverEmail}
                              readOnly
                              disabled
                              className="bg-muted text-muted-foreground cursor-not-allowed"
                              placeholder="Auto-populated when driver is selected"
                              data-testid="input-driver-email"
                            />
                          </div>

                          {/* Notes to Driver */}
                          <div>
                            <label className="block text-sm font-medium mb-2">Notes to Driver (Optional)</label>
                            <Textarea
                              placeholder="Any special instructions for pickup..."
                              value={pickupNotes}
                              onChange={(e) => setPickupNotes(e.target.value)}
                              rows={2}
                              data-testid="input-pickup-notes"
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}

              {/* DIRECT SHOP CHECK-IN PATH - Show all fields */}
              {arrivalPath === 'direct' && (
                <CsrCheckInFormFields
                  form={form}
                  referenceData={referenceData}
                  watchedFields={watchedFields}
                  customerSearchOpen={customerSearchOpen}
                  setCustomerSearchOpen={setCustomerSearchOpen}
                  shipToSearchOpen={shipToSearchOpen}
                  setShipToSearchOpen={setShipToSearchOpen}
                />
              )}

              {/* DISPATCH DELIVERY PATH */}
              {arrivalPath === 'delivery' && (
                <>
                  {/* Location */}
                  <FormField
                    control={form.control}
                    name="shopName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-muted-foreground" /> Location *
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-delivery-location">
                              <SelectValue placeholder="Select location" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingLocations ? (
                              <SelectItem value="_loading" disabled>Loading...</SelectItem>
                            ) : (
                              locations.map((loc) => (
                                <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Customer Name */}
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-muted-foreground" /> Customer Name *
                        </FormLabel>
                        <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                className={cn(
                                  "w-full justify-between",
                                  !field.value && "text-muted-foreground"
                                )}
                                data-testid="select-delivery-customer"
                              >
                                {field.value || "Select customer..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-full p-0" align="start">
                            <Command>
                              <div className="p-2">
                                <Input
                                  placeholder="Search customers..."
                                  className="h-9"
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    if (value) {
                                      field.onChange(value);
                                    }
                                  }}
                                />
                              </div>
                              <CommandList>
                                <ScrollArea className="h-[200px]">
                                  {isLoadingCustomers ? (
                                    <div className="p-2 text-center text-sm text-muted-foreground">Loading...</div>
                                  ) : (
                                    customerNames
                                      .filter(name => name.toLowerCase().includes((field.value || "").toLowerCase()))
                                      .slice(0, 50)
                                      .map((name) => (
                                        <CommandItem
                                          key={name}
                                          value={name}
                                          onSelect={() => {
                                            field.onChange(name);
                                            form.setValue("customerShipTo", "");
                                            setCustomerSearchOpen(false);
                                          }}
                                        >
                                          <Check className={cn("mr-2 h-4 w-4", name === field.value ? "opacity-100" : "opacity-0")} />
                                          {name}
                                        </CommandItem>
                                      ))
                                  )}
                                </ScrollArea>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Customer Ship-To */}
                  <FormField
                    control={form.control}
                    name="customerShipTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-muted-foreground" /> Customer Ship-To *
                        </FormLabel>
                        <Popover open={shipToSearchOpen} onOpenChange={setShipToSearchOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={shipToSearchOpen}
                                className="w-full justify-between"
                                data-testid="select-delivery-ship-to"
                              >
                                {field.value || "Select or type ship to location..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                            <Command shouldFilter={false}>
                              <div className="flex items-center border-b px-3">
                                <Database className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <Input
                                  placeholder="Search ship to locations or enter custom location..."
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                              </div>
                              <CommandList>
                                {isLoadingShipTo ? (
                                  <div className="py-6 text-center text-sm">Loading ship to options...</div>
                                ) : !customerName ? (
                                  <div className="py-6 text-center text-sm">Select Customer first</div>
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
                                     !shipToOptions.some(shipTo => 
                                       shipTo.toLowerCase() === field.value.toLowerCase()
                                     ) && (
                                      <div className="p-2 border-t">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="w-full justify-start"
                                          onClick={() => {
                                            setShipToSearchOpen(false);
                                          }}
                                        >
                                          Add "{field.value}" as a new ship to location
                                        </Button>
                                      </div>
                                    )}
                                    {!isLoadingShipTo && 
                                     shipToOptions
                                       .filter((shipTo) =>
                                         shipTo.toLowerCase().includes((field.value || "").toLowerCase())
                                       ).length === 0 && !field.value && (
                                      <div className="py-6 text-center text-sm">No ship to locations found</div>
                                    )}
                                  </>
                                )}
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Contact Name */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Contact Name</label>
                    <Input
                      placeholder="Contact person"
                      value={deliveryContactName}
                      onChange={(e) => setDeliveryContactName(e.target.value)}
                      data-testid="input-delivery-contact-name"
                    />
                  </div>

                  {/* Contact Number */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Contact Number</label>
                    <Input
                      placeholder="(555) 555-5555"
                      value={deliveryContactNumber}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '');
                        const limitedDigits = digits.substring(0, 10);
                        
                        let formatted = '';
                        if (limitedDigits.length === 0) formatted = '';
                        else if (limitedDigits.length <= 3) formatted = `(${limitedDigits}`;
                        else if (limitedDigits.length <= 6) formatted = `(${limitedDigits.substring(0, 3)}) ${limitedDigits.substring(3)}`;
                        else formatted = `(${limitedDigits.substring(0, 3)}) ${limitedDigits.substring(3, 6)}-${limitedDigits.substring(6)}`;
                        
                        setDeliveryContactNumber(formatted);
                      }}
                      data-testid="input-delivery-contact-number"
                    />
                  </div>

                  {/* Driver */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Driver *</label>
                    <Select value={deliveryDriver} onValueChange={(value) => {
                      setDeliveryDriver(value);
                      const selectedDriver = driverDetails.find(d => d.name === value);
                      setDeliveryDriverEmail(selectedDriver?.email || "");
                      setDeliveryFieldErrors(prev => ({ ...prev, driver: undefined }));
                    }}>
                      <SelectTrigger data-testid="select-delivery-driver" className={deliveryFieldErrors.driver ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select driver" />
                      </SelectTrigger>
                      <SelectContent>
                        {isLoadingDrivers ? (
                          <SelectItem value="_loading" disabled>Loading drivers...</SelectItem>
                        ) : (
                          drivers.map((driver) => (
                            <SelectItem key={driver} value={driver}>
                              {driver}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {deliveryFieldErrors.driver && (
                      <p className="text-sm text-red-500 mt-1">{deliveryFieldErrors.driver}</p>
                    )}
                  </div>

                  {/* Driver Email (read-only) */}
                  <div>
                    <label className="block text-sm font-medium mb-2 text-muted-foreground">Driver Email</label>
                    <Input
                      value={deliveryDriverEmail}
                      readOnly
                      disabled
                      className="bg-muted text-muted-foreground cursor-not-allowed"
                      placeholder="Auto-populated when driver is selected"
                      data-testid="input-delivery-driver-email"
                    />
                  </div>

                  {/* Order Numbers */}
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-2">Order Number *</label>
                      <Input
                        placeholder="Primary order number"
                        value={deliveryOrderNumber}
                        onChange={(e) => {
                          setDeliveryOrderNumber(e.target.value);
                          setDeliveryFieldErrors(prev => ({ ...prev, orderNumber: undefined }));
                        }}
                        className={deliveryFieldErrors.orderNumber ? "border-red-500" : ""}
                        data-testid="input-delivery-order-1"
                      />
                      {deliveryFieldErrors.orderNumber && (
                        <p className="text-sm text-red-500 mt-1">{deliveryFieldErrors.orderNumber}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Order Number 2 (Optional)</label>
                      <Input
                        placeholder="Additional order number"
                        value={deliveryOrderNumber2}
                        onChange={(e) => setDeliveryOrderNumber2(e.target.value)}
                        data-testid="input-delivery-order-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Order Number 3 (Optional)</label>
                      <Input
                        placeholder="Additional order number"
                        value={deliveryOrderNumber3}
                        onChange={(e) => setDeliveryOrderNumber3(e.target.value)}
                        data-testid="input-delivery-order-3"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Order Number 4 (Optional)</label>
                      <Input
                        placeholder="Additional order number"
                        value={deliveryOrderNumber4}
                        onChange={(e) => setDeliveryOrderNumber4(e.target.value)}
                        data-testid="input-delivery-order-4"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Order Number 5 (Optional)</label>
                      <Input
                        placeholder="Additional order number"
                        value={deliveryOrderNumber5}
                        onChange={(e) => setDeliveryOrderNumber5(e.target.value)}
                        data-testid="input-delivery-order-5"
                      />
                    </div>
                  </div>

                  {/* Delivery Notes */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Delivery Notes (Optional)</label>
                    <Textarea
                      placeholder="Any special instructions for delivery..."
                      value={deliveryNotes}
                      onChange={(e) => setDeliveryNotes(e.target.value)}
                      rows={2}
                      data-testid="input-delivery-notes"
                    />
                  </div>
                </>
              )}

              {/* Add Parts to Job - Only show for service paths, not delivery */}
              {arrivalPath !== 'delivery' && (
                <div className="space-y-2">
                <label className="text-sm font-medium">
                  {arrivalPath === 'direct' 
                    ? <>Parts * <span className="text-muted-foreground font-normal">(at least one required)</span></>
                    : 'Add parts to job (optional)'}
                </label>
                <div className="ml-4">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setPartsModalOpen(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                    data-testid="button-add-part"
                  >
                    <Plus className="mr-1 h-4 w-4" />
                    {localParts.length === 0 ? 'ADD' : 'MANAGE PARTS'}
                  </Button>
                  {localParts.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {localParts.length} part{localParts.length !== 1 ? 's' : ''} added
                    </p>
                  )}
                </div>
              </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <Button
                  type="submit"
                  disabled={createJobMutation.isPending}
                  className="flex-1 bg-[var(--ecs-primary)] hover:bg-[var(--ecs-primary-hover)] hover:shadow-lg hover:scale-[1.02] text-white font-medium transition-all duration-200"
                  data-testid="button-submit"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {createJobMutation.isPending ? "Creating Job..." : "Create Job"}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearForm}
                  className="flex-1 hover:bg-gray-100 hover:shadow-lg hover:scale-[1.02] font-medium transition-all duration-200"
                  data-testid="button-clear"
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear Form
                </Button>
              </div>
            </form>
          </Form>
          </>
        )}
        </CardContent>
      </Card>

      {/* Parts Management Modal */}
      <PartsManagementModal
        open={partsModalOpen}
        onOpenChange={setPartsModalOpen}
        jobId={tempJobIdForParts}
        mode="local"
        localParts={localParts}
        onLocalPartsChange={setLocalParts}
        openInAddMode={localParts.length === 0}
        shopName={form.watch("shopName")}
        hideSerialNumber={arrivalPath === 'shipment'}
      />

      {/* Direct Delivery Modal */}
      <DeliveryDispatchModal
        open={showDeliveryModal}
        onOpenChange={(open) => {
          setShowDeliveryModal(open);
          if (!open) {
            setArrivalPath('direct');
          }
        }}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/jobs'] });
          toast({
            title: "Success",
            description: "Dispatch delivery job created and dispatched to driver",
          });
          setShowDeliveryModal(false);
        }}
        mode="new"
      />
    </div>
  );
}