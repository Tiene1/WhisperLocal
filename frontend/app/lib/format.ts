/** Formatte un nombre de secondes en mm:ss (ou hh:mm:ss au-delà d'une heure). */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || Number.isNaN(totalSeconds)) {
    return "--:--";
  }
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Formatte une date ISO en libellé court lisible (ex: "24 Oct, 14:30"). */
export function formatDateLabel(iso: string | null | undefined): string {
  if (!iso) return "--";
  const date = new Date(iso);
  return date.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatTimeLabel(iso: string | null | undefined): string {
  if (!iso) return "--:--:--";
  const date = new Date(iso);
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
