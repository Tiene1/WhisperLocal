"use client";

import { useEffect, useMemo, useState } from "react";
import type { TranscriptionJob } from "@/app/types/job";
import { formatDuration, formatTimeLabel } from "@/app/lib/format";
import StatusBadge from "@/app/components/StatusBadge";

interface ProcessingViewProps {
  job: TranscriptionJob;
  onCancel: () => void;
  isCancelling: boolean;
}

/** Écran "Traitement en cours" (statut PENDING ou PROCESSING). */
export default function ProcessingView({ job, onCancel, isCancelling }: ProcessingViewProps) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!job.startedAt) {
      setElapsedSeconds(0);
      return;
    }
    const startedAtMs = new Date(job.startedAt).getTime();
    const tick = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [job.startedAt]);

  // Progression tolérante à l'absence de données (cf. CLAUDE.md règle 4) :
  // si progress reste à 0 alors qu'on est PROCESSING depuis un moment,
  // on bascule sur un indicateur d'activité générique plutôt qu'un "0%".
  const hasReliableProgress = job.status === "PROCESSING" && job.progress > 0;

  // Barres de waveform générées une seule fois par montage (composant déjà
  // client-only, aucun risque de désynchronisation SSR/CSR).
  const waveformBars = useMemo(
    () =>
      Array.from({ length: 40 }, () => ({
        delay: (Math.random() * 1).toFixed(2),
        duration: (0.5 + Math.random() * 0.8).toFixed(2),
      })),
    [],
  );

  const canCancel = job.status === "PENDING" || job.status === "PROCESSING";

  return (
    <div className="w-full max-w-175 bg-surface-card border border-surface-elevated rounded-xl p-stack-lg relative z-10 flex flex-col gap-stack-lg shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
      {/* Header / Status */}
      <div className="flex items-start justify-between border-b border-surface-elevated pb-stack-md">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface mb-2">
            {job.status === "PENDING" ? "En attente de traitement" : "Transcription en cours"}
          </h1>
          <div className="flex items-center gap-2 font-code text-code text-on-surface-variant">
            <span className="material-symbols-outlined text-base">audio_file</span>
            <span>{job.filename}</span>
          </div>
        </div>
        <div
          className={
            job.status === "PROCESSING"
              ? "rounded border-2 border-status-processing glowing-border bg-surface-dim"
              : ""
          }
        >
          <StatusBadge status={job.status} progress={job.progress} />
        </div>
      </div>

      {/* Visualizer */}
      <div className="h-32 w-full bg-bg-base border border-surface-elevated rounded-lg flex items-center justify-center overflow-hidden relative">
        {hasReliableProgress ? (
          <div className="flex items-end gap-1 h-16 px-4">
            {waveformBars.map((bar, i) => (
              <div
                key={i}
                className="waveform-bar h-full"
                style={{ animationDelay: `-${bar.delay}s`, animationDuration: `${bar.duration}s` }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl animate-spin" style={{ animationDuration: "2s" }}>
              progress_activity
            </span>
            <span className="font-label-sm text-label-sm">Traitement en cours (durée non estimable)</span>
          </div>
        )}
        <div className="absolute bottom-3 right-3 font-code text-code text-on-surface-variant bg-surface/80 px-2 py-1 rounded backdrop-blur-sm">
          {formatDuration(elapsedSeconds)} / ~{formatDuration(job.durationSeconds)}
        </div>
      </div>

      {/* Metadata */}
      <div className="grid grid-cols-2 gap-gutter text-on-surface-variant">
        <div className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Modèle</span>
          <span className="font-code text-code text-on-surface">
            {job.model} ({job.language})
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-label-sm text-label-sm uppercase tracking-wider text-outline">Début</span>
          <span className="font-code text-code text-on-surface">{formatTimeLabel(job.startedAt)}</span>
        </div>
      </div>

      {/* Notice */}
      <div className="mt-stack-sm flex items-center gap-3 p-4 bg-surface-container-low border border-surface-elevated rounded-lg text-on-surface-variant font-body-sm text-body-sm">
        <span className="material-symbols-outlined text-status-done text-xl">shield_lock</span>
        <div>
          <strong className="text-on-surface block mb-1">Traitement 100% Local</strong>
          L&apos;inférence s&apos;exécute directement sur votre matériel. Aucune donnée audio n&apos;est transmise
          sur le réseau.
        </div>
      </div>

      {/* Actions */}
      {canCancel && (
        <div className="flex justify-end pt-stack-sm">
          <button
            onClick={onCancel}
            disabled={isCancelling}
            className="px-4 py-2 font-code text-code text-error border border-error/30 rounded hover:bg-error/10 transition-colors disabled:opacity-50"
          >
            {isCancelling ? "Annulation..." : "Cancel Job"}
          </button>
        </div>
      )}
    </div>
  );
}
