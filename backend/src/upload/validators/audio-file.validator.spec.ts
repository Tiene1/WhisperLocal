import { BadRequestException } from '@nestjs/common';
import { AudioFileValidationPipe } from './audio-file.validator';
import whisperConfig from '../../shared/config/whisper.config';

describe('AudioFileValidationPipe', () => {
  let pipe: AudioFileValidationPipe;

  beforeEach(() => {
    pipe = new AudioFileValidationPipe(whisperConfig());
  });

  it("lève BadRequestException si aucun fichier n'est fourni", () => {
    expect(() => pipe.transform(undefined as unknown as Express.Multer.File)).toThrow(
      BadRequestException,
    );
  });

  it('lève BadRequestException si le fichier dépasse 250 Mo', () => {
    const file = {
      originalname: 'trop-gros.mp3',
      size: 251 * 1024 * 1024,
    } as Express.Multer.File;

    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow(/250 Mo/);
  });

  it('accepte un fichier de exactement 250 Mo (limite incluse)', () => {
    const file = {
      originalname: 'limite.mp3',
      size: 250 * 1024 * 1024,
    } as Express.Multer.File;

    expect(pipe.transform(file)).toBe(file);
  });

  it('lève BadRequestException pour un format non supporté', () => {
    const file = {
      originalname: 'notes.txt',
      size: 100,
    } as Express.Multer.File;

    expect(() => pipe.transform(file)).toThrow(BadRequestException);
    expect(() => pipe.transform(file)).toThrow(/Format de fichier non supporté/);
  });

  it('accepte les extensions audio autorisées (ex: .mp3, .wav)', () => {
    const mp3 = { originalname: 'a.mp3', size: 100 } as Express.Multer.File;
    const wav = { originalname: 'b.wav', size: 100 } as Express.Multer.File;

    expect(pipe.transform(mp3)).toBe(mp3);
    expect(pipe.transform(wav)).toBe(wav);
  });
});
