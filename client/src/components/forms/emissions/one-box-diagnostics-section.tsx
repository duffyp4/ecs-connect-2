import React from "react";
import { Control, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
  YES_NO,
  SENSORS_REMOVED_OPTIONS,
} from "@/lib/emissions-reference-data";

interface OneBoxDiagnosticsSectionProps {
  partIndex: number;
  control: Control<any>;
}

export const OneBoxDiagnosticsSection = React.memo(
  function OneBoxDiagnosticsSection({
    partIndex,
    control,
  }: OneBoxDiagnosticsSectionProps) {
    const hasPhysicalDamage = useWatch({
      control,
      name: `parts.${partIndex}.hasPhysicalDamage`,
    });

    const sensorsRemoved = useWatch({
      control,
      name: `parts.${partIndex}.wereSensorsRemoved`,
    });

    const hasCrystallization = useWatch({
      control,
      name: `parts.${partIndex}.hasCrystallization`,
    });

    return (
      <div className="space-y-4">
        {/* Numeric diagnostic inputs */}
        <FormField
          control={control}
          name={`parts.${partIndex}.noxConversionPercent`}
          render={({ field }) => (
            <FormItem>
              <FormLabel required>NOx Conversion %</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="e.g. 95"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`parts.${partIndex}.docInletTemp`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>DOC Inlet Temp</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Temperature"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`parts.${partIndex}.docOutletTemp`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>DOC Outlet Temp</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Temperature"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name={`parts.${partIndex}.dpfOutletTemp`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>DPF Outlet Temp</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="Temperature"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Physical damage */}
        <FormField
          control={control}
          name={`parts.${partIndex}.hasPhysicalDamage`}
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Does the One Box have any physical damage?</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {YES_NO.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {hasPhysicalDamage === "Yes" && (
          <PhotoPlaceholder label="Physical Damage Photo" />
        )}

        {/* Sensors removed */}
        <FormField
          control={control}
          name={`parts.${partIndex}.wereSensorsRemoved`}
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Were any sensors removed from the box?</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {YES_NO.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {sensorsRemoved === "Yes" && (
          <FormField
            control={control}
            name={`parts.${partIndex}.sensorsRemoved`}
            render={({ field }) => {
              const currentValue: string[] = field.value || [];
              return (
                <FormItem>
                  <FormLabel>Sensors Removed</FormLabel>
                  <div className="space-y-2">
                    {SENSORS_REMOVED_OPTIONS.map((sensor) => (
                      <label
                        key={sensor}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Checkbox
                          checked={currentValue.includes(sensor)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              field.onChange([...currentValue, sensor]);
                            } else {
                              field.onChange(
                                currentValue.filter((v: string) => v !== sensor)
                              );
                            }
                          }}
                        />
                        <span className="text-sm">{sensor}</span>
                      </label>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        )}

        {/* Repair photos and description */}
        <PhotoPlaceholder label="Pre-repair Photo" />
        <PhotoPlaceholder label="Post-repair Photo" />
        <PhotoPlaceholder label="Dosing Module Photo" />

        <FormField
          control={control}
          name={`parts.${partIndex}.repairDescriptionOneBox`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Repair Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe repairs performed..."
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Crystallization */}
        <FormField
          control={control}
          name={`parts.${partIndex}.hasCrystallization`}
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Is There Crystallization?</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {YES_NO.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {hasCrystallization === "Yes" && (
          <>
            <FormField
              control={control}
              name={`parts.${partIndex}.crystallizationDescription`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Crystallization Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe crystallization found..."
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <PhotoPlaceholder label="Crystallization Photos" />
          </>
        )}
      </div>
    );
  }
);
