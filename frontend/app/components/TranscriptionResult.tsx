"use client";

import { useState } from "react";
import Link from "next/link";
import type { TranscriptionJob } from "@/app/types/job";
import { getExportUrl } from "@/app/lib/api-client";
import { formatDateLabel, formatDuration } from "@/app/lib/format";
import StatusBadge from "@/app/components/StatusBadge";

interface TranscriptionResultProps {
  job: TranscriptionJob;
}

/** Palette de badges locuteur — couleurs déjà présentes dans le design
 * system (tailwind.config.ts), réutilisées ici pour rester cohérent. */
const SPEAKER_COLORS = [
  "bg-primary-container text-on-primary-container",
  "bg-secondary-container text-on-secondary-container",
  "bg-tertiary-container text-on-tertiary-container",
  "bg-status-done text-white",
  "bg-status-processing text-white",
  "bg-status-failed text-white",
];

/** Hash simple et déterministe (label -> index de palette) — même locuteur
 * = même couleur sur tout l'affichage, sans état ni dépendance à l'ordre. */
function speakerColorClass(speaker: string): string {
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) {
    hash = (hash * 31 + speaker.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % SPEAKER_COLORS.length;
  return SPEAKER_COLORS[index];
}

interface SpeakerBlock {
  speaker: string;
  text: string;
}

/** Regroupe les segments consécutifs du même locuteur en un seul bloc de
 * texte (cf. mission : "Locuteur X" au-dessus de chaque bloc consécutif). */
function groupBySpeaker(segments: TranscriptionJob["speakerSegments"]): SpeakerBlock[] {
  if (!segments || segments.length === 0) return [];
  const blocks: SpeakerBlock[] = [];
  for (const segment of segments) {
    const last = blocks[blocks.length - 1];
    if (last && last.speaker === segment.speaker) {
      last.text = `${last.text} ${segment.text}`.trim();
    } else {
      blocks.push({ speaker: segment.speaker, text: segment.text });
    }
  }
  return blocks;
}

/** Écran "Résultat" (statut DONE) — texte transcrit + exports + copier. */
export default function TranscriptionResult({ job }: TranscriptionResultProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!job.resultText) return;
    try {
      await navigator.clipboard.writeText(job.resultText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé, permissions...) —
      // on ignore silencieusement, ce n'est pas bloquant.
    }
  }

  const paragraphs = (job.resultText ?? "").split(/\n{2,}/).filter(Boolean);
  const speakerBlocks = groupBySpeaker(job.speakerSegments);
  const hasSpeakerBlocks = speakerBlocks.length > 0;
  const diarizationUnavailable = job.diarizationEnabled && !job.speakerSegments;

  return (
    <div className="max-w-container-max mx-auto w-full px-gutter md:px-margin py-stack-lg flex-1 flex flex-col">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-stack-lg gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Link href="/history" className="text-on-surface-variant hover:text-primary transition-colors flex items-center">
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </Link>
            <h2 className="font-headline-lg text-headline-lg text-on-surface break-all">{job.filename}</h2>
            <StatusBadge status={job.status} />
          </div>
          <p className="font-body-sm text-body-sm text-on-surface-variant flex flex-wrap gap-4">
            <span>Modèle: {job.model}</span>
            <span>•</span>
            <span>Durée: {formatDuration(job.durationSeconds)}</span>
            <span>•</span>
            <span>Achevé le {formatDateLabel(job.completedAt)}</span>
          </p>
        </div>

        {/* Export Actions — 3 boutons distincts (cf. CLAUDE.md règle 7) */}
        <div className="flex gap-3">
          <a
            href={getExportUrl(job.id, "srt")}
            className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md px-4 py-2 border border-surface-elevated rounded hover:border-outline-variant transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">subtitles</span>
            SRT
          </a>
          <a
            href={getExportUrl(job.id, "docx")}
            className="text-on-surface-variant hover:text-on-surface font-label-md text-label-md px-4 py-2 border border-surface-elevated rounded hover:border-outline-variant transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">description</span>
            DOCX
          </a>
          <a
            href={getExportUrl(job.id, "txt")}
            className="bg-primary text-on-primary font-label-md text-label-md px-4 py-2 rounded hover:bg-primary-container transition-colors flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-lg">download</span>
            Télécharger TXT
          </a>
        </div>
      </div>

      {/* Transcription Canvas */}
      <div className="bg-surface-card border border-surface-elevated rounded-lg flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-surface-elevated px-stack-md py-3 flex justify-between items-center bg-surface">
          <span className="font-label-md text-label-md text-on-surface-variant">Texte transcrit</span>
          <button
            onClick={handleCopy}
            className="text-on-surface-variant hover:text-on-surface flex items-center gap-2 font-label-sm text-label-sm transition-colors"
          >
            <span className="material-symbols-outlined text-base">
              {copied ? "check" : "content_copy"}
            </span>
            {copied ? "Copié !" : "Copier"}
          </button>
        </div>
        <div className="p-stack-lg overflow-y-auto flex-1 font-body-lg text-body-lg text-on-surface leading-relaxed">
          {diarizationUnavailable && (
            <p className="mb-4 font-body-sm text-body-sm text-on-surface-variant italic">
              Identification des locuteurs non disponible pour cette transcription.
            </p>
          )}
          {hasSpeakerBlocks ? (
            speakerBlocks.map((block, i) => (
              <div key={i} className="mb-4 last:mb-0">
                <span
                  className={`inline-block mb-1 font-label-sm text-label-sm px-2 py-0.5 rounded-full ${speakerColorClass(block.speaker)}`}
                >
                  Locuteur {block.speaker}
                </span>
                <p>{block.text}</p>
              </div>
            ))
          ) : paragraphs.length > 0 ? (
            paragraphs.map((p, i) => (
              <p key={i} className="mb-4 last:mb-0">
                {p}
              </p>
            ))
          ) : (
            <p className="text-on-surface-variant italic">Aucun texte transcrit disponible.</p>
          )}
        </div>
      </div>
    </div>
  );
}
