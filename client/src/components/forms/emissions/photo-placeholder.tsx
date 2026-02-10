import { Camera } from "lucide-react";

interface PhotoPlaceholderProps {
  label: string;
}

export function PhotoPlaceholder({ label }: PhotoPlaceholderProps) {
  return (
    <div className="flex items-center gap-2 p-3 border border-dashed border-muted-foreground/30 rounded-md bg-muted/20 text-muted-foreground text-sm">
      <Camera className="h-4 w-4 shrink-0" />
      <span>{label} — photo capture coming soon</span>
    </div>
  );
}
