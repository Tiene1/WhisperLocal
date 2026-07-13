import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { promises as fs } from 'fs';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { HistoryModule } from '../history/history.module';
import whisperConfig from '../shared/config/whisper.config';
import { TranscriptionModule } from '../transcription/transcription.module';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { AudioFileValidationPipe } from './validators/audio-file.validator';

/**
 * UploadModule — réception fichier + choix modèle/langue, validation,
 * extraction de la durée audio, conversion WAV. Dépend de
 * `TranscriptionModule` (mise en file d'attente) et `HistoryModule`
 * (persistance via `HistoryRepository`).
 */
@Module({
  imports: [
    HistoryModule,
    TranscriptionModule,
    MulterModule.registerAsync({
      useFactory: (config: ConfigType<typeof whisperConfig>) => ({
        storage: diskStorage({
          destination: config.uploadTmpDir,
          filename: (_req, file, callback) => {
            callback(null, `${randomUUID()}${path.extname(file.originalname)}`);
          },
        }),
        limits: { fileSize: config.maxUploadSizeBytes },
      }),
      inject: [whisperConfig.KEY],
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService, AudioFileValidationPipe],
})
export class UploadModule implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    const cfg = whisperConfig();
    await fs.mkdir(cfg.uploadTmpDir, { recursive: true });
  }
}
