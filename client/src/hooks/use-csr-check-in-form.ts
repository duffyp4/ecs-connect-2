import { useEffect } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import { insertJobSchema } from "@shared/schema";
import { 
  useShopUsers, 
  useShopsForUser, 
  usePermissionForUser, 
  useCustomerNames, 
  useShipToForCustomer, 
  useShip2Ids, 
  useTechComments, 
  useSendClampsGaskets, 
  usePreferredProcesses, 
  useCustomerInstructions, 
  useCustomerSpecificData, 
  useAllShops, 
  useUsersForShop, 
  useDriverDetails 
} from "@/hooks/use-reference-data";
import type { z } from "zod";

type FormData = z.infer<typeof insertJobSchema>;

interface UseCsrCheckInFormOptions {
  initialValues?: Partial<FormData>;
  disableAutoPopulation?: boolean;
}

export interface CsrCheckInFormData {
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
}

/**
 * Shared hook for CSR Check-In form logic
 * Handles form state, reference data, and auto-population
 */
export function useCsrCheckInForm(options: UseCsrCheckInFormOptions = {}): CsrCheckInFormData {
  const { initialValues = {}, disableAutoPopulation = false } = options;

  // Initialize form with default or provided values
  const form = useForm<FormData>({
    // No resolver - validate manually
    defaultValues: {
      p21OrderNumber: "",
      userId: "",
      permissionToStart: "",
      permissionDeniedStop: "",
      shopName: "",
      customerName: "",
      customerShipTo: "",
      p21ShipToId: "",
      customerSpecificInstructions: "",
      sendClampsGaskets: "",
      preferredProcess: "",
      anyOtherSpecificInstructions: "",
      anyCommentsForTech: "",
      noteToTechAboutCustomer: "",
      contactName: "",
      contactNumber: "",
      poNumber: "",
      serialNumbers: "",
      techCustomerQuestionInquiry: "sales@ecspart.com",
      shopHandoff: "",
      handoffEmailWorkflow: "",
      ...initialValues,
    },
  });

  // Reference data hooks
  const { data: shopUsers = [], isLoading: isLoadingShopUsers } = useShopUsers();
  const userId = form.watch("userId") || "";
  const { data: shopsForUser = [], isLoading: isLoadingShops } = useShopsForUser(userId || undefined);
  const { data: allShops = [], isLoading: isLoadingAllShops } = useAllShops();
  const { data: permissionData } = usePermissionForUser(userId || undefined);
  const shopName = form.watch("shopName") || "";
  const { data: usersForSelectedShop = [], isLoading: isLoadingShopHandoffUsers } = useUsersForShop(shopName || undefined);
  const { data: customerNames = [], isLoading: isLoadingCustomers } = useCustomerNames();
  const customerName = form.watch("customerName") || "";
  const customerShipTo = form.watch("customerShipTo") || "";
  const { data: shipToOptions = [], isLoading: isLoadingShipTo } = useShipToForCustomer(customerName || undefined);
  const { data: ship2Ids = [], isLoading: isLoadingShip2Ids } = useShip2Ids(customerName || undefined, customerShipTo || undefined);
  const { data: techComments = [], isLoading: isLoadingComments } = useTechComments();
  const { data: sendClampsOptions = [], isLoading: isLoadingSendClamps } = useSendClampsGaskets();
  const { data: preferredProcesses = [], isLoading: isLoadingProcesses } = usePreferredProcesses();
  const { data: customerInstructionsData } = useCustomerInstructions(customerName || undefined, customerShipTo || undefined);
  const { data: customerSpecificData } = useCustomerSpecificData(customerName || undefined, customerShipTo || undefined);
  const { data: driverDetails = [], isLoading: isLoadingDrivers } = useDriverDetails();
  const shopHandoff = form.watch("shopHandoff") || "";

  // Auto-populate permission when user changes
  useEffect(() => {
    if (!disableAutoPopulation && permissionData?.permission) {
      form.setValue("permissionToStart", permissionData.permission);
    }
  }, [permissionData, form, disableAutoPopulation]);

  // Auto-populate customer instructions when customer changes
  useEffect(() => {
    if (!disableAutoPopulation && customerInstructionsData && customerName) {
      if (customerInstructionsData.instructions === '#N/A' || 
          customerInstructionsData.instructions === '' || 
          !customerInstructionsData.instructions) {
        form.setValue("customerSpecificInstructions", "N/A");
      } else {
        form.setValue("customerSpecificInstructions", customerInstructionsData.instructions);
      }
    }
  }, [customerInstructionsData, customerName, form, disableAutoPopulation]);

  // Auto-populate reference data fields when customer changes
  useEffect(() => {
    if (!disableAutoPopulation && customerSpecificData && customerName) {
      // Auto-populate preferred process from reference data
      if (customerSpecificData.preferredProcess === '#N/A' || 
          customerSpecificData.preferredProcess === '' || 
          !customerSpecificData.preferredProcess) {
        form.setValue("preferredProcess", "N/A");
      } else {
        form.setValue("preferredProcess", customerSpecificData.preferredProcess);
      }
      
      // Auto-populate send clamps/gaskets from reference data
      if (customerSpecificData.sendClampsGaskets === '#N/A' || 
          customerSpecificData.sendClampsGaskets === '' || 
          !customerSpecificData.sendClampsGaskets) {
        form.setValue("sendClampsGaskets", "N/A");
      } else {
        form.setValue("sendClampsGaskets", customerSpecificData.sendClampsGaskets);
      }
      
      // Auto-populate "Any Other Specific Instructions?" from reference data
      if (customerSpecificData.customerNotes === '#N/A' || 
          customerSpecificData.customerNotes === '' || 
          !customerSpecificData.customerNotes) {
        form.setValue("anyOtherSpecificInstructions", "N/A");
      } else {
        form.setValue("anyOtherSpecificInstructions", customerSpecificData.customerNotes);
      }
      
      // Auto-populate customer notes from reference data
      if (customerSpecificData.customerNotes === '#N/A' || 
          customerSpecificData.customerNotes === '' || 
          !customerSpecificData.customerNotes) {
        form.setValue("noteToTechAboutCustomer", "N/A");
      } else {
        form.setValue("noteToTechAboutCustomer", customerSpecificData.customerNotes);
      }
    }
  }, [customerSpecificData, customerName, form, disableAutoPopulation]);

  // Clear shop name when user changes (only for new form, not modal)
  useEffect(() => {
    if (!disableAutoPopulation && !initialValues.shopName && userId) {
      form.setValue("shopName", "");
    }
  }, [userId, form, disableAutoPopulation, initialValues.shopName]);

  // Clear shop handoff when shop name changes (only for new form, not modal)
  useEffect(() => {
    if (!disableAutoPopulation && !initialValues.shopName) {
      form.setValue("shopHandoff", "");
    }
  }, [shopName, form, disableAutoPopulation, initialValues.shopName]);

  // Auto-populate handoff email when shop handoff changes
  useEffect(() => {
    if (!disableAutoPopulation && shopHandoff) {
      form.setValue("handoffEmailWorkflow", shopHandoff);
    }
  }, [shopHandoff, form, disableAutoPopulation]);

  // Auto-populate Ship2 ID when customer and ship-to are selected
  useEffect(() => {
    if (!disableAutoPopulation) {
      if (ship2Ids.length > 0) {
        form.setValue("p21ShipToId", ship2Ids[0]);
      } else if (customerName && customerShipTo) {
        form.setValue("p21ShipToId", "");
      }
    }
  }, [ship2Ids, customerName, customerShipTo, form, disableAutoPopulation]);

  return {
    form,
    referenceData: {
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
      driverDetails,
      isLoadingDrivers,
    },
    watchedFields: {
      userId,
      shopName,
      customerName,
      customerShipTo,
      shopHandoff,
    },
  };
}
