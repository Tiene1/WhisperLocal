import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import { WhisperCppProvider } from './whisper-cpp.provider';
import { JobCancelledError } from '../errors/job-cancelled.error';
import { WhisperLanguageCode, WhisperModelName } from '../domain/transcription-job.entity';
import whisperConfig from '../../shared/config/whisper.config';

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}));

jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
  },
}));

class FakeChildProcess extends EventEmitter {
  stdout = new EventEmitter();
  stderr = new EventEmitter();
  kill = jest.fn();
}

describe('WhisperCppProvider', () => {
  let provider: WhisperCppProvider;
  let fakeChild: FakeChildProcess;

  beforeEach(() => {
    provider = new WhisperCppProvider(whisperConfig());
    fakeChild = new FakeChildProcess();
    (spawn as jest.Mock).mockReturnValue(fakeChild);
    (fs.readFile as jest.Mock).mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  const options = () => ({
    jobId: 'job-1',
    wavFilePath: '/tmp/job-1.wav',
    model: WhisperModelName.MEDIUM,
    language: WhisperLanguageCode.FR,
  });

  it('transcribe() résout avec le texte et le srt lus depuis les fichiers de sortie', async () => {
    (fs.readFile as jest.Mock).mockImplementation((filePath: string) =>
      filePath.endsWith('.txt') ? Promise.resolve('Bonjour') : Promise.resolve('1\n...'),
    );

    const promise = provider.transcribe(options());
    fakeChild.emit('close', 0);

    await expect(promise).resolves.toEqual({ text: 'Bonjour', srt: '1\n...' });
  });

  it('transcribe() capte la progression best-effort depuis stderr', async () => {
    (fs.readFile as jest.Mock).mockResolvedValue('');
    const onProgress = jest.fn();

    const promise = provider.transcribe({ ...options(), onProgress });
    fakeChild.stderr.emit('data', Buffer.from('whisper_full: progress = 42%\n'));
    fakeChild.emit('close', 0);
    await promise;

    expect(onProgress).toHaveBeenCalledWith(42);
  });

  it("transcribe() ne lève jamais d'erreur si aucune progression n'est exposée par le binaire", async () => {
    (fs.readFile as jest.Mock).mockResolvedValue('');
    const onProgress = jest.fn();

    const promise = provider.transcribe({ ...options(), onProgress });
    fakeChild.stderr.emit('data', Buffer.from('juste un log quelconque, pas de progression\n'));
    fakeChild.emit('close', 0);

    await expect(promise).resolves.toBeDefined();
    expect(onProgress).not.toHaveBeenCalled();
  });

  it('transcribe() retourne une chaîne vide pour un fichier de sortie manquant, sans lever', async () => {
    (fs.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'));

    const promise = provider.transcribe(options());
    fakeChild.emit('close', 0);

    await expect(promise).resolves.toEqual({ text: '', srt: '' });
  });

  it('transcribe() rejette avec un message clair si whisper.cpp échoue (code non nul)', async () => {
    const promise = provider.transcribe(options());
    fakeChild.stderr.emit('data', Buffer.from('crash mémoire'));
    fakeChild.emit('close', 1);

    await expect(promise).rejects.toThrow(/whisper\.cpp a échoué/);
  });

  it("transcribe() rejette avec 'erreur inconnue' si le code est non nul sans sortie stderr", async () => {
    const promise = provider.transcribe(options());
    fakeChild.emit('close', 1);

    await expect(promise).rejects.toThrow(/erreur inconnue/);
  });

  it('transcribe() rejette si le binaire ne peut pas être lancé', async () => {
    const promise = provider.transcribe(options());
    fakeChild.emit('error', new Error('ENOENT'));

    await expect(promise).rejects.toThrow(/Échec du lancement de whisper\.cpp/);
  });

  it('kill() ne fait rien si aucun processus actif pour ce jobId', async () => {
    await expect(provider.kill('inconnu')).resolves.toBeUndefined();
    expect(fakeChild.kill).not.toHaveBeenCalled();
  });

  it('kill() envoie SIGTERM et transcribe() rejette avec JobCancelledError quand le process se termine', async () => {
    (fs.readFile as jest.Mock).mockResolvedValue('');

    const transcribePromise = provider.transcribe(options());
    // Laisse le temps à `activeProcesses` d'être renseigné (synchrone ici).
    const killPromise = provider.kill('job-1');

    expect(fakeChild.kill).toHaveBeenCalledWith('SIGTERM');

    fakeChild.emit('close', null);

    await killPromise;
    await expect(transcribePromise).rejects.toBeInstanceOf(JobCancelledError);
  });

  it('kill() bascule sur SIGKILL si le process ne se termine pas dans le délai imparti', async () => {
    jest.useFakeTimers();
    const transcribePromise = provider.transcribe(options()).catch(() => {
      // Le rejet est attendu (JobCancelledError) — on capture pour éviter
      // une rejection non gérée, l'assertion porte sur kill() ci-dessous.
    });

    const killPromise = provider.kill('job-1');
    expect(fakeChild.kill).toHaveBeenCalledWith('SIGTERM');

    jest.advanceTimersByTime(3000);
    // Le repli SIGKILL a été déclenché sans que 'close' ait été émis.
    expect(fakeChild.kill).toHaveBeenCalledWith('SIGKILL');

    fakeChild.emit('close', null);
    await killPromise;
    await transcribePromise;
  });
});
