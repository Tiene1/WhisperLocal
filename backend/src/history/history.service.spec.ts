import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JobStatus, TranscriptionJob } from '@prisma/client';
import { DocxExportProvider } from './export/docx-export.provider';
import { HistoryRepository } from './history.repository';
import { HistoryService } from './history.service';

function buildJob(overrides: Partial<TranscriptionJob> = {}): TranscriptionJob {
  return {
    id: 'job-1',
    filename: 'test.mp3',
    status: JobStatus.DONE,
    model: 'medium',
    language: 'fr',
    durationSeconds: 42,
    progress: 100,
    resultText: 'Bonjour le monde',
    resultSrt: '1\n00:00:00,000 --> 00:00:01,000\nBonjour le monde\n',
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: new Date(),
    completedAt: new Date(),
    diarizationEnabled: false,
    speakerSegments: null,
    ...overrides,
  };
}

describe('HistoryService', () => {
  let service: HistoryService;
  let repository: jest.Mocked<HistoryRepository>;
  let docxProvider: jest.Mocked<DocxExportProvider>;

  beforeEach(() => {
    repository = {
      findAll: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<HistoryRepository>;

    docxProvider = {
      generate: jest.fn().mockResolvedValue(Buffer.from('docx-content')),
    } as unknown as jest.Mocked<DocxExportProvider>;

    service = new HistoryService(repository, docxProvider);
  });

  describe('listJobs', () => {
    it('retourne la liste des jobs mappés en JobListItemDto', async () => {
      repository.findAll.mockResolvedValue([buildJob(), buildJob({ id: 'job-2' })]);

      const result = await service.listJobs();

      expect(repository.findAll).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('job-1');
      expect(result[1].id).toBe('job-2');
      // JobListItemDto n'expose pas resultText/resultSrt (liste allégée)
      expect((result[0] as unknown as { resultText?: string }).resultText).toBeUndefined();
    });

    it('retourne un tableau vide sans erreur si aucun job en base', async () => {
      repository.findAll.mockResolvedValue([]);
      const result = await service.listJobs();
      expect(result).toEqual([]);
    });
  });

  describe('getJob', () => {
    it("lève NotFoundException si le job n'existe pas", async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.getJob('inconnu')).rejects.toThrow(NotFoundException);
    });

    it('retourne le DTO du job trouvé', async () => {
      repository.findById.mockResolvedValue(buildJob());
      const result = await service.getJob('job-1');
      expect(result.id).toBe('job-1');
      expect(result.status).toBe(JobStatus.DONE);
    });
  });

  describe('deleteJob', () => {
    it('refuse de supprimer un job PROCESSING', async () => {
      repository.findById.mockResolvedValue(buildJob({ status: JobStatus.PROCESSING }));
      await expect(service.deleteJob('job-1')).rejects.toThrow(ConflictException);
      expect(repository.delete).not.toHaveBeenCalled();
    });

    it('supprime un job DONE', async () => {
      repository.findById.mockResolvedValue(buildJob({ status: JobStatus.DONE }));
      await service.deleteJob('job-1');
      expect(repository.delete).toHaveBeenCalledWith('job-1');
    });
  });

  describe('exportJob', () => {
    it("lève NotFoundException si le job n'existe pas", async () => {
      repository.findById.mockResolvedValue(null);
      await expect(service.exportJob('inconnu', 'txt')).rejects.toThrow(NotFoundException);
    });

    it("refuse l'export d'un job non terminé", async () => {
      repository.findById.mockResolvedValue(buildJob({ status: JobStatus.PROCESSING }));
      await expect(service.exportJob('job-1', 'txt')).rejects.toThrow(BadRequestException);
    });

    it('exporte le format txt à partir de resultText', async () => {
      repository.findById.mockResolvedValue(buildJob());
      const result = await service.exportJob('job-1', 'txt');
      expect(result.buffer.toString('utf-8')).toBe('Bonjour le monde');
      expect(result.contentType).toContain('text/plain');
    });

    it('exporte le format srt à partir de resultSrt', async () => {
      repository.findById.mockResolvedValue(buildJob());
      const result = await service.exportJob('job-1', 'srt');
      expect(result.buffer.toString('utf-8')).toContain('Bonjour le monde');
    });

    it('exporte le format docx via DocxExportProvider, jamais stocké sur disque', async () => {
      repository.findById.mockResolvedValue(buildJob());
      const result = await service.exportJob('job-1', 'docx');
      expect(docxProvider.generate).toHaveBeenCalledWith('Bonjour le monde', expect.any(String));
      expect(result.buffer.toString('utf-8')).toBe('docx-content');
    });

    it("rejette un format d'export inconnu (garde-fou runtime au-delà du typage TS)", async () => {
      repository.findById.mockResolvedValue(buildJob());
      await expect(
        service.exportJob('job-1', 'pdf' as unknown as 'txt'),
      ).rejects.toThrow(BadRequestException);
    });

    it('nettoie le nom de fichier exporté (caractères spéciaux remplacés)', async () => {
      repository.findById.mockResolvedValue(buildJob({ filename: 'ma réunion (2026)/étrange.mp3' }));
      const result = await service.exportJob('job-1', 'txt');
      expect(result.filename).toMatch(/^[a-zA-Z0-9-_]+\.txt$/);
    });

    it('retombe sur "transcription" si le nom nettoyé est vide', async () => {
      repository.findById.mockResolvedValue(buildJob({ filename: '.mp3' }));
      const result = await service.exportJob('job-1', 'txt');
      expect(result.filename).toBe('transcription.txt');
    });
  });
});
