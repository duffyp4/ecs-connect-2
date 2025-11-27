import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Database, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { UseFormReturn } from "react-hook-form";
import type { z } from "zod";
import type { insertJobSchema } from "@shared/schema";

type FormData = z.infer<typeof insertJobSchema>;

interface CsrCheckInFormFieldsProps {
  form: UseFormReturn<FormData>;
  referenceData: {
    shopUsers: string[];
    isLoadingShopUsers: boolean;
    allShops: string[];
    isLoadingAllShops: boolean;
    customerNames: string[];
    isLoadingCustomers: boolean;
    shipToOptions: string[];
    isLoadingShipTo: boolean;
    usersForSelectedShop: string[];
    isLoadingShopHandoffUsers: boolean;
    ship2Ids: string[];
    isLoadingShip2Ids: boolean;
    techComments: string[];
    isLoadingComments: boolean;
    sendClampsOptions: string[];
    isLoadingSendClamps: boolean;
    preferredProcesses: string[];
    isLoadingProcesses: boolean;
    driverDetails: Array<{ name: string; email: string }>;
    isLoadingDrivers: boolean;
  };
  watchedFields: {
    userId: string;
    shopName: string;
    customerName: string;
    customerShipTo: string;
    shopHandoff: string;
  };
  customerSearchOpen: boolean;
  setCustomerSearchOpen: (open: boolean) => void;
  shipToSearchOpen: boolean;
  setShipToSearchOpen: (open: boolean) => void;
  disabledFields?: string[];
}

export function CsrCheckInFormFields({
  form,
  referenceData,
  watchedFields,
  customerSearchOpen,
  setCustomerSearchOpen,
  shipToSearchOpen,
  setShipToSearchOpen,
  disabledFields = [],
}: CsrCheckInFormFieldsProps) {
  const {
    shopUsers,
    isLoadingShopUsers,
    allShops,
    isLoadingAllShops,
    customerNames,
    isLoadingCustomers,
    shipToOptions,
    isLoadingShipTo,
    usersForSelectedShop,
    isLoadingShopHandoffUsers,
    ship2Ids,
    isLoadingShip2Ids,
    techComments,
    isLoadingComments,
    sendClampsOptions,
    isLoadingSendClamps,
    preferredProcesses,
    isLoadingProcesses,
  } = referenceData;

  const { userId, shopName, customerName, customerShipTo, shopHandoff } = watchedFields;

  const isFieldDisabled = (fieldName: string) => disabledFields.includes(fieldName);

  return (
    <>
      {/* P21 Order Number */}
      <FormField
        control={form.control}
        name="p21OrderNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>P21 Order Number (Enter after invoicing)</FormLabel>
            <FormControl>
              <Input 
                placeholder="Order number" 
                {...field} 
                value={field.value || ""} 
                data-testid="input-p21-order"
                disabled={isFieldDisabled('p21OrderNumber')}
                className={isFieldDisabled('p21OrderNumber') ? "bg-muted" : ""}
                autoFocus={false}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* User ID */}
      <FormField
        control={form.control}
        name="userId"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-1">
              <Database className="h-3 w-3 text-muted-foreground" /> User ID *
            </FormLabel>
            <Select 
              onValueChange={field.onChange} 
              value={field.value || ""}
              disabled={isFieldDisabled('userId')}
            >
              <FormControl>
                <SelectTrigger data-testid="select-user-id" className={isFieldDisabled('userId') ? "bg-muted" : ""} autoFocus={true}>
                  <SelectValue placeholder="Select user ID" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {isLoadingShopUsers ? (
                  <SelectItem value="loading" disabled>Loading users...</SelectItem>
                ) : (
                  shopUsers.map((user) => (
                    <SelectItem key={user} value={user}>
                      {user}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Permission Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <FormField
          control={form.control}
          name="permissionToStart"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                <Database className="h-3 w-3 text-muted-foreground" /> Permission to Start
              </FormLabel>
              <FormControl>
                <Input 
                  {...field} 
                  value={field.value || (userId ? "Loading..." : "First select User ID")}
                  readOnly
                  disabled
                  className="bg-muted cursor-not-allowed"
                  data-testid="input-permission-start"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="permissionDeniedStop"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                <Database className="h-3 w-3 text-muted-foreground" /> Permission Denied Stop
              </FormLabel>
              <FormControl>
                <Input 
                  placeholder="Stop reason" 
                  {...field} 
                  value={field.value || ""} 
                  data-testid="input-permission-denied"
                  disabled={isFieldDisabled('permissionDeniedStop')}
                  className={isFieldDisabled('permissionDeniedStop') ? "bg-muted" : ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Shop and Customer Info - Reference Data Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <FormField
          control={form.control}
          name="shopName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                <Database className="h-3 w-3 text-muted-foreground" /> Shop Name *
              </FormLabel>
              {isFieldDisabled('shopName') ? (
                <FormControl>
                  <Input 
                    {...field} 
                    disabled 
                    className="bg-muted" 
                    data-testid="select-shop-name" 
                  />
                </FormControl>
              ) : (
                <Select onValueChange={field.onChange} value={field.value || ""}>
                  <FormControl>
                    <SelectTrigger data-testid="select-shop-name">
                      <SelectValue placeholder="Select shop" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {isLoadingAllShops ? (
                      <SelectItem value="loading" disabled>Loading shops...</SelectItem>
                    ) : (
                      allShops.map((shop) => (
                        <SelectItem key={shop} value={shop}>
                          {shop}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="customerName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                <Database className="h-3 w-3 text-muted-foreground" /> Customer Name *
              </FormLabel>
              {isFieldDisabled('customerName') ? (
                <FormControl>
                  <Input 
                    {...field} 
                    disabled 
                    className="bg-muted" 
                    data-testid="select-customer-name" 
                  />
                </FormControl>
              ) : (
                <Popover open={customerSearchOpen} onOpenChange={setCustomerSearchOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerSearchOpen}
                        className="w-full justify-between"
                        data-testid="select-customer-name"
                      >
                        {field.value || "Select or type customer name..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command shouldFilter={false}>
                      <div className="flex items-center border-b px-3">
                        <Database className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                          placeholder="Search customers or enter custom name..."
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                      <CommandList>
                        {isLoadingCustomers ? (
                          <div className="py-6 text-center text-sm">Loading customers...</div>
                        ) : (
                          <>
                            {customerNames
                              .filter((customer) =>
                                customer.toLowerCase().includes((field.value || "").toLowerCase())
                              )
                              .slice(0, 100)
                              .map((customer) => (
                                <CommandItem
                                  key={customer}
                                  value={customer}
                                  onSelect={() => {
                                    field.onChange(customer);
                                    setCustomerSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === customer ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {customer}
                                </CommandItem>
                              ))}
                            {field.value && 
                             !customerNames.some(customer => 
                               customer.toLowerCase() === field.value.toLowerCase()
                             ) && (
                              <div className="p-2 border-t">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start"
                                  onClick={() => {
                                    setCustomerSearchOpen(false);
                                  }}
                                >
                                  Add "{field.value}" as a new customer
                                </Button>
                              </div>
                            )}
                            {!isLoadingCustomers && 
                             customerNames
                               .filter((customer) =>
                                 customer.toLowerCase().includes((field.value || "").toLowerCase())
                               ).length === 0 && !field.value && (
                              <div className="py-6 text-center text-sm">No customers found</div>
                            )}
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Customer Ship To and P21 Ship ID - Reference Data Fields */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <FormField
          control={form.control}
          name="customerShipTo"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                <Database className="h-3 w-3 text-muted-foreground" /> Customer Ship To *
              </FormLabel>
              {isFieldDisabled('customerShipTo') ? (
                <FormControl>
                  <Input 
                    {...field} 
                    disabled 
                    className="bg-muted" 
                    data-testid="select-ship-to" 
                  />
                </FormControl>
              ) : (
                <Popover open={shipToSearchOpen} onOpenChange={setShipToSearchOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={shipToSearchOpen}
                        className="w-full justify-between"
                        data-testid="select-ship-to"
                      >
                        {field.value || "Select or type ship to location..."}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command shouldFilter={false}>
                      <div className="flex items-center border-b px-3">
                        <Database className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <Input
                          placeholder="Search ship to locations or enter custom location..."
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
                        />
                      </div>
                      <CommandList>
                        {isLoadingShipTo ? (
                          <div className="py-6 text-center text-sm">Loading ship to options...</div>
                        ) : !customerName ? (
                          <div className="py-6 text-center text-sm">Select Customer first</div>
                        ) : (
                          <>
                            {shipToOptions
                              .filter((shipTo) =>
                                shipTo.toLowerCase().includes((field.value || "").toLowerCase())
                              )
                              .slice(0, 100)
                              .map((shipTo) => (
                                <CommandItem
                                  key={shipTo}
                                  value={shipTo}
                                  onSelect={() => {
                                    field.onChange(shipTo);
                                    setShipToSearchOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === shipTo ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {shipTo}
                                </CommandItem>
                              ))}
                            {field.value && 
                             !shipToOptions.some(shipTo => 
                               shipTo.toLowerCase() === field.value.toLowerCase()
                             ) && (
                              <div className="p-2 border-t">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start"
                                  onClick={() => {
                                    setShipToSearchOpen(false);
                                  }}
                                >
                                  Add "{field.value}" as a new ship to location
                                </Button>
                              </div>
                            )}
                            {!isLoadingShipTo && 
                             shipToOptions
                               .filter((shipTo) =>
                                 shipTo.toLowerCase().includes((field.value || "").toLowerCase())
                               ).length === 0 && !field.value && (
                              <div className="py-6 text-center text-sm">No ship to locations found</div>
                            )}
                          </>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="p21ShipToId"
          render={({ field }) => {
            const displayValue = field.value && field.value !== '#N/A' ? field.value : '';
            
            return (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  <Database className="h-3 w-3 text-muted-foreground" /> P21 Ship to ID
                </FormLabel>
                <FormControl>
                  <Input 
                    {...field}
                    value={displayValue}
                    readOnly
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                    data-testid="input-p21-ship-id-readonly"
                    placeholder={!displayValue ? (customerName && customerShipTo ? "Auto-populated from reference data" : "Select customer and ship-to first") : ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </div>

      {/* Customer Specific Instructions - Read-only reference data field */}
      <FormField
        control={form.control}
        name="customerSpecificInstructions"
        render={({ field }) => {
          const displayValue = field.value && field.value !== '#N/A' && field.value !== '' ? field.value : '';
          
          return (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                <Database className="h-3 w-3 text-muted-foreground" /> Customer Specific Instructions
              </FormLabel>
              <FormControl>
                <Input 
                  {...field}
                  value={displayValue}
                  readOnly
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                  data-testid="input-customer-instructions-readonly"
                  placeholder={!displayValue ? (customerName ? "Auto-populated from reference data" : "Select customer to load instructions") : ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      {/* Service Details */}
      <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="sendClampsGaskets"
          render={({ field }) => {
            const displayValue = field.value && field.value !== '#N/A' && field.value !== '' ? field.value : '';
            
            return (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  <Database className="h-3 w-3 text-muted-foreground" /> Send Clamps & Gaskets?
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={displayValue}
                    readOnly
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                    data-testid="input-clamps-gaskets-readonly"
                    placeholder={!displayValue ? (customerName ? "Auto-populated from reference data" : "Select customer to load data") : ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />

        <FormField
          control={form.control}
          name="preferredProcess"
          render={({ field }) => {
            const displayValue = field.value && field.value !== '#N/A' ? field.value : '';
            
            return (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  <Database className="h-3 w-3 text-muted-foreground" /> Preferred Process?
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    value={displayValue}
                    readOnly
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                    data-testid="input-preferred-process-readonly"
                    placeholder={!displayValue ? (customerName ? "Auto-populated from reference data" : "Select customer to load data") : ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </div>

      {/* Any Other Specific Instructions - Read-only reference data field */}
      <FormField
        control={form.control}
        name="anyOtherSpecificInstructions"
        render={({ field }) => {
          const displayValue = field.value && field.value !== '#N/A' ? field.value : '';
          
          return (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                <Database className="h-3 w-3 text-muted-foreground" /> Any Other Specific Instructions?
              </FormLabel>
              <FormControl>
                <Textarea 
                  {...field}
                  value={displayValue}
                  readOnly
                  className="bg-muted text-muted-foreground cursor-not-allowed resize-none"
                  data-testid="input-other-instructions-readonly"
                  placeholder={!displayValue ? (customerName ? "Auto-populated from reference data" : "Select customer to load instructions") : ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      {/* Tech Communication - Yes/No Selector */}
      <FormField
        control={form.control}
        name="anyCommentsForTech"
        render={({ field }) => (
          <FormItem>
            <FormLabel className="flex items-center gap-1">
              <Database className="h-3 w-3 text-muted-foreground" /> Any comments for the tech about this submission?
            </FormLabel>
            <FormControl>
              <div className="flex items-center space-x-6" data-testid="radio-tech-comments">
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="tech-comments-yes"
                    value="Yes"
                    checked={field.value === "Yes"}
                    onChange={() => field.onChange("Yes")}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                    disabled={isFieldDisabled('anyCommentsForTech')}
                  />
                  <label htmlFor="tech-comments-yes" className="text-sm font-medium cursor-pointer">
                    Yes
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="radio"
                    id="tech-comments-no"
                    value="No"
                    checked={field.value === "No"}
                    onChange={() => field.onChange("No")}
                    className="h-4 w-4 text-primary focus:ring-primary border-gray-300"
                    disabled={isFieldDisabled('anyCommentsForTech')}
                  />
                  <label htmlFor="tech-comments-no" className="text-sm font-medium cursor-pointer">
                    No
                  </label>
                </div>
              </div>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="noteToTechAboutCustomer"
        render={({ field }) => {
          const hasCommentsForTech = form.watch("anyCommentsForTech") === "Yes";
          
          return (
            <FormItem>
              <FormLabel>Note to Tech about Customer or service:</FormLabel>
              <FormControl>
                <Textarea 
                  {...field}
                  value={hasCommentsForTech ? (field.value || "") : ""}
                  readOnly={!hasCommentsForTech || isFieldDisabled('noteToTechAboutCustomer')}
                  className={hasCommentsForTech && !isFieldDisabled('noteToTechAboutCustomer') ? "" : "bg-muted text-muted-foreground cursor-not-allowed"}
                  placeholder={hasCommentsForTech ? "Notes about customer or service" : "Select 'Yes' above to enable this field"}
                  data-testid="input-tech-notes"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          );
        }}
      />

      {/* Contact Information */}
      <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="contactName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Name *</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Contact person" 
                  {...field} 
                  data-testid="input-contact-name"
                  disabled={isFieldDisabled('contactName')}
                  className={isFieldDisabled('contactName') ? "bg-muted" : ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contactNumber"
          render={({ field }) => {
            const formatPhoneNumber = (value: string) => {
              const digits = value.replace(/\D/g, '');
              const limitedDigits = digits.substring(0, 10);
              
              if (limitedDigits.length === 0) return '';
              if (limitedDigits.length <= 3) return `(${limitedDigits}`;
              if (limitedDigits.length <= 6) return `(${limitedDigits.substring(0, 3)}) ${limitedDigits.substring(3)}`;
              return `(${limitedDigits.substring(0, 3)}) ${limitedDigits.substring(3, 6)}-${limitedDigits.substring(6)}`;
            };

            const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
              const formatted = formatPhoneNumber(e.target.value);
              field.onChange(formatted);
            };

            return (
              <FormItem>
                <FormLabel>Contact Number *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="(XXX) XXX-XXXX" 
                    value={field.value}
                    onChange={handleChange}
                    data-testid="input-contact-number"
                    maxLength={14}
                    disabled={isFieldDisabled('contactNumber')}
                    className={isFieldDisabled('contactNumber') ? "bg-muted" : ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </div>

      {/* PO Number */}
      <FormField
        control={form.control}
        name="poNumber"
        render={({ field }) => (
          <FormItem>
            <FormLabel>PO Number *</FormLabel>
            <FormControl>
              <Input 
                placeholder="Purchase order number" 
                {...field} 
                value={field.value || ""} 
                data-testid="input-po-number"
                disabled={isFieldDisabled('poNumber')}
                className={isFieldDisabled('poNumber') ? "bg-muted" : ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Tech Customer Question Inquiry - Pre-filled and read-only */}
      <FormField
        control={form.control}
        name="techCustomerQuestionInquiry"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Tech Customer Question Inquiry</FormLabel>
            <FormControl>
              <Input 
                {...field}
                value="sales@ecspart.com"
                readOnly
                className="bg-muted text-muted-foreground cursor-not-allowed"
                data-testid="input-customer-inquiry-readonly"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Handoff */}
      <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="shopHandoff"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1">
                <Database className="h-3 w-3 text-muted-foreground" /> Shop Handoff *
              </FormLabel>
              <Select 
                onValueChange={field.onChange} 
                value={field.value || ""}
                disabled={isFieldDisabled('shopHandoff')}
              >
                <FormControl>
                  <SelectTrigger data-testid="select-shop-handoff" className={isFieldDisabled('shopHandoff') ? "bg-muted" : ""}>
                    <SelectValue placeholder="Select shop user" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {isLoadingShopHandoffUsers ? (
                    <SelectItem value="loading" disabled>Loading shop users...</SelectItem>
                  ) : shopName ? (
                    usersForSelectedShop.map((user) => (
                      <SelectItem key={user} value={user}>
                        {user}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-shop" disabled>Select Shop Name first</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="handoffEmailWorkflow"
          render={({ field }) => {
            const displayValue = field.value || "";
            
            return (
              <FormItem>
                <FormLabel className="flex items-center gap-1">
                  <Database className="h-3 w-3 text-muted-foreground" /> Handoff Email workflow
                </FormLabel>
                <FormControl>
                  <Input 
                    {...field}
                    value={displayValue}
                    readOnly
                    className="bg-muted text-muted-foreground cursor-not-allowed"
                    data-testid="input-handoff-email-readonly"
                    placeholder={!displayValue ? (form.getValues("shopHandoff") ? "Auto-populated from shop handoff selection" : "Select shop handoff first") : ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            );
          }}
        />
      </div>
    </>
  );
}
