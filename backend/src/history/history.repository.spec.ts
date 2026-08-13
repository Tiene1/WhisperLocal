import { JobStatus } from '@prisma/client';
import { HistoryRepository } from './history.repository';
import { PrismaService } from '../prisma/prisma.service';

describe('HistoryRepository', () => {
  let repository: HistoryRepository;
  let prisma: {
    transcriptionJob: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
  };

  beforeEach(() => {
    prisma = {
      transcriptionJob: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    repository = new HistoryRepository(prisma as unknown as PrismaService);
  });

  it('create() crée le job en base avec le statut PENDING', async () => {
    prisma.transcriptionJob.create.mockResolvedValue({ id: 'job-1' });

    await repository.create({
      id: 'job-1',
      filename: 'a.mp3',
      model: 'medium',
      language: 'fr',
      durationSeconds: 42,
    });

    expect(prisma.transcriptionJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: 'job-1',
        filename: 'a.mp3',
        model: 'medium',
        language: 'fr',
        durationSeconds: 42,
        status: JobStatus.PENDING,
      }),
    });
  });

  it('create() accepte une durée null (extraction ffprobe échouée)', async () => {
    prisma.transcriptionJob.create.mockResolvedValue({ id: 'job-1' });

    await repository.create({
      id: 'job-1',
      filename: 'a.mp3',
      model: 'medium',
      language: 'fr',
      durationSeconds: null,
    });

    expect(prisma.transcriptionJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ durationSeconds: undefined }),
    });
  });

  it('findById() délègue à findUnique', async () => {
    prisma.transcriptionJob.findUnique.mockResolvedValue({ id: 'job-1' });
    const result = await repository.findById('job-1');
    expect(prisma.transcriptionJob.findUnique).toHaveBeenCalledWith({ where: { id: 'job-1' } });
    expect(result).toEqual({ id: 'job-1' });
  });

  it('findAll() trie par date de création décroissante', async () => {
    prisma.transcriptionJob.findMany.mockResolvedValue([]);
    await repository.findAll();
    expect(prisma.transcriptionJob.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: 'desc' },
    });
  });

  it('findAllByStatus() filtre par statut', async () => {
    prisma.transcriptionJob.findMany.mockResolvedValue([]);
    await repository.findAllByStatus(JobStatus.PROCESSING);
    expect(prisma.transcriptionJob.findMany).toHaveBeenCalledWith({
      where: { status: JobStatus.PROCESSING },
    });
  });

  it('markProcessing() renseigne le statut et startedAt', async () => {
    prisma.transcriptionJob.update.mockResolvedValue({ id: 'job-1' });
    await repository.markProcessing('job-1');
    expect(prisma.transcriptionJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { status: JobStatus.PROCESSING, startedAt: expect.any(Date) },
    });
  });

  it('updateProgress() met à jour uniquement le champ progress', async () => {
    prisma.transcriptionJob.update.mockResolvedValue({ id: 'job-1' });
    await repository.updateProgress('job-1', 42);
    expect(prisma.transcriptionJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { progress: 42 },
    });
  });

  it('markDone() renseigne resultText/resultSrt, progress=100, completedAt et l\'indicateur de confiance', async () => {
    prisma.transcriptionJob.update.mockResolvedValue({ id: 'job-1' });
    await repository.markDone('job-1', 'texte', 'srt', 0.06, false);
    expect(prisma.transcriptionJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        status: JobStatus.DONE,
        resultText: 'texte',
        resultSrt: 'srt',
        progress: 100,
        completedAt: expect.any(Date),
        lowConfidenceRatio: 0.06,
        isLowConfidenceWarning: false,
      },
    });
  });

  it("markDone() propage isLowConfidenceWarning=true quand le ratio dépasse le seuil configuré", async () => {
    prisma.transcriptionJob.update.mockResolvedValue({ id: 'job-1' });
    await repository.markDone('job-1', 'texte', 'srt', 0.48, true);
    expect(prisma.transcriptionJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        lowConfidenceRatio: 0.48,
        isLowConfidenceWarning: true,
      }),
    });
  });

  it('markFailed() renseigne errorMessage et completedAt', async () => {
    prisma.transcriptionJob.update.mockResolvedValue({ id: 'job-1' });
    await repository.markFailed('job-1', 'oups');
    expect(prisma.transcriptionJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: {
        status: JobStatus.FAILED,
        errorMessage: 'oups',
        completedAt: expect.any(Date),
      },
    });
  });

  it('delete() délègue à prisma.delete', async () => {
    prisma.transcriptionJob.delete.mockResolvedValue({ id: 'job-1' });
    await repository.delete('job-1');
    expect(prisma.transcriptionJob.delete).toHaveBeenCalledWith({ where: { id: 'job-1' } });
  });

  it('create() active diarizationEnabled si demandé à l\'upload', async () => {
    prisma.transcriptionJob.create.mockResolvedValue({ id: 'job-1' });

    await repository.create({
      id: 'job-1',
      filename: 'a.mp3',
      model: 'medium',
      language: 'fr',
      durationSeconds: 42,
      diarizationEnabled: true,
    });

    expect(prisma.transcriptionJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ diarizationEnabled: true }),
    });
  });

  it('create() désactive diarizationEnabled par défaut', async () => {
    prisma.transcriptionJob.create.mockResolvedValue({ id: 'job-1' });

    await repository.create({
      id: 'job-1',
      filename: 'a.mp3',
      model: 'medium',
      language: 'fr',
      durationSeconds: 42,
    });

    expect(prisma.transcriptionJob.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ diarizationEnabled: false }),
    });
  });

  it('updateSpeakerSegments() met à jour uniquement le champ speakerSegments', async () => {
    prisma.transcriptionJob.update.mockResolvedValue({ id: 'job-1' });
    const speakerSegments = [{ speaker: 'SPEAKER_00', start: 0, end: 2, text: 'Bonjour' }];

    await repository.updateSpeakerSegments('job-1', speakerSegments);

    expect(prisma.transcriptionJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { speakerSegments },
    });
  });
});
