import { Play } from "lucide-react";

export function VideoPlaceholder({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <div
      className={
        "overflow-hidden rounded-2xl border border-border bg-card shadow-[0_20px_60px_-20px_rgba(15,23,42,0.15)] " +
        (className ?? "")
      }
    >
      <div className="flex items-center gap-1.5 border-b border-border bg-muted/50 px-4 py-3">
        <span className="size-2.5 rounded-full bg-[#ff5f57]" />
        <span className="size-2.5 rounded-full bg-[#febc2e]" />
        <span className="size-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-auto mr-auto text-xs font-medium text-muted-foreground">
          Rio
        </span>
      </div>

      <div className="flex aspect-video flex-col items-center justify-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Play className="size-5 text-muted-foreground" />
        </span>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}