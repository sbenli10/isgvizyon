import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProfileTab =
  | "overview"
  | "companies"
  | "employees"
  | "trainings"
  | "documents"
  | "follow"
  | "archive"
  | "risks"
  | "reports"
  | "visits"
  | "subscription"
  | "settings";

export type ProfileTabConfig = {
  id: ProfileTab;
  label: string;
  icon: LucideIcon;
};

type ProfileTabsProps = {
  tabs: ProfileTabConfig[];
  activeTab: ProfileTab;
  onChange: (tab: ProfileTab) => void;
};

export function ProfileTabs({ tabs, activeTab, onChange }: ProfileTabsProps) {
  return (
    <div className="overflow-x-auto rounded-[26px] border border-white/10 bg-slate-950/55 p-2 shadow-2xl shadow-black/15 backdrop-blur-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-max gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={cn(
                "inline-flex h-11 items-center gap-2 rounded-2xl border px-3.5 text-sm font-black transition-all",
                active
                  ? "border-cyan-300/35 bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-cyan-950/25"
                  : "border-white/5 bg-white/[0.04] text-slate-300 hover:border-cyan-300/25 hover:bg-cyan-400/10 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
