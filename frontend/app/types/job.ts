// Types partagés — miroir exact des DTOs exposés par l'API NestJS
// (voir backend/docs/architecture.md, section "Contrat API" et schéma Prisma).

/** Les 4 seuls statuts visuels exposés par l'API. Une annulation aboutit à
 * FAILED (avec errorMessage dédié) — pas de statut CANCELLED distinct. */
export type JobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

/** Modèles Whisper supportés (medium = défaut backend). */
export type ModelSize = "base" | "small" | "medium" | "large";

/** Langues supportées côté sélecteur d'upload. */
export type JobLanguage = "auto" | "fr" | "en" | "es";

/** Formats d'export disponibles sur l'écran résultat. */
export type ExportFormat = "txt" | "srt" | "docx";

/** Segment attribué à un locuteur — résultat de la fusion whisper.cpp/pyannote
 * par recouvrement temporel (cf. ADR section 11). `speaker` est un label
 * opaque (ex. "SPEAKER_00"), sans garantie de stabilité entre jobs. */
export interface SpeakerSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionJob {
  id: string;
  filename: string;
  status: JobStatus;
  model: string;
  language: string;
  /** Durée totale de l'audio, en secondes — connue dès l'upload (ffprobe). */
  durationSeconds: number | null;
  /** Progression best-effort (0-100). Reste à 0 si whisper.cpp n'expose pas
   * l'info sur ce build — ne jamais l'afficher comme une mesure fiable. */
  progress: number;
  /** Rempli uniquement si status === "DONE". */
  resultText: string | null;
  /** Rempli uniquement si status === "FAILED" (échec réel ou annulation). */
  errorMessage: string | null;
  /** Diarisation opt-in demandée à l'upload (cf. ADR section 11). */
  diarizationEnabled: boolean;
  /** `null` si la diarisation n'a pas été demandée, ou si le service était
   * indisponible/a échoué — jamais une erreur, juste une info absente
   * (même philosophie que `progress` best-effort). */
  speakerSegments: SpeakerSegment[] | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface UploadResponse {
  jobId: string;
}
