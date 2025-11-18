import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insertJobSchema, pickupJobSchema } from "@shared/schema";
import { type LocalPart } from "@/components/parts-management-modal";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCsrCheckInForm } from "@/hooks/use-csr-check-in-form";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClipboardList, Send, X, Info, Clock, Database, Check, ChevronsUpDown, Truck, Store, ArrowLeft, Settings } from "lucide-react";
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
  const [arrivalPath, setArrivalPath] = useState<'pickup' | 'direct'>('direct');
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

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

  // Parts management state
  const [partsModalOpen, setPartsModalOpen] = useState(false);
  const [tempJobIdForParts, setTempJobIdForParts] = useState<string>("temp-new-job");
  const [localParts, setLocalParts] = useState<LocalPart[]>([]);

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
      
      // Step 2: Create the job with arrivalPath (and pickup details for pickup jobs)
      const jobPayload = arrivalPath === 'pickup'
        ? { 
            ...data, 
            arrivalPath, 
            pickupDriverEmail, 
            pickupNotes,
            contactName: pickupContactName,
            contactNumber: pickupContactNumber,
            poNumber: pickupPoNumber
          }
        : { ...data, arrivalPath };
        
      const response = await apiRequest("POST", "/api/jobs", jobPayload);
      const job = await response.json();
      
      // Step 3: Handle direct arrival path (pickup dispatch is now handled in job creation)
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
      
      // Step 4: Save local parts to the job (if any)
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
      
      // Return the original job object for success handling
      return job;
    },
    onSuccess: (job) => {
      const pathDescription = arrivalPath === 'pickup' 
        ? 'and dispatched for pickup' 
        : 'and checked in at shop';
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
    // Validate using the appropriate schema
    const schema = arrivalPath === 'pickup' ? pickupJobSchema : insertJobSchema;
    const result = schema.safeParse(data);
    
    if (!result.success) {
      // Show validation errors
      const errors = result.error.flatten().fieldErrors;
      Object.entries(errors).forEach(([field, messages]) => {
        if (messages && messages.length > 0) {
          form.setError(field as any, { message: messages[0] });
        }
      });
      return;
    }
    
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
        <p className="text-sm sm:text-base text-muted-foreground">Complete all required fields to initiate a new service job</p>
      </div>

      <Card>
        <CardHeader className="card-header">
          <h2 className="text-lg font-semibold flex items-center">
            <ClipboardList className="mr-2 h-5 w-5" />
            Customer Check-in
          </h2>
          <p className="text-sm opacity-90">Fields matching GoCanvas "Testing Copy" form structure</p>
        </CardHeader>
        <CardContent className="pt-6 pb-6 px-4 sm:px-6 space-y-6">
          {/* Step 1: Path Selection */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h3 className="text-xl font-semibold">How will items arrive at the shop?</h3>
                <p className="text-sm text-muted-foreground">Choose the appropriate path to continue</p>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
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
              </div>
            </div>
          )}

          {/* Step 2: Form */}
          {currentStep === 2 && (
            <>
              {/* Back Button */}
              <div>
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
              </div>

              {/* Path Indicator */}
              <Alert className="bg-[var(--ecs-primary)]/10 border-[var(--ecs-primary)]">
                <Info className="h-4 w-4 text-[var(--ecs-primary)]" />
                <AlertDescription className="text-[var(--ecs-dark)]">
                  <strong>Selected Path:</strong> {arrivalPath === 'direct' ? 'Direct Shop Check-in' : 'Dispatch Pickup'}
                </AlertDescription>
              </Alert>

              {/* Job ID and Timestamp Display */}
              <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Job ID:</strong> <span className="job-id">{generatedJobId}</span>
                    <div className="text-xs text-muted-foreground mt-1">
                      Automatically generated on form submission
                    </div>
                  </AlertDescription>
                </Alert>
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Initiated:</strong> Time recorded upon check-in form submission
                  </AlertDescription>
                </Alert>
              </div>


              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                  {/* PICKUP PATH - Match GoCanvas field order */}
                  {arrivalPath === 'pickup' && (
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
                        <label className="block text-sm font-medium mb-2">Contact Name</label>
                        <Input
                          placeholder="Contact person"
                          value={pickupContactName}
                          onChange={(e) => setPickupContactName(e.target.value)}
                          data-testid="input-pickup-contact-name"
                        />
                      </div>

                      {/* Contact Number */}
                      <div>
                        <label className="block text-sm font-medium mb-2">Contact Number</label>
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

                      {/* Driver */}
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
    </div>
  );
}