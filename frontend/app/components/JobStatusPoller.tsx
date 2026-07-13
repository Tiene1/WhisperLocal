"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ApiError, cancelJob, fetchJob } from "@/app/lib/api-client";
import type { TranscriptionJob } from "@/app/types/job";
import ProcessingView from "@/app/components/ProcessingView";
import TranscriptionResult from "@/app/components/TranscriptionResult";

const POLL_INTERVAL_MS = 4000;
const TERMINAL_STATUSES = new Set(["DONE", "FAILED"]);

interface JobStatusPollerProps {
  jobId: string;
}

/** Interroge GET /jobs/:id à intervalle régulier (polling REST — jamais de
 * WebSocket/SSE, cf. CLAUDE.md) et bascule vers la bonne vue selon le
 * statut. Le polling s'arrête dès qu'un statut terminal est atteint. */
export default function JobStatusPoller({ jobId }: JobStatusPollerProps) {
  const [job, setJob] = useState<TranscriptionJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const loadJob = useCallback(async () => {
    try {
      const data = await fetchJob(jobId);
      setJob(data);
      setError(null);
      if (TERMINAL_STATUSES.has(data.status)) {
        stopPolling();
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de récupérer le statut du job.");
    } finally {
      setIsLoading(false);
    }
  }, [jobId, stopPolling]);

  useEffect(() => {
    loadJob();
    intervalRef.current = setInterval(loadJob, POLL_INTERVAL_MS);
    return () => stopPolling();
  }, [loadJob, stopPolling]);

  async function handleCancel() {
    if (!job || isCancelling) return;
    setIsCancelling(true);
    try {
      await cancelJob(job.id);
      await loadJob();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'annulation.");
    } finally {
      setIsCancelling(false);
    }
  }

  // État Chargement (skeleton)
  if (isLoading && !job) {
    return (
      <div className="w-full max-w-175 bg-surface-card border border-surface-elevated rounded-xl p-stack-lg flex flex-col gap-stack-md animate-pulse">
        <div className="h-6 w-2/3 bg-surface-elevated rounded" />
        <div className="h-32 w-full bg-surface-elevated rounded-lg" />
        <div className="h-4 w-1/3 bg-surface-elevated rounded" />
      </div>
    );
  }

  // État Erreur (retry)
  if (error && !job) {
    return (
      <div className="w-full max-w-125 bg-surface-card border border-status-failed/30 rounded-xl p-stack-lg flex flex-col gap-4 items-center text-center">
        <span className="material-symbols-outlined text-status-failed text-3xl">error</span>
        <p className="font-body-md text-body-md text-on-surface">{error}</p>
        <button
          onClick={() => {
            setIsLoading(true);
            loadJob();
          }}
          className="px-4 py-2 rounded bg-primary-container text-on-primary-container font-label-md text-label-md hover:opacity-90 transition-opacity"
        >
          Réessayer
        </button>
      </div>
    );
  }

  // Job introuvable (ne devrait pas arriver hors 404) — état vide défensif
  if (!job) {
    return (
      <div className="w-full max-w-125 text-center text-on-surface-variant font-body-md text-body-md">
        Aucune donnée pour ce job.
      </div>
    );
  }

  if (job.status === "DONE") {
    return <TranscriptionResult job={job} />;
  }

  if (job.status === "FAILED") {
    return (
      <div className="w-full max-w-175 bg-surface-card border border-status-failed/30 rounded-xl p-stack-lg flex flex-col gap-stack-md">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-status-failed text-3xl">error</span>
          <div>
            <h1 className="font-headline-md text-headline-md text-on-surface">Échec de la transcription</h1>
            <p className="font-code text-code text-on-surface-variant">{job.filename}</p>
          </div>
        </div>
        <p className="font-code text-code text-status-failed bg-status-failed/5 p-3 rounded border border-status-failed/20">
          {job.errorMessage ?? "Une erreur inconnue est survenue."}
        </p>
        <div className="flex justify-end gap-3">
          <Link
            href="/history"
            className="px-4 py-2 font-label-md text-label-md text-on-surface-variant border border-surface-elevated rounded hover:border-outline-variant transition-colors"
          >
            Retour à l&apos;historique
          </Link>
          <Link
            href="/"
            className="px-4 py-2 font-label-md text-label-md bg-primary-container text-on-primary-container rounded hover:opacity-90 transition-opacity"
          >
            Nouvelle transcription
          </Link>
        </div>
      </div>
    );
  }

  return <ProcessingView job={job} onCancel={handleCancel} isCancelling={isCancelling} />;
}
