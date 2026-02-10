import React from "react";
import { Control } from "react-hook-form";
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
import { PhotoPlaceholder } from "@/components/forms/emissions/photo-placeholder";
import {
  SEALING_RING_CONDITIONS,
  CANISTER_CONDITIONS,
} from "@/lib/emissions-reference-data";

interface SealingCanisterSectionProps {
  partIndex: number;
  control: Control<any>;
}

export const SealingCanisterSection = React.memo(
  function SealingCanisterSection({
    partIndex,
    control,
  }: SealingCanisterSectionProps) {
    return (
      <div className="space-y-3">
        <FormField
          control={control}
          name={`parts.${partIndex}.sealingRingCondition`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Inlet & Outlet Sealing Ring</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SEALING_RING_CONDITIONS.map((condition) => (
                      <SelectItem key={condition} value={condition}>
                        {condition}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <PhotoPlaceholder label="Sealing Ring Damage Photo" />

        <FormField
          control={control}
          name={`parts.${partIndex}.canisterCondition`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Canister Inspection</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CANISTER_CONDITIONS.map((condition) => (
                      <SelectItem key={condition} value={condition}>
                        {condition}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <PhotoPlaceholder label="Canister Inspection Photo" />
      </div>
    );
  }
);
