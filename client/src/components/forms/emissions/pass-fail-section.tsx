import React from "react";
import { Control, useWatch } from "react-hook-form";
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
import {
  YES_NO,
  PASS_FAIL,
  FAILED_REASONS,
  SUBMISSION_STATUSES,
} from "@/lib/emissions-reference-data";

interface PassFailSectionProps {
  partIndex: number;
  control: Control<any>;
}

export const PassFailSection = React.memo(
  function PassFailSection({ partIndex, control }: PassFailSectionProps) {
    const passOrFail = useWatch({
      control,
      name: `parts.${partIndex}.passOrFail`,
    });

    const additionalComments = useWatch({
      control,
      name: `parts.${partIndex}.hasAdditionalComments`,
    });

    return (
      <div className="space-y-4">
        {/* Pass or Fail */}
        <FormField
          control={control}
          name={`parts.${partIndex}.passOrFail`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Did the Part Pass or Fail?</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select result..." />
                  </SelectTrigger>
                  <SelectContent>
                    {PASS_FAIL.map((opt) => (
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

        {/* Failure details — shown only when Fail is selected */}
        {passOrFail === "Fail" && (
          <div className="space-y-4 pl-3 border-l-2 border-destructive/30">
            <FormField
              control={control}
              name={`parts.${partIndex}.failedReason`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Failed Reason</FormLabel>
                  <FormControl>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value || ""}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select reason..." />
                      </SelectTrigger>
                      <SelectContent>
                        {FAILED_REASONS.map((reason) => (
                          <SelectItem key={reason} value={reason}>
                            {reason}
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
              name={`parts.${partIndex}.failureNotes`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Additional Notes about Failure</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the failure..."
                      rows={3}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Submission Status */}
        <FormField
          control={control}
          name={`parts.${partIndex}.submissionStatus`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Submission Status</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SUBMISSION_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Additional Comments toggle */}
        <FormField
          control={control}
          name={`parts.${partIndex}.hasAdditionalComments`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Comments?</FormLabel>
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

        {additionalComments === "Yes" && (
          <FormField
            control={control}
            name={`parts.${partIndex}.additionalPartComments`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Comments</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter additional comments..."
                    rows={3}
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
    );
  }
);
