import { Injectable } from '@nestjs/common';
import { JobStatus, Prisma, TranscriptionJob } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateJobData {
  id: string;
  filename: string;
  model: string;
  language: string;
  durationSeconds: number | null;
  /** Diarisation opt-in demandée à l'upload (défaut false — cf. ADR section 11). */
  diarizationEnabled?: boolean;
}

/**
 * Infrastructure — seul point d'accès Prisma pour l'entité `TranscriptionJob`.
 *
 * Partagé entre `HistoryModule` (consultation/suppression/export) et
 * `TranscriptionModule` (création, mise à jour de statut/progression),
 * conformément à la règle absolue CLAUDE.md : jamais d'accès Prisma
 * direct dans un service.
 */
@Injectable()
export class HistoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateJobData): Promise<TranscriptionJob> {
    return this.prisma.transcriptionJob.create({
      data: {
        id: data.id,
        filename: data.filename,
        model: data.model,
        language: data.language,
        durationSeconds: data.durationSeconds ?? undefined,
        status: JobStatus.PENDING,
        diarizationEnabled: data.diarizationEnabled ?? false,
      },
    });
  }

  findById(id: string): Promise<TranscriptionJob | null> {
    return this.prisma.transcriptionJob.findUnique({ where: { id } });
  }

  findAll(): Promise<TranscriptionJob[]> {
    return this.prisma.transcriptionJob.findMany({ orderBy: { createdAt: 'desc' } });
  }

  findAllByStatus(status: JobStatus): Promise<TranscriptionJob[]> {
    return this.prisma.transcriptionJob.findMany({ where: { status } });
  }

  markProcessing(id: string): Promise<TranscriptionJob> {
    return this.prisma.transcriptionJob.update({
      where: { id },
      data: { status: JobStatus.PROCESSING, startedAt: new Date() },
    });
  }

  updateProgress(id: string, progress: number): Promise<TranscriptionJob> {
    return this.prisma.transcriptionJob.update({
      where: { id },
      data: { progress },
    });
  }

  /**
   * `speakerSegments` est passé ici (plutôt que dans un update séparé après
   * coup) pour que le job ne passe à `DONE` qu'une fois la diarisation
   * (si demandée) déjà tentée — évite une course où le frontend arrête son
   * polling dès `DONE` avant que les locuteurs soient prêts (cf. ADR
   * section 11 : la diarisation ne doit jamais bloquer/échouer le job,
   * mais elle doit rester synchrone avec son passage à `DONE`).
   */
  markDone(
    id: string,
    resultText: string,
    resultSrt: string,
    speakerSegments?: Prisma.InputJsonValue | null,
  ): Promise<TranscriptionJob> {
    return this.prisma.transcriptionJob.update({
      where: { id },
      data: {
        status: JobStatus.DONE,
        resultText,
        resultSrt,
        progress: 100,
        completedAt: new Date(),
        ...(speakerSegments !== undefined
          ? { speakerSegments: speakerSegments ?? Prisma.JsonNull }
          : {}),
      },
    });
  }

  markFailed(id: string, errorMessage: string): Promise<TranscriptionJob> {
    return this.prisma.transcriptionJob.update({
      where: { id },
      data: {
        status: JobStatus.FAILED,
        errorMessage,
        completedAt: new Date(),
      },
    });
  }

  delete(id: string): Promise<TranscriptionJob> {
    return this.prisma.transcriptionJob.delete({ where: { id } });
  }

  /**
   * Enregistre les segments de locuteurs fusionnés (résultat de la
   * diarisation). N'est appelée que si le service de diarisation a répondu
   * avec succès — sinon `speakerSegments` reste `null` (cf. ADR section 11).
   */
  updateSpeakerSegments(
    id: string,
    speakerSegments: Prisma.InputJsonValue,
  ): Promise<TranscriptionJob> {
    return this.prisma.transcriptionJob.update({
      where: { id },
      data: { speakerSegments },
    });
  }
}
