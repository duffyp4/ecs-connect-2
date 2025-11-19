import { useState } from "react";
import { insertJobSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
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
import { ClipboardList, Settings } from "lucide-react";
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

  // Use the shared CSR Check-In form hook with auto-population disabled
  // since we're pre-populating from existing job data
  const { form, referenceData, watchedFields } = useCsrCheckInForm({
    disableAutoPopulation: true,
    initialValues: {
      p21OrderNumber: job.p21OrderNumber || "",
      userId: job.userId || "",
      permissionToStart: job.permissionToStart || "",
      permissionDeniedStop: job.permissionDeniedStop || "",
      // shopName is NOT pre-populated - user selects it during check-in
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
      techCustomerQuestionInquiry:
        job.techCustomerQuestionInquiry || "sales@ecspart.com",
      shopHandoff: job.shopHandoff || "",
      handoffEmailWorkflow: job.handoffEmailWorkflow || "",
    },
  });

  const onSubmit = async (data: FormData) => {
    try {
      setIsSubmitting(true);

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
                disabledFields={["customerName", "customerShipTo"]}
              />
            </form>
          </Form>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <div className="flex-1">
            <Button
              type="button"
              variant="outline"
              onClick={() => setPartsModalOpen(true)}
              disabled={isSubmitting}
              data-testid="button-manage-parts"
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage Parts
            </Button>
          </div>
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
        onSuccess={() => {
          toast({
            title: "Parts Updated",
            description: "Job parts have been updated successfully.",
          });
        }}
      />
    </Dialog>
  );
}
