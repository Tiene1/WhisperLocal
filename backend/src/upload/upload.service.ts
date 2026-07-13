import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { unlink } from 'fs/promises';
import * as path from 'path';
import { HistoryRepository } from '../history/history.repository';
import whisperConfig from '../shared/config/whisper.config';
import { FfmpegProvider } from '../transcription/engine/ffmpeg.provider';
import { TranscriptionService } from '../transcription/transcription.service';
import { UploadAudioDto } from './dto/upload-audio.dto';

/**
 * Application — orchestre la réception d'un fichier audio : extraction
 * de la durée (ffprobe), conversion WAV 16kHz mono (ffmpeg), création du
 * job en base (`PENDING`), puis mise en file d'attente pour transcription.
 *
 * Aucun accès Prisma direct : passe par `HistoryRepository`.
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(
    private readonly ffmpegProvider: FfmpegProvider,
    private readonly transcriptionService: TranscriptionService,
    private readonly historyRepository: HistoryRepository,
    @Inject(whisperConfig.KEY)
    private readonly config: ConfigType<typeof whisperConfig>,
  ) {}

  async handleUpload(file: Express.Multer.File, dto: UploadAudioDto): Promise<string> {
    const jobId = randomUUID();
    const wavFilePath = path.join(this.config.uploadTmpDir, `${jobId}.wav`);

    try {
      const durationSeconds = await this.ffmpegProvider.getDurationSeconds(file.path);
      await this.ffmpegProvider.convertToWav(file.path, wavFilePath);

      await this.historyRepository.create({
        id: jobId,
        filename: file.originalname,
        model: dto.model,
        language: dto.language,
        durationSeconds,
        diarizationEnabled: dto.diarizationEnabled,
      });

      this.transcriptionService.enqueue({
        jobId,
        wavFilePath,
        model: dto.model,
        language: dto.language,
        diarizationEnabled: dto.diarizationEnabled,
      });

      return jobId;
    } finally {
      // Le fichier original uploadé n'a plus d'utilité une fois converti
      // en WAV : seul ce dernier est manipulé par la suite (upload,
      // annulation, échec) — cf. décision documentée dans le README.
      await this.deleteOriginalFileSafely(file.path);
    }
  }

  private async deleteOriginalFileSafely(filePath: string): Promise<void> {
    try {
      await unlink(filePath);
    } catch (error) {
      this.logger.warn(`Impossible de supprimer le fichier original ${filePath} : ${(error as Error).message}`);
    }
  }
}
