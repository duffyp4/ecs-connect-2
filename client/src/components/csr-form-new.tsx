import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insertJobSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClipboardList, Send, X, Info, Clock } from "lucide-react";
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
          Create New Job
        </h1>
        <p className="text-muted-foreground">Complete all required fields to initiate a new service job</p>
      </div>

      <Card>
        <CardHeader className="card-header">
          <h2 className="text-lg font-semibold flex items-center">
            <ClipboardList className="mr-2 h-5 w-5" />
            Job Information
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
                      <Input placeholder="Order number" {...field} data-testid="input-p21-order" />
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
                    <FormLabel>User ID *</FormLabel>
                    <FormControl>
                      <Input placeholder="User ID" {...field} data-testid="input-user-id" />
                    </FormControl>
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
                      <FormLabel>Permission to Start</FormLabel>
                      <FormControl>
                        <Input placeholder="Permission status" {...field} data-testid="input-permission-start" />
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
                      <FormLabel>Permission Denied Stop *</FormLabel>
                      <FormControl>
                        <Input placeholder="Stop reason" {...field} data-testid="input-permission-denied" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Shop and Customer Info */}
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="shopName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shop Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Shop name" {...field} data-testid="input-shop-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Customer name" {...field} data-testid="input-customer-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Customer Ship To and P21 Ship ID */}
              <div className="grid md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerShipTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Ship To</FormLabel>
                      <FormControl>
                        <Input placeholder="Ship to address" {...field} data-testid="input-ship-to" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="p21ShipToId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>P21 Ship to ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Ship to ID" {...field} data-testid="input-p21-ship-id" />
                      </FormControl>
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
                      <FormLabel>Send Clamps & Gaskets?</FormLabel>
                      <FormControl>
                        <Input placeholder="Yes/No" {...field} data-testid="input-clamps-gaskets" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="preferredProcess"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Preferred Process?</FormLabel>
                      <FormControl>
                        <Input placeholder="Process type" {...field} data-testid="input-preferred-process" />
                      </FormControl>
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
                    <FormLabel>Any comments for the tech about this submission?</FormLabel>
                    <FormControl>
                      <Input placeholder="Comments for technician" {...field} data-testid="input-tech-comments" />
                    </FormControl>
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