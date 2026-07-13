import { Module } from '@nestjs/common';
import { HistoryModule } from '../history/history.module';
import { DiarizationProvider } from './engine/diarization.provider';
import { FfmpegProvider } from './engine/ffmpeg.provider';
import { WhisperCppProvider } from './engine/whisper-cpp.provider';
import { InMemoryQueueService } from './queue/in-memory-queue.service';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from './transcription.service';

/**
 * TranscriptionModule — file d'attente en mémoire, moteur whisper.cpp,
 * conversion ffmpeg, diarisation opt-in (service Python externe). Dépend
 * de `HistoryModule` pour la persistance (`HistoryRepository`), seul point
 * d'accès Prisma.
 */
@Module({
  imports: [HistoryModule],
  controllers: [TranscriptionController],
  providers: [
    TranscriptionService,
    InMemoryQueueService,
    WhisperCppProvider,
    FfmpegProvider,
    DiarizationProvider,
  ],
  exports: [TranscriptionService, FfmpegProvider],
})
export class TranscriptionModule {}
