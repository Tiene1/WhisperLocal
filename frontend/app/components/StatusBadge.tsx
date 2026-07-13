import type { JobStatus } from "@/app/types/job";

interface StatusBadgeProps {
  status: JobStatus;
  /** Progression 0-100, affichée uniquement si > 0 (cf. règle "progression tolérante"). */
  progress?: number;
  className?: string;
}

const STATUS_CONFIG: Record<
  JobStatus,
  { label: string; icon: string; colorClass: string; pulse?: boolean }
> = {
  PENDING: {
    label: "En attente",
    icon: "schedule",
    colorClass: "text-status-pending bg-status-pending/10 border-status-pending/20",
  },
  PROCESSING: {
    label: "En cours",
    icon: "sync",
    colorClass: "text-status-processing bg-status-processing/10 border-status-processing/20",
    pulse: true,
  },
  DONE: {
    label: "Terminé",
    icon: "check_circle",
    colorClass: "text-status-done bg-status-done/10 border-status-done/20",
  },
  FAILED: {
    label: "Échec",
    icon: "error",
    colorClass: "text-status-failed bg-status-failed/10 border-status-failed/20",
  },
};

/** Badge de statut réutilisable — les 4 seuls statuts visuels autorisés
 * (pas de badge "Annulé" séparé, cf. CLAUDE.md règle 3). */
export default function StatusBadge({ status, progress, className = "" }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const showProgress = status === "PROCESSING" && typeof progress === "number" && progress > 0;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded border font-label-sm text-label-sm ${config.colorClass} ${
        config.pulse ? "border-2 animate-pulse-border" : ""
      } ${className}`}
    >
      {config.pulse ? (
        <span className="w-1.5 h-1.5 rounded-full bg-status-processing animate-pulse" />
      ) : (
        <span className="material-symbols-outlined text-sm">{config.icon}</span>
      )}
      {config.label}
      {showProgress ? ` (${progress}%)` : ""}
    </span>
  );
}
