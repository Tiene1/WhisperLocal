import { Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { JobResponseDto } from '../history/dto/job-response.dto';
import { TranscriptionService } from './transcription.service';

/**
 * Présentation — statut d'un job et annulation. Aucune logique métier
 * ici : tout est délégué à `TranscriptionService`.
 */
@Controller('jobs')
export class TranscriptionController {
  constructor(private readonly transcriptionService: TranscriptionService) {}

  @Get(':id')
  async getStatus(@Param('id') id: string): Promise<JobResponseDto> {
    return this.transcriptionService.getJobStatus(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@Param('id') id: string): Promise<void> {
    await this.transcriptionService.cancelJob(id);
  }
}
