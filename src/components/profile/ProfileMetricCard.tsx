import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ProfileMetricCardProps = {
  title: string;
  value: string | number;
  description: string;
  icon: LucideIcon;
  tone: string;
};

export function ProfileMetricCard({ title, value, description, icon: Icon, tone }: ProfileMetricCardProps) {
  return (
    <div
      className={cn(
        "group rounded-2xl border p-5 text-white shadow-sm transition-all hover:-translate-y-0.5",
        tone,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-3xl font-black tracking-tight">{value}</p>
          <p className="mt-2 text-sm font-bold">{title}</p>
          <p className="mt-1 text-xs leading-5 text-white/70">{description}</p>
        </div>
        <div className="rounded-2xl bg-white/15 p-3 ring-1 ring-white/15">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
