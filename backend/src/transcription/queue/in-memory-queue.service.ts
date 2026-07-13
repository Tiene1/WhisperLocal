import { Injectable, Logger } from '@nestjs/common';
import { TranscriptionJobEntity } from '../domain/transcription-job.entity';

export type QueueProcessor = (job: TranscriptionJobEntity) => Promise<void>;

/**
 * Infrastructure — file d'attente FIFO en mémoire, concurrence = 1.
 *
 * Pas de Redis/BullMQ (cf. ADR + CLAUDE.md règle 2) : un simple tableau
 * en mémoire suffit pour un usage mono-utilisateur sur une seule machine.
 * L'état de la file est perdu au redémarrage — cf. nettoyage au boot
 * (CLAUDE.md règle 3), géré par `TranscriptionService`.
 */
@Injectable()
export class InMemoryQueueService {
  private readonly logger = new Logger(InMemoryQueueService.name);

  private readonly pendingJobs: TranscriptionJobEntity[] = [];
  private currentJob: TranscriptionJobEntity | null = null;
  private processor: QueueProcessor | null = null;
  private isProcessing = false;

  /** Enregistre la fonction appelée pour traiter chaque job dépilé. */
  setProcessor(processor: QueueProcessor): void {
    this.processor = processor;
  }

  enqueue(job: TranscriptionJobEntity): void {
    this.pendingJobs.push(job);
    this.logger.log(`Job ${job.id} ajouté à la file (${this.pendingJobs.length} en attente)`);
    void this.processNext();
  }

  /**
   * Retire un job encore en attente (jamais démarré) de la file.
   * Retourne le job retiré, ou `null` s'il n'était pas en attente.
   */
  removePending(jobId: string): TranscriptionJobEntity | null {
    const index = this.pendingJobs.findIndex((job) => job.id === jobId);
    if (index === -1) {
      return null;
    }
    const [removed] = this.pendingJobs.splice(index, 1);
    return removed;
  }

  /** Retourne le job actuellement en cours de traitement, s'il y en a un. */
  getCurrentJob(): TranscriptionJobEntity | null {
    return this.currentJob;
  }

  isJobPending(jobId: string): boolean {
    return this.pendingJobs.some((job) => job.id === jobId);
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.pendingJobs.length === 0 || !this.processor) {
      return;
    }

    this.isProcessing = true;
    const job = this.pendingJobs.shift()!;
    this.currentJob = job;

    try {
      await this.processor(job);
    } catch (error) {
      // Le processor (TranscriptionService) gère déjà la persistance de
      // l'échec — on se contente de logger ici pour éviter une promesse
      // rejetée non gérée.
      this.logger.error(`Job ${job.id} terminé avec une erreur : ${(error as Error).message}`);
    } finally {
      this.currentJob = null;
      this.isProcessing = false;
      void this.processNext();
    }
  }
}
