"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ApiError, MAX_UPLOAD_SIZE_BYTES, uploadAudio } from "@/app/lib/api-client";
import type { JobLanguage, ModelSize } from "@/app/types/job";
import ModelSelector from "@/app/components/ModelSelector";
import LanguageSelector from "@/app/components/LanguageSelector";

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} Mo`;
}

/** Zone de dépôt + réglages modèle/langue + soumission vers POST /uploads. */
export default function UploadForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [model, setModel] = useState<ModelSize>("medium");
  const [language, setLanguage] = useState<JobLanguage>("fr");
  const [diarizationEnabled, setDiarizationEnabled] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function validateAndSetFile(candidate: File | null) {
    setError(null);
    if (!candidate) return;

    if (candidate.size > MAX_UPLOAD_SIZE_BYTES) {
      setError(
        `"${candidate.name}" dépasse la taille maximale autorisée (250 Mo, fichier de ${formatBytes(candidate.size)}).`,
      );
      setFile(null);
      return;
    }

    setFile(candidate);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragActive(false);
    validateAndSetFile(e.dataTransfer.files?.[0] ?? null);
  }

  async function handleSubmit() {
    if (!file || isUploading) return;
    setIsUploading(true);
    setError(null);
    try {
      const { jobId } = await uploadAudio(file, model, language, diarizationEnabled);
      router.push(`/jobs/${jobId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Échec de l'envoi du fichier. Réessayez.");
      setIsUploading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
      {/* Zone Drag & Drop */}
      <div className="lg:col-span-2 bg-surface-card rounded-xl border border-surface-elevated p-1 overflow-hidden group">
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragActive(true);
          }}
          onDragLeave={() => setIsDragActive(false)}
          onDrop={handleDrop}
          className={`w-full h-64 sm:h-80 upload-dashed rounded-lg flex flex-col items-center justify-center p-stack-lg relative cursor-pointer ${
            isDragActive ? "upload-dashed-active" : ""
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="audio/*,video/mp4,.mp3,.wav,.m4a,.mp4"
            className="hidden"
            onChange={(e) => validateAndSetFile(e.target.files?.[0] ?? null)}
          />
          <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center mb-4 group-hover:bg-primary-container group-hover:text-on-primary-container transition-colors duration-300">
            <span className="material-symbols-outlined text-3xl text-on-surface-variant group-hover:text-on-primary-container">
              cloud_upload
            </span>
          </div>
          {file ? (
            <>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2 text-center break-all px-4">
                {file.name}
              </h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant text-center">
                {formatBytes(file.size)} — cliquez pour changer de fichier
              </p>
            </>
          ) : (
            <>
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-2">Glissez &amp; Déposez</h3>
              <p className="font-body-sm text-body-sm text-on-surface-variant text-center max-w-xs">
                MP3, WAV, M4A, MP4 supportés.
              </p>
            </>
          )}
          <div className="mt-stack-md flex gap-4">
            <span className="font-label-sm text-label-sm text-status-pending px-3 py-1 bg-surface-container rounded-full border border-surface-elevated">
              Max 250Mo
            </span>
            <span className="font-label-sm text-label-sm text-status-pending px-3 py-1 bg-surface-container rounded-full border border-surface-elevated">
              Max 3h
            </span>
          </div>
        </div>
      </div>

      {/* Réglages */}
      <div className="lg:col-span-1 bg-surface-card rounded-xl border border-surface-elevated p-stack-md flex flex-col gap-stack-md">
        <h3 className="font-headline-sm text-headline-sm text-on-surface border-b border-surface-elevated pb-2">
          Paramètres du Modèle
        </h3>
        <div className="space-y-4 flex-1">
          <ModelSelector value={model} onChange={setModel} disabled={isUploading} />
          <LanguageSelector value={language} onChange={setLanguage} disabled={isUploading} />

          {/* Diarisation opt-in — expérimentale, désactivée par défaut
              (cf. ADR section 11 : ajoute du temps de traitement, dépend
              d'un service de diarisation séparé qui peut être indisponible). */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 p-2 border border-surface-elevated rounded-lg bg-bg-base cursor-pointer hover:border-primary transition-colors">
              <input
                checked={diarizationEnabled}
                disabled={isUploading}
                onChange={(e) => setDiarizationEnabled(e.target.checked)}
                className="rounded border-surface-elevated bg-surface text-primary focus:ring-primary focus:ring-offset-bg-base"
                type="checkbox"
              />
              <span className="font-body-sm text-body-sm text-on-surface">Identifier les locuteurs</span>
            </label>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              Fonctionnalité expérimentale — augmente le temps de traitement.
            </p>
          </div>

          {/* Cases décoratives — le backend génère toujours TXT + SRT,
              aucune logique conditionnelle n'est câblée ici (cf. CLAUDE.md règle 5). */}
          <div className="flex flex-col gap-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant">Format de Sortie</label>
            <div className="flex gap-2">
              <label className="flex items-center gap-2 p-2 border border-surface-elevated rounded-lg bg-bg-base cursor-pointer hover:border-primary transition-colors flex-1">
                <input
                  defaultChecked
                  disabled
                  className="rounded border-surface-elevated bg-surface text-primary focus:ring-primary focus:ring-offset-bg-base"
                  type="checkbox"
                />
                <span className="font-code text-code text-on-surface">TXT</span>
              </label>
              <label className="flex items-center gap-2 p-2 border border-surface-elevated rounded-lg bg-bg-base cursor-pointer hover:border-primary transition-colors flex-1">
                <input
                  defaultChecked
                  disabled
                  className="rounded border-surface-elevated bg-surface text-primary focus:ring-primary focus:ring-offset-bg-base"
                  type="checkbox"
                />
                <span className="font-code text-code text-on-surface">SRT</span>
              </label>
            </div>
          </div>
        </div>

        {error && (
          <p className="font-body-sm text-body-sm text-status-failed bg-status-failed/10 border border-status-failed/20 rounded-lg p-3">
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!file || isUploading}
          className="w-full bg-primary-container text-on-primary-container py-3 px-4 rounded-lg font-label-md text-label-md font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <>
              <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
              Envoi en cours...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-lg">graphic_eq</span>
              Démarrer la transcription
            </>
          )}
        </button>
      </div>
    </div>
  );
}
