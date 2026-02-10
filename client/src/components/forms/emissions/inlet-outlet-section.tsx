import React from "react";
import { Control, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
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
import {
  INLET_COLORS,
  OUTLET_COLORS,
  DAMAGE_TYPES,
  LEAKING_CELLS_OPTIONS,
} from "@/lib/emissions-reference-data";

interface InletOutletSectionProps {
  partIndex: number;
  control: Control<any>;
}

export const InletOutletSection = React.memo(
  function InletOutletSection({ partIndex, control }: InletOutletSectionProps) {
    const inletColor = useWatch({
      control,
      name: `parts.${partIndex}.inletColor`,
    });

    const outletColor = useWatch({
      control,
      name: `parts.${partIndex}.outletColor`,
    });

    return (
      <div className="space-y-6">
        {/* Inlet Sub-Section */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Inlet
          </p>

          <FormField
            control={control}
            name={`parts.${partIndex}.inletColor`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inlet Color & Condition</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select color & condition..." />
                    </SelectTrigger>
                    <SelectContent>
                      {INLET_COLORS.map((color) => (
                        <SelectItem key={color} value={color}>
                          {color}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {inletColor === "Other Color" && (
            <FormField
              control={control}
              name={`parts.${partIndex}.inletOtherColor`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Other Color</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Describe inlet color..."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={control}
            name={`parts.${partIndex}.inletDamage`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Inlet Damage</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select damage type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DAMAGE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <PhotoPlaceholder label="Inlet Damage Photo" />

          <FormField
            control={control}
            name={`parts.${partIndex}.inletComment`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Inlet Comment</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional inlet notes..."
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

        {/* Outlet Sub-Section */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            Outlet
          </p>

          <FormField
            control={control}
            name={`parts.${partIndex}.outletColor`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Outlet Color & Condition</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select color & condition..." />
                    </SelectTrigger>
                    <SelectContent>
                      {OUTLET_COLORS.map((color) => (
                        <SelectItem key={color} value={color}>
                          {color}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {outletColor === "Other Color" && (
            <FormField
              control={control}
              name={`parts.${partIndex}.outletOtherColor`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Other Color</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Describe outlet color..."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={control}
            name={`parts.${partIndex}.outletDamage`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Outlet Damage</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select damage type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DAMAGE_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <PhotoPlaceholder label="Outlet Damage Photo" />

          <FormField
            control={control}
            name={`parts.${partIndex}.outletLeakingCells`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Outlet Leaking Cells</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select leaking cells..." />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAKING_CELLS_OPTIONS.map((option) => (
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

          <FormField
            control={control}
            name={`parts.${partIndex}.outletComment`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Additional Outlet Comment</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Additional outlet notes..."
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
      </div>
    );
  }
);
