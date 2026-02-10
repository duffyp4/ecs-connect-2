import React from "react";
import { Control } from "react-hook-form";
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
import { PhotoPlaceholder } from "@/components/forms/emissions/photo-placeholder";
import { COLLECTOR_CONDITIONS } from "@/lib/emissions-reference-data";

interface CollectorSectionProps {
  partIndex: number;
  control: Control<any>;
}

export const CollectorSection = React.memo(
  function CollectorSection({
    partIndex,
    control,
  }: CollectorSectionProps) {
    return (
      <div className="space-y-3">
        <FormField
          control={control}
          name={`parts.${partIndex}.collectorCondition`}
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Collector Condition</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition..." />
                  </SelectTrigger>
                  <SelectContent>
                    {COLLECTOR_CONDITIONS.map((condition) => (
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

        <PhotoPlaceholder label="Collector Damage Photo" />

        <FormField
          control={control}
          name={`parts.${partIndex}.collectorComment`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Collector Comment</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional collector notes..."
                  rows={2}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    );
  }
);
