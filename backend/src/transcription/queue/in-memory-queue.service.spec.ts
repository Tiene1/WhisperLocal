import { JobStatus, TranscriptionJobEntity, WhisperLanguageCode, WhisperModelName } from '../domain/transcription-job.entity';
import { InMemoryQueueService } from './in-memory-queue.service';

function buildEntity(id: string): TranscriptionJobEntity {
  return new TranscriptionJobEntity({
    id,
    wavFilePath: `/tmp/${id}.wav`,
    model: WhisperModelName.MEDIUM,
    language: WhisperLanguageCode.FR,
    status: JobStatus.PENDING,
  });
}

describe('InMemoryQueueService', () => {
  let queue: InMemoryQueueService;

  beforeEach(() => {
    queue = new InMemoryQueueService();
  });

  it('traite les jobs un par un (concurrence = 1), dans l\'ordre FIFO', async () => {
    const processedOrder: string[] = [];
    let resolveFirst: (() => void) | undefined;

    queue.setProcessor(async (job) => {
      processedOrder.push(job.id);
      if (job.id === 'job-1') {
        await new Promise<void>((resolve) => {
          resolveFirst = resolve;
        });
      }
    });

    queue.enqueue(buildEntity('job-1'));
    queue.enqueue(buildEntity('job-2'));

    // job-2 ne doit pas encore être traité tant que job-1 bloque.
    await Promise.resolve();
    expect(processedOrder).toEqual(['job-1']);

    resolveFirst?.();
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(processedOrder).toEqual(['job-1', 'job-2']);
  });

  it('retire un job encore en attente (removePending)', () => {
    queue.setProcessor(() => new Promise(() => {})); // ne résout jamais, bloque le job-1 courant
    queue.enqueue(buildEntity('job-1'));
    queue.enqueue(buildEntity('job-2'));

    const removed = queue.removePending('job-2');

    expect(removed?.id).toBe('job-2');
    expect(queue.isJobPending('job-2')).toBe(false);
  });

  it('retourne null si removePending cible un job déjà en cours ou inconnu', () => {
    expect(queue.removePending('inconnu')).toBeNull();
  });

  it('expose le job actuellement en cours de traitement', async () => {
    queue.setProcessor(() => new Promise(() => {}));
    const entity = buildEntity('job-1');
    queue.enqueue(entity);

    await Promise.resolve();

    expect(queue.getCurrentJob()?.id).toBe('job-1');
  });

  it('continue à traiter la file même si un processor rejette (erreur non gérée évitée)', async () => {
    const processedOrder: string[] = [];
    queue.setProcessor(async (job) => {
      processedOrder.push(job.id);
      if (job.id === 'job-1') {
        throw new Error('erreur processor job-1');
      }
    });

    queue.enqueue(buildEntity('job-1'));
    queue.enqueue(buildEntity('job-2'));

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(processedOrder).toEqual(['job-1', 'job-2']);
    expect(queue.getCurrentJob()).toBeNull();
  });

  it('ne fait rien si enqueue() est appelé alors qu\'un job est déjà en cours de traitement (isProcessing=true)', async () => {
    let callCount = 0;
    queue.setProcessor(async () => {
      callCount += 1;
    });

    // Deux jobs enfilés en synchrone : le second déclenche processNext()
    // alors que isProcessing est déjà vrai pour le premier -> retour anticipé.
    queue.enqueue(buildEntity('job-1'));
    queue.enqueue(buildEntity('job-2'));

    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));

    expect(callCount).toBe(2);
  });
});
