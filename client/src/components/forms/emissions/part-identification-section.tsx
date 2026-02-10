import React from "react";
import { Control } from "react-hook-form";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

interface PartData {
  part: string;
  process: string;
  ecsSerial: string;
  filterPn?: string;
  poNumber?: string;
  mileage?: string;
  unitVin?: string;
}

interface PartIdentificationSectionProps {
  partIndex: number;
  control: Control<any>;
  partData: PartData;
}

export const PartIdentificationSection = React.memo(
  function PartIdentificationSection({
    partIndex,
    control,
    partData,
  }: PartIdentificationSectionProps) {
    return (
      <div className="space-y-4">
        {/* Read-only pre-filled fields from CSR dispatch */}
        <div className="space-y-2 p-3 bg-muted/50 rounded-md">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Pre-filled Info
          </p>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Part Type</span>
              <p className="font-medium">{partData.part || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Process</span>
              <p className="font-medium">{partData.process || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">ECS Serial</span>
              <p className="font-medium">{partData.ecsSerial || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Filter P/N</span>
              <p className="font-medium">{partData.filterPn || "—"}</p>
            </div>
            {partData.poNumber && (
              <div>
                <span className="text-muted-foreground">PO Number</span>
                <p className="font-medium">{partData.poNumber}</p>
              </div>
            )}
            {partData.mileage && (
              <div>
                <span className="text-muted-foreground">Mileage</span>
                <p className="font-medium">{partData.mileage}</p>
              </div>
            )}
            {partData.unitVin && (
              <div>
                <span className="text-muted-foreground">Unit/VIN</span>
                <p className="font-medium">{partData.unitVin}</p>
              </div>
            )}
          </div>
        </div>

        {/* Editable technician fields */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Technician Input
          </p>

          <FormField
            control={control}
            name={`parts.${partIndex}.ecsPartNumber`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>ECS Part Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="ECS part number"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`parts.${partIndex}.partDescription`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Part Description</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Part description"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`parts.${partIndex}.oeSerialNumber`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>OE Serial Number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="OE serial number"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </div>
    );
  }
);
