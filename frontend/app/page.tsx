"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ApiError, fetchJobs } from "@/app/lib/api-client";
import type { TranscriptionJob } from "@/app/types/job";
import { formatDuration } from "@/app/lib/format";
import UploadForm from "@/app/components/UploadForm";
import StatusBadge from "@/app/components/StatusBadge";

const RECENT_COUNT = 3;

function RecentJobs() {
  const [jobs, setJobs] = useState<TranscriptionJob[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchJobs()
      .then((data) => {
        if (!cancelled) setJobs(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : "Impossible de charger l'historique.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const recent = (jobs ?? []).slice(0, RECENT_COUNT);

  return (
    <div className="mt-stack-md flex flex-col gap-stack-md">
      <div className="flex items-center justify-between">
        <h3 className="font-headline-sm text-headline-sm text-on-surface">Travaux Récents</h3>
        <Link
          href="/history"
          className="font-label-sm text-label-sm text-primary hover:text-primary-container transition-colors flex items-center gap-1"
        >
          Voir tout <span className="material-symbols-outlined text-base">arrow_forward</span>
        </Link>
      </div>

      <div className="bg-surface-card border border-surface-elevated rounded-xl overflow-hidden">
        {/* Chargement */}
        {isLoading && (
          <div className="flex flex-col gap-2 p-4 animate-pulse">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-12 w-full bg-surface-elevated rounded" />
            ))}
          </div>
        )}

        {/* Erreur */}
        {!isLoading && error && (
          <p className="p-4 font-body-sm text-body-sm text-status-failed">{error}</p>
        )}

        {/* Vide */}
        {!isLoading && !error && recent.length === 0 && (
          <p className="p-6 text-center font-body-sm text-body-sm text-on-surface-variant">
            Aucune transcription pour le moment — déposez un fichier ci-dessus pour commencer.
          </p>
        )}

        {/* Données */}
        {!isLoading && !error && recent.length > 0 && (
          <>
            <div className="grid grid-cols-12 gap-4 p-4 border-b border-surface-elevated font-label-sm text-label-sm text-on-surface-variant bg-surface-container-lowest">
              <div className="col-span-6 md:col-span-5">Fichier</div>
              <div className="hidden md:block col-span-3">Modèle</div>
              <div className="col-span-3 md:col-span-2">Durée</div>
              <div className="col-span-3 md:col-span-2 text-right">Statut</div>
            </div>
            <div className="flex flex-col">
              {recent.map((job) => (
                <Link
                  key={job.id}
                  href={`/jobs/${job.id}`}
                  className="grid grid-cols-12 gap-4 p-4 items-center border-b border-surface-elevated last:border-b-0 hover:bg-surface-container-lowest transition-colors"
                >
                  <div className="col-span-6 md:col-span-5 flex items-center gap-3">
                    <span className="material-symbols-outlined text-on-surface-variant">audio_file</span>
                    <span className="font-body-sm text-body-sm text-on-surface truncate">{job.filename}</span>
                  </div>
                  <div className="hidden md:block col-span-3 font-code text-code text-on-surface-variant">
                    {job.model} ({job.language})
                  </div>
                  <div className="col-span-3 md:col-span-2 font-code text-code text-on-surface-variant">
                    {formatDuration(job.durationSeconds)}
                  </div>
                  <div className="col-span-3 md:col-span-2 flex justify-end">
                    <StatusBadge status={job.status} progress={job.progress} />
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function UploadPage() {
  return (
    <main className="flex-1 flex flex-col z-10 relative">
      <div className="p-margin max-w-container-max mx-auto w-full flex-1 flex flex-col gap-stack-lg">
        <div className="flex flex-col gap-2">
          <h2 className="font-headline-lg text-headline-lg text-on-surface">Nouvelle Transcription</h2>
          <p className="font-body-md text-body-md text-on-surface-variant">
            Déposez un fichier audio ou vidéo. Le traitement s&apos;effectue localement sur votre machine.
          </p>
        </div>

        <UploadForm />
        <RecentJobs />
      </div>
    </main>
  );
}
