import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { FfmpegProvider } from './ffmpeg.provider';
import whisperConfig from '../../shared/config/whisper.config';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
}

describe('FfmpegProvider', () => {
  let provider: FfmpegProvider;
  let fakeChild: FakeChildProcess;

  beforeEach(() => {
    provider = new FfmpegProvider(whisperConfig());
    fakeChild = new FakeChildProcess();
    (spawn as jest.Mock).mockReturnValue(fakeChild);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('convertToWav', () => {
    it('résout quand ffmpeg se termine avec le code 0', async () => {
      const promise = provider.convertToWav('/tmp/in.mp3', '/tmp/out.wav');
      fakeChild.emit('close', 0);
      await expect(promise).resolves.toBeUndefined();

      expect(spawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['-i', '/tmp/in.mp3', '-ar', '16000', '-ac', '1']),
      );
    });

    it('rejette si ffmpeg se termine avec un code non nul', async () => {
      const promise = provider.convertToWav('/tmp/in.mp3', '/tmp/out.wav');
      fakeChild.stderr.emit('data', Buffer.from('erreur de conversion'));
      fakeChild.emit('close', 1);

      await expect(promise).rejects.toThrow(/ffmpeg a échoué/);
    });

    it("rejette si le binaire ffmpeg ne peut pas être lancé (ENOENT)", async () => {
      const promise = provider.convertToWav('/tmp/in.mp3', '/tmp/out.wav');
      fakeChild.emit('error', new Error('ENOENT'));

      await expect(promise).rejects.toThrow(/Échec du lancement de ffmpeg/);
    });
  });

  describe('getDurationSeconds', () => {
    it('retourne la durée arrondie en secondes', async () => {
      const promise = provider.getDurationSeconds('/tmp/in.mp3');
      fakeChild.stdout.emit('data', Buffer.from('12.7\n'));
      fakeChild.emit('close', 0);

      await expect(promise).resolves.toBe(13);
    });

    it('retourne null si ffprobe échoue (best-effort, ne lève jamais)', async () => {
      const promise = provider.getDurationSeconds('/tmp/in.mp3');
      fakeChild.emit('close', 1);

      await expect(promise).resolves.toBeNull();
    });

    it('retourne null si la sortie ffprobe est illisible (NaN)', async () => {
      const promise = provider.getDurationSeconds('/tmp/in.mp3');
      fakeChild.stdout.emit('data', Buffer.from('pas-un-nombre'));
      fakeChild.emit('close', 0);

      await expect(promise).resolves.toBeNull();
    });
  });
});
