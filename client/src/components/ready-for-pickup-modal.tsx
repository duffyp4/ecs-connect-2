import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Package } from "lucide-react";
import type { Job } from "@shared/schema";

const readyForPickupSchema = z.object({
  orderNumber: z.string().optional(),
  orderNumber2: z.string().optional(),
  orderNumber3: z.string().optional(),
  orderNumber4: z.string().optional(),
  orderNumber5: z.string().optional(),
});

type ReadyForPickupFormData = z.infer<typeof readyForPickupSchema>;

interface ReadyForPickupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job;
  onSuccess: () => void;
}

export function ReadyForPickupModal({
  open,
  onOpenChange,
  job,
  onSuccess,
}: ReadyForPickupModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReadyForPickupFormData>({
    resolver: zodResolver(readyForPickupSchema),
    defaultValues: {
      orderNumber: job.orderNumber || "",
      orderNumber2: job.orderNumber2 || "",
      orderNumber3: job.orderNumber3 || "",
      orderNumber4: job.orderNumber4 || "",
      orderNumber5: job.orderNumber5 || "",
    },
  });

  const onSubmit = async (data: ReadyForPickupFormData) => {
    try {
      setIsSubmitting(true);

      // Call the mark-ready endpoint with order numbers and delivery method
      await apiRequest("POST", `/api/jobs/${job.jobId}/mark-ready`, {
        deliveryMethod: 'pickup',
        orderNumber: data.orderNumber,
        orderNumber2: data.orderNumber2,
        orderNumber3: data.orderNumber3,
        orderNumber4: data.orderNumber4,
        orderNumber5: data.orderNumber5,
      });

      // Invalidate queries to refresh data immediately
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/metrics"] });

      toast({
        title: "Ready for Pickup",
        description: "Job has been marked as ready for pickup",
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to mark job as ready for pickup",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Ready for Pickup
          </DialogTitle>
          <DialogDescription>
            Add order numbers for Job {job.jobId}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-200px)] pr-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-4">
                {/* Order Number */}
                <FormField
                  control={form.control}
                  name="orderNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Order Number</FormLabel>
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

                {/* Order Number - #2 */}
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

                {/* Order Number - #3 */}
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

                {/* Order Number - #4 */}
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

                {/* Order Number - #5 */}
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
            data-testid="button-cancel-ready-pickup"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            data-testid="button-confirm-ready-pickup"
            onClick={form.handleSubmit(onSubmit)}
          >
            {isSubmitting ? "Processing..." : "Mark as Ready for Pickup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
