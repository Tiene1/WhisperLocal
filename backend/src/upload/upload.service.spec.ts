import { unlink } from 'fs/promises';
import { HistoryRepository } from '../history/history.repository';
import whisperConfig from '../shared/config/whisper.config';
import { FfmpegProvider } from '../transcription/engine/ffmpeg.provider';
import { WhisperLanguageCode, WhisperModelName } from '../transcription/domain/transcription-job.entity';
import { TranscriptionService } from '../transcription/transcription.service';
import { UploadService } from './upload.service';

jest.mock('fs/promises', () => ({
  unlink: jest.fn().mockResolvedValue(undefined),
}));

describe('UploadService', () => {
  let service: UploadService;
  let ffmpegProvider: jest.Mocked<FfmpegProvider>;
  let transcriptionService: jest.Mocked<TranscriptionService>;
  let historyRepository: jest.Mocked<HistoryRepository>;

  beforeEach(() => {
    ffmpegProvider = {
      getDurationSeconds: jest.fn().mockResolvedValue(120),
      convertToWav: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<FfmpegProvider>;

    transcriptionService = {
      enqueue: jest.fn(),
    } as unknown as jest.Mocked<TranscriptionService>;

    historyRepository = {
      create: jest.fn().mockResolvedValue({}),
    } as unknown as jest.Mocked<HistoryRepository>;

    service = new UploadService(ffmpegProvider, transcriptionService, historyRepository, whisperConfig());
    jest.clearAllMocks();
  });

  it("convertit le fichier en WAV, crée le job en base, l'enfile puis supprime le fichier original", async () => {
    const file = {
      path: '/tmp/uploaded-original.mp3',
      originalname: 'interview.mp3',
      size: 1000,
    } as Express.Multer.File;

    const jobId = await service.handleUpload(file, {
      model: WhisperModelName.MEDIUM,
      language: WhisperLanguageCode.FR,
      diarizationEnabled: false,
    });

    expect(ffmpegProvider.getDurationSeconds).toHaveBeenCalledWith(file.path);
    expect(ffmpegProvider.convertToWav).toHaveBeenCalledWith(file.path, expect.stringContaining(jobId));
    expect(historyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: jobId,
        filename: 'interview.mp3',
        model: WhisperModelName.MEDIUM,
        language: WhisperLanguageCode.FR,
        durationSeconds: 120,
      }),
    );
    expect(transcriptionService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ jobId, model: WhisperModelName.MEDIUM, language: WhisperLanguageCode.FR }),
    );
    expect(unlink).toHaveBeenCalledWith(file.path);
  });

  it('propage diarizationEnabled à la création du job et à la mise en file', async () => {
    const file = {
      path: '/tmp/uploaded-original.mp3',
      originalname: 'interview.mp3',
      size: 1000,
    } as Express.Multer.File;

    const jobId = await service.handleUpload(file, {
      model: WhisperModelName.MEDIUM,
      language: WhisperLanguageCode.FR,
      diarizationEnabled: true,
    });

    expect(historyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ id: jobId, diarizationEnabled: true }),
    );
    expect(transcriptionService.enqueue).toHaveBeenCalledWith(
      expect.objectContaining({ jobId, diarizationEnabled: true }),
    );
  });

  it('supprime tout de même le fichier original si la conversion ffmpeg échoue', async () => {
    ffmpegProvider.convertToWav.mockRejectedValue(new Error('ffmpeg indisponible'));
    const file = {
      path: '/tmp/uploaded-original.mp3',
      originalname: 'interview.mp3',
      size: 1000,
    } as Express.Multer.File;

    await expect(
      service.handleUpload(file, {
        model: WhisperModelName.MEDIUM,
        language: WhisperLanguageCode.FR,
        diarizationEnabled: false,
      }),
    ).rejects.toThrow('ffmpeg indisponible');

    expect(unlink).toHaveBeenCalledWith(file.path);
    expect(historyRepository.create).not.toHaveBeenCalled();
  });

  it("n'échoue pas si la suppression du fichier original échoue (best-effort, juste loggé)", async () => {
    (unlink as jest.Mock).mockRejectedValueOnce(new Error('EBUSY: fichier verrouillé'));
    const file = {
      path: '/tmp/uploaded-original.mp3',
      originalname: 'interview.mp3',
      size: 1000,
    } as Express.Multer.File;

    const jobId = await service.handleUpload(file, {
      model: WhisperModelName.MEDIUM,
      language: WhisperLanguageCode.FR,
      diarizationEnabled: false,
    });

    expect(jobId).toBeDefined();
    expect(historyRepository.create).toHaveBeenCalled();
  });
});
