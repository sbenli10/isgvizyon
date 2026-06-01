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
    <div className="overflow-x-auto rounded-2xl border border-slate-700/60 bg-slate-900/70 p-2 shadow-sm">
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
                "inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-all",
                active
                  ? "bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-lg shadow-blue-950/20"
                  : "text-slate-300 hover:bg-slate-800 hover:text-white",
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
