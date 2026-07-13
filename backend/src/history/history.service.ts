import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { JobStatus, TranscriptionJob } from '@prisma/client';
import { DocxExportProvider } from './export/docx-export.provider';
import { HistoryRepository } from './history.repository';
import { JobListItemDto, JobResponseDto } from './dto/job-response.dto';

export type ExportFormat = 'txt' | 'srt' | 'docx';

export interface ExportedFile {
  buffer: Buffer;
  filename: string;
  contentType: string;
}

/**
 * Application — logique de consultation, suppression et export de
 * l'historique des jobs. Aucun accès Prisma direct : tout passe par
 * `HistoryRepository`.
 */
@Injectable()
export class HistoryService {
  constructor(
    private readonly historyRepository: HistoryRepository,
    private readonly docxExportProvider: DocxExportProvider,
  ) {}

  async listJobs(): Promise<JobListItemDto[]> {
    const jobs = await this.historyRepository.findAll();
    return jobs.map((job) => JobListItemDto.fromEntity(job));
  }

  async getJob(id: string): Promise<JobResponseDto> {
    const job = await this.findJobOrThrow(id);
    return JobResponseDto.fromEntity(job);
  }

  async deleteJob(id: string): Promise<void> {
    const job = await this.findJobOrThrow(id);

    if (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING) {
      throw new ConflictException(
        'Impossible de supprimer un job en attente ou en cours — annule-le d\'abord via /jobs/:id/cancel',
      );
    }

    await this.historyRepository.delete(id);
  }

  async exportJob(id: string, format: ExportFormat): Promise<ExportedFile> {
    const job = await this.findJobOrThrow(id);

    if (job.status !== JobStatus.DONE) {
      throw new BadRequestException(
        `Le job ${id} n'est pas encore terminé (statut actuel : ${job.status}) — export impossible`,
      );
    }

    const baseName = this.sanitizeBaseName(job.filename);

    switch (format) {
      case 'txt':
        return {
          buffer: Buffer.from(job.resultText ?? '', 'utf-8'),
          filename: `${baseName}.txt`,
          contentType: 'text/plain; charset=utf-8',
        };
      case 'srt':
        return {
          buffer: Buffer.from(job.resultSrt ?? '', 'utf-8'),
          filename: `${baseName}.srt`,
          contentType: 'application/x-subrip',
        };
      case 'docx': {
        const buffer = await this.docxExportProvider.generate(job.resultText ?? '', baseName);
        return {
          buffer,
          filename: `${baseName}.docx`,
          contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        };
      }
      default:
        throw new BadRequestException(`Format d'export non supporté : ${format as string}`);
    }
  }

  private async findJobOrThrow(id: string): Promise<TranscriptionJob> {
    const job = await this.historyRepository.findById(id);
    if (!job) {
      throw new NotFoundException(`Job ${id} introuvable`);
    }
    return job;
  }

  private sanitizeBaseName(filename: string): string {
    const withoutExtension = filename.replace(/\.[^/.]+$/, '');
    return withoutExtension.replace(/[^a-zA-Z0-9-_]/g, '_') || 'transcription';
  }
}
