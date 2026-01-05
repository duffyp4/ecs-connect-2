import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { JobPart } from "@shared/schema";

interface RawField {
  label: string;
  value: string | null;
  entry_id?: number;
}

interface PartDetailModalProps {
  part: JobPart | null;
  partIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PartDetailModal({
  part,
  partIndex,
  open,
  onOpenChange,
}: PartDetailModalProps) {
  if (!part) return null;

  const rawFields = (part.rawGocanvasFields as RawField[] | null) || [];
  const hasRawFields = rawFields.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>Part {partIndex + 1} - All GoCanvas Fields</span>
            {part.ecsSerial && (
              <Badge variant="outline" className="font-mono text-xs">
                {part.ecsSerial}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {hasRawFields ? (
            <div className="space-y-3">
              {rawFields.map((field, index) => (
                <div
                  key={`${field.entry_id || index}-${index}`}
                  className="flex flex-col py-2 border-b border-muted last:border-0"
                  data-testid={`field-row-${index}`}
                >
                  <div className="text-sm text-muted-foreground">
                    {field.label}
                  </div>
                  <div className="font-medium">
                    {field.value && field.value.trim() !== "" ? field.value : "-"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>No GoCanvas submission data available yet.</p>
              <p className="text-sm mt-2">
                Detailed fields will appear here after the technician completes the Emissions Service Log form.
              </p>
            </div>
          )}
        </ScrollArea>

        {hasRawFields && (
          <div className="text-xs text-muted-foreground text-center pt-2 border-t">
            Showing {rawFields.length} fields from GoCanvas submission
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
