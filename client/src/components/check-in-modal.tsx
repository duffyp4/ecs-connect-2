import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { insertJobSchema } from "@shared/schema";
import { getShopCode, getTodayDateCode } from "@shared/shopCodes";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useCsrCheckInForm } from "@/hooks/use-csr-check-in-form";
import { CsrCheckInFormFields } from "@/components/csr-check-in-form-fields";
import { PartsManagementModal } from "@/components/parts-management-modal";
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
import { ClipboardList, Plus, AlertCircle, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export function CheckInModal({
  open,
  onOpenChange,
  job,
  onSuccess,
}: CheckInModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [shipToSearchOpen, setShipToSearchOpen] = useState(false);
  const [partsModalOpen, setPartsModalOpen] = useState(false);
  const [generatingSerialForPartId, setGeneratingSerialForPartId] = useState<string | null>(null);

  // Fetch existing parts for this job
  const { data: existingParts = [], refetch: refetchParts } = useQuery<any[]>({
    queryKey: [`/api/jobs/${job.jobId}/parts`],
    enabled: open,
  });

  // Use the shared CSR Check-In form hook with auto-population disabled
  // since we're pre-populating from existing job data
  const { form, referenceData, watchedFields } = useCsrCheckInForm({
    disableAutoPopulation: true,
    initialValues: {
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
      techCustomerQuestionInquiry:
        job.techCustomerQuestionInquiry || "sales@ecspart.com",
      shopHandoff: job.shopHandoff || "",
      handoffEmailWorkflow: job.handoffEmailWorkflow || "",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

      // Validate that at least one part exists
      if (!existingParts || existingParts.length === 0) {
        toast({
          title: "Parts Required",
          description: "At least one part is required before checking in at shop. Please add parts to this job first.",
          variant: "destructive",
        });
        setIsSubmitting(false);
        return;
      }

      // Validate using insertJobSchema (same as original CSR form)
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
      await apiRequest("POST", `/api/jobs/${job.jobId}/check-in`, result.data);

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
        description:
          error instanceof Error ? error.message : "Failed to check in job",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate serial number for a specific part (inline in the table)
  const handleGenerateSerialForPart = async (partId: string) => {
    try {
      setGeneratingSerialForPartId(partId);
      
      // Use job's shop name or form's selected shop name
      const shopNameToUse = form.watch("shopName") || job.shopName || "Nashville";
      const shopCode = getShopCode(shopNameToUse);
      const dateCode = getTodayDateCode();
      
      // Get next serial from database
      const response = await apiRequest("POST", `/api/serial/generate`, { shopCode, date: dateCode });
      const data = await response.json();
      const serialNumber = data.serialNumber;
      
      // Update the part with the new serial number
      await apiRequest("PATCH", `/api/jobs/${job.jobId}/parts/${partId}`, { 
        ecsSerial: serialNumber 
      });
      
      // Refetch parts to show the updated serial
      await refetchParts();
      
      toast({
        title: "Serial Generated",
        description: `Serial number ${serialNumber} has been assigned.`,
      });
    } catch (error) {
      console.error("Failed to generate serial number:", error);
      toast({
        title: "Generation Failed",
        description: "Could not generate serial number. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingSerialForPartId(null);
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
            Complete the remaining job information for Job {job.jobId}.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-200px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Job ID (Read-only) */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <label className="text-sm font-medium">Job ID</label>
                <Input
                  value={job.jobId}
                  disabled
                  className="bg-muted mt-2"
                  data-testid="input-job-id"
                />
              </div>

              {/* All Form Fields */}
              <CsrCheckInFormFields
                form={form}
                referenceData={referenceData}
                watchedFields={watchedFields}
                customerSearchOpen={customerSearchOpen}
                setCustomerSearchOpen={setCustomerSearchOpen}
                shipToSearchOpen={shipToSearchOpen}
                setShipToSearchOpen={setShipToSearchOpen}
                disabledFields={["shopName", "customerName", "customerShipTo"]}
              />

              {/* Add/Manage Parts */}
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Parts * <span className="text-muted-foreground font-normal">(at least one required)</span>
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
                    {existingParts.length === 0 ? 'ADD' : 'MANAGE PARTS'}
                  </Button>
                  
                  {/* Parts Summary Table */}
                  {existingParts.length > 0 && (
                    <div className="mt-3 border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[180px]">ECS Serial</TableHead>
                            <TableHead>Part</TableHead>
                            <TableHead className="w-[100px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {existingParts.map((part, index) => (
                            <TableRow key={part.id || index}>
                              <TableCell className="font-mono text-sm">
                                {part.ecsSerial ? (
                                  part.ecsSerial
                                ) : (
                                  <span className="flex items-center gap-1 text-amber-600">
                                    <AlertCircle className="h-3 w-3" />
                                    <span className="text-xs">Not assigned</span>
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>{part.part || 'Unknown'}</TableCell>
                              <TableCell>
                                {!part.ecsSerial && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleGenerateSerialForPart(part.id)}
                                    disabled={generatingSerialForPartId === part.id}
                                    className="border-blue-500 text-blue-600 hover:bg-blue-50 text-xs h-7"
                                    data-testid={`button-generate-serial-${part.id}`}
                                  >
                                    {generatingSerialForPartId === part.id ? (
                                      <>
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        ...
                                      </>
                                    ) : (
                                      'Generate'
                                    )}
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
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

      {/* Parts Management Modal */}
      <PartsManagementModal
        open={partsModalOpen}
        onOpenChange={setPartsModalOpen}
        jobId={job.jobId}
        openInAddMode={existingParts.length === 0}
        onSuccess={async () => {
          // Refetch parts to ensure we have the latest data before check-in
          await refetchParts();
          toast({
            title: "Parts Updated",
            description: "Job parts have been updated successfully.",
          });
        }}
      />
    </Dialog>
  );
}
