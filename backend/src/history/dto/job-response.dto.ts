import { TranscriptionJob } from '@prisma/client';

/**
 * DTO de sortie — statut détaillé d'un job (`GET /jobs/:id`).
 * Ne jamais exposer directement le modèle Prisma (cf. règle DTO).
 */
export class JobResponseDto {
  id!: string;
  filename!: string;
  status!: string;
  model!: string;
  language!: string;
  durationSeconds!: number | null;
  progress!: number;
  resultText!: string | null;
  resultSrt!: string | null;
  errorMessage!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  startedAt!: Date | null;
  completedAt!: Date | null;
  /** Diarisation opt-in demandée à l'upload (cf. ADR section 11). */
  diarizationEnabled!: boolean;
  /** `null` tant que la diarisation n'a pas réussi (best-effort, jamais bloquant). */
  speakerSegments!: unknown;

  static fromEntity(job: TranscriptionJob): JobResponseDto {
    const dto = new JobResponseDto();
    dto.id = job.id;
    dto.filename = job.filename;
    dto.status = job.status;
    dto.model = job.model;
    dto.language = job.language;
    dto.durationSeconds = job.durationSeconds;
    dto.progress = job.progress;
    dto.resultText = job.resultText;
    dto.resultSrt = job.resultSrt;
    dto.errorMessage = job.errorMessage;
    dto.createdAt = job.createdAt;
    dto.updatedAt = job.updatedAt;
    dto.startedAt = job.startedAt;
    dto.completedAt = job.completedAt;
    dto.diarizationEnabled = job.diarizationEnabled;
    dto.speakerSegments = job.speakerSegments;
    return dto;
  }
}

/**
 * DTO de sortie — élément de liste (`GET /jobs`).
 * Volontairement allégé : n'expose pas `resultText`/`resultSrt` qui
 * peuvent être volumineux et sont inutiles dans une vue historique.
 */
export class JobListItemDto {
  id!: string;
  filename!: string;
  status!: string;
  model!: string;
  language!: string;
  durationSeconds!: number | null;
  progress!: number;
  errorMessage!: string | null;
  createdAt!: Date;
  updatedAt!: Date;
  diarizationEnabled!: boolean;

  static fromEntity(job: TranscriptionJob): JobListItemDto {
    const dto = new JobListItemDto();
    dto.id = job.id;
    dto.filename = job.filename;
    dto.status = job.status;
    dto.model = job.model;
    dto.language = job.language;
    dto.durationSeconds = job.durationSeconds;
    dto.progress = job.progress;
    dto.errorMessage = job.errorMessage;
    dto.createdAt = job.createdAt;
    dto.updatedAt = job.updatedAt;
    dto.diarizationEnabled = job.diarizationEnabled;
    return dto;
  }
}
