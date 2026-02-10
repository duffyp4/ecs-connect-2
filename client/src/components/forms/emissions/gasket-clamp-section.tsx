import React from "react";
import { Control, useWatch } from "react-hook-form";
import { Input } from "@/components/ui/input";
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
import { YES_NO, EC_EG_EK_QUANTITIES } from "@/lib/emissions-reference-data";

interface GasketClampPartData {
  ec?: string;
  eg?: string;
  ek?: string;
  inletClampPn?: string;
  inletGasketPn?: string;
  outletClampPn?: string;
  outletGasketPn?: string;
  kit1?: string;
  kit2?: string;
}

interface GasketClampSectionProps {
  partIndex: number;
  control: Control<any>;
  partData: GasketClampPartData;
}

/** Renders EC/EG/EK part number + description input pairs based on the selected quantity. */
function ReplacementSlots({
  prefix,
  label,
  partIndex,
  control,
  quantity,
}: {
  prefix: string;
  label: string;
  partIndex: number;
  control: Control<any>;
  quantity: string | undefined;
}) {
  const count = parseInt(quantity || "0", 10) || 0;
  if (count === 0) return null;

  return (
    <div className="space-y-2 pl-6">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="grid grid-cols-2 gap-2">
          <FormField
            control={control}
            name={`parts.${partIndex}.${prefix}PartNumber${i + 1}`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {label} Part Number - {i + 1}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={`${label} part number`}
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
            name={`parts.${partIndex}.${prefix}PartDescription${i + 1}`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  {label} Part Description - {i + 1}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={`${label} description`}
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      ))}
    </div>
  );
}

export const GasketClampSection = React.memo(
  function GasketClampSection({
    partIndex,
    control,
    partData,
  }: GasketClampSectionProps) {
    const gasketOrClamps = useWatch({
      control,
      name: `parts.${partIndex}.gasketOrClamps`,
    });

    const showRecommended = useWatch({
      control,
      name: `parts.${partIndex}.showRecommendedGaskets`,
    });

    const ecChecked = useWatch({
      control,
      name: `parts.${partIndex}.ecReplacement`,
    });

    const egChecked = useWatch({
      control,
      name: `parts.${partIndex}.egReplacement`,
    });

    const ekChecked = useWatch({
      control,
      name: `parts.${partIndex}.ekReplacement`,
    });

    const ecQuantity = useWatch({
      control,
      name: `parts.${partIndex}.ecQuantity`,
    });

    const egQuantity = useWatch({
      control,
      name: `parts.${partIndex}.egQuantity`,
    });

    const ekQuantity = useWatch({
      control,
      name: `parts.${partIndex}.ekQuantity`,
    });

    return (
      <div className="space-y-4">
        {/* Gasket or Clamps? */}
        <FormField
          control={control}
          name={`parts.${partIndex}.gasketOrClamps`}
          render={({ field }) => (
            <FormItem>
              <FormLabel required>Gasket or Clamps</FormLabel>
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

        {/* Show recommended gaskets/clamps? */}
        <FormField
          control={control}
          name={`parts.${partIndex}.showRecommendedGaskets`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Would you like to see Recommended Gaskets, Clamps and Kits?
              </FormLabel>
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

        {/* Read-only recommended values */}
        {showRecommended === "Yes" && (
          <div className="space-y-2 p-3 bg-muted/50 rounded-md">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Recommended Gaskets, Clamps & Kits
            </p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Inlet Clamp PN</span>
                <p className="font-medium">{partData.inletClampPn || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Inlet Gasket PN</span>
                <p className="font-medium">{partData.inletGasketPn || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Outlet Clamp PN</span>
                <p className="font-medium">{partData.outletClampPn || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Outlet Gasket PN</span>
                <p className="font-medium">{partData.outletGasketPn || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Kit #1</span>
                <p className="font-medium">{partData.kit1 || "—"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Kit #2</span>
                <p className="font-medium">{partData.kit2 || "—"}</p>
              </div>
            </div>
          </div>
        )}

        <PhotoPlaceholder label="Clamp/Gasket Photos" />

        {/* EC/EG/EK replacement checkboxes — shown when gasketOrClamps is Yes */}
        {gasketOrClamps === "Yes" && (
          <div className="space-y-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">
              Replacement Parts
            </p>

            {/* EC */}
            <div className="space-y-3">
              <FormField
                control={control}
                name={`parts.${partIndex}.ecReplacement`}
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value === true}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">EC</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {ecChecked && (
                <div className="space-y-3 pl-6">
                  <FormField
                    control={control}
                    name={`parts.${partIndex}.ecQuantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EC Quantity</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ""}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select quantity..." />
                            </SelectTrigger>
                            <SelectContent>
                              {EC_EG_EK_QUANTITIES.map((qty) => (
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
                  <ReplacementSlots
                    prefix="ec"
                    label="EC"
                    partIndex={partIndex}
                    control={control}
                    quantity={ecQuantity}
                  />
                </div>
              )}
            </div>

            {/* EG */}
            <div className="space-y-3">
              <FormField
                control={control}
                name={`parts.${partIndex}.egReplacement`}
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value === true}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">EG</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {egChecked && (
                <div className="space-y-3 pl-6">
                  <FormField
                    control={control}
                    name={`parts.${partIndex}.egQuantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EG Quantity</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ""}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select quantity..." />
                            </SelectTrigger>
                            <SelectContent>
                              {EC_EG_EK_QUANTITIES.map((qty) => (
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
                  <ReplacementSlots
                    prefix="eg"
                    label="EG"
                    partIndex={partIndex}
                    control={control}
                    quantity={egQuantity}
                  />
                </div>
              )}
            </div>

            {/* EK */}
            <div className="space-y-3">
              <FormField
                control={control}
                name={`parts.${partIndex}.ekReplacement`}
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value === true}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">EK</FormLabel>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {ekChecked && (
                <div className="space-y-3 pl-6">
                  <FormField
                    control={control}
                    name={`parts.${partIndex}.ekQuantity`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>EK Quantity</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            value={field.value || ""}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select quantity..." />
                            </SelectTrigger>
                            <SelectContent>
                              {EC_EG_EK_QUANTITIES.map((qty) => (
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
                  <ReplacementSlots
                    prefix="ek"
                    label="EK"
                    partIndex={partIndex}
                    control={control}
                    quantity={ekQuantity}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }
);
