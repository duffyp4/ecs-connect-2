import { useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";

interface PartData {
  id: string;
  part: string;
  process: string;
  ecsSerial: string;
  filterPn?: string;
  poNumber?: string;
  mileage?: string;
  unitVin?: string;
  gasketClamps?: string;
  ec?: string;
  eg?: string;
  ek?: string;
}

interface PartsLoopSectionProps {
  parts: PartData[];
  form: UseFormReturn<any>;
}

export function PartsLoopSection({ parts, form }: PartsLoopSectionProps) {
  const [expandedParts, setExpandedParts] = useState<Set<number>>(() => {
    // Expand first part by default
    return new Set(parts.length > 0 ? [0] : []);
  });

  const togglePart = (index: number) => {
    setExpandedParts((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (parts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No parts assigned to this job.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Parts ({parts.length})</h2>
      {parts.map((part, index) => {
        const isExpanded = expandedParts.has(index);
        const passOrFail = form.watch(`parts.${index}.passOrFail`);
        const statusIcon = passOrFail === "Pass" ? (
          <CheckCircle2 className="h-4 w-4 text-green-600" />
        ) : passOrFail === "Fail" ? (
          <XCircle className="h-4 w-4 text-red-600" />
        ) : null;

        return (
          <Card key={part.id || index}>
            {/* Collapsible header */}
            <CardHeader
              className="pb-2 cursor-pointer select-none"
              onClick={() => togglePart(index)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">
                    {part.part || `Part ${index + 1}`}
                  </CardTitle>
                  {statusIcon}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{part.ecsSerial || "No serial"}</span>
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="space-y-4">
                {/* Read-only CSR fields */}
                <div className="space-y-2 p-3 bg-muted/50 rounded-md">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Pre-filled Info</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Part</span>
                      <p className="font-medium">{part.part || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Process</span>
                      <p className="font-medium">{part.process || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">ECS Serial</span>
                      <p className="font-medium">{part.ecsSerial || "—"}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Filter P/N</span>
                      <p className="font-medium">{part.filterPn || "—"}</p>
                    </div>
                    {part.poNumber && (
                      <div>
                        <span className="text-muted-foreground">PO Number</span>
                        <p className="font-medium">{part.poNumber}</p>
                      </div>
                    )}
                    {part.mileage && (
                      <div>
                        <span className="text-muted-foreground">Mileage</span>
                        <p className="font-medium">{part.mileage}</p>
                      </div>
                    )}
                    {part.unitVin && (
                      <div>
                        <span className="text-muted-foreground">Unit/VIN</span>
                        <p className="font-medium">{part.unitVin}</p>
                      </div>
                    )}
                    {part.gasketClamps && (
                      <div>
                        <span className="text-muted-foreground">Gasket/Clamps</span>
                        <p className="font-medium">{part.gasketClamps}</p>
                      </div>
                    )}
                    {(part.ec || part.eg || part.ek) && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">EC/EG/EK</span>
                        <p className="font-medium">
                          {[part.ec, part.eg, part.ek].filter(Boolean).join(" / ")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tech-editable fields */}
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase">Technician Input</p>

                  <FormField
                    control={form.control}
                    name={`parts.${index}.ecsPartNumber`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ECS Part Number</FormLabel>
                        <FormControl>
                          <Input placeholder="ECS part number" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`parts.${index}.passOrFail`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Pass or Fail? *</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select result..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Pass">Pass</SelectItem>
                              <SelectItem value="Fail">Fail</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`parts.${index}.requireRepairs`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Did the Part Require Repairs?</FormLabel>
                        <FormControl>
                          <Select onValueChange={field.onChange} value={field.value || ""}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Yes">Yes</SelectItem>
                              <SelectItem value="No">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {form.watch(`parts.${index}.passOrFail`) === "Fail" && (
                    <FormField
                      control={form.control}
                      name={`parts.${index}.failedReason`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Failed Reason</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe why the part failed..."
                              rows={2}
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  {form.watch(`parts.${index}.requireRepairs`) === "Yes" && (
                    <FormField
                      control={form.control}
                      name={`parts.${index}.repairsPerformed`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Repairs Performed</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Describe repairs performed..."
                              rows={2}
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
