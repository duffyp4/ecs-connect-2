import React from "react";
import { Control, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
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
import {
  YES_NO,
  LIGHT_TEST_OPTIONS,
  DROP_ROD_TEST_OPTIONS,
} from "@/lib/emissions-reference-data";

interface MeasurementsSectionProps {
  partIndex: number;
  control: Control<any>;
}

export const MeasurementsSection = React.memo(
  function MeasurementsSection({ partIndex, control }: MeasurementsSectionProps) {
    // Watch measurement values for auto-calculations
    const weightPreKg = useWatch({
      control,
      name: `parts.${partIndex}.weightPreKg`,
    });
    const flowRatePre = useWatch({
      control,
      name: `parts.${partIndex}.flowRatePre`,
    });
    const weightPostKg = useWatch({
      control,
      name: `parts.${partIndex}.weightPostKg`,
    });
    const flowRatePost = useWatch({
      control,
      name: `parts.${partIndex}.flowRatePost`,
    });
    const weightSinteredKg = useWatch({
      control,
      name: `parts.${partIndex}.weightSinteredKg`,
    });
    const flowRateSintered = useWatch({
      control,
      name: `parts.${partIndex}.flowRateSintered`,
    });

    // Derived calculations
    const pre = parseFloat(weightPreKg) || 0;
    const post = parseFloat(weightPostKg) || 0;
    const sintered = parseFloat(weightSinteredKg) || 0;
    const flowPre = parseFloat(flowRatePre) || 0;
    const flowPost = parseFloat(flowRatePost) || 0;

    const flowRateIncrease =
      flowPre > 0 || flowPost > 0 ? (flowPost - flowPre).toFixed(2) : "—";
    const weightLossPrePost =
      pre > 0 || post > 0
        ? ((pre - post) * 1000).toFixed(1)
        : "—";
    const weightLossPreSintered =
      pre > 0 || sintered > 0
        ? ((pre - sintered) * 1000).toFixed(1)
        : "—";

    return (
      <div className="space-y-4">
        {/* Pre-cleaning measurements */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={control}
            name={`parts.${partIndex}.weightPreKg`}
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Weight (KG) - PRE Cleaning</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
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
            name={`parts.${partIndex}.flowRatePre`}
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Flow Rate - PRE Cleaning</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Post-cleaning measurements */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={control}
            name={`parts.${partIndex}.weightPostKg`}
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Weight (KG) - Post Cleaning</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
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
            name={`parts.${partIndex}.flowRatePost`}
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Flow Rate - Post Cleaning</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Post sintered ash measurements */}
        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={control}
            name={`parts.${partIndex}.weightSinteredKg`}
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Weight (KG) - POST SINTERED ASH</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
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
            name={`parts.${partIndex}.flowRateSintered`}
            render={({ field }) => (
              <FormItem>
                <FormLabel required>Flow Rate - POST SINTERED ASH</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Auto-calculated read-only display */}
        <div className="space-y-2 p-3 bg-muted/50 rounded-md">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Calculated Values
          </p>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Flow Rate Increase</span>
              <p className="font-medium">{flowRateIncrease}</p>
            </div>
            <div>
              <span className="text-muted-foreground">
                Weight Loss Pre&rarr;Post (g)
              </span>
              <p className="font-medium">{weightLossPrePost}</p>
            </div>
            <div>
              <span className="text-muted-foreground">
                Weight Loss Pre&rarr;Sintered (g)
              </span>
              <p className="font-medium">{weightLossPreSintered}</p>
            </div>
          </div>
        </div>

        {/* Test selects */}
        <FormField
          control={control}
          name={`parts.${partIndex}.lightTest`}
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Light Test</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select result..." />
                  </SelectTrigger>
                  <SelectContent>
                    {LIGHT_TEST_OPTIONS.map((opt) => (
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

        <FormField
          control={control}
          name={`parts.${partIndex}.dropRodTest`}
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Drop Rod Test</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select result..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DROP_ROD_TEST_OPTIONS.map((opt) => (
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

        <FormField
          control={control}
          name={`parts.${partIndex}.sinteredAshProcess`}
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Did You Perform The Sintered Ash Process?</FormLabel>
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
      </div>
    );
  }
);
