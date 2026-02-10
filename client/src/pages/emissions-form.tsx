import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useParams, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { captureGps, getDeviceInfo } from "@/lib/gpsCapture";
import { enqueue } from "@/lib/offlineQueue";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Wrench, ArrowLeft, Loader2, WifiOff, Zap } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useDevMode } from "@/contexts/DevModeContext";
import { generateEmissionsTestData } from "@/lib/test-data-generators";
import { PartsLoopSection } from "@/components/forms/parts-loop-section";
import { SignOffSection } from "@/components/forms/emissions/sign-off-section";

interface FormSubmission {
  id: string;
  jobId: string;
  formType: string;
  status: string;
  prefilledData: Record<string, unknown> | null;
}

// Comprehensive part response schema — all ~60 tech-editable fields per part.
// All optional at field level; conditional requirements handled by superRefine.
const partResponseSchema = z.object({
  // Identification
  ecsSerial: z.string(),
  ecsPartNumber: z.string().optional(),
  partDescription: z.string().optional(),
  oeSerialNumber: z.string().optional(),

  // Cleaning
  cleaningPhase: z.string().optional(),

  // One Box Diagnostics
  noxConversion: z.string().optional(),
  docInletTemp: z.string().optional(),
  docOutletTemp: z.string().optional(),
  dpfOutletTemp: z.string().optional(),
  physicalDamage: z.string().optional(),
  sensorsRemoved: z.string().optional(),
  sensorsRemovedList: z.string().optional(),
  repairDescriptionOneBox: z.string().optional(),
  crystallization: z.string().optional(),
  crystallizationDescription: z.string().optional(),

  // One Box Inspection — smoke tests
  preScrSmokeTest: z.string().optional(),
  preDocSmokeTest: z.string().optional(),
  postScrSmokeTest: z.string().optional(),
  postDocSmokeTest: z.string().optional(),
  needsSensors: z.string().optional(),
  selectedSensors: z.string().optional(),

  // Inlet & Outlet
  inletColor: z.string().optional(),
  inletOtherColor: z.string().optional(),
  inletDamage: z.string().optional(),
  inletComment: z.string().optional(),
  outletColor: z.string().optional(),
  outletOtherColor: z.string().optional(),
  outletDamage: z.string().optional(),
  outletLeakingCells: z.string().optional(),
  outletComment: z.string().optional(),

  // Sealing & Canister
  sealingRing: z.string().optional(),
  canisterInspection: z.string().optional(),

  // Bung & Fitting
  bungCondition: z.string().optional(),
  showRecommendedBungs: z.string().optional(),
  bungProblem: z.string().optional(),
  firstFittingQty: z.string().optional(),
  firstFittingPn: z.string().optional(),
  firstFittingDesc: z.string().optional(),
  additionalFittingNeeded: z.string().optional(),
  secondFittingQty: z.string().optional(),
  secondFittingPn: z.string().optional(),
  secondFittingDesc: z.string().optional(),
  thirdFittingNeeded: z.string().optional(),
  thirdFittingQty: z.string().optional(),
  thirdFittingPn: z.string().optional(),
  thirdFittingDesc: z.string().optional(),
  bungFittingComment: z.string().optional(),

  // Collector
  collectorCondition: z.string().optional(),
  collectorComment: z.string().optional(),

  // Gasket & Clamps
  gasketOrClamps: z.string().optional(),
  showRecommendedGaskets: z.string().optional(),
  ecChecked: z.boolean().optional(),
  egChecked: z.boolean().optional(),
  ekChecked: z.boolean().optional(),
  ecQuantity: z.string().optional(),
  egQuantity: z.string().optional(),
  ekQuantity: z.string().optional(),
  ecPn1: z.string().optional(),
  ecDesc1: z.string().optional(),
  ecPn2: z.string().optional(),
  ecDesc2: z.string().optional(),
  ecPn3: z.string().optional(),
  ecDesc3: z.string().optional(),
  egPn1: z.string().optional(),
  egDesc1: z.string().optional(),
  egPn2: z.string().optional(),
  egDesc2: z.string().optional(),
  egPn3: z.string().optional(),
  egDesc3: z.string().optional(),
  ekPn1: z.string().optional(),
  ekDesc1: z.string().optional(),
  ekPn2: z.string().optional(),
  ekDesc2: z.string().optional(),
  ekPn3: z.string().optional(),
  ekDesc3: z.string().optional(),

  // Measurements
  weightPreKg: z.string().optional(),
  flowRatePre: z.string().optional(),
  weightPostKg: z.string().optional(),
  flowRatePost: z.string().optional(),
  weightSinteredKg: z.string().optional(),
  flowRateSintered: z.string().optional(),
  lightTest: z.string().optional(),
  dropRodTest: z.string().optional(),
  sinteredAshProcess: z.string().optional(),

  // Repair Assessment
  requireRepairs: z.string().optional(),
  repairsPerformed: z.string().optional(),
  repairDescription: z.string().optional(),

  // Pass/Fail
  passOrFail: z.string().min(1, "Pass or Fail is required"),
  failedReason: z.string().optional(),
  failureNotes: z.string().optional(),
  submissionStatus: z.string().optional(),
  additionalPartComments: z.string().optional(),
  showAdditionalComments: z.string().optional(),
}).superRefine((data, ctx) => {
  // Failed reason required when part fails
  if (data.passOrFail === "Fail" && !data.failedReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Failed reason is required when part fails",
      path: ["failedReason"],
    });
  }
});

const emissionsFormSchema = z.object({
  parts: z.array(partResponseSchema),
  additionalComments: z.string().optional(),
  // Sign-off fields
  technicianName: z.string().min(1, "Technician name is required"),
  signOffDate: z.string().optional(),
  signOffTime: z.string().optional(),
});

type EmissionsFormValues = z.infer<typeof emissionsFormSchema>;

interface PartPrefill {
  id: string;
  part: string;
  process: string;
  ecsSerial: string;
  filterPn?: string;
  poNumber?: string;
  mileage?: string;
  unitVin?: string;
  gasketClamps?: string;
  ec?: string;
  eg?: string;
  ek?: string;
}

/** Build default values for a single part */
function buildPartDefaults(p: PartPrefill) {
  return {
    ecsSerial: p.ecsSerial || "",
    ecsPartNumber: "",
    partDescription: "",
    oeSerialNumber: "",
    cleaningPhase: "",
    noxConversion: "",
    docInletTemp: "",
    docOutletTemp: "",
    dpfOutletTemp: "",
    physicalDamage: "",
    sensorsRemoved: "",
    sensorsRemovedList: "",
    repairDescriptionOneBox: "",
    crystallization: "",
    crystallizationDescription: "",
    preScrSmokeTest: "",
    preDocSmokeTest: "",
    postScrSmokeTest: "",
    postDocSmokeTest: "",
    needsSensors: "",
    selectedSensors: "",
    inletColor: "",
    inletOtherColor: "",
    inletDamage: "",
    inletComment: "",
    outletColor: "",
    outletOtherColor: "",
    outletDamage: "",
    outletLeakingCells: "",
    outletComment: "",
    sealingRing: "",
    canisterInspection: "",
    bungCondition: "",
    showRecommendedBungs: "",
    bungProblem: "",
    firstFittingQty: "",
    firstFittingPn: "",
    firstFittingDesc: "",
    additionalFittingNeeded: "",
    secondFittingQty: "",
    secondFittingPn: "",
    secondFittingDesc: "",
    thirdFittingNeeded: "",
    thirdFittingQty: "",
    thirdFittingPn: "",
    thirdFittingDesc: "",
    bungFittingComment: "",
    collectorCondition: "",
    collectorComment: "",
    gasketOrClamps: "",
    showRecommendedGaskets: "",
    ecChecked: false,
    egChecked: false,
    ekChecked: false,
    ecQuantity: "",
    egQuantity: "",
    ekQuantity: "",
    ecPn1: "", ecDesc1: "", ecPn2: "", ecDesc2: "", ecPn3: "", ecDesc3: "",
    egPn1: "", egDesc1: "", egPn2: "", egDesc2: "", egPn3: "", egDesc3: "",
    ekPn1: "", ekDesc1: "", ekPn2: "", ekDesc2: "", ekPn3: "", ekDesc3: "",
    weightPreKg: "",
    flowRatePre: "",
    weightPostKg: "",
    flowRatePost: "",
    weightSinteredKg: "",
    flowRateSintered: "",
    lightTest: "",
    dropRodTest: "",
    sinteredAshProcess: "",
    requireRepairs: "",
    repairsPerformed: "",
    repairDescription: "",
    passOrFail: "",
    failedReason: "",
    failureNotes: "",
    submissionStatus: "",
    additionalPartComments: "",
    showAdditionalComments: "",
  };
}

export default function EmissionsForm() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const { isDevMode } = useDevMode();

  const { data: submission, isLoading } = useQuery<FormSubmission>({
    queryKey: [`/api/form-submissions/${id}`],
    enabled: !!id,
  });

  const prefill = (submission?.prefilledData ?? {}) as Record<string, unknown>;
  const parts = (prefill.parts as PartPrefill[]) ?? [];

  const now = new Date();

  const form = useForm<EmissionsFormValues>({
    resolver: zodResolver(emissionsFormSchema),
    defaultValues: {
      parts: parts.map(buildPartDefaults),
      additionalComments: "",
      technicianName: "",
      signOffDate: now.toISOString().split("T")[0],
      signOffTime: now.toTimeString().slice(0, 5),
    },
  });

  // Mark as in_progress when form is opened
  const startMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PATCH", `/api/form-submissions/${id}/start`);
    },
  });

  if (submission?.status === "dispatched" && !startMutation.isPending && !startMutation.isSuccess) {
    startMutation.mutate();
  }

  const submitMutation = useMutation({
    mutationFn: async (values: EmissionsFormValues) => {
      const gps = await captureGps();
      const deviceInfo = getDeviceInfo();

      const payload = {
        responseData: values,
        gps: gps ? { latitude: gps.latitude, longitude: gps.longitude, accuracy: gps.accuracy } : undefined,
        deviceInfo,
      };

      if (!navigator.onLine) {
        await enqueue({
          submissionId: id!,
          responseData: values,
          gps: gps ? { latitude: gps.latitude, longitude: gps.longitude, accuracy: gps.accuracy } : undefined,
          deviceInfo,
        });
        return { offline: true };
      }

      const res = await apiRequest("POST", `/api/form-submissions/${id}/complete`, payload);
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: [`/api/form-submissions/assigned/${user?.email}`] });

      if (result?.offline) {
        toast({
          title: "Saved Offline",
          description: "Service log saved. It will sync when you're back online.",
        });
      } else {
        toast({
          title: "Service Complete",
          description: "Emissions service log submitted successfully.",
        });
      }
      navigate("/tech");
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to submit emissions service log",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Form submission not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/tech")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-lg mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate("/tech")}>
        <ArrowLeft className="h-4 w-4 mr-2" />Back
      </Button>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          Emissions Service Log
        </h1>
        <div className="flex items-center gap-2">
          {!navigator.onLine && (
            <span className="text-xs flex items-center gap-1 text-orange-600">
              <WifiOff className="h-3 w-3" /> Offline
            </span>
          )}
          {isDevMode && (
            <Button
              type="button"
              size="sm"
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={() => {
                const data = generateEmissionsTestData(parts.length);
                form.reset(data);
              }}
            >
              <Zap className="h-3 w-3 mr-1" />Fill Test Data
            </Button>
          )}
        </div>
      </div>

      {/* Read-only CSR section */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Job Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">Job ID</span>
              <p className="font-medium">{submission.jobId}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Shop</span>
              <p className="font-medium">{(prefill.shopName as string) || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Customer</span>
              <p className="font-medium">{(prefill.customerName as string) || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Ship To</span>
              <p className="font-medium">{(prefill.customerShipTo as string) || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Contact</span>
              <p className="font-medium">{(prefill.contactName as string) || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Phone</span>
              <p className="font-medium">{(prefill.contactNumber as string) || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">PO Number</span>
              <p className="font-medium">{(prefill.poNumber as string) || "—"}</p>
            </div>
            {!!prefill.p21OrderNumber && (
              <div>
                <span className="text-muted-foreground">P21 Order #</span>
                <p className="font-medium">{String(prefill.p21OrderNumber)}</p>
              </div>
            )}
          </div>

          {!!prefill.serialNumbers && (
            <div>
              <span className="text-muted-foreground">Serial Numbers</span>
              <p className="font-medium">{String(prefill.serialNumbers)}</p>
            </div>
          )}

          {!!prefill.permissionToStart && (
            <div>
              <span className="text-muted-foreground">Permission to Start</span>
              <p className="font-medium">{String(prefill.permissionToStart)}</p>
            </div>
          )}

          {!!prefill.customerSpecificInstructions && (
            <div className="p-2 bg-yellow-50 rounded text-xs border border-yellow-200">
              <span className="font-medium">Customer Instructions: </span>
              {String(prefill.customerSpecificInstructions)}
            </div>
          )}

          {!!prefill.preferredProcess && (
            <div>
              <span className="text-muted-foreground">Preferred Process</span>
              <p className="font-medium">{String(prefill.preferredProcess)}</p>
            </div>
          )}

          {!!prefill.sendClampsGaskets && (
            <div>
              <span className="text-muted-foreground">Send Clamps & Gaskets?</span>
              <p className="font-medium">{String(prefill.sendClampsGaskets)}</p>
            </div>
          )}

          {!!prefill.anyOtherSpecificInstructions && (
            <div className="p-2 bg-muted rounded text-xs">
              <span className="font-medium">Other Instructions: </span>
              {String(prefill.anyOtherSpecificInstructions)}
            </div>
          )}

          {!!prefill.anyCommentsForTech && (
            <div className="p-2 bg-blue-50 rounded text-xs border border-blue-200">
              <span className="font-medium">Comments for Tech: </span>
              {String(prefill.anyCommentsForTech)}
            </div>
          )}

          {!!prefill.noteToTechAboutCustomer && (
            <div className="p-2 bg-orange-50 rounded text-xs border border-orange-200">
              <span className="font-medium">Note about Customer: </span>
              {String(prefill.noteToTechAboutCustomer)}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parts loop and technician input */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => submitMutation.mutate(v))} className="space-y-4">
          <PartsLoopSection parts={parts} form={form} />

          {/* Additional comments */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Additional Comments</CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="additionalComments"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        placeholder="Any additional comments about this service..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Sign-off section */}
          <SignOffSection
            control={form.control}
            shopName={prefill.shopName as string | undefined}
            partsCount={parts.length}
          />

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Submitting...</>
            ) : (
              "Complete Service Log"
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
}
