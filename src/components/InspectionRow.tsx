import { AlertCircle, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLocation } from "react-router-dom";

interface InspectionRowProps {
  id: string;
  site: string;
  inspector: string;
  date: string;
  status: "completed" | "in-progress" | "overdue" | "scheduled";
  riskLevel: "low" | "medium" | "high" | "critical";
  score?: number;
  photoUrl?: string | null;
}

const riskStyles: Record<string, string> = {
  low: "bg-success/10 text-success border-success/30",
  medium: "bg-warning/10 text-warning border-warning/30",
  high: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  critical: "bg-destructive/10 text-destructive border-destructive/30",
};

const statusStyles: Record<string, string> = {
  completed: "bg-success/10 text-success border-success/30",
  "in-progress": "bg-blue-500/10 text-blue-500 border-blue-500/30",
  overdue: "bg-destructive/10 text-destructive border-destructive/30",
  scheduled: "bg-muted/10 text-muted-foreground border-muted/30",
};

export function InspectionRow({
  id,
  site,
  inspector,
  date,
  status,
  riskLevel,
  score,
  photoUrl,
}: InspectionRowProps) {
  // 🎨 Risk seviyesine göre border rengi
  const borderColor =
    riskLevel === "critical"
      ? "border-l-4 border-l-destructive"
      : riskLevel === "high"
      ? "border-l-4 border-l-orange-500"
      : "border-l-4 border-l-border/50";

      

  return (
    <div
      className={`flex items-center justify-between gap-4 p-4 hover:bg-muted/50 transition-colors cursor-pointer group ${borderColor}`}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {photoUrl ? (
          <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
            <img
              src={photoUrl}
              alt={site}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="h-12 w-12 rounded-lg border border-border/50 bg-secondary/30 flex items-center justify-center flex-shrink-0">
            <ImageIcon className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {site}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <p className="text-xs text-muted-foreground">{inspector}</p>
            <span className="text-xs text-muted-foreground/60">•</span>
            <p className="text-xs text-muted-foreground">{date}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-shrink-0">
        {score !== undefined && (
          <span className="text-sm font-bold text-foreground bg-primary/10 px-2.5 py-1 rounded-md">
            {score}%
          </span>
        )}
        <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${riskStyles[riskLevel]}`}>
          {riskLevel === "low"
            ? "Düşük"
            : riskLevel === "medium"
            ? "Orta"
            : riskLevel === "high"
            ? "Yüksek"
            : "Kritik"}
        </Badge>
        <Badge variant="outline" className={`text-[10px] uppercase tracking-wider ${statusStyles[status]}`}>
          {status === "completed"
            ? "Tamamlandı"
            : status === "in-progress"
            ? "Devam"
            : status === "overdue"
            ? "Gecikmiş"
            : "Planlandı"}
        </Badge>
      </div>
    </div>
  );
}