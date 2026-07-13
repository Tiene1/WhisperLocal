import { ConflictException, Injectable, Logger, NotFoundException, OnApplicationBootstrap } from '@nestjs/common';
import { JobStatus as PrismaJobStatus, Prisma } from '@prisma/client';
import { unlink } from 'fs/promises';
import { HistoryRepository } from '../history/history.repository';
import { JobResponseDto } from '../history/dto/job-response.dto';
import {
  CANCELLED_BY_USER_MESSAGE,
  INTERRUPTED_BY_RESTART_MESSAGE,
  JobStatus,
  TranscriptionJobEntity,
  WhisperLanguageCode,
  WhisperModelName,
} from './domain/transcription-job.entity';
import { JobCancelledError } from './errors/job-cancelled.error';
import { DiarizationProvider } from './engine/diarization.provider';
import { mergeSpeakerSegments } from './engine/speaker-merge';
import { WhisperCppProvider } from './engine/whisper-cpp.provider';
import { InMemoryQueueService } from './queue/in-memory-queue.service';

export interface EnqueueTranscriptionParams {
  jobId: string;
  wavFilePath: string;
  model: WhisperModelName;
  language: WhisperLanguageCode;
  /** Diarisation opt-in demandée à l'upload (défaut false — cf. ADR section 11). */
  diarizationEnabled?: boolean;
}

/**
 * Application — orchestration de la file de transcription et de
 * l'annulation. Aucun accès Prisma direct : tout passe par
 * `HistoryRepository`.
 */
@Injectable()
export class TranscriptionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TranscriptionService.name);

  constructor(
    private readonly queue: InMemoryQueueService,
    private readonly whisperCppProvider: WhisperCppProvider,
    private readonly historyRepository: HistoryRepository,
    private readonly diarizationProvider: DiarizationProvider,
  ) {
    this.queue.setProcessor((job) => this.processJob(job));
  }

  /**
   * Nettoyage au démarrage (CLAUDE.md règle 3 / ADR Risque 3) : tout job
   * resté `PROCESSING` suite à un arrêt brutal du serveur repasse à
   * `FAILED`. La file en mémoire étant vide au boot, aucun subprocess
   * n'est réellement actif — il s'agit uniquement de corriger l'état
   * persisté en base.
   */
  async onApplicationBootstrap(): Promise<void> {
    const orphanedJobs = await this.historyRepository.findAllByStatus(PrismaJobStatus.PROCESSING);
    for (const job of orphanedJobs) {
      await this.historyRepository.markFailed(job.id, INTERRUPTED_BY_RESTART_MESSAGE);
      this.logger.warn(`Job ${job.id} marqué FAILED (interrompu par un redémarrage du serveur)`);
    }
  }

  enqueue(params: EnqueueTranscriptionParams): void {
    const job = new TranscriptionJobEntity({
      id: params.jobId,
      wavFilePath: params.wavFilePath,
      model: params.model,
      language: params.language,
      status: JobStatus.PENDING,
      diarizationEnabled: params.diarizationEnabled,
    });
    this.queue.enqueue(job);
  }

  async getJobStatus(id: string): Promise<JobResponseDto> {
    const job = await this.historyRepository.findById(id);
    if (!job) {
      throw new NotFoundException(`Job ${id} introuvable`);
    }
    return JobResponseDto.fromEntity(job);
  }

  /**
   * Annule un job `PENDING` (retrait de file) ou `PROCESSING` (kill du
   * subprocess whisper.cpp). Cf. CLAUDE.md règle 8 / ADR Risque 7.
   */
  async cancelJob(id: string): Promise<void> {
    const pendingJob = this.queue.removePending(id);
    if (pendingJob) {
      await this.historyRepository.markFailed(id, CANCELLED_BY_USER_MESSAGE);
      await this.deleteWavFileSafely(pendingJob.wavFilePath);
      return;
    }

    const currentJob = this.queue.getCurrentJob();
    if (currentJob && currentJob.id === id) {
      // Le kill déclenche une JobCancelledError capturée par `processJob`,
      // qui se charge lui-même de la mise à jour DB et du nettoyage fichier.
      await this.whisperCppProvider.kill(id);
      return;
    }

    const job = await this.historyRepository.findById(id);
    if (!job) {
      throw new NotFoundException(`Job ${id} introuvable`);
    }
    throw new ConflictException(
      `Le job ${id} n'est plus annulable (statut actuel : ${job.status})`,
    );
  }

  /** Processor branché sur la file — appelé pour chaque job dépilé. */
  private async processJob(job: TranscriptionJobEntity): Promise<void> {
    await this.historyRepository.markProcessing(job.id);

    try {
      const result = await this.whisperCppProvider.transcribe({
        jobId: job.id,
        wavFilePath: job.wavFilePath,
        model: job.model,
        language: job.language,
        onProgress: (percent) => {
          // Best-effort (CLAUDE.md règle 9) — on ne bloque jamais le
          // traitement si la mise à jour de progression échoue.
          this.historyRepository.updateProgress(job.id, percent).catch((error) => {
            this.logger.debug(`Échec mise à jour progression job ${job.id} : ${error.message}`);
          });
        },
      });

      // Diarisation AVANT le passage à `DONE` (pas après) : sinon le job
      // apparaît "terminé" côté frontend, qui arrête son polling, avant que
      // les locuteurs soient prêts — l'info arrive alors trop tard pour
      // être affichée (course observée en test réel). Reste néanmoins
      // jamais bloquant : un échec de diarisation n'empêche pas `markDone`
      // (cf. ADR section 11), seul `speakerSegments` reste `null`.
      const speakerSegments = job.diarizationEnabled
        ? await this.tryDiarize(job.id, job.wavFilePath, result.srt)
        : null;

      await this.historyRepository.markDone(job.id, result.text, result.srt, speakerSegments);

      await this.deleteWavFileSafely(job.wavFilePath);
    } catch (error) {
      if (error instanceof JobCancelledError) {
        await this.historyRepository.markFailed(job.id, CANCELLED_BY_USER_MESSAGE);
        await this.deleteWavFileSafely(job.wavFilePath);
        return;
      }

      // Échec réel : le fichier audio (WAV) est conservé pour permettre
      // un diagnostic / nouvel essai (CLAUDE.md règle 1 / ADR Risque 1).
      const message = (error as Error).message;
      await this.historyRepository.markFailed(job.id, message);
      this.logger.error(`Job ${job.id} en échec : ${message}`);
    }
  }

  /**
   * Tente la diarisation d'un job réussi et fusionne le résultat avec les
   * cues SRT. N'échoue jamais bruyamment : le service de diarisation étant
   * lui-même best-effort (retourne `null` sur toute erreur), une erreur de
   * fusion est simplement loguée en warning et `null` est renvoyé — le
   * job reste `DONE` avec `speakerSegments` à `null` (cf. ADR section 11).
   * La persistance elle-même est déléguée à l'appelant (`markDone`), pour
   * que le job ne passe à `DONE` qu'une fois ce résultat déjà disponible.
   */
  private async tryDiarize(
    jobId: string,
    wavFilePath: string,
    srt: string,
  ): Promise<Prisma.InputJsonValue | null> {
    const segments = await this.diarizationProvider.diarize(wavFilePath);
    if (!segments) {
      return null;
    }

    try {
      return mergeSpeakerSegments(srt, segments) as unknown as Prisma.InputJsonValue;
    } catch (error) {
      this.logger.warn(
        `Fusion des locuteurs impossible pour le job ${jobId} : ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async deleteWavFileSafely(wavFilePath: string): Promise<void> {
    try {
      await unlink(wavFilePath);
    } catch (error) {
      this.logger.warn(`Impossible de supprimer le fichier WAV ${wavFilePath} : ${(error as Error).message}`);
    }
  }
}
