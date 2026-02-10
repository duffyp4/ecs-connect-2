import React from "react";
import { Control, useWatch } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
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
import { YES_NO, REPAIRS_PERFORMED_OPTIONS } from "@/lib/emissions-reference-data";

interface RepairAssessmentSectionProps {
  partIndex: number;
  control: Control<any>;
}

export const RepairAssessmentSection = React.memo(
  function RepairAssessmentSection({
    partIndex,
    control,
  }: RepairAssessmentSectionProps) {
    const requireRepairs = useWatch({
      control,
      name: `parts.${partIndex}.requireRepairs`,
    });

    const repairsPerformed: string = useWatch({
      control,
      name: `parts.${partIndex}.repairsPerformed`,
    }) ?? "";

    // Parse comma-separated string into a Set for checkbox state
    const selectedRepairs = new Set(
      repairsPerformed
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean)
    );

    return (
      <div className="space-y-4">
        <FormField
          control={control}
          name={`parts.${partIndex}.requireRepairs`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Did the Part Require Repairs?</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {YES_NO.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {requireRepairs === "Yes" && (
          <div className="space-y-4 pl-3 border-l-2 border-muted">
            {/* Multi-checkbox for repairs performed */}
            <FormField
              control={control}
              name={`parts.${partIndex}.repairsPerformed`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Which Repairs Were Performed</FormLabel>
                  <div className="space-y-2">
                    {REPAIRS_PERFORMED_OPTIONS.map((option) => {
                      const isChecked = selectedRepairs.has(option);

                      const handleToggle = (checked: boolean) => {
                        const next = new Set(selectedRepairs);
                        if (checked) {
                          next.add(option);
                        } else {
                          next.delete(option);
                        }
                        field.onChange(Array.from(next).join(", "));
                      };

                      return (
                        <div
                          key={option}
                          className="flex items-center gap-2"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={handleToggle}
                          />
                          <span className="text-sm">{option}</span>
                        </div>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name={`parts.${partIndex}.repairDescription`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description of Repairs</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the repairs performed..."
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <PhotoPlaceholder label="Repair Photos" />
          </div>
        )}
      </div>
    );
  }
);
