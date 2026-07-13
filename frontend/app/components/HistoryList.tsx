"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ApiError, cancelJob, deleteJob, fetchJobs } from "@/app/lib/api-client";
import type { JobStatus, TranscriptionJob } from "@/app/types/job";
import { formatDateLabel } from "@/app/lib/format";
import StatusBadge from "@/app/components/StatusBadge";

const PAGE_SIZE = 10;
const FILTERS: { value: JobStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tous" },
  { value: "PENDING", label: "En attente" },
  { value: "PROCESSING", label: "En cours" },
  { value: "DONE", label: "Terminé" },
  { value: "FAILED", label: "Échec" },
];

/** Table complète de l'historique — filtre par statut, pagination
 * client-side (l'API n'expose pas de pagination serveur dans le contrat
 * actuel) et actions contextuelles selon le statut. */
export default function HistoryList() {
  const [jobs, setJobs] = useState<TranscriptionJob[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<JobStatus | "ALL">("ALL");
  const [page, setPage] = useState(0);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchJobs();
      setJobs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible de charger l'historique.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredJobs = useMemo(() => {
    if (!jobs) return [];
    if (filter === "ALL") return jobs;
    return jobs.filter((j) => j.status === filter);
  }, [jobs, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE));
  const pageJobs = filteredJobs.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  async function handleCancel(id: string) {
    setPendingActionId(id);
    try {
      await cancelJob(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'annulation.");
    } finally {
      setPendingActionId(null);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("Supprimer définitivement cette transcription ?")) return;
    setPendingActionId(id);
    try {
      await deleteJob(id);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de la suppression.");
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <div className="w-full max-w-container-max mx-auto flex flex-col gap-stack-md">
      <div className="flex items-center gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => {
              setFilter(f.value);
              setPage(0);
            }}
            className={`font-label-sm text-label-sm px-3 py-1.5 rounded-full border transition-colors ${
              filter === f.value
                ? "bg-primary-container text-on-primary-container border-primary-container"
                : "border-surface-elevated text-on-surface-variant hover:border-outline-variant"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-surface-card border border-surface-elevated rounded-xl shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden">
        {/* Chargement */}
        {isLoading && (
          <div className="flex flex-col gap-2 p-6 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 w-full bg-surface-elevated rounded" />
            ))}
          </div>
        )}

        {/* Erreur */}
        {!isLoading && error && (
          <div className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="material-symbols-outlined text-status-failed text-3xl">error</span>
            <p className="font-body-md text-body-md text-on-surface">{error}</p>
            <button
              onClick={() => {
                setIsLoading(true);
                load();
              }}
              className="px-4 py-2 rounded bg-primary-container text-on-primary-container font-label-md text-label-md hover:opacity-90 transition-opacity"
            >
              Réessayer
            </button>
          </div>
        )}

        {/* Vide */}
        {!isLoading && !error && filteredJobs.length === 0 && (
          <div className="flex flex-col items-center gap-3 p-10 text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-3xl">inbox</span>
            <p className="font-body-md text-body-md">Aucune transcription pour ce filtre.</p>
            <Link href="/" className="font-label-sm text-label-sm text-primary hover:text-primary-container">
              Démarrer une nouvelle transcription
            </Link>
          </div>
        )}

        {/* Données */}
        {!isLoading && !error && filteredJobs.length > 0 && (
          <>
            <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 border-b border-surface-elevated bg-surface-dim font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              <div>Nom du fichier</div>
              <div>Statut</div>
              <div>Modèle</div>
              <div>Date</div>
              <div className="text-right">Actions</div>
            </div>
            <div className="flex flex-col">
              {pageJobs.map((job) => (
                <div
                  key={job.id}
                  className="flex flex-col border-b border-surface-elevated last:border-b-0 hover:bg-surface-container-low transition-colors group"
                >
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center">
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex items-center gap-3 font-code text-code text-on-surface hover:text-primary transition-colors truncate"
                    >
                      <span
                        className={`material-symbols-outlined text-xl ${
                          job.status === "DONE"
                            ? "text-status-done"
                            : job.status === "FAILED"
                              ? "text-status-failed"
                              : "text-status-processing animate-spin"
                        }`}
                        style={job.status !== "DONE" && job.status !== "FAILED" ? { animationDuration: "3s" } : undefined}
                      >
                        {job.status === "DONE" ? "audio_file" : job.status === "FAILED" ? "error" : "sync"}
                      </span>
                      <span className="truncate">{job.filename}</span>
                    </Link>
                    <div>
                      <StatusBadge status={job.status} progress={job.progress} />
                    </div>
                    <div className="font-code text-code text-on-surface-variant">
                      {job.model} ({job.language})
                    </div>
                    <div className="text-on-surface-variant font-body-sm">{formatDateLabel(job.createdAt)}</div>
                    <div className="flex items-center justify-end gap-2">
                      {job.status === "DONE" && (
                        <>
                          <Link
                            href={`/jobs/${job.id}`}
                            className="p-1.5 text-on-surface-variant hover:text-primary transition-colors rounded hover:bg-surface-variant"
                            title="Ouvrir le texte"
                          >
                            <span className="material-symbols-outlined text-xl">description</span>
                          </Link>
                          <button
                            onClick={() => handleDelete(job.id)}
                            disabled={pendingActionId === job.id}
                            className="p-1.5 text-on-surface-variant hover:text-error transition-colors rounded hover:bg-error-container/20 disabled:opacity-50"
                            title="Supprimer"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        </>
                      )}
                      {(job.status === "PENDING" || job.status === "PROCESSING") && (
                        <button
                          onClick={() => handleCancel(job.id)}
                          disabled={pendingActionId === job.id}
                          className="p-1.5 text-on-surface-variant hover:text-error transition-colors rounded hover:bg-error-container/20 disabled:opacity-50"
                          title="Annuler"
                        >
                          <span className="material-symbols-outlined text-xl">cancel</span>
                        </button>
                      )}
                      {job.status === "FAILED" && (
                        <>
                          <Link
                            href="/"
                            className="p-1.5 text-on-surface-variant hover:text-primary transition-colors rounded hover:bg-surface-variant"
                            title="Réessayer (nouvelle transcription)"
                          >
                            <span className="material-symbols-outlined text-xl">refresh</span>
                          </Link>
                          <button
                            onClick={() => handleDelete(job.id)}
                            disabled={pendingActionId === job.id}
                            className="p-1.5 text-on-surface-variant hover:text-error transition-colors rounded hover:bg-error-container/20 disabled:opacity-50"
                            title="Supprimer"
                          >
                            <span className="material-symbols-outlined text-xl">delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  {job.status === "FAILED" && job.errorMessage && (
                    <div className="px-6 pb-4 pt-1 ml-9">
                      <p className="font-code text-code text-status-failed bg-status-failed/5 p-2 rounded border border-status-failed/20 inline-block">
                        {job.errorMessage}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="px-6 py-4 border-t border-surface-elevated flex items-center justify-between text-on-surface-variant font-body-sm text-body-sm bg-surface-dim">
              <span>
                Affichage {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filteredJobs.length)} sur{" "}
                {filteredJobs.length} transcriptions
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="p-1 border border-outline-variant rounded hover:text-on-surface hover:border-surface-elevated disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="p-1 border border-outline-variant rounded hover:text-on-surface hover:border-surface-elevated disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
