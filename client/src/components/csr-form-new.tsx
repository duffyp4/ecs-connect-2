import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insertJobSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useShopUsers, useShopsForUser, usePermissionForUser, useCustomerNames, useShipToForCustomer, useShip2Ids, useTechComments, useSendClampsGaskets, usePreferredProcesses, useCustomerInstructions, useCustomerNotes, useCustomerSpecificData, useAllShops, useUsersForShop, useDrivers } from "@/hooks/use-reference-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClipboardList, Send, X, Info, Clock, Database, Check, ChevronsUpDown, Truck, Store, ArrowLeft } from "lucide-react";
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

  const form = useForm<FormData>({
    resolver: zodResolver(insertJobSchema),
    defaultValues: {
      p21OrderNumber: "",
      userId: "",
      permissionToStart: "",
      permissionDeniedStop: "",
      shopName: "",
      customerName: "",
      customerShipTo: "",
      p21ShipToId: "",
      customerSpecificInstructions: "",
      sendClampsGaskets: "",
      preferredProcess: "",
      anyOtherSpecificInstructions: "",
      anyCommentsForTech: "",
      noteToTechAboutCustomer: "",
      contactName: "",
      contactNumber: "",
      poNumber: "",
      serialNumbers: "",
      techCustomerQuestionInquiry: "sales@ecspart.com",
      shopHandoff: "",
      handoffEmailWorkflow: "",
    },
  });

  // Reference data hooks - now that form is defined
  const { data: shopUsers = [], isLoading: isLoadingShopUsers } = useShopUsers();
  const userId = form.watch("userId") || "";
  const { data: shopsForUser = [], isLoading: isLoadingShops } = useShopsForUser(userId || undefined);
  const { data: allShops = [], isLoading: isLoadingAllShops } = useAllShops();
  const { data: permissionData } = usePermissionForUser(userId || undefined);
  const shopName = form.watch("shopName") || "";
  const { data: usersForSelectedShop = [], isLoading: isLoadingShopHandoffUsers } = useUsersForShop(shopName || undefined);
  const { data: customerNames = [], isLoading: isLoadingCustomers } = useCustomerNames();
  const customerName = form.watch("customerName") || "";
  const customerShipTo = form.watch("customerShipTo") || "";
  const { data: shipToOptions = [], isLoading: isLoadingShipTo } = useShipToForCustomer(customerName || undefined);
  const { data: ship2Ids = [], isLoading: isLoadingShip2Ids } = useShip2Ids(customerName || undefined, customerShipTo || undefined);
  const { data: techComments = [], isLoading: isLoadingComments } = useTechComments();
  const { data: sendClampsOptions = [], isLoading: isLoadingSendClamps } = useSendClampsGaskets();
  const { data: preferredProcesses = [], isLoading: isLoadingProcesses } = usePreferredProcesses();
  const { data: customerInstructionsData } = useCustomerInstructions(customerName || undefined, customerShipTo || undefined);
  const { data: customerNotes = [], isLoading: isLoadingNotes } = useCustomerNotes();
  const { data: customerSpecificData } = useCustomerSpecificData(customerName || undefined, customerShipTo || undefined);
  const { data: drivers = [], isLoading: isLoadingDrivers } = useDrivers();

  // Pickup fields state
  const [pickupDriver, setPickupDriver] = useState<string>("");
  const [pickupAddress, setPickupAddress] = useState<string>("");
  const [pickupNotes, setPickupNotes] = useState<string>("");
  const [pickupFieldErrors, setPickupFieldErrors] = useState<{ driver?: string; address?: string }>({});

  // Auto-populate permission when user changes
  useEffect(() => {
    if (permissionData?.permission) {
      form.setValue("permissionToStart", permissionData.permission);
    }
  }, [permissionData, form]);

  // Auto-populate customer instructions when customer changes
  useEffect(() => {
    if (customerInstructionsData && customerName) {
      if (customerInstructionsData.instructions === '#N/A' || 
          customerInstructionsData.instructions === '' || 
          !customerInstructionsData.instructions) {
        form.setValue("customerSpecificInstructions", "N/A");
      } else {
        form.setValue("customerSpecificInstructions", customerInstructionsData.instructions);
      }
    }
  }, [customerInstructionsData, customerName, form]);

  // Auto-populate reference data fields when customer changes
  useEffect(() => {

    if (customerSpecificData && customerName) {
      // Auto-populate preferred process from reference data
      if (customerSpecificData.preferredProcess === '#N/A' || 
          customerSpecificData.preferredProcess === '' || 
          !customerSpecificData.preferredProcess) {
        form.setValue("preferredProcess", "N/A");
      } else {
        form.setValue("preferredProcess", customerSpecificData.preferredProcess);
      }
      
      // Auto-populate send clamps/gaskets from reference data
      if (customerSpecificData.sendClampsGaskets === '#N/A' || 
          customerSpecificData.sendClampsGaskets === '' || 
          !customerSpecificData.sendClampsGaskets) {
        form.setValue("sendClampsGaskets", "N/A");
      } else {
        form.setValue("sendClampsGaskets", customerSpecificData.sendClampsGaskets);
      }
      
      // Auto-populate "Any Other Specific Instructions?" from reference data (column 11)
      if (customerSpecificData.customerNotes === '#N/A' || 
          customerSpecificData.customerNotes === '' || 
          !customerSpecificData.customerNotes) {
        form.setValue("anyOtherSpecificInstructions", "N/A");
      } else {
        form.setValue("anyOtherSpecificInstructions", customerSpecificData.customerNotes);
      }
      
      // Auto-populate customer notes from reference data
      if (customerSpecificData.customerNotes === '#N/A' || 
          customerSpecificData.customerNotes === '' || 
          !customerSpecificData.customerNotes) {
        form.setValue("noteToTechAboutCustomer", "N/A");
      } else {
        form.setValue("noteToTechAboutCustomer", customerSpecificData.customerNotes);
      }
    }
  }, [customerSpecificData, customerName, form]);

  // Clear shop name when user changes (let user manually select from all shops)
  useEffect(() => {
    if (userId) {
      // Clear shop name when user changes so they can select manually from all available shops
      form.setValue("shopName", "");
    }
  }, [userId, form]);

  // Clear shop handoff when shop name changes
  useEffect(() => {
    form.setValue("shopHandoff", "");
  }, [shopName, form]);

  // Auto-populate handoff email when shop handoff changes
  const shopHandoff = form.watch("shopHandoff") || "";
  useEffect(() => {
    if (shopHandoff) {
      // Use the shop handoff user ID as the handoff email workflow
      form.setValue("handoffEmailWorkflow", shopHandoff);
    }
  }, [shopHandoff, form]);

  // Auto-populate Ship2 ID when customer and ship-to are selected
  useEffect(() => {
    if (ship2Ids.length > 0) {
      // Use the first (and typically only) ship2 ID for this customer/ship-to combination
      form.setValue("p21ShipToId", ship2Ids[0]);
    } else if (customerName && customerShipTo) {
      // Clear field if customer and ship-to are selected but no ship2 ID found
      form.setValue("p21ShipToId", "");
    }
  }, [ship2Ids, customerName, customerShipTo, form]);

  const createJobMutation = useMutation({
    mutationFn: async (data: FormData) => {
      // Step 1: Validate pickup fields BEFORE creating job
      if (arrivalPath === 'pickup') {
        const errors: { driver?: string; address?: string } = {};
        if (!pickupDriver) errors.driver = "Driver is required for pickup dispatch";
        if (!pickupAddress) errors.address = "Pickup address is required";
        
        if (Object.keys(errors).length > 0) {
          setPickupFieldErrors(errors);
          throw new Error("Please complete all required pickup fields");
        }
        setPickupFieldErrors({});
      }
      
      // Step 2: Create the job
      const response = await apiRequest("POST", "/api/jobs", data);
      const job = await response.json();
      
      // Step 3: Handle arrival path
      if (arrivalPath === 'pickup') {
        // Dispatch pickup
        await apiRequest("POST", `/api/jobs/${job.id}/dispatch-pickup`, {
          driverEmail: pickupDriver,
          pickupAddress,
          pickupNotes,
        });
      } else {
        // Direct check-in at shop
        await apiRequest("POST", `/api/jobs/${job.id}/check-in`, {});
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
      setPickupAddress("");
      setPickupNotes("");
      setPickupFieldErrors({});
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

  const onSubmit = (data: FormData) => {
    createJobMutation.mutate(data);
  };

  const clearForm = () => {
    form.reset();
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
          <span className="hidden sm:inline">CSR Check-in Portal</span>
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

              {/* Pickup Fields - Show only when pickup path is selected */}
              {arrivalPath === 'pickup' && (
                <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                  <h4 className="font-semibold text-base">Pickup Information</h4>
                  
                  <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Driver Selection */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Driver *</label>
                      <Select value={pickupDriver} onValueChange={(value) => {
                        setPickupDriver(value);
                        setPickupFieldErrors(prev => ({ ...prev, driver: undefined }));
                      }}>
                        <SelectTrigger data-testid="select-pickup-driver" className={pickupFieldErrors.driver ? "border-red-500" : ""}>
                          <SelectValue placeholder="Select driver" />
                        </SelectTrigger>
                        <SelectContent>
                          {isLoadingDrivers ? (
                            <SelectItem value="_loading">Loading drivers...</SelectItem>
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

                    {/* Pickup Address */}
                    <div>
                      <label className="block text-sm font-medium mb-2">Pickup Address *</label>
                      <Input
                        placeholder="Enter pickup address"
                        value={pickupAddress}
                        onChange={(e) => {
                          setPickupAddress(e.target.value);
                          setPickupFieldErrors(prev => ({ ...prev, address: undefined }));
                        }}
                        className={pickupFieldErrors.address ? "border-red-500" : ""}
                        data-testid="input-pickup-address"
                      />
                      {pickupFieldErrors.address && (
                        <p className="text-sm text-red-500 mt-1" data-testid="error-pickup-address">{pickupFieldErrors.address}</p>
                      )}
                    </div>
                  </div>

                  {/* Pickup Notes */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Pickup Notes (Optional)</label>
                    <Textarea
                      placeholder="Any special instructions for pickup..."
                      value={pickupNotes}
                      onChange={(e) => setPickupNotes(e.target.value)}
                      rows={2}
                      data-testid="input-pickup-notes"
                    />
                  </div>
                </div>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  
                  {/* PICKUP PATH - Show only essential fields */}
                  {arrivalPath === 'pickup' && (
                    <>
                      {/* Shop and Customer Info for Pickup */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
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
                              {isLoadingAllShops ? (
                                <SelectItem value="loading" disabled>Loading locations...</SelectItem>
                              ) : (
                                allShops.map((shop) => (
                                  <SelectItem key={shop} value={shop}>
                                    {shop}
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
                  </div>

                  {/* Customer Ship To */}
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
                </>
              )}

              {/* DIRECT SHOP CHECK-IN PATH - Show all fields */}
              {arrivalPath === 'direct' && (
                <>
              {/* P21 Order Number */}
              <FormField
                control={form.control}
                name="p21OrderNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>P21 Order Number (Enter after invoicing)</FormLabel>
                    <FormControl>
                      <Input placeholder="Order number" {...field} value={field.value || ""} data-testid="input-p21-order" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* User ID */}
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Database className="h-3 w-3 text-muted-foreground" /> User ID *
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger data-testid="select-user-id">
                          <SelectValue placeholder="Select user ID" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {isLoadingShopUsers ? (
                          <SelectItem value="loading" disabled>Loading users...</SelectItem>
                        ) : (
                          shopUsers.map((user) => (
                            <SelectItem key={user} value={user}>
                              {user}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Permission Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="permissionToStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Permission to Start
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || (userId ? "Loading..." : "First select User ID")}
                          readOnly
                          disabled
                          className="bg-muted cursor-not-allowed"
                          data-testid="input-permission-start"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="permissionDeniedStop"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Permission Denied Stop
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Stop reason" {...field} value={field.value || ""} data-testid="input-permission-denied" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Shop and Customer Info - Reference Data Fields */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="shopName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Shop Name *
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-shop-name">
                            <SelectValue placeholder="Select shop" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingAllShops ? (
                            <SelectItem value="loading" disabled>Loading shops...</SelectItem>
                          ) : (
                            allShops.map((shop) => (
                              <SelectItem key={shop} value={shop}>
                                {shop}
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
              </div>

              {/* Customer Ship To and P21 Ship ID - Reference Data Fields */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="customerShipTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Customer Ship To *
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

                <FormField
                  control={form.control}
                  name="p21ShipToId"
                  render={({ field }) => {
                    const displayValue = field.value && field.value !== '#N/A' ? field.value : '';
                    
                    return (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-muted-foreground" /> P21 Ship to ID
                        </FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            value={displayValue}
                            readOnly
                            className="bg-muted text-muted-foreground cursor-not-allowed"
                            data-testid="input-p21-ship-id-readonly"
                            placeholder={!displayValue ? (customerName && customerShipTo ? "Auto-populated from reference data" : "Select customer and ship-to first") : ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Customer Specific Instructions - Read-only reference data field */}
              <FormField
                control={form.control}
                name="customerSpecificInstructions"
                render={({ field }) => {
                  // Show the field value if it exists and is not #N/A, otherwise empty
                  const displayValue = field.value && field.value !== '#N/A' && field.value !== '' ? field.value : '';
                  
                  return (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Customer Specific Instructions
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field}
                          value={displayValue}
                          readOnly
                          className="bg-muted text-muted-foreground cursor-not-allowed"
                          data-testid="input-customer-instructions-readonly"
                          placeholder={!displayValue ? (customerName ? "Auto-populated from reference data" : "Select customer to load instructions") : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Service Details */}
              <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sendClampsGaskets"
                  render={({ field }) => {
                    const displayValue = field.value && field.value !== '#N/A' && field.value !== '' ? field.value : '';
                    
                    return (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-muted-foreground" /> Send Clamps & Gaskets?
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={displayValue}
                            readOnly
                            className="bg-muted text-muted-foreground cursor-not-allowed"
                            data-testid="input-clamps-gaskets-readonly"
                            placeholder={!displayValue ? (customerName ? "Auto-populated from reference data" : "Select customer to load data") : ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

                <FormField
                  control={form.control}
                  name="preferredProcess"
                  render={({ field }) => {
                    const displayValue = field.value && field.value !== '#N/A' ? field.value : '';
                    
                    return (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-muted-foreground" /> Preferred Process?
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={displayValue}
                            readOnly
                            className="bg-muted text-muted-foreground cursor-not-allowed"
                            data-testid="input-preferred-process-readonly"
                            placeholder={!displayValue ? (customerName ? "Auto-populated from reference data" : "Select customer to load data") : ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* Any Other Specific Instructions - Read-only reference data field */}
              <FormField
                control={form.control}
                name="anyOtherSpecificInstructions"
                render={({ field }) => {
                  const displayValue = field.value && field.value !== '#N/A' ? field.value : '';
                  
                  return (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Any Other Specific Instructions?
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          value={displayValue}
                          readOnly
                          className="bg-muted text-muted-foreground cursor-not-allowed resize-none"
                          data-testid="input-other-instructions-readonly"
                          placeholder={!displayValue ? (customerName ? "Auto-populated from reference data" : "Select customer to load instructions") : ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Tech Communication - Yes/No Selector */}
              <FormField
                control={form.control}
                name="anyCommentsForTech"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Database className="h-3 w-3 text-muted-foreground" /> Any comments for the tech about this submission?
                    </FormLabel>
                    <FormControl>
                      <div className="flex items-center space-x-6" data-testid="radio-tech-comments">
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="tech-comments-yes"
                            value="Yes"
                            checked={field.value === "Yes"}
                            onChange={() => field.onChange("Yes")}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                          />
                          <label htmlFor="tech-comments-yes" className="text-sm font-medium cursor-pointer">
                            Yes
                          </label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="radio"
                            id="tech-comments-no"
                            value="No"
                            checked={field.value === "No"}
                            onChange={() => field.onChange("No")}
                            className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                          />
                          <label htmlFor="tech-comments-no" className="text-sm font-medium cursor-pointer">
                            No
                          </label>
                        </div>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="noteToTechAboutCustomer"
                render={({ field }) => {
                  const hasCommentsForTech = form.watch("anyCommentsForTech") === "Yes";
                  
                  return (
                    <FormItem>
                      <FormLabel>Note to Tech about Customer or service:</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field}
                          value={hasCommentsForTech ? (field.value || "") : ""}
                          readOnly={!hasCommentsForTech}
                          className={hasCommentsForTech ? "" : "bg-muted text-muted-foreground cursor-not-allowed"}
                          placeholder={hasCommentsForTech ? "Notes about customer or service" : "Select 'Yes' above to enable this field"}
                          data-testid="input-tech-notes"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {/* Contact Information */}
              <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact person" {...field} data-testid="input-contact-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="contactNumber"
                  render={({ field }) => {
                    const formatPhoneNumber = (value: string) => {
                      // Remove all non-digits
                      const digits = value.replace(/\D/g, '');
                      
                      // Limit to 10 digits
                      const limitedDigits = digits.substring(0, 10);
                      
                      // Format based on length
                      if (limitedDigits.length === 0) return '';
                      if (limitedDigits.length <= 3) return `(${limitedDigits}`;
                      if (limitedDigits.length <= 6) return `(${limitedDigits.substring(0, 3)}) ${limitedDigits.substring(3)}`;
                      return `(${limitedDigits.substring(0, 3)}) ${limitedDigits.substring(3, 6)}-${limitedDigits.substring(6)}`;
                    };

                    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      field.onChange(formatted);
                    };

                    return (
                      <FormItem>
                        <FormLabel>Contact Number *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="(XXX) XXX-XXXX" 
                            value={field.value}
                            onChange={handleChange}
                            data-testid="input-contact-number"
                            maxLength={14} // (XXX) XXX-XXXX = 14 characters
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>

              {/* PO and Serial Information */}
              <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="poNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PO Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="Purchase order number" {...field} value={field.value || ""} data-testid="input-po-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="serialNumbers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Number(s) *</FormLabel>
                      <FormControl>
                        <Input placeholder="Serial numbers" {...field} value={field.value || ""} data-testid="input-serial-numbers" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Tech Customer Question Inquiry - Pre-filled and read-only */}
              <FormField
                control={form.control}
                name="techCustomerQuestionInquiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tech Customer Question Inquiry</FormLabel>
                    <FormControl>
                      <Input 
                        {...field}
                        value="sales@ecspart.com"
                        readOnly
                        className="bg-muted text-muted-foreground cursor-not-allowed"
                        data-testid="input-customer-inquiry-readonly"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Handoff */}
              <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="shopHandoff"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Shop Handoff *
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-shop-handoff">
                            <SelectValue placeholder="Select shop user" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingShopHandoffUsers ? (
                            <SelectItem value="loading" disabled>Loading shop users...</SelectItem>
                          ) : shopName ? (
                            usersForSelectedShop.map((user) => (
                              <SelectItem key={user} value={user}>
                                {user}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-shop" disabled>Select Shop Name first</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="handoffEmailWorkflow"
                  render={({ field }) => {
                    const displayValue = field.value || "";
                    
                    return (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-muted-foreground" /> Handoff Email workflow
                        </FormLabel>
                        <FormControl>
                          <Input 
                            {...field}
                            value={displayValue}
                            readOnly
                            className="bg-muted text-muted-foreground cursor-not-allowed"
                            data-testid="input-handoff-email-readonly"
                            placeholder={!displayValue ? (form.getValues("shopHandoff") ? "Auto-populated from shop handoff selection" : "Select shop handoff first") : ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />
              </div>
                </>
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