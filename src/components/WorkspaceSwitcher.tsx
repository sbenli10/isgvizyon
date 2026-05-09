import { Building2, Loader2, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWorkspaces } from "@/hooks/useWorkspaces";
import { cn } from "@/lib/utils";

interface WorkspaceSwitcherProps {
  compact?: boolean;
  className?: string;
}

export function WorkspaceSwitcher({ compact = false, className }: WorkspaceSwitcherProps) {
  const navigate = useNavigate();
  const { workspaces, currentWorkspace, loading, switching, switchWorkspace } = useWorkspaces();

  if (loading && workspaces.length === 0) {
    return (
      <div className={cn("rounded-2xl border border-slate-200/80 bg-white/70 p-3 dark:border-white/10 dark:bg-white/[0.03]", className)}>
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Çalışma alanları yükleniyor
        </div>
      </div>
    );
  }

  const value = currentWorkspace?.workspace_id ?? "personal";

  return (
    <div className={cn("space-y-2 rounded-2xl border border-slate-200/80 bg-white/70 p-2.5 dark:border-white/10 dark:bg-white/[0.03]", className)}>
      {!compact ? (
        <div className="flex items-center justify-between gap-2 px-1">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Çalışma Alanı
          </span>
          {switching ? <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-500" /> : null}
        </div>
      ) : null}
      <Select
        value={value}
        onValueChange={async (nextValue) => {
          await switchWorkspace(nextValue === "personal" ? null : nextValue);
          navigate("/", { replace: true });
        }}
        disabled={switching}
      >
        <SelectTrigger className="h-9 rounded-xl border-slate-200/80 bg-white/80 text-xs text-slate-900 shadow-none dark:border-white/10 dark:bg-slate-950/60 dark:text-slate-100">
          <SelectValue placeholder="Çalışma alanı seç" />
        </SelectTrigger>
        <SelectContent>
          {workspaces.map((workspace) => {
            const itemValue = workspace.workspace_id ?? "personal";
            const Icon = workspace.workspace_type === "personal" ? User : Building2;

            return (
              <SelectItem key={itemValue} value={itemValue}>
                <span className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 stroke-[1.8]" />
                  <span>{workspace.workspace_name}</span>
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      {!compact && currentWorkspace ? (
        <p className="px-1 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
          {currentWorkspace.workspace_type === "personal"
            ? "Bireysel premium/free haklarınız burada geçerlidir."
            : currentWorkspace.role === "owner"
              ? "Sahibi olduğunuz OSGB çalışma alanı."
              : "Üyesi olduğunuz kurumsal çalışma alanı."}
        </p>
      ) : null}
    </div>
  );
}
