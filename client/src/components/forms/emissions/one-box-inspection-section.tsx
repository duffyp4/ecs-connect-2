import React from "react";
import { Control, useWatch } from "react-hook-form";
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
  SMOKE_TEST_OPTIONS,
  ONE_BOX_SENSORS,
  YES_NO,
} from "@/lib/emissions-reference-data";

interface OneBoxInspectionSectionProps {
  partIndex: number;
  control: Control<any>;
}

export const OneBoxInspectionSection = React.memo(
  function OneBoxInspectionSection({
    partIndex,
    control,
  }: OneBoxInspectionSectionProps) {
    const needsSensors = useWatch({
      control,
      name: `parts.${partIndex}.oneBoxNeedsSensors`,
    });

    return (
      <div className="space-y-4">
        {/* Pre Cleaning - SCR */}
        <FormField
          control={control}
          name={`parts.${partIndex}.preCleaningScrSmokeTest`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pre Cleaning SCR Smoke Test</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select result..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SMOKE_TEST_OPTIONS.map((option) => (
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

        <PhotoPlaceholder label="Pre Cleaning - SCR Scope Inspection Photo" />

        {/* Pre Cleaning - DOC */}
        <FormField
          control={control}
          name={`parts.${partIndex}.preCleaningDocSmokeTest`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Pre Cleaning DOC Smoke Test</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select result..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SMOKE_TEST_OPTIONS.map((option) => (
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

        <PhotoPlaceholder label="Pre Cleaning - DOC Scope Inspection Photo" />

        {/* Pre Cleaning/Repair damage photos */}
        <PhotoPlaceholder label="Pre Cleaning/Repair - SCR Side DAMAGE Photo" />
        <PhotoPlaceholder label="Pre Cleaning/Repair - DOC Side DAMAGE Photo" />

        {/* Post Cleaning - SCR */}
        <FormField
          control={control}
          name={`parts.${partIndex}.postCleaningScrSmokeTest`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Post Cleaning SCR Smoke Test</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select result..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SMOKE_TEST_OPTIONS.map((option) => (
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

        <PhotoPlaceholder label="Post Cleaning - SCR Scope Inspection Photo" />

        {/* Post Cleaning - DOC */}
        <FormField
          control={control}
          name={`parts.${partIndex}.postCleaningDocSmokeTest`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Post Cleaning DOC Smoke Test</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select result..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SMOKE_TEST_OPTIONS.map((option) => (
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

        <PhotoPlaceholder label="Post Cleaning - DOC Scope Inspection Photo" />

        {/* One Box sensors needed */}
        <FormField
          control={control}
          name={`parts.${partIndex}.oneBoxNeedsSensors`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Does the One Box Need Sensors?</FormLabel>
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

        {needsSensors === "Yes" && (
          <FormField
            control={control}
            name={`parts.${partIndex}.oneBoxSensorsNeeded`}
            render={({ field }) => {
              const currentValue: string[] = field.value || [];
              return (
                <FormItem>
                  <FormLabel>Sensors Needed</FormLabel>
                  <div className="space-y-2">
                    {ONE_BOX_SENSORS.map((sensor) => {
                      const sensorKey = sensor.pn;
                      return (
                        <label
                          key={sensorKey}
                          className="flex items-start gap-2 cursor-pointer"
                        >
                          <Checkbox
                            className="mt-0.5"
                            checked={currentValue.includes(sensorKey)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...currentValue, sensorKey]);
                              } else {
                                field.onChange(
                                  currentValue.filter(
                                    (v: string) => v !== sensorKey
                                  )
                                );
                              }
                            }}
                          />
                          <span className="text-sm">
                            <span className="font-medium">{sensor.pn}</span>
                            {" — "}
                            {sensor.description}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
        )}
      </div>
    );
  }
);
