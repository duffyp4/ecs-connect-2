import React, { useMemo } from "react";
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
  BUNG_CONDITIONS,
  BUNG_PROBLEMS,
  FITTING_QUANTITIES,
  FITTING_PART_NUMBERS,
} from "@/lib/emissions-reference-data";

interface PartData {
  inletLeftBung?: string;
  inletRightBung?: string;
  outletLeftBung?: string;
  outletRightBung?: string;
}

interface BungFittingSectionProps {
  partIndex: number;
  control: Control<any>;
  partData?: PartData;
}

/** Lookup map from fitting part number to description */
const fittingDescriptionMap = new Map(
  FITTING_PART_NUMBERS.map((f) => [f.pn, f.description])
);

/**
 * Renders a single fitting slot (quantity, part number, auto-populated description).
 */
function FittingSlot({
  partIndex,
  control,
  slotPrefix,
  label,
}: {
  partIndex: number;
  control: Control<any>;
  slotPrefix: string;
  label: string;
}) {
  const selectedPn = useWatch({
    control,
    name: `parts.${partIndex}.${slotPrefix}PartNumber`,
  });

  const description = useMemo(
    () => (selectedPn ? fittingDescriptionMap.get(selectedPn) ?? "" : ""),
    [selectedPn]
  );

  return (
    <div className="space-y-3 p-3 border border-muted rounded-md">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>

      <FormField
        control={control}
        name={`parts.${partIndex}.${slotPrefix}Quantity`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label} Quantity</FormLabel>
            <FormControl>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select quantity..." />
                </SelectTrigger>
                <SelectContent>
                  {FITTING_QUANTITIES.map((qty) => (
                    <SelectItem key={qty} value={qty}>
                      {qty}
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
        name={`parts.${partIndex}.${slotPrefix}PartNumber`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label} Replaced Fitting</FormLabel>
            <FormControl>
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Select fitting..." />
                </SelectTrigger>
                <SelectContent>
                  {FITTING_PART_NUMBERS.map((fitting) => (
                    <SelectItem key={fitting.pn} value={fitting.pn}>
                      {fitting.pn} - {fitting.description}
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
        name={`parts.${partIndex}.${slotPrefix}Description`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label} Part Description</FormLabel>
            <FormControl>
              <Input
                readOnly
                placeholder="Auto-populated from fitting selection"
                {...field}
                value={description}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

export const BungFittingSection = React.memo(
  function BungFittingSection({
    partIndex,
    control,
    partData,
  }: BungFittingSectionProps) {
    const showRecommendedBungs = useWatch({
      control,
      name: `parts.${partIndex}.showRecommendedBungs`,
    });

    const additionalFitting2 = useWatch({
      control,
      name: `parts.${partIndex}.additionalFitting2`,
    });

    const additionalFitting3 = useWatch({
      control,
      name: `parts.${partIndex}.additionalFitting3`,
    });

    return (
      <div className="space-y-3">
        <FormField
          control={control}
          name={`parts.${partIndex}.bungCondition`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bung & Fitting Condition</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select condition..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BUNG_CONDITIONS.map((condition) => (
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

        {/* Recommended Bungs Toggle */}
        <FormField
          control={control}
          name={`parts.${partIndex}.showRecommendedBungs`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Would you like to see Recommended Bungs?</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {showRecommendedBungs === "Yes" && partData && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-md">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Recommended Bungs
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Inlet Left Bung</span>
                <p className="font-medium">{partData.inletLeftBung || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Inlet Right Bung</span>
                <p className="font-medium">{partData.inletRightBung || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Outlet Left Bung</span>
                <p className="font-medium">{partData.outletLeftBung || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Outlet Right Bung</span>
                <p className="font-medium">{partData.outletRightBung || "—"}</p>
              </div>
            </div>
          </div>
        )}

        <PhotoPlaceholder label="Bung Photos" />

        <FormField
          control={control}
          name={`parts.${partIndex}.bungProblem`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Bung & Fitting Problem</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select problem..." />
                  </SelectTrigger>
                  <SelectContent>
                    {BUNG_PROBLEMS.map((problem) => (
                      <SelectItem key={problem} value={problem}>
                        {problem}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <PhotoPlaceholder label="Bung & Fitting Damage Photo" />

        {/* Slot 1 — Always visible */}
        <FittingSlot
          partIndex={partIndex}
          control={control}
          slotPrefix="firstFitting"
          label="First Fitting"
        />

        {/* Slot 2 — Conditional */}
        <FormField
          control={control}
          name={`parts.${partIndex}.additionalFitting2`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Fitting Needed?</FormLabel>
              <FormControl>
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Yes">Yes</SelectItem>
                    <SelectItem value="No">No</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {additionalFitting2 === "Yes" && (
          <>
            <FittingSlot
              partIndex={partIndex}
              control={control}
              slotPrefix="secondFitting"
              label="Second Fitting"
            />

            {/* Slot 3 — Conditional (only if Slot 2 is visible) */}
            <FormField
              control={control}
              name={`parts.${partIndex}.additionalFitting3`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Third Fitting Needed?</FormLabel>
                  <FormControl>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {additionalFitting3 === "Yes" && (
              <FittingSlot
                partIndex={partIndex}
                control={control}
                slotPrefix="thirdFitting"
                label="Third Fitting"
              />
            )}
          </>
        )}

        <FormField
          control={control}
          name={`parts.${partIndex}.bungComment`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Additional Bung & Fitting Comment</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional bung & fitting notes..."
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
