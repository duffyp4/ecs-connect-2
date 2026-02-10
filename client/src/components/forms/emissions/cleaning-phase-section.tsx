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
import { CLEANING_PHASES } from "@/lib/emissions-reference-data";

interface CleaningPhaseSectionProps {
  partIndex: number;
  control: Control<any>;
}

export const CleaningPhaseSection = React.memo(
  function CleaningPhaseSection({ partIndex, control }: CleaningPhaseSectionProps) {
    return (
      <div className="space-y-4">
        <FormField
          control={control}
          name={`parts.${partIndex}.cleaningPhase`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Cleaning Phase</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select cleaning phase..." />
                  </SelectTrigger>
                  <SelectContent>
                    {CLEANING_PHASES.map((phase) => (
                      <SelectItem key={phase} value={phase}>
                        {phase}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <PhotoPlaceholder label="Pre-Cleaning Photos (inlet, side & outlet)" />
        <PhotoPlaceholder label="Post-Cleaning Photos (inlet, side & outlet)" />
      </div>
    );
  }
);
