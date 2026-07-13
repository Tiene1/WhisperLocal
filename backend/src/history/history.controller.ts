import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { ExportFormat, HistoryService } from './history.service';
import { JobListItemDto } from './dto/job-response.dto';

const VALID_EXPORT_FORMATS: ExportFormat[] = ['txt', 'srt', 'docx'];

/**
 * Présentation — consultation de l'historique, suppression et export.
 * Aucune logique métier ici : tout est délégué à `HistoryService`.
 */
@Controller('jobs')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  async list(): Promise<JobListItemDto[]> {
    return this.historyService.listJobs();
  }

  @Get(':id/export')
  async export(
    @Param('id') id: string,
    @Query('format') format: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    if (!VALID_EXPORT_FORMATS.includes(format as ExportFormat)) {
      throw new BadRequestException(
        `Paramètre "format" invalide : attendu txt, srt ou docx (reçu "${format}")`,
      );
    }

    const exported = await this.historyService.exportJob(id, format as ExportFormat);

    res.set({
      'Content-Type': exported.contentType,
      'Content-Disposition': `attachment; filename="${exported.filename}"`,
    });

    return new StreamableFile(exported.buffer);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    await this.historyService.deleteJob(id);
  }
}
