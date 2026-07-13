/**
 * Domaine — WhisperLocal
 *
 * Entité pure, sans dépendance à Prisma ni à NestJS (`@nestjs/common`),
 * conformément aux règles absolues de CLAUDE.md.
 *
 * Représente l'état d'exécution *en mémoire* d'un job de transcription
 * pendant qu'il transite dans la file d'attente / le moteur whisper.cpp.
 * La persistance (statut, résultat...) est gérée séparément par
 * `HistoryRepository` (couche infrastructure) via le modèle Prisma
 * `TranscriptionJob`.
 */

export enum WhisperModelName {
  BASE = 'base',
  SMALL = 'small',
  MEDIUM = 'medium',
  LARGE = 'large',
}

export enum WhisperLanguageCode {
  AUTO = 'auto',
  FR = 'fr',
  EN = 'en',
  ES = 'es',
}

export enum JobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  DONE = 'DONE',
  FAILED = 'FAILED',
}

export const CANCELLED_BY_USER_MESSAGE = 'Annulé par l\'utilisateur';
export const INTERRUPTED_BY_RESTART_MESSAGE = 'Interrompu par un redémarrage du serveur';

export interface TranscriptionJobProps {
  id: string;
  /** Chemin absolu du fichier WAV converti (16kHz mono), utilisé par whisper.cpp. */
  wavFilePath: string;
  model: WhisperModelName;
  language: WhisperLanguageCode;
  status: JobStatus;
  /** Diarisation demandée à l'upload (opt-in, défaut false — cf. ADR section 11). */
  diarizationEnabled?: boolean;
}

/**
 * Entité métier représentant un job de transcription en cours de vie
 * dans la file d'attente en mémoire. Porte les règles de transition
 * de statut valides.
 */
export class TranscriptionJobEntity {
  readonly id: string;
  readonly wavFilePath: string;
  readonly model: WhisperModelName;
  readonly language: WhisperLanguageCode;
  readonly diarizationEnabled: boolean;
  private _status: JobStatus;

  constructor(props: TranscriptionJobProps) {
    this.id = props.id;
    this.wavFilePath = props.wavFilePath;
    this.model = props.model;
    this.language = props.language;
    this.diarizationEnabled = props.diarizationEnabled ?? false;
    this._status = props.status;
  }

  get status(): JobStatus {
    return this._status;
  }

  /** Un job peut être annulé tant qu'il n'est pas déjà terminé. */
  isCancellable(): boolean {
    return this._status === JobStatus.PENDING || this._status === JobStatus.PROCESSING;
  }

  markProcessing(): void {
    if (this._status !== JobStatus.PENDING) {
      throw new Error(
        `Transition invalide : impossible de passer de ${this._status} à ${JobStatus.PROCESSING}`,
      );
    }
    this._status = JobStatus.PROCESSING;
  }

  markDone(): void {
    if (this._status !== JobStatus.PROCESSING) {
      throw new Error(
        `Transition invalide : impossible de passer de ${this._status} à ${JobStatus.DONE}`,
      );
    }
    this._status = JobStatus.DONE;
  }

  markFailed(): void {
    this._status = JobStatus.FAILED;
  }
}
