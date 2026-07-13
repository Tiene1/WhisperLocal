import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HistoryModule } from './history/history.module';
import { PrismaModule } from './prisma/prisma.module';
import whisperConfig from './shared/config/whisper.config';
import { TranscriptionModule } from './transcription/transcription.module';
import { UploadModule } from './upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [whisperConfig],
      envFilePath: ['.env'],
    }),
    PrismaModule,
    UploadModule,
    TranscriptionModule,
    HistoryModule,
  ],
})
export class AppModule {}
