import { ConflictException, NotFoundException } from '@nestjs/common';
import { JobStatus as PrismaJobStatus, TranscriptionJob } from '@prisma/client';
import { unlink } from 'fs/promises';
import { HistoryRepository } from '../history/history.repository';
import {
  CANCELLED_BY_USER_MESSAGE,
  JobStatus,
  TranscriptionJobEntity,
  WhisperLanguageCode,
  WhisperModelName,
} from './domain/transcription-job.entity';
import { JobCancelledError } from './errors/job-cancelled.error';
import { DiarizationProvider } from './engine/diarization.provider';
import { WhisperCppProvider } from './engine/whisper-cpp.provider';
import { InMemoryQueueService } from './queue/in-memory-queue.service';
import { TranscriptionService } from './transcription.service';

jest.mock('fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));

function buildJob(overrides: Partial<TranscriptionJob> = {}): TranscriptionJob {
  return {
    id: 'job-1',
    filename: 'test.mp3',
    status: PrismaJobStatus.PROCESSING,
    model: 'medium',
    language: 'fr',
    durationSeconds: 10,
    progress: 0,
    resultText: null,
    resultSrt: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: new Date(),
    completedAt: null,
    diarizationEnabled: false,
    speakerSegments: null,
    ...overrides,
  };
}

describe('TranscriptionService', () => {
  let service: TranscriptionService;
  let queue: jest.Mocked<InMemoryQueueService>;
  let whisperCppProvider: jest.Mocked<WhisperCppProvider>;
  let historyRepository: jest.Mocked<HistoryRepository>;
  let diarizationProvider: jest.Mocked<DiarizationProvider>;

  beforeEach(() => {
    queue = {
      setProcessor: jest.fn(),
      enqueue: jest.fn(),
      removePending: jest.fn(),
      getCurrentJob: jest.fn(),
      isJobPending: jest.fn(),
    } as unknown as jest.Mocked<InMemoryQueueService>;

    whisperCppProvider = {
      transcribe: jest.fn(),
      kill: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<WhisperCppProvider>;

    historyRepository = {
      findById: jest.fn(),
      findAllByStatus: jest.fn().mockResolvedValue([]),
      markProcessing: jest.fn(),
      updateProgress: jest.fn().mockResolvedValue(undefined),
      markDone: jest.fn(),
      markFailed: jest.fn(),
      updateSpeakerSegments: jest.fn(),
    } as unknown as jest.Mocked<HistoryRepository>;

    diarizationProvider = {
      diarize: jest.fn(),
    } as unknown as jest.Mocked<DiarizationProvider>;

    service = new TranscriptionService(queue, whisperCppProvider, historyRepository, diarizationProvider);
    (unlink as jest.Mock).mockClear();
  });

  describe('onApplicationBootstrap (nettoyage au démarrage)', () => {
    it('repasse tout job PROCESSING orphelin à FAILED (redémarrage serveur)', async () => {
      historyRepository.findAllByStatus.mockResolvedValue([
        buildJob({ id: 'orphan-1', status: PrismaJobStatus.PROCESSING }),
        buildJob({ id: 'orphan-2', status: PrismaJobStatus.PROCESSING }),
      ]);

      await service.onApplicationBootstrap();

      expect(historyRepository.findAllByStatus).toHaveBeenCalledWith(PrismaJobStatus.PROCESSING);
      expect(historyRepository.markFailed).toHaveBeenCalledWith(
        'orphan-1',
        'Interrompu par un redémarrage du serveur',
      );
      expect(historyRepository.markFailed).toHaveBeenCalledWith(
        'orphan-2',
        'Interrompu par un redémarrage du serveur',
      );
    });

    it("ne fait rien si aucun job n'était PROCESSING au redémarrage", async () => {
      historyRepository.findAllByStatus.mockResolvedValue([]);

      await service.onApplicationBootstrap();

      expect(historyRepository.markFailed).not.toHaveBeenCalled();
    });
  });

  describe('cancelJob', () => {
    it('retire un job PENDING de la file et le marque FAILED (annulation)', async () => {
      const pendingEntity = new TranscriptionJobEntity({
        id: 'job-1',
        wavFilePath: '/tmp/job-1.wav',
        model: WhisperModelName.MEDIUM,
        language: WhisperLanguageCode.FR,
        status: JobStatus.PENDING,
      });
      queue.removePending.mockReturnValue(pendingEntity);

      await service.cancelJob('job-1');

      expect(historyRepository.markFailed).toHaveBeenCalledWith('job-1', CANCELLED_BY_USER_MESSAGE);
      expect(unlink).toHaveBeenCalledWith('/tmp/job-1.wav');
      expect(whisperCppProvider.kill).not.toHaveBeenCalled();
    });

    it('tue le subprocess si le job est actuellement PROCESSING', async () => {
      queue.removePending.mockReturnValue(null);
      const processingEntity = new TranscriptionJobEntity({
        id: 'job-1',
        wavFilePath: '/tmp/job-1.wav',
        model: WhisperModelName.MEDIUM,
        language: WhisperLanguageCode.FR,
        status: JobStatus.PROCESSING,
      });
      queue.getCurrentJob.mockReturnValue(processingEntity);

      await service.cancelJob('job-1');

      expect(whisperCppProvider.kill).toHaveBeenCalledWith('job-1');
      // La mise à jour DB est déléguée au processor (via JobCancelledError), pas à cancelJob directement.
      expect(historyRepository.markFailed).not.toHaveBeenCalled();
    });

    it('lève ConflictException si le job est déjà terminé', async () => {
      queue.removePending.mockReturnValue(null);
      queue.getCurrentJob.mockReturnValue(null);
      historyRepository.findById.mockResolvedValue(buildJob({ status: PrismaJobStatus.DONE }));

      await expect(service.cancelJob('job-1')).rejects.toThrow(ConflictException);
    });

    it("lève NotFoundException si le job n'existe pas du tout", async () => {
      queue.removePending.mockReturnValue(null);
      queue.getCurrentJob.mockReturnValue(null);
      historyRepository.findById.mockResolvedValue(null);

      await expect(service.cancelJob('inconnu')).rejects.toThrow(NotFoundException);
    });
  });

  describe('processJob (via enqueue -> processor branché sur la file)', () => {
    it('marque le job DONE et supprime le WAV en cas de succès', async () => {
      const processor = getRegisteredProcessor(queue);
      const entity = new TranscriptionJobEntity({
        id: 'job-1',
        wavFilePath: '/tmp/job-1.wav',
        model: WhisperModelName.MEDIUM,
        language: WhisperLanguageCode.FR,
        status: JobStatus.PENDING,
      });
      whisperCppProvider.transcribe.mockResolvedValue({ text: 'Bonjour', srt: '1\n...' });

      await processor(entity);

      expect(historyRepository.markProcessing).toHaveBeenCalledWith('job-1');
      expect(historyRepository.markDone).toHaveBeenCalledWith('job-1', 'Bonjour', '1\n...', null);
      expect(unlink).toHaveBeenCalledWith('/tmp/job-1.wav');
    });

    it('marque le job FAILED et CONSERVE le WAV en cas d\'échec réel', async () => {
      const processor = getRegisteredProcessor(queue);
      const entity = new TranscriptionJobEntity({
        id: 'job-1',
        wavFilePath: '/tmp/job-1.wav',
        model: WhisperModelName.MEDIUM,
        language: WhisperLanguageCode.FR,
        status: JobStatus.PENDING,
      });
      whisperCppProvider.transcribe.mockRejectedValue(new Error('whisper.cpp crash'));

      await processor(entity);

      expect(historyRepository.markFailed).toHaveBeenCalledWith('job-1', 'whisper.cpp crash');
      expect(unlink).not.toHaveBeenCalled();
    });

    it("marque le job FAILED avec le message d'annulation et supprime le WAV sur JobCancelledError", async () => {
      const processor = getRegisteredProcessor(queue);
      const entity = new TranscriptionJobEntity({
        id: 'job-1',
        wavFilePath: '/tmp/job-1.wav',
        model: WhisperModelName.MEDIUM,
        language: WhisperLanguageCode.FR,
        status: JobStatus.PENDING,
      });
      whisperCppProvider.transcribe.mockRejectedValue(new JobCancelledError('job-1'));

      await processor(entity);

      expect(historyRepository.markFailed).toHaveBeenCalledWith('job-1', CANCELLED_BY_USER_MESSAGE);
      expect(unlink).toHaveBeenCalledWith('/tmp/job-1.wav');
    });

    it("progression best-effort : n'interrompt jamais le job si la mise à jour échoue en base", async () => {
      const processor = getRegisteredProcessor(queue);
      const entity = new TranscriptionJobEntity({
        id: 'job-1',
        wavFilePath: '/tmp/job-1.wav',
        model: WhisperModelName.MEDIUM,
        language: WhisperLanguageCode.FR,
        status: JobStatus.PENDING,
      });
      historyRepository.updateProgress.mockRejectedValue(new Error('DB indisponible'));
      whisperCppProvider.transcribe.mockImplementation(async ({ onProgress }) => {
        onProgress?.(37);
        return { text: 'Bonjour', srt: '1\n...' };
      });

      await expect(processor(entity)).resolves.toBeUndefined();
      // Laisse la microtask du .catch() de updateProgress se résoudre.
      await new Promise((resolve) => setImmediate(resolve));

      expect(historyRepository.markDone).toHaveBeenCalledWith('job-1', 'Bonjour', '1\n...', null);
    });

    it('ne lève pas si la suppression du WAV échoue (best-effort, juste loggé)', async () => {
      const processor = getRegisteredProcessor(queue);
      const entity = new TranscriptionJobEntity({
        id: 'job-1',
        wavFilePath: '/tmp/job-1.wav',
        model: WhisperModelName.MEDIUM,
        language: WhisperLanguageCode.FR,
        status: JobStatus.PENDING,
      });
      whisperCppProvider.transcribe.mockResolvedValue({ text: 'Bonjour', srt: '1\n...' });
      (unlink as jest.Mock).mockRejectedValueOnce(new Error('EBUSY'));

      await expect(processor(entity)).resolves.toBeUndefined();
      expect(historyRepository.markDone).toHaveBeenCalled();
    });

    it("n'appelle jamais le service de diarisation si diarizationEnabled est faux (défaut)", async () => {
      const processor = getRegisteredProcessor(queue);
      const entity = new TranscriptionJobEntity({
        id: 'job-1',
        wavFilePath: '/tmp/job-1.wav',
        model: WhisperModelName.MEDIUM,
        language: WhisperLanguageCode.FR,
        status: JobStatus.PENDING,
      });
      whisperCppProvider.transcribe.mockResolvedValue({ text: 'Bonjour', srt: '1\n...' });

      await processor(entity);

      expect(diarizationProvider.diarize).not.toHaveBeenCalled();
      // speakerSegments = null (pas de tentative de diarisation).
      expect(historyRepository.markDone).toHaveBeenCalledWith('job-1', 'Bonjour', '1\n...', null);
    });

    it('appelle le service de diarisation AVANT markDone et lui passe les locuteurs fusionnés (évite la course avec le polling frontend)', async () => {
      const processor = getRegisteredProcessor(queue);
      const entity = new TranscriptionJobEntity({
        id: 'job-1',
        wavFilePath: '/tmp/job-1.wav',
        model: WhisperModelName.MEDIUM,
        language: WhisperLanguageCode.FR,
        status: JobStatus.PENDING,
        diarizationEnabled: true,
      });
      const srt = '1\n00:00:00,000 --> 00:00:02,000\nBonjour\n';
      whisperCppProvider.transcribe.mockResolvedValue({ text: 'Bonjour', srt });
      diarizationProvider.diarize.mockResolvedValue([{ speaker: 'SPEAKER_00', start: 0, end: 2 }]);

      await processor(entity);

      expect(diarizationProvider.diarize).toHaveBeenCalledWith('/tmp/job-1.wav');
      expect(historyRepository.markDone).toHaveBeenCalledWith('job-1', 'Bonjour', srt, [
        { speaker: 'SPEAKER_00', start: 0, end: 2, text: 'Bonjour' },
      ]);
      // Le WAV est bien supprimé après la tentative de diarisation, comme pour le flux classique.
      expect(unlink).toHaveBeenCalledWith('/tmp/job-1.wav');
    });

    it("règle 'jamais bloquant' : le job passe DONE avec speakerSegments=null si le service de diarisation échoue (retourne null)", async () => {
      const processor = getRegisteredProcessor(queue);
      const entity = new TranscriptionJobEntity({
        id: 'job-1',
        wavFilePath: '/tmp/job-1.wav',
        model: WhisperModelName.MEDIUM,
        language: WhisperLanguageCode.FR,
        status: JobStatus.PENDING,
        diarizationEnabled: true,
      });
      whisperCppProvider.transcribe.mockResolvedValue({ text: 'Bonjour', srt: '1\n...' });
      diarizationProvider.diarize.mockResolvedValue(null);

      await expect(processor(entity)).resolves.toBeUndefined();

      expect(historyRepository.markDone).toHaveBeenCalledWith('job-1', 'Bonjour', '1\n...', null);
      expect(historyRepository.markFailed).not.toHaveBeenCalled();
      expect(unlink).toHaveBeenCalledWith('/tmp/job-1.wav');
    });

    it("règle 'jamais bloquant' : le job passe DONE avec speakerSegments=null même si la fusion échoue", async () => {
      const processor = getRegisteredProcessor(queue);
      const entity = new TranscriptionJobEntity({
        id: 'job-1',
        wavFilePath: '/tmp/job-1.wav',
        model: WhisperModelName.MEDIUM,
        language: WhisperLanguageCode.FR,
        status: JobStatus.PENDING,
        diarizationEnabled: true,
      });
      // Segments non itérables -> mergeSpeakerSegments lève une erreur, capturée en warning.
      // (SRT valide avec au moins une cue, sinon `.map` sur un tableau vide
      // ne déclencherait jamais l'itération fautive sur `segments`.)
      const srt = '1\n00:00:00,000 --> 00:00:02,000\nBonjour\n';
      whisperCppProvider.transcribe.mockResolvedValue({ text: 'Bonjour', srt });
      diarizationProvider.diarize.mockResolvedValue({} as unknown as never);

      await expect(processor(entity)).resolves.toBeUndefined();

      expect(historyRepository.markDone).toHaveBeenCalledWith('job-1', 'Bonjour', srt, null);
      expect(historyRepository.markFailed).not.toHaveBeenCalled();
      expect(unlink).toHaveBeenCalledWith('/tmp/job-1.wav');
    });
  });
});

function getRegisteredProcessor(
  queue: jest.Mocked<InMemoryQueueService>,
): (job: TranscriptionJobEntity) => Promise<void> {
  const call = queue.setProcessor.mock.calls[0];
  return call[0];
}
