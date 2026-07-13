import { Module } from '@nestjs/common';
import { DocxExportProvider } from './export/docx-export.provider';
import { HistoryController } from './history.controller';
import { HistoryRepository } from './history.repository';
import { HistoryService } from './history.service';

/**
 * HistoryModule — consultation, suppression et export de l'historique.
 * Exporte `HistoryRepository`, seul point d'accès Prisma pour l'entité
 * `TranscriptionJob`, réutilisé par `TranscriptionModule` et `UploadModule`.
 */
@Module({
  controllers: [HistoryController],
  providers: [HistoryService, HistoryRepository, DocxExportProvider],
  exports: [HistoryRepository],
})
export class HistoryModule {}
