import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { TranscriptionController } from './transcription.controller';
import { TranscriptionService } from './transcription.service';
import { JobResponseDto } from '../history/dto/job-response.dto';

describe('TranscriptionController (intégration)', () => {
  let app: INestApplication;
  let transcriptionService: {
    getJobStatus: jest.Mock;
    cancelJob: jest.Mock;
  };

  beforeEach(async () => {
    transcriptionService = {
      getJobStatus: jest.fn(),
      cancelJob: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TranscriptionController],
      providers: [{ provide: TranscriptionService, useValue: transcriptionService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /jobs/:id retourne le statut du job', async () => {
    const dto = new JobResponseDto();
    Object.assign(dto, {
      id: 'job-1',
      filename: 'a.mp3',
      status: 'PROCESSING',
      model: 'medium',
      language: 'fr',
      durationSeconds: 60,
      progress: 0,
      resultText: null,
      resultSrt: null,
      errorMessage: null,
    });
    transcriptionService.getJobStatus.mockResolvedValue(dto);

    const response = await request(app.getHttpServer()).get('/jobs/job-1').expect(200);

    expect(response.body.id).toBe('job-1');
    expect(transcriptionService.getJobStatus).toHaveBeenCalledWith('job-1');
  });

  it('GET /jobs/:id -> 404 si le job est introuvable', async () => {
    transcriptionService.getJobStatus.mockRejectedValue(new NotFoundException('introuvable'));

    await request(app.getHttpServer()).get('/jobs/inconnu').expect(404);
  });

  it('POST /jobs/:id/cancel -> 204 en cas de succès', async () => {
    transcriptionService.cancelJob.mockResolvedValue(undefined);

    await request(app.getHttpServer()).post('/jobs/job-1/cancel').expect(204);

    expect(transcriptionService.cancelJob).toHaveBeenCalledWith('job-1');
  });

  it('POST /jobs/:id/cancel -> 409 si le job n\'est plus annulable', async () => {
    transcriptionService.cancelJob.mockRejectedValue(new ConflictException('plus annulable'));

    await request(app.getHttpServer()).post('/jobs/job-1/cancel').expect(409);
  });
});
