import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCreateWorkspaceOrganization } from "@/hooks/useCreateWorkspaceOrganization";
import { cn } from "@/lib/utils";

type OrganizationCreateButtonProps = {
  nextPath?: string;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  compact?: boolean;
};

export function OrganizationCreateButton({
  nextPath,
  className,
  iconClassName,
  labelClassName,
  compact = false,
}: OrganizationCreateButtonProps) {
  const { creating, createWorkspaceOrganization } = useCreateWorkspaceOrganization();

  return (
    <Button
      type="button"
      disabled={creating}
      onClick={() => void createWorkspaceOrganization(nextPath)}
      aria-label="Organizasyon Oluştur"
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-cyan-300/30 bg-[linear-gradient(135deg,rgba(14,165,233,0.92),rgba(99,102,241,0.88))] font-bold text-white shadow-[0_16px_36px_-24px_rgba(6,182,212,0.95)] transition hover:border-cyan-200/50 hover:from-cyan-500 hover:to-indigo-500 disabled:opacity-70",
        compact ? "h-10 w-10 p-0 sm:w-auto sm:px-3" : "h-10 px-4 text-sm",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-px rounded-[15px] border border-white/20" />
      <Building2 className={cn(compact ? "h-4 w-4 sm:mr-2" : "mr-2 h-4 w-4", iconClassName)} />
      <span className={cn(compact ? "hidden sm:inline" : "inline", labelClassName)}>
        {creating ? "Oluşturuluyor..." : "Organizasyon Oluştur"}
      </span>
    </Button>
  );
}
