import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, INestApplication, NotFoundException } from '@nestjs/common';
import request from 'supertest';
import { HistoryController } from './history.controller';
import { HistoryService } from './history.service';

describe('HistoryController (intégration)', () => {
  let app: INestApplication;
  let historyService: {
    listJobs: jest.Mock;
    exportJob: jest.Mock;
    deleteJob: jest.Mock;
  };

  beforeEach(async () => {
    historyService = {
      listJobs: jest.fn(),
      exportJob: jest.fn(),
      deleteJob: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HistoryController],
      providers: [{ provide: HistoryService, useValue: historyService }],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /jobs retourne la liste des jobs', async () => {
    historyService.listJobs.mockResolvedValue([{ id: 'job-1' }]);

    const response = await request(app.getHttpServer()).get('/jobs').expect(200);

    expect(response.body).toEqual([{ id: 'job-1' }]);
  });

  it('GET /jobs/:id/export avec un format invalide -> 400, sans appeler le service', async () => {
    await request(app.getHttpServer()).get('/jobs/job-1/export?format=pdf').expect(400);
    expect(historyService.exportJob).not.toHaveBeenCalled();
  });

  it('GET /jobs/:id/export?format=txt renvoie le fichier avec les bons en-têtes', async () => {
    historyService.exportJob.mockResolvedValue({
      buffer: Buffer.from('Bonjour'),
      filename: 'transcription.txt',
      contentType: 'text/plain; charset=utf-8',
    });

    const response = await request(app.getHttpServer())
      .get('/jobs/job-1/export?format=txt')
      .expect(200);

    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.headers['content-disposition']).toContain('transcription.txt');
    expect(response.text).toBe('Bonjour');
  });

  it("GET /jobs/:id/export -> 400 si le job n'est pas terminé", async () => {
    historyService.exportJob.mockRejectedValue(new BadRequestException('pas terminé'));

    await request(app.getHttpServer()).get('/jobs/job-1/export?format=srt').expect(400);
  });

  it('DELETE /jobs/:id -> 204 en cas de succès', async () => {
    historyService.deleteJob.mockResolvedValue(undefined);

    await request(app.getHttpServer()).delete('/jobs/job-1').expect(204);

    expect(historyService.deleteJob).toHaveBeenCalledWith('job-1');
  });

  it('DELETE /jobs/:id -> 404 si le job est introuvable', async () => {
    historyService.deleteJob.mockRejectedValue(new NotFoundException('introuvable'));

    await request(app.getHttpServer()).delete('/jobs/inconnu').expect(404);
  });
});
