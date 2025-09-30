import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { checkInJobSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useShopUsers, usePermissionForUser, useUsersForShop } from "@/hooks/use-reference-data";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { z } from "zod";
import type { Job } from "@shared/schema";

type FormData = z.infer<typeof checkInJobSchema>;

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
    resolver: zodResolver(checkInJobSchema),
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

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);
      
      // Filter out empty optional fields to avoid violating NOT NULL constraints
      // Convert empty strings to undefined and remove them from the payload
      const cleanedData = Object.entries(data).reduce((acc, [key, value]) => {
        // Keep the value if it's truthy, or if it's explicitly empty and required
        if (value !== "" && value !== null && value !== undefined) {
          acc[key] = value;
        } else {
          // For required fields, keep empty values as they are
          const requiredFields = ['shopName', 'customerName', 'userId', 'permissionToStart', 'shopHandoff', 'contactName', 'contactNumber'];
          if (requiredFields.includes(key)) {
            acc[key] = value;
          }
          // For optional fields, omit empty values entirely
        }
        return acc;
      }, {} as Record<string, any>);
      
      // Submit to check-in endpoint with cleaned data
      await apiRequest("POST", `/api/jobs/${job.jobId}/check-in`, cleanedData);

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

              {/* Required Fields */}
              <div className="space-y-4">
                <h3 className="font-semibold">User & Shop Information *</h3>
                
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User ID *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-user-id">
                            <SelectValue placeholder={isLoadingShopUsers ? "Loading users..." : "Select user"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {shopUsers.map((user) => (
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

                <FormField
                  control={form.control}
                  name="permissionToStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Permission to Start *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-permission">
                            <SelectValue placeholder="Select permission" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {permissionData && Object.entries(permissionData).map(([key, value]) => (
                            <SelectItem key={key} value={value as string}>
                              {value as string}
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
                  name="shopHandoff"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shop Handoff *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
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
              </div>

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
                    name="p21OrderNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>P21 Order Number</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Enter P21 order number" data-testid="input-p21-order" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="serialNumbers"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial Numbers</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Enter serial numbers (one per line)" rows={3} data-testid="input-serial-numbers" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Additional Instructions */}
              <div className="space-y-4">
                <h3 className="font-semibold">Additional Instructions</h3>
                
                <FormField
                  control={form.control}
                  name="anyOtherSpecificInstructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Specific Instructions</FormLabel>
                      <FormControl>
                        <Textarea {...field} placeholder="Enter any specific instructions" rows={3} data-testid="input-other-instructions" />
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
