import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import whisperConfig from '../shared/config/whisper.config';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { AudioFileValidationPipe } from './validators/audio-file.validator';

describe('UploadController (intégration)', () => {
  let app: INestApplication;
  let uploadService: { handleUpload: jest.Mock };

  beforeEach(async () => {
    uploadService = { handleUpload: jest.fn().mockResolvedValue('job-123') };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UploadController],
      providers: [
        { provide: UploadService, useValue: uploadService },
        AudioFileValidationPipe,
        { provide: whisperConfig.KEY, useValue: whisperConfig() },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /uploads sans fichier -> 400', async () => {
    await request(app.getHttpServer()).post('/uploads').expect(400);
    expect(uploadService.handleUpload).not.toHaveBeenCalled();
  });

  it('POST /uploads avec un format de fichier non supporté -> 400', async () => {
    await request(app.getHttpServer())
      .post('/uploads')
      .attach('file', Buffer.from('contenu'), 'notes.txt')
      .expect(400);
    expect(uploadService.handleUpload).not.toHaveBeenCalled();
  });

  it('POST /uploads avec un fichier audio valide -> 201 + jobId', async () => {
    const response = await request(app.getHttpServer())
      .post('/uploads')
      .field('model', 'medium')
      .field('language', 'fr')
      .attach('file', Buffer.from('faux-contenu-audio'), 'sample.mp3')
      .expect(201);

    expect(response.body).toEqual({ jobId: 'job-123' });
    expect(uploadService.handleUpload).toHaveBeenCalledTimes(1);
  });

  it('POST /uploads avec un model invalide -> 400', async () => {
    await request(app.getHttpServer())
      .post('/uploads')
      .field('model', 'ultra-large-invalide')
      .attach('file', Buffer.from('faux-contenu-audio'), 'sample.mp3')
      .expect(400);
    expect(uploadService.handleUpload).not.toHaveBeenCalled();
  });
});
