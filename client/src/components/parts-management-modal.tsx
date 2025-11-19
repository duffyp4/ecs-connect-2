import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertJobPartSchema, type JobPart, type InsertJobPart } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useParts } from "@/hooks/use-reference-data";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Package, Trash2, Edit, Plus, ChevronsUpDown, Check, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import type { z } from "zod";
import { useQuery } from "@tanstack/react-query";

type PartFormData = z.infer<typeof insertJobPartSchema>;

// Local part type (without id, for new jobs)
export type LocalPart = Omit<InsertJobPart, 'jobId'> & { tempId?: string };

interface PartsManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  onSuccess?: () => void;
  // Optional: For managing parts locally (before job creation)
  localParts?: LocalPart[];
  onLocalPartsChange?: (parts: LocalPart[]) => void;
  mode?: 'api' | 'local'; // 'api' = existing job, 'local' = new job
  openInAddMode?: boolean; // If true, opens directly to add form instead of parts list
}

export function PartsManagementModal({
  open,
  onOpenChange,
  jobId,
  onSuccess,
  localParts,
  onLocalPartsChange,
  mode = 'api',
  openInAddMode = false,
}: PartsManagementModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPart, setEditingPart] = useState<JobPart | LocalPart | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [partSearchOpen, setPartSearchOpen] = useState(false);

  // Fetch parts from reference data
  const { data: partsOptions = [], isLoading: isLoadingParts } = useParts();

  // Open in add mode if requested
  useEffect(() => {
    if (open && openInAddMode) {
      setShowForm(true);
      setEditingPart(null);
    }
  }, [open, openInAddMode]);

  // Only query API if in API mode
  const { data: apiParts = [], isLoading, refetch } = useQuery<JobPart[]>({
    queryKey: [`/api/jobs/${jobId}/parts`],
    enabled: open && mode === 'api',
  });

  // Use either API parts or local parts depending on mode
  const parts = mode === 'local' ? (localParts || []) : apiParts;

  const form = useForm<PartFormData>({
    resolver: zodResolver(insertJobPartSchema),
    defaultValues: {
      jobId,
      part: "",
      process: "",
      ecsSerial: "",
      filterPn: "",
      poNumber: "",
      mileage: "",
      unitVin: "",
      gasketClamps: "",
      ec: "",
      eg: "",
      ek: "",
    },
  });

  useEffect(() => {
    if (editingPart) {
      form.reset({
        jobId,
        part: editingPart.part || "",
        process: editingPart.process || "",
        ecsSerial: editingPart.ecsSerial || "",
        filterPn: editingPart.filterPn || "",
        poNumber: editingPart.poNumber || "",
        mileage: editingPart.mileage || "",
        unitVin: editingPart.unitVin || "",
        gasketClamps: editingPart.gasketClamps || "",
        ec: editingPart.ec || "",
        eg: editingPart.eg || "",
        ek: editingPart.ek || "",
      });
      setShowForm(true);
    }
  }, [editingPart, form, jobId]);

  const onSubmit = async (data: PartFormData) => {
    try {
      setIsSubmitting(true);

      if (mode === 'local') {
        // Local mode: update local parts array
        const partData: LocalPart = {
          part: data.part,
          process: data.process,
          ecsSerial: data.ecsSerial,
          filterPn: data.filterPn,
          poNumber: data.poNumber,
          mileage: data.mileage,
          unitVin: data.unitVin,
          gasketClamps: data.gasketClamps,
          ec: data.ec,
          eg: data.eg,
          ek: data.ek,
        };

        if (editingPart && 'tempId' in editingPart) {
          // Update existing local part
          const updated = (localParts || []).map(p => 
            p.tempId === editingPart.tempId ? { ...partData, tempId: editingPart.tempId } : p
          );
          onLocalPartsChange?.(updated);
        } else {
          // Add new local part
          const newPart = { ...partData, tempId: Date.now().toString() };
          onLocalPartsChange?.([...(localParts || []), newPart]);
        }

        toast({
          title: editingPart ? "Part Updated" : "Part Added",
          description: "Part has been saved locally.",
        });
      } else {
        // API mode: save to server
        if (editingPart && 'id' in editingPart) {
          await apiRequest("PUT", `/api/jobs/${jobId}/parts/${editingPart.id}`, data);
          toast({
            title: "Part Updated",
            description: "Part has been updated successfully.",
          });
        } else {
          await apiRequest("POST", `/api/jobs/${jobId}/parts`, data);
          toast({
            title: "Part Added",
            description: "Part has been added successfully.",
          });
        }

        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/parts`] });
        refetch();
      }

      form.reset();
      setEditingPart(null);
      setShowForm(false);
      onSuccess?.();
    } catch (error) {
      console.error("Part save error:", error);
      toast({
        title: "Save Failed",
        description: error instanceof Error ? error.message : "Failed to save part",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (part: JobPart | LocalPart) => {
    if (!confirm("Are you sure you want to delete this part?")) return;

    try {
      if (mode === 'local' && 'tempId' in part) {
        // Local mode: remove from local parts array
        const updated = (localParts || []).filter(p => p.tempId !== part.tempId);
        onLocalPartsChange?.(updated);
        toast({
          title: "Part Deleted",
          description: "Part has been deleted.",
        });
      } else if (mode === 'api' && 'id' in part) {
        // API mode: delete from server
        await apiRequest("DELETE", `/api/jobs/${jobId}/parts/${part.id}`);
        toast({
          title: "Part Deleted",
          description: "Part has been deleted successfully.",
        });
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/parts`] });
        refetch();
      }
      
      onSuccess?.();
    } catch (error) {
      console.error("Part delete error:", error);
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete part",
        variant: "destructive",
      });
    }
  };

  const handleAddNew = () => {
    form.reset({
      jobId,
      part: "",
      process: "",
      ecsSerial: "",
      filterPn: "",
      poNumber: "",
      mileage: "",
      unitVin: "",
      gasketClamps: "",
      ec: "",
      eg: "",
      ek: "",
    });
    setEditingPart(null);
    setShowForm(true);
  };

  const handleCancel = () => {
    form.reset();
    setEditingPart(null);
    setShowForm(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Manage Parts
          </DialogTitle>
          <DialogDescription>
            Add, edit, or remove parts for this job. Parts will be included in the emissions service log dispatch.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-12rem)]">
          {!showForm && (
            <div className="space-y-4 pr-4">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-medium">Parts List ({parts.length})</h3>
                <Button
                  type="button"
                  onClick={handleAddNew}
                  size="sm"
                  data-testid="button-add-part"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add Part
                </Button>
              </div>

              {isLoading && <p className="text-sm text-muted-foreground">Loading parts...</p>}
              
              {!isLoading && parts.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No parts added yet</p>
                  <p className="text-sm">Click "Add Part" to get started</p>
                </div>
              )}

              {parts.map((part) => {
                const partKey = 'id' in part ? part.id : part.tempId || 'unknown';
                return (
                  <div
                    key={partKey}
                    className="border rounded-lg p-4 space-y-2"
                    data-testid={`card-part-${partKey}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 flex-1">
                        <div className="font-medium">{part.part || "Unnamed Part"}</div>
                        <div className="text-sm text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1">
                          {part.process && <div><span className="font-medium">Process:</span> {part.process}</div>}
                          {part.ecsSerial && <div><span className="font-medium">ECS Serial:</span> {part.ecsSerial}</div>}
                          {part.filterPn && <div><span className="font-medium">Filter PN:</span> {part.filterPn}</div>}
                          {part.poNumber && <div><span className="font-medium">PO:</span> {part.poNumber}</div>}
                          {part.mileage && <div><span className="font-medium">Mileage:</span> {part.mileage}</div>}
                          {part.unitVin && <div><span className="font-medium">Unit/VIN:</span> {part.unitVin}</div>}
                          {part.gasketClamps && <div><span className="font-medium">Gasket/Clamps:</span> {part.gasketClamps}</div>}
                          {part.ec && <div><span className="font-medium">EC:</span> {part.ec}</div>}
                          {part.eg && <div><span className="font-medium">EG:</span> {part.eg}</div>}
                          {part.ek && <div><span className="font-medium">EK:</span> {part.ek}</div>}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingPart(part)}
                          data-testid={`button-edit-part-${partKey}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(part)}
                          data-testid={`button-delete-part-${partKey}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {showForm && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pr-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="part"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-muted-foreground" /> Part *
                        </FormLabel>
                        <Popover open={partSearchOpen} onOpenChange={setPartSearchOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={partSearchOpen}
                                className="w-full justify-between"
                                data-testid="select-part"
                              >
                                {field.value || "Select or type part name..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0">
                            <Command shouldFilter={false}>
                              <div className="flex items-center border-b px-3">
                                <Database className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <Input
                                  placeholder="Search parts or enter custom name..."
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                              </div>
                              <CommandList>
                                {isLoadingParts ? (
                                  <div className="py-6 text-center text-sm">Loading parts...</div>
                                ) : (
                                  <>
                                    {partsOptions
                                      .filter((part) =>
                                        part.toLowerCase().includes((field.value || "").toLowerCase())
                                      )
                                      .slice(0, 100)
                                      .map((part) => (
                                        <CommandItem
                                          key={part}
                                          value={part}
                                          onSelect={() => {
                                            field.onChange(part);
                                            setPartSearchOpen(false);
                                          }}
                                        >
                                          <Check
                                            className={cn(
                                              "mr-2 h-4 w-4",
                                              field.value === part ? "opacity-100" : "opacity-0"
                                            )}
                                          />
                                          {part}
                                        </CommandItem>
                                      ))}
                                    {partsOptions
                                      .filter((part) =>
                                        part.toLowerCase().includes((field.value || "").toLowerCase())
                                      ).length === 0 && field.value && (
                                      <div className="py-6 text-center text-sm text-muted-foreground">
                                        Press Enter to use "{field.value}"
                                      </div>
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
                    name="process"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Process Being Performed *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-process" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ecsSerial"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ECS Serial Number *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-ecs-serial" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="gasketClamps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gasket or Clamps *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-gasket-clamps" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="filterPn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Filter Part Number</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-filter-pn" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="poNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PO Number</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-po-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="mileage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Mileage</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-mileage" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unitVin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unit / VIN Number</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-unit-vin" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ec"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EC</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-ec" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="eg"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EG</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-eg" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="ek"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EK</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-ek" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    data-testid="button-cancel-part"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    data-testid="button-save-part"
                  >
                    {isSubmitting ? "Saving..." : editingPart ? "Update Part" : "Add Part"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </ScrollArea>

        {!showForm && (
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-parts"
            >
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
