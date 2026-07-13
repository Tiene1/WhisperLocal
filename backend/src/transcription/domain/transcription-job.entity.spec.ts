import {
  JobStatus,
  TranscriptionJobEntity,
  WhisperLanguageCode,
  WhisperModelName,
} from './transcription-job.entity';

function buildEntity(status: JobStatus): TranscriptionJobEntity {
  return new TranscriptionJobEntity({
    id: 'job-1',
    wavFilePath: '/tmp/job-1.wav',
    model: WhisperModelName.MEDIUM,
    language: WhisperLanguageCode.FR,
    status,
  });
}

describe('TranscriptionJobEntity', () => {
  describe('isCancellable', () => {
    it('est annulable si PENDING', () => {
      expect(buildEntity(JobStatus.PENDING).isCancellable()).toBe(true);
    });

    it('est annulable si PROCESSING', () => {
      expect(buildEntity(JobStatus.PROCESSING).isCancellable()).toBe(true);
    });

    it("n'est pas annulable si DONE", () => {
      expect(buildEntity(JobStatus.DONE).isCancellable()).toBe(false);
    });

    it("n'est pas annulable si FAILED", () => {
      expect(buildEntity(JobStatus.FAILED).isCancellable()).toBe(false);
    });
  });

  describe('markProcessing', () => {
    it('transitionne PENDING -> PROCESSING', () => {
      const entity = buildEntity(JobStatus.PENDING);
      entity.markProcessing();
      expect(entity.status).toBe(JobStatus.PROCESSING);
    });

    it('lève une erreur si le statut de départ n\'est pas PENDING', () => {
      const entity = buildEntity(JobStatus.DONE);
      expect(() => entity.markProcessing()).toThrow(/Transition invalide/);
    });
  });

  describe('markDone', () => {
    it('transitionne PROCESSING -> DONE', () => {
      const entity = buildEntity(JobStatus.PROCESSING);
      entity.markDone();
      expect(entity.status).toBe(JobStatus.DONE);
    });

    it('lève une erreur si le statut de départ n\'est pas PROCESSING', () => {
      const entity = buildEntity(JobStatus.PENDING);
      expect(() => entity.markDone()).toThrow(/Transition invalide/);
    });
  });

  describe('markFailed', () => {
    it('force le statut à FAILED depuis PENDING', () => {
      const entity = buildEntity(JobStatus.PENDING);
      entity.markFailed();
      expect(entity.status).toBe(JobStatus.FAILED);
    });

    it('force le statut à FAILED depuis PROCESSING (aucune restriction de transition)', () => {
      const entity = buildEntity(JobStatus.PROCESSING);
      entity.markFailed();
      expect(entity.status).toBe(JobStatus.FAILED);
    });
  });
});
