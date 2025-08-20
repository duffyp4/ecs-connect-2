import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insertJobSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useShopUsers, useShopsForUser, usePermissionForUser, useCustomerNames, useShipToForCustomer, useShip2Ids, useTechComments, useSendClampsGaskets, usePreferredProcesses } from "@/hooks/use-reference-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClipboardList, Send, X, Info, Clock, Database } from "lucide-react";
import type { z } from "zod";

type FormData = z.infer<typeof insertJobSchema>;

export default function CSRForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generatedJobId, setGeneratedJobId] = useState<string>("");
  const [currentTimestamp, setCurrentTimestamp] = useState<string>("");

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
      techCustomerQuestionInquiry: "",
      checkInDate: "",
      checkInTime: "",
      shopHandoff: "",
      handoffEmailWorkflow: "",
    },
  });

  // Reference data hooks - now that form is defined
  const { data: shopUsers = [], isLoading: isLoadingShopUsers } = useShopUsers();
  const userId = form.watch("userId") || "";
  const { data: shopsForUser = [], isLoading: isLoadingShops } = useShopsForUser(userId || undefined);
  const { data: permissionData } = usePermissionForUser(userId || undefined);
  const { data: customerNames = [], isLoading: isLoadingCustomers } = useCustomerNames();
  const customerName = form.watch("customerName") || "";
  const customerShipTo = form.watch("customerShipTo") || "";
  const { data: shipToOptions = [], isLoading: isLoadingShipTo } = useShipToForCustomer(customerName || undefined);
  const { data: ship2Ids = [], isLoading: isLoadingShip2Ids } = useShip2Ids(customerName || undefined, customerShipTo || undefined);
  const { data: techComments = [], isLoading: isLoadingComments } = useTechComments();
  const { data: sendClampsOptions = [], isLoading: isLoadingSendClamps } = useSendClampsGaskets();
  const { data: preferredProcesses = [], isLoading: isLoadingProcesses } = usePreferredProcesses();

  // Auto-populate permission when user changes
  useEffect(() => {
    if (permissionData?.permission) {
      form.setValue("permissionToStart", permissionData.permission);
    }
  }, [permissionData, form]);

  // Auto-populate shop name when user changes
  useEffect(() => {
    if (shopsForUser.length === 1) {
      // Auto-select if only one shop available for user
      form.setValue("shopName", shopsForUser[0]);
    } else if (shopsForUser.length === 0 && userId) {
      // Clear shop name if user has no shops
      form.setValue("shopName", "");
    }
  }, [shopsForUser, userId, form]);

  // Clear Ship2 ID when customer or ship-to changes
  useEffect(() => {
    form.setValue("p21ShipToId", "");
  }, [customerName, customerShipTo, form]);

  const createJobMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const response = await apiRequest("POST", "/api/jobs", data);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Job Created Successfully",
        description: `Job ${data.jobId} has been created and assigned to technician.`,
      });
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to create job. Please try again.",
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--ecs-dark)] flex items-center">
          <ClipboardList className="mr-2 h-6 w-6" />
          CSR Check-in Portal
        </h1>
        <p className="text-muted-foreground">Complete all required fields to initiate a new service job</p>
      </div>

      <Card>
        <CardHeader className="card-header">
          <h2 className="text-lg font-semibold flex items-center">
            <ClipboardList className="mr-2 h-5 w-5" />
            Customer Check-in
          </h2>
          <p className="text-sm opacity-90">Fields matching GoCanvas "Testing Copy" form structure</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Job ID and Timestamp Display */}
          <div className="grid md:grid-cols-2 gap-4">
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
                <strong>Initiated:</strong> {currentTimestamp}
              </AlertDescription>
            </Alert>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="permissionToStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Permission to Start
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-permission-start">
                            <SelectValue placeholder="Select permission status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="No">No</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="permissionDeniedStop"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permission Denied Stop *</FormLabel>
                      <FormControl>
                        <Input placeholder="Stop reason" {...field} data-testid="input-permission-denied" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Shop and Customer Info - Reference Data Fields */}
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="shopName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Shop Name *
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-shop-name">
                            <SelectValue placeholder="Select shop" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingShops ? (
                            <SelectItem value="loading" disabled>Loading shops...</SelectItem>
                          ) : userId ? (
                            shopsForUser.map((shop) => (
                              <SelectItem key={shop} value={shop}>
                                {shop}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-user" disabled>Select User ID first</SelectItem>
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
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-customer-name">
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingCustomers ? (
                            <SelectItem value="loading" disabled>Loading customers...</SelectItem>
                          ) : (
                            customerNames.slice(0, 100).map((customer) => (
                              <SelectItem key={customer} value={customer}>
                                {customer}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Customer Ship To and P21 Ship ID - Reference Data Fields */}
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerShipTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Customer Ship To
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-ship-to">
                            <SelectValue placeholder="Select ship to location" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingShipTo ? (
                            <SelectItem value="loading" disabled>Loading ship to options...</SelectItem>
                          ) : customerName ? (
                            shipToOptions.map((shipTo) => (
                              <SelectItem key={shipTo} value={shipTo}>
                                {shipTo}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-customer" disabled>Select Customer first</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="p21ShipToId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> P21 Ship to ID
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-p21-ship-id">
                            <SelectValue placeholder="Select P21 Ship ID" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingShip2Ids ? (
                            <SelectItem value="loading" disabled>Loading Ship2 IDs...</SelectItem>
                          ) : customerName && customerShipTo ? (
                            ship2Ids.map((ship2Id) => (
                              <SelectItem key={ship2Id} value={ship2Id}>
                                {ship2Id}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value="no-shipto" disabled>Select Customer and Ship To first</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Instructions */}
              <FormField
                control={form.control}
                name="customerSpecificInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer Specific Instructions?</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Any specific customer instructions" {...field} data-testid="input-customer-instructions" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Service Details */}
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="sendClampsGaskets"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Send Clamps & Gaskets?
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-clamps-gaskets">
                            <SelectValue placeholder="Select option" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingSendClamps ? (
                            <SelectItem value="loading" disabled>Loading options...</SelectItem>
                          ) : (
                            sendClampsOptions.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option}
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
                  name="preferredProcess"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Preferred Process?
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-preferred-process">
                            <SelectValue placeholder="Select process" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {isLoadingProcesses ? (
                            <SelectItem value="loading" disabled>Loading processes...</SelectItem>
                          ) : (
                            preferredProcesses.map((process) => (
                              <SelectItem key={process} value={process}>
                                {process}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Additional Instructions */}
              <FormField
                control={form.control}
                name="anyOtherSpecificInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Any Other Specific Instructions?</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Additional instructions" {...field} data-testid="input-other-instructions" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tech Communication */}
              <FormField
                control={form.control}
                name="anyCommentsForTech"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Database className="h-3 w-3 text-muted-foreground" /> Any comments for the tech about this submission?
                    </FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-tech-comments">
                          <SelectValue placeholder="Select comment type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {/* Reference Data will be loaded here */}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="noteToTechAboutCustomer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Note to Tech about Customer or service:</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Notes about customer or service" {...field} data-testid="input-tech-notes" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contact Information */}
              <div className="grid md:grid-cols-2 gap-4">
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
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contact Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="Phone number" {...field} data-testid="input-contact-number" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* PO and Serial Information */}
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="poNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PO Number</FormLabel>
                      <FormControl>
                        <Input placeholder="Purchase order number" {...field} data-testid="input-po-number" />
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
                        <Input placeholder="Serial numbers" {...field} data-testid="input-serial-numbers" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Tech Customer Inquiry */}
              <FormField
                control={form.control}
                name="techCustomerQuestionInquiry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tech Customer Question Inquiry</FormLabel>
                    <FormControl>
                      <Input placeholder="Customer inquiry" {...field} data-testid="input-customer-inquiry" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Scheduling */}
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="checkInDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Check In Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} data-testid="input-check-in-date" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="checkInTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Check In Time *</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} data-testid="input-check-in-time" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Handoff */}
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="shopHandoff"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shop Handoff *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-shop-handoff">
                            <SelectValue placeholder="Select technician" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {technicians.map((tech) => (
                            <SelectItem key={tech.id} value={tech.email}>
                              {tech.name} ({tech.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="handoffEmailWorkflow"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Handoff Email workflow</FormLabel>
                      <FormControl>
                        <Input placeholder="Email workflow" {...field} data-testid="input-handoff-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-4 pt-6">
                <Button
                  type="submit"
                  disabled={createJobMutation.isPending}
                  className="flex-1 bg-[var(--ecs-dark)] hover:bg-[var(--ecs-dark-hover)]"
                  data-testid="button-submit"
                >
                  <Send className="mr-2 h-4 w-4" />
                  {createJobMutation.isPending ? "Creating Job..." : "Create Job"}
                </Button>
                
                <Button
                  type="button"
                  variant="outline"
                  onClick={clearForm}
                  className="flex-1"
                  data-testid="button-clear"
                >
                  <X className="mr-2 h-4 w-4" />
                  Clear Form
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}