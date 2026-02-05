import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { insertJobPartSchema, type JobPart, type InsertJobPart, type Job } from "@shared/schema";
import { getShopCode, getTodayDateCode } from "@shared/shopCodes";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useParts, useProcesses, useFilterPartNumbers } from "@/hooks/use-reference-data";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Package, Trash2, Edit, Plus, Database, ChevronsUpDown, Check, Info, Copy, GripVertical } from "lucide-react";
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
  showEditLockDisclaimer?: boolean; // If true, shows disclaimer about parts being locked after shop check-in
  editingPart?: JobPart | null; // Pass a part to edit directly (from job details page)
  shopName?: string; // Optional: Pass shop name directly (for local mode when job doesn't exist yet)
  hideSerialNumber?: boolean; // If true, hides the ECS Serial Number field (for inbound shipment path)
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
  showEditLockDisclaimer = false,
  editingPart: externalEditingPart,
  shopName: propShopName,
  hideSerialNumber = false,
}: PartsManagementModalProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPart, setEditingPart] = useState<JobPart | LocalPart | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch parts, processes, and filter part numbers from reference data
  const { data: partsOptions = [], isLoading: isLoadingParts } = useParts();
  const { data: processOptions = [], isLoading: isLoadingProcesses } = useProcesses();
  const { data: filterPNOptions = [], isLoading: isLoadingFilterPNs } = useFilterPartNumbers();
  
  const [filterPNSearchOpen, setFilterPNSearchOpen] = useState(false);

  // Open in add mode if requested
  useEffect(() => {
    if (open && openInAddMode) {
      setShowForm(true);
      setEditingPart(null);
    }
  }, [open, openInAddMode]);

  // Handle external editing part (from job details page)
  useEffect(() => {
    if (open && externalEditingPart) {
      setEditingPart(externalEditingPart);
      setShowForm(true);
    }
  }, [open, externalEditingPart]);

  // Fetch job information to get shop name for serial number generation
  const { data: job } = useQuery<Job>({
    queryKey: [`/api/jobs/${jobId}`],
    enabled: open,
  });

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

  // Serial number validation state
  const [serialValidation, setSerialValidation] = useState<{
    status: 'idle' | 'checking' | 'valid' | 'invalid';
    message?: string;
  }>({ status: 'idle' });
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate serial number on demand
  const handleGenerateSerial = async () => {
    try {
      setIsGenerating(true);
      const shopNameToUse = propShopName || job?.shopName || "Nashville";
      const shopCode = getShopCode(shopNameToUse);
      const dateCode = getTodayDateCode();
      
      // Get next serial from database
      const response = await apiRequest("POST", `/api/serial/generate`, { shopCode, date: dateCode });
      const data = await response.json();
      let suggestedSerial = data.serialNumber;
      
      // If in local mode, also check local parts array and increment if needed
      if (mode === 'local' && localParts && localParts.length > 0) {
        const localSerials = localParts
          .map(p => p.ecsSerial)
          .filter(s => s && s.startsWith(`${shopCode}.${dateCode}.`));
        
        // Extract sequence numbers from local parts
        const localSequences = localSerials
          .map(serial => {
            const match = serial?.match(/\.(\d{2})$/);
            return match ? parseInt(match[1], 10) : 0;
          })
          .filter(seq => !isNaN(seq));
        
        if (localSequences.length > 0) {
          // Find the highest sequence in local parts
          const maxLocalSeq = Math.max(...localSequences);
          
          // Extract sequence from suggested serial
          const suggestedMatch = suggestedSerial.match(/\.(\d{2})$/);
          const suggestedSeq = suggestedMatch ? parseInt(suggestedMatch[1], 10) : 0;
          
          // If local sequence is higher or equal, use next after max local
          if (maxLocalSeq >= suggestedSeq) {
            const nextSeq = maxLocalSeq + 1;
            suggestedSerial = `${shopCode}.${dateCode}.${String(nextSeq).padStart(2, '0')}`;
          }
        }
      }
      
      form.setValue("ecsSerial", suggestedSerial);
      setSerialValidation({ status: 'valid', message: 'Serial # Available' });
    } catch (error) {
      console.error("Failed to generate serial number:", error);
      toast({
        title: "Generation Failed",
        description: "Could not generate serial number. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Real-time validation with debounce
  useEffect(() => {
    const serial = form.watch("ecsSerial");
    
    if (!serial) {
      setSerialValidation({ status: 'idle' });
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setSerialValidation({ status: 'checking' });
        
        // FIRST: Check local parts array (for new jobs where parts aren't in DB yet)
        if (mode === 'local' && localParts && localParts.length > 0) {
          // Find if serial is already used by another local part
          const existingLocalPart = localParts.find(p => 
            p.ecsSerial === serial && 
            (!editingPart || !('tempId' in editingPart) || p.tempId !== editingPart.tempId)
          );
          
          if (existingLocalPart) {
            setSerialValidation({ status: 'invalid', message: 'Serial number already in use on this job' });
            return;
          }
        }
        
        // SECOND: Check database for existing parts
        // Build query params to exclude current part when editing
        const queryParams = new URLSearchParams();
        queryParams.set('jobId', jobId);
        if (editingPart && 'id' in editingPart) {
          queryParams.set('partId', editingPart.id);
        }
        
        const response = await apiRequest("GET", `/api/serial/check/${encodeURIComponent(serial)}?${queryParams.toString()}`);
        const data = await response.json();
        
        if (data.valid && data.available) {
          setSerialValidation({ status: 'valid', message: 'Serial # Available' });
        } else if (!data.valid) {
          setSerialValidation({ status: 'invalid', message: data.error || 'Invalid serial number format' });
        } else if (!data.available) {
          setSerialValidation({ status: 'invalid', message: 'Serial number already in use' });
        }
      } catch (error) {
        console.error("Failed to validate serial number:", error);
        setSerialValidation({ status: 'invalid', message: 'Could not validate serial number' });
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [form.watch("ecsSerial"), jobId, editingPart, mode, localParts]);

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

  const handleDuplicate = async (part: JobPart | LocalPart) => {
    try {
      setIsSubmitting(true);
      
      let newSerial = "";
      
      // Only generate a serial number if the original part has one
      // (e.g., inbound shipment parts don't have serials until check-in)
      if (part.ecsSerial) {
        const shopNameToUse = propShopName || job?.shopName || "Nashville";
        const shopCode = getShopCode(shopNameToUse);
        const dateCode = getTodayDateCode();
        
        // Get next serial from database
        const response = await apiRequest("POST", `/api/serial/generate`, { shopCode, date: dateCode });
        const data = await response.json();
        newSerial = data.serialNumber;
        
        // If in local mode, also check local parts array and increment if needed
        if (mode === 'local' && localParts && localParts.length > 0) {
          const localSerials = localParts
            .map(p => p.ecsSerial)
            .filter(s => s && s.startsWith(`${shopCode}.${dateCode}.`));
          
          const localSequences = localSerials
            .map(serial => {
              const match = serial?.match(/\.(\d{2})$/);
              return match ? parseInt(match[1], 10) : 0;
            })
            .filter(seq => !isNaN(seq));
          
          if (localSequences.length > 0) {
            const maxLocalSeq = Math.max(...localSequences);
            const suggestedMatch = newSerial.match(/\.(\d{2})$/);
            const suggestedSeq = suggestedMatch ? parseInt(suggestedMatch[1], 10) : 0;
            
            if (maxLocalSeq >= suggestedSeq) {
              const nextSeq = maxLocalSeq + 1;
              newSerial = `${shopCode}.${dateCode}.${String(nextSeq).padStart(2, '0')}`;
            }
          }
        }
      }
      
      // Copy all part data (keep serial empty if original had none)
      const duplicateData: LocalPart = {
        part: part.part || "",
        process: part.process || "",
        ecsSerial: newSerial,
        filterPn: part.filterPn || undefined,
        poNumber: part.poNumber || undefined,
        mileage: part.mileage || undefined,
        unitVin: part.unitVin || undefined,
        gasketClamps: part.gasketClamps || "",
        ec: part.ec || undefined,
        eg: part.eg || undefined,
        ek: part.ek || undefined,
      };

      if (mode === 'local') {
        // Local mode: add to local parts array
        const newPart = { ...duplicateData, tempId: Date.now().toString() };
        onLocalPartsChange?.([...(localParts || []), newPart]);
        toast({
          title: "Part Duplicated",
          description: newSerial 
            ? `Created duplicate with serial ${newSerial}` 
            : "Created duplicate (no serial - will be assigned at check-in)",
        });
      } else {
        // API mode: save to server
        await apiRequest("POST", `/api/jobs/${jobId}/parts`, {
          jobId,
          ...duplicateData,
        });
        toast({
          title: "Part Duplicated",
          description: newSerial 
            ? `Created duplicate with serial ${newSerial}` 
            : "Created duplicate (no serial - will be assigned at check-in)",
        });
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/parts`] });
        refetch();
      }
      
      onSuccess?.();
    } catch (error) {
      console.error("Part duplicate error:", error);
      toast({
        title: "Duplicate Failed",
        description: error instanceof Error ? error.message : "Failed to duplicate part",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
    
    // If we opened directly in add mode and have no parts yet, close the entire modal
    // Otherwise, just go back to the parts list
    if (openInAddMode && parts.length === 0) {
      onOpenChange(false);
    } else {
      setShowForm(false);
    }
  };

  // Handle drag and drop reordering with serial number reassignment
  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;
    
    const sourceIndex = result.source.index;
    const destIndex = result.destination.index;
    
    if (sourceIndex === destIndex) return;
    
    // Reorder the parts array
    const reorderedParts = [...parts] as (JobPart | LocalPart)[];
    const [movedPart] = reorderedParts.splice(sourceIndex, 1);
    reorderedParts.splice(destIndex, 0, movedPart);
    
    // Extract all serial numbers and sort them
    const serials = reorderedParts
      .map(p => p.ecsSerial)
      .filter((s): s is string => !!s);
    
    // Sort serials to get sequential order
    const sortedSerials = [...serials].sort((a, b) => {
      // Extract the sequence number at the end (after last dot)
      const seqA = parseInt(a.split('.').pop() || '0', 10);
      const seqB = parseInt(b.split('.').pop() || '0', 10);
      return seqA - seqB;
    });
    
    // Reassign serials to match visual order (top = lowest, bottom = highest)
    const updatedParts = reorderedParts.map((part, index) => ({
      ...part,
      ecsSerial: sortedSerials[index] || part.ecsSerial,
    }));
    
    try {
      setIsSubmitting(true);
      
      if (mode === 'local') {
        // Local mode: update local parts array with new order and serials
        const localUpdated = updatedParts.map(p => {
          if ('tempId' in p) {
            return {
              part: p.part || "",
              process: p.process || "",
              ecsSerial: p.ecsSerial || "",
              filterPn: p.filterPn || undefined,
              poNumber: p.poNumber || undefined,
              mileage: p.mileage || undefined,
              unitVin: p.unitVin || undefined,
              gasketClamps: p.gasketClamps || "",
              ec: p.ec || undefined,
              eg: p.eg || undefined,
              ek: p.ek || undefined,
              tempId: p.tempId,
            } as LocalPart;
          }
          return p;
        });
        onLocalPartsChange?.(localUpdated as LocalPart[]);
        toast({
          title: "Parts Reordered",
          description: "Serial numbers have been reassigned to match the new order.",
        });
      } else {
        // API mode: update each part's serial number on the server
        for (const part of updatedParts) {
          if ('id' in part && part.id) {
            await apiRequest("PATCH", `/api/jobs/${jobId}/parts/${part.id}`, {
              ecsSerial: part.ecsSerial,
            });
          }
        }
        toast({
          title: "Parts Reordered",
          description: "Serial numbers have been reassigned to match the new order.",
        });
        queryClient.invalidateQueries({ queryKey: [`/api/jobs/${jobId}/parts`] });
        refetch();
      }
    } catch (error) {
      console.error("Reorder error:", error);
      toast({
        title: "Reorder Failed",
        description: error instanceof Error ? error.message : "Failed to reorder parts",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[90vw] md:max-w-3xl lg:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Manage Parts
          </DialogTitle>
          <DialogDescription>
            Add, edit, or remove parts for this job. Parts will be included in the emissions service log dispatch.
          </DialogDescription>
        </DialogHeader>

        {showEditLockDisclaimer && (
          <Alert className="mt-4 flex-shrink-0">
            <Info className="h-4 w-4" />
            <AlertDescription>
              Parts can only be edited until the job gets checked in at the shop. At that point, edits can only be made by the technician in GoCanvas.
            </AlertDescription>
          </Alert>
        )}

        {!showForm && (
          <ScrollArea className="flex-1 overflow-auto">
            <div className="space-y-4 pr-2 sm:pr-4">
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

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="parts-list">
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="space-y-2"
                    >
                      {parts.map((part, index) => {
                        const partKey = 'id' in part ? String(part.id) : part.tempId || `unknown-${index}`;
                        return (
                          <Draggable key={partKey} draggableId={partKey} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                className={cn(
                                  "border rounded-lg p-4 space-y-2 bg-background",
                                  snapshot.isDragging && "shadow-lg ring-2 ring-primary"
                                )}
                                data-testid={`card-part-${partKey}`}
                              >
                                <div className="flex justify-between items-start">
                                  <div
                                    {...provided.dragHandleProps}
                                    className="flex items-center mr-3 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                                    title="Drag to reorder"
                                  >
                                    <GripVertical className="h-5 w-5" />
                                  </div>
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
                                      onClick={() => handleDuplicate(part)}
                                      disabled={isSubmitting}
                                      data-testid={`button-duplicate-part-${partKey}`}
                                      title="Duplicate part"
                                    >
                                      <Copy className="h-4 w-4" />
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
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>
            </div>
          </ScrollArea>
        )}

        {showForm && (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
              <ScrollArea className="flex-1 overflow-auto pr-2 sm:pr-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4">
                  <FormField
                    control={form.control}
                    name="part"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-muted-foreground" /> Part *
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-part">
                              <SelectValue placeholder="Select part..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingParts ? (
                              <div className="py-6 text-center text-sm">Loading parts...</div>
                            ) : (
                              partsOptions.map((part) => (
                                <SelectItem key={part} value={part}>
                                  {part}
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
                    name="process"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-muted-foreground" /> Process Being Performed *
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-process">
                              <SelectValue placeholder="Select process..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {isLoadingProcesses ? (
                              <div className="py-6 text-center text-sm">Loading processes...</div>
                            ) : (
                              processOptions.map((process) => (
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

                  {!hideSerialNumber && (
                    <FormField
                      control={form.control}
                      name="ecsSerial"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>ECS Serial Number *</FormLabel>
                          <FormControl>
                            <Input {...field} data-testid="input-ecs-serial" />
                          </FormControl>
                          <div className="flex items-center gap-2 mt-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={handleGenerateSerial}
                              disabled={isGenerating}
                              className="border-blue-500 text-blue-600 hover:bg-blue-50"
                              data-testid="button-generate-serial"
                            >
                              {isGenerating ? "Generating..." : "Generate"}
                            </Button>
                            {serialValidation.status === 'checking' && (
                              <span className="text-xs text-muted-foreground">Checking...</span>
                            )}
                            {serialValidation.status === 'valid' && (
                              <span className="text-xs text-green-600 font-medium" data-testid="text-serial-valid">
                                ✓ {serialValidation.message}
                              </span>
                            )}
                            {serialValidation.status === 'invalid' && (
                              <span className="text-xs text-red-600 font-medium" data-testid="text-serial-invalid">
                                ✗ {serialValidation.message}
                              </span>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="filterPn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-1">
                          <Database className="h-3 w-3 text-muted-foreground" /> Filter Part Number
                        </FormLabel>
                        <Popover open={filterPNSearchOpen} onOpenChange={setFilterPNSearchOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                role="combobox"
                                aria-expanded={filterPNSearchOpen}
                                className="w-full justify-between font-normal"
                                data-testid="select-filter-pn"
                              >
                                {field.value || "Select or type filter part number..."}
                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px] p-0">
                            <Command shouldFilter={false}>
                              <div className="flex items-center border-b px-3">
                                <Database className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                                <Input
                                  placeholder="Search or type filter part number..."
                                  value={field.value || ""}
                                  onChange={(e) => field.onChange(e.target.value)}
                                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                                />
                              </div>
                              <CommandList>
                                {isLoadingFilterPNs ? (
                                  <div className="py-6 text-center text-sm">Loading filter part numbers...</div>
                                ) : (
                                  <>
                                    <CommandEmpty>
                                      <div className="py-6 text-center text-sm text-muted-foreground">
                                        {field.value ? (
                                          <>Press Enter to use &quot;{field.value}&quot;</>
                                        ) : (
                                          "Type to search or enter a custom value"
                                        )}
                                      </div>
                                    </CommandEmpty>
                                    <CommandGroup>
                                      {filterPNOptions
                                        .filter((pn) =>
                                          pn.toLowerCase().includes((field.value || "").toLowerCase())
                                        )
                                        .slice(0, 100)
                                        .map((pn) => (
                                          <CommandItem
                                            key={pn}
                                            value={pn}
                                            onSelect={() => {
                                              field.onChange(pn);
                                              setFilterPNSearchOpen(false);
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                field.value === pn ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            {pn}
                                          </CommandItem>
                                        ))}
                                    </CommandGroup>
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
                    name="gasketClamps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Gasket or Clamps *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger data-testid="select-gasket-clamps">
                              <SelectValue placeholder="Select option..." />
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

                  {form.watch("gasketClamps") === "Yes" && (
                    <div className="col-span-1">
                      <div className="rounded-lg border p-4 bg-muted/30 space-y-3">
                        <FormField
                          control={form.control}
                          name="ec"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-y-0">
                              <FormLabel className="cursor-pointer font-normal">EC</FormLabel>
                              <FormControl>
                                <Checkbox
                                  checked={field.value === "Yes"}
                                  onCheckedChange={(checked) => field.onChange(checked ? "Yes" : "")}
                                  data-testid="checkbox-ec"
                                  className="h-4 w-4"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="eg"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-y-0">
                              <FormLabel className="cursor-pointer font-normal">EG</FormLabel>
                              <FormControl>
                                <Checkbox
                                  checked={field.value === "Yes"}
                                  onCheckedChange={(checked) => field.onChange(checked ? "Yes" : "")}
                                  data-testid="checkbox-eg"
                                  className="h-4 w-4"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="ek"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center justify-between space-y-0">
                              <FormLabel className="cursor-pointer font-normal">EK</FormLabel>
                              <FormControl>
                                <Checkbox
                                  checked={field.value === "Yes"}
                                  onCheckedChange={(checked) => field.onChange(checked ? "Yes" : "")}
                                  data-testid="checkbox-ek"
                                  className="h-4 w-4"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>

              <DialogFooter className="flex-shrink-0 pt-4 flex-col sm:flex-row gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  data-testid="button-cancel-part"
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="button-save-part"
                  className="w-full sm:w-auto"
                >
                  {isSubmitting ? "Saving..." : editingPart ? "Update Part" : "Add Part"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}

        {!showForm && (
          <DialogFooter className="flex-shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="button-close-parts"
              className="w-full sm:w-auto"
            >
              Close
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
