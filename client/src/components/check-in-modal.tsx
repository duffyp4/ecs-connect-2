import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { insertJobSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useShopUsers, usePermissionForUser, useUsersForShop, useShip2Ids, useTechComments, useSendClampsGaskets, usePreferredProcesses, useCustomerInstructions, useCustomerSpecificData } from "@/hooks/use-reference-data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Database } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { z } from "zod";
import type { Job } from "@shared/schema";

type FormData = z.infer<typeof insertJobSchema>;

interface CheckInModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  onSuccess: () => void;
}

export function CheckInModal({ open, onOpenChange, job, onSuccess }: CheckInModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({
    // No resolver - validate manually like the original form
    defaultValues: {
      p21OrderNumber: job.p21OrderNumber || "",
      userId: job.userId || "",
      permissionToStart: job.permissionToStart || "",
      permissionDeniedStop: job.permissionDeniedStop || "",
      shopName: job.shopName || "",
      customerName: job.customerName || "",
      customerShipTo: job.customerShipTo || "",
      p21ShipToId: job.p21ShipToId || "",
      customerSpecificInstructions: job.customerSpecificInstructions || "",
      sendClampsGaskets: job.sendClampsGaskets || "",
      preferredProcess: job.preferredProcess || "",
      anyOtherSpecificInstructions: job.anyOtherSpecificInstructions || "",
      anyCommentsForTech: job.anyCommentsForTech || "",
      noteToTechAboutCustomer: job.noteToTechAboutCustomer || "",
      contactName: job.contactName || "",
      contactNumber: job.contactNumber || "",
      poNumber: job.poNumber || "",
      serialNumbers: job.serialNumbers || "",
      techCustomerQuestionInquiry: job.techCustomerQuestionInquiry || "sales@ecspart.com",
      shopHandoff: job.shopHandoff || "",
      handoffEmailWorkflow: job.handoffEmailWorkflow || "",
    },
  });

  // Reference data hooks
  const { data: shopUsers = [], isLoading: isLoadingShopUsers } = useShopUsers();
  const userId = form.watch("userId") || "";
  const { data: permissionData } = usePermissionForUser(userId || undefined);
  const shopName = form.watch("shopName") || "";
  const { data: usersForSelectedShop = [], isLoading: isLoadingShopHandoffUsers } = useUsersForShop(shopName || undefined);
  const customerName = form.watch("customerName") || "";
  const customerShipTo = form.watch("customerShipTo") || "";
  const { data: ship2Ids = [] } = useShip2Ids(customerName || undefined, customerShipTo || undefined);
  const { data: techComments = [], isLoading: isLoadingComments } = useTechComments();
  const { data: sendClampsOptions = [], isLoading: isLoadingSendClamps } = useSendClampsGaskets();
  const { data: preferredProcesses = [], isLoading: isLoadingProcesses } = usePreferredProcesses();
  const { data: customerInstructionsData } = useCustomerInstructions(customerName || undefined, customerShipTo || undefined);
  const { data: customerSpecificData } = useCustomerSpecificData(customerName || undefined, customerShipTo || undefined);

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
      
      // Auto-populate "Any Other Specific Instructions?" from reference data
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

  // Auto-populate handoff email when shop handoff changes
  const shopHandoff = form.watch("shopHandoff") || "";
  useEffect(() => {
    if (shopHandoff) {
      form.setValue("handoffEmailWorkflow", shopHandoff);
    }
  }, [shopHandoff, form]);

  // Auto-populate Ship2 ID when customer and ship-to are selected
  useEffect(() => {
    if (ship2Ids.length > 0) {
      form.setValue("p21ShipToId", ship2Ids[0]);
    } else if (customerName && customerShipTo) {
      form.setValue("p21ShipToId", "");
    }
  }, [ship2Ids, customerName, customerShipTo, form]);

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);
      
      // Validate using insertJobSchema like the original form does
      const result = insertJobSchema.safeParse(data);
      
      if (!result.success) {
        // Show validation errors
        const errors = result.error.flatten().fieldErrors;
        Object.entries(errors).forEach(([field, messages]) => {
          if (messages && messages.length > 0) {
            form.setError(field as any, {
              type: "manual",
              message: messages[0],
            });
          }
        });
        toast({
          title: "Validation Error",
          description: "Please check the form for errors and try again.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }
      
      // Submit to check-in endpoint with validated data
      await apiRequest("POST", `/api/jobs/${job.id}/check-in`, result.data);

      toast({
        title: "Job Checked In",
        description: `Job ${job.jobId} has been checked in at shop successfully.`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Check-in error:", error);
      toast({
        title: "Check-In Failed",
        description: error instanceof Error ? error.message : "Failed to check in job",
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
            <ClipboardList className="h-5 w-5" />
            Check In at Shop - Complete Job Details
          </DialogTitle>
          <DialogDescription>
            Complete the remaining job information for Job {job.jobId}. Fields marked with * are required.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-200px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Pre-populated Fields (Read-only) */}
              <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold text-sm">Pre-populated Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium">Job ID</label>
                    <Input value={job.jobId} disabled className="bg-muted mt-2" data-testid="input-job-id" />
                  </div>
                  <FormField
                    control={form.control}
                    name="shopName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Shop Name</FormLabel>
                        <FormControl>
                          <Input {...field} disabled className="bg-muted" data-testid="input-shop-name" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Name</FormLabel>
                        <FormControl>
                          <Input {...field} disabled className="bg-muted" data-testid="input-customer-name" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="customerShipTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Customer Ship To</FormLabel>
                        <FormControl>
                          <Input {...field} disabled className="bg-muted" data-testid="input-customer-ship-to" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

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

              {/* Ship2 ID (Read-only, auto-populated) */}
              <FormField
                control={form.control}
                name="p21ShipToId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Database className="h-3 w-3 text-muted-foreground" /> P21 Ship-To ID
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value || "Auto-populated"}
                        readOnly
                        disabled
                        className="bg-muted cursor-not-allowed"
                        data-testid="input-ship2-id"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Customer Specific Instructions */}
              <FormField
                control={form.control}
                name="customerSpecificInstructions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Database className="h-3 w-3 text-muted-foreground" /> Customer Specific Instructions
                    </FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value || ""} rows={2} data-testid="input-customer-instructions" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Send Clamps/Gaskets and Preferred Process */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="sendClampsGaskets"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Send Clamps/Gaskets?
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || "Auto-populated"}
                          readOnly
                          disabled
                          className="bg-muted cursor-not-allowed"
                          data-testid="input-send-clamps"
                        />
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
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Preferred Process
                      </FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value || "Auto-populated"}
                          readOnly
                          disabled
                          className="bg-muted cursor-not-allowed"
                          data-testid="input-preferred-process"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Shop Handoff */}
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
                          <SelectValue placeholder={isLoadingShopHandoffUsers ? "Loading..." : "Select handoff user"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {usersForSelectedShop.map((user) => (
                          <SelectItem key={user} value={user}>
                            {user}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Handoff Email Workflow (Read-only, auto-populated) */}
              <FormField
                control={form.control}
                name="handoffEmailWorkflow"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1">
                      <Database className="h-3 w-3 text-muted-foreground" /> Handoff Email Workflow
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        value={field.value || "Auto-populated"}
                        readOnly
                        disabled
                        className="bg-muted cursor-not-allowed"
                        data-testid="input-handoff-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contact Information */}
              <div className="space-y-4">
                <h3 className="font-semibold">Contact Information *</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="contactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Name *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter contact name" data-testid="input-contact-name" />
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
                          <Input {...field} placeholder="Enter contact number" data-testid="input-contact-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Order Information */}
              <div className="space-y-4">
                <h3 className="font-semibold">Order Information</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="poNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PO Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter PO number" data-testid="input-po-number" />
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
                        <FormLabel>Serial Numbers</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Enter serial numbers (one per line)" rows={2} data-testid="input-serial-numbers" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Additional Instructions */}
              <div className="space-y-4">
                <h3 className="font-semibold">Additional Instructions</h3>
                
                <FormField
                  control={form.control}
                  name="anyOtherSpecificInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Any Other Specific Instructions?
                      </FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} rows={2} data-testid="input-other-instructions" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="anyCommentsForTech"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Any Comments for Tech?
                      </FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-tech-comments">
                            <SelectValue placeholder={isLoadingComments ? "Loading..." : "Select or leave blank"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="">None</SelectItem>
                          {techComments.map((comment) => (
                            <SelectItem key={comment} value={comment}>
                              {comment}
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
                  name="noteToTechAboutCustomer"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1">
                        <Database className="h-3 w-3 text-muted-foreground" /> Note to Tech About Customer
                      </FormLabel>
                      <FormControl>
                        <Textarea {...field} value={field.value || ""} rows={2} data-testid="input-note-to-tech" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="techCustomerQuestionInquiry"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>If Tech has a question, which email should they contact?</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="sales@ecspart.com" data-testid="input-tech-inquiry-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            data-testid="button-cancel"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            onClick={form.handleSubmit(onSubmit)}
            disabled={isSubmitting}
            data-testid="button-submit-check-in"
          >
            {isSubmitting ? "Checking In..." : "Complete Check-In"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
