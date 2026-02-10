import { Control, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { AlertTriangle } from "lucide-react";
import { TECHNICIANS } from "@/lib/emissions-reference-data";

interface PartIssue {
  partLabel: string;
  message: string;
}

/** Validate all parts and return a flat list of issues that prevent a clean sign-off. */
function getPartIssues(
  parts: Array<Record<string, unknown>>,
  partLabels: string[],
): PartIssue[] {
  const issues: PartIssue[] = [];
  parts.forEach((p, i) => {
    const label = partLabels[i] || `Part ${i + 1}`;
    if (!p.passOrFail) {
      issues.push({ partLabel: label, message: "Pass or Fail not selected" });
    }
    if (p.passOrFail === "Fail" && !p.failedReason) {
      issues.push({ partLabel: label, message: "Failed reason is required" });
    }
    if (p.submissionStatus !== "Completed") {
      issues.push({ partLabel: label, message: "Submission status not set to Completed" });
    }
  });
  return issues;
}

interface SignOffSectionProps {
  control: Control<any>;
  shopName?: string;
  partLabels: string[];
}

export function SignOffSection({ control, shopName, partLabels }: SignOffSectionProps) {
  // Watch the full parts array so we can validate multiple fields per part
  const parts: Array<Record<string, unknown>> = useWatch({ control, name: "parts" }) ?? [];
  const issues = getPartIssues(parts, partLabels);

  // Filter technicians by shop if shopName is provided, otherwise show all
  const filteredTechs = shopName
    ? TECHNICIANS.filter((t) => t.shop === shopName)
    : [...TECHNICIANS];

  // Always include an "Other" option
  const techOptions = [
    ...filteredTechs.map((t) => t.name),
    ...(filteredTechs.length > 0 ? [] : TECHNICIANS.map((t) => t.name)),
  ];
  // Deduplicate
  const uniqueTechs = Array.from(new Set(techOptions));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Sign Off</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Comprehensive issues warning */}
        {issues.length > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-300 rounded text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">
                {issues.length} issue{issues.length !== 1 ? "s" : ""} to resolve before signing off
              </p>
              <ul className="text-xs mt-1 text-amber-700 list-disc list-inside space-y-0.5">
                {issues.map((issue, idx) => (
                  <li key={idx}>
                    <span className="font-medium">{issue.partLabel}:</span> {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <FormField
          control={control}
          name="technicianName"
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Technician Name</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select technician..." />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueTechs.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={control}
            name="signOffDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sign Off Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name="signOffTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Sign Off Time</FormLabel>
                <FormControl>
                  <Input type="time" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      </CardContent>
    </Card>
  );
}
