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

interface SignOffSectionProps {
  control: Control<any>;
  shopName?: string;
  partsCount: number;
}

export function SignOffSection({ control, shopName, partsCount }: SignOffSectionProps) {
  // Watch all parts' submissionStatus to count open (incomplete) parts
  const parts: Array<{ submissionStatus?: string }> = useWatch({ control, name: "parts" }) ?? [];
  const openCount = parts.filter(
    (p) => p.submissionStatus !== "Completed"
  ).length;

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
        {/* Open submissions warning — matches GoCanvas FORCE STOP behavior */}
        {openCount > 0 && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-300 rounded text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600" />
            <div>
              <p className="font-semibold">
                {openCount} of {partsCount} part{partsCount !== 1 ? "s" : ""} not marked Completed
              </p>
              <p className="text-xs mt-1 text-amber-700">
                Ensure each part's "Submission Status" is set to "Completed" before signing off.
                Go back to the parts log and close out any open part submissions.
              </p>
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
