import { useState } from "react";
import { UseFormReturn, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, CheckCircle2, XCircle } from "lucide-react";
import {
  showCleaningPhase,
  showOneBoxDiagnostics,
  showOneBoxInspection,
  showInletOutlet,
  showSealingCanister,
  showMeasurements,
} from "@/lib/emissions-form-config";

// Section sub-components
import { PartIdentificationSection } from "./emissions/part-identification-section";
import { CleaningPhaseSection } from "./emissions/cleaning-phase-section";
import { OneBoxDiagnosticsSection } from "./emissions/one-box-diagnostics-section";
import { OneBoxInspectionSection } from "./emissions/one-box-inspection-section";
import { InletOutletSection } from "./emissions/inlet-outlet-section";
import { SealingCanisterSection } from "./emissions/sealing-canister-section";
import { BungFittingSection } from "./emissions/bung-fitting-section";
import { CollectorSection } from "./emissions/collector-section";
import { GasketClampSection } from "./emissions/gasket-clamp-section";
import { MeasurementsSection } from "./emissions/measurements-section";
import { RepairAssessmentSection } from "./emissions/repair-assessment-section";
import { PassFailSection } from "./emissions/pass-fail-section";

export interface PartData {
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

interface PartsLoopSectionProps {
  parts: PartData[];
  form: UseFormReturn<any>;
}

/** Collapsible sub-section wrapper */
function SectionGroup({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-md">
      <button
        type="button"
        className="w-full flex items-center justify-between p-3 text-sm font-medium text-left hover:bg-muted/50"
        onClick={() => setOpen(!open)}
      >
        {title}
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="px-3 pb-3 space-y-3">{children}</div>}
    </div>
  );
}

/** Single part card with all its sections */
function PartCard({
  part,
  index,
  form,
  isExpanded,
  onToggle,
}: {
  part: PartData;
  index: number;
  form: UseFormReturn<any>;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const passOrFail = useWatch({ control: form.control, name: `parts.${index}.passOrFail` });

  const statusIcon =
    passOrFail === "Pass" ? (
      <CheckCircle2 className="h-4 w-4 text-green-600" />
    ) : passOrFail === "Fail" ? (
      <XCircle className="h-4 w-4 text-red-600" />
    ) : null;

  const partType = part.part || "";
  const process = part.process || "";

  return (
    <Card>
      {/* Collapsible header */}
      <CardHeader className="pb-2 cursor-pointer select-none" onClick={onToggle}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{part.part || `Part ${index + 1}`}</CardTitle>
            {statusIcon}
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>{part.ecsSerial || "No serial"}</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-3">
          {/* 1. Part Identification (always visible) */}
          <SectionGroup title="Part Identification" defaultOpen>
            <PartIdentificationSection
              partIndex={index}
              control={form.control}
              partData={part}
            />
          </SectionGroup>

          {/* 2. Cleaning Phase (hidden for REPAIR ONLY) */}
          {showCleaningPhase(process) && (
            <SectionGroup title="Cleaning Phase">
              <CleaningPhaseSection partIndex={index} control={form.control} />
            </SectionGroup>
          )}

          {/* 3. One Box Diagnostics (One Box / DPF-DOC / DPF-DOC-SCR) */}
          {showOneBoxDiagnostics(partType) && (
            <SectionGroup title="One Box Diagnostics">
              <OneBoxDiagnosticsSection partIndex={index} control={form.control} />
            </SectionGroup>
          )}

          {/* 4. One Box Inspection (One Box parts, not REPAIR ONLY) */}
          {showOneBoxInspection(partType, process) && (
            <SectionGroup title="One Box Inspection">
              <OneBoxInspectionSection partIndex={index} control={form.control} />
            </SectionGroup>
          )}

          {/* 5. Inlet & Outlet (hidden for REPAIR ONLY) */}
          {showInletOutlet(partType, process) && (
            <SectionGroup title="Inlet & Outlet">
              <InletOutletSection partIndex={index} control={form.control} />
            </SectionGroup>
          )}

          {/* 6. Sealing & Canister (hidden for REPAIR ONLY) */}
          {showSealingCanister(partType, process) && (
            <SectionGroup title="Sealing & Canister">
              <SealingCanisterSection partIndex={index} control={form.control} />
            </SectionGroup>
          )}

          {/* 7. Bung & Fitting (always visible) */}
          <SectionGroup title="Bung & Fitting">
            <BungFittingSection partIndex={index} control={form.control} />
          </SectionGroup>

          {/* 8. Collector (always visible) */}
          <SectionGroup title="Collector">
            <CollectorSection partIndex={index} control={form.control} />
          </SectionGroup>

          {/* 9. Gasket & Clamps (always visible) */}
          <SectionGroup title="Gasket & Clamps">
            <GasketClampSection
              partIndex={index}
              control={form.control}
              partData={{ ec: part.ec, eg: part.eg, ek: part.ek }}
            />
          </SectionGroup>

          {/* 10. Measurements (hidden for REPAIR ONLY) */}
          {showMeasurements(partType, process) && (
            <SectionGroup title="Measurements">
              <MeasurementsSection partIndex={index} control={form.control} />
            </SectionGroup>
          )}

          {/* 11. Repair Assessment (always visible) */}
          <SectionGroup title="Repair Assessment">
            <RepairAssessmentSection partIndex={index} control={form.control} />
          </SectionGroup>

          {/* 12. Pass / Fail (always visible) */}
          <SectionGroup title="Pass / Fail" defaultOpen>
            <PassFailSection partIndex={index} control={form.control} />
          </SectionGroup>
        </CardContent>
      )}
    </Card>
  );
}

export function PartsLoopSection({ parts, form }: PartsLoopSectionProps) {
  const [expandedParts, setExpandedParts] = useState<Set<number>>(() => {
    return new Set(parts.length > 0 ? [0] : []);
  });

  const togglePart = (index: number) => {
    setExpandedParts((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (parts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No parts assigned to this job.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Parts ({parts.length})</h2>
      {parts.map((part, index) => (
        <PartCard
          key={part.id || index}
          part={part}
          index={index}
          form={form}
          isExpanded={expandedParts.has(index)}
          onToggle={() => togglePart(index)}
        />
      ))}
    </div>
  );
}
