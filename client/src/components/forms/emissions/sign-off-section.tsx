import { Control } from "react-hook-form";
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
import { TECHNICIANS } from "@/lib/emissions-reference-data";

interface SignOffSectionProps {
  control: Control<any>;
  shopName?: string;
}

export function SignOffSection({ control, shopName }: SignOffSectionProps) {
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
        <FormField
          control={control}
          name="technicianName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Technician Name *</FormLabel>
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
