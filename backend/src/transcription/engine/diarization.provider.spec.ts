import { DiarizationProvider } from './diarization.provider';
import whisperConfig from '../../shared/config/whisper.config';

describe('DiarizationProvider', () => {
  let provider: DiarizationProvider;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    provider = new DiarizationProvider(whisperConfig());
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retourne les segments renvoyés par le service en cas de succès', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          segments: [{ speaker: 'SPEAKER_00', start: 0, end: 2 }],
        }),
    });

    const result = await provider.diarize('/tmp/job-1.wav');

    expect(result).toEqual([{ speaker: 'SPEAKER_00', start: 0, end: 2 }]);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/diarize'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ filePath: '/tmp/job-1.wav' }),
      }),
    );
  });

  it("retourne null (jamais d'exception) si le service répond avec une erreur HTTP", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });

    await expect(provider.diarize('/tmp/job-1.wav')).resolves.toBeNull();
  });

  it("retourne null (jamais d'exception) si l'appel HTTP échoue (service down)", async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(provider.diarize('/tmp/job-1.wav')).resolves.toBeNull();
  });

  it("retourne null si l'appel expire (timeout / AbortError)", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));

    await expect(provider.diarize('/tmp/job-1.wav')).resolves.toBeNull();
  });

  it('retourne un tableau vide si le service répond sans champ segments', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });

    await expect(provider.diarize('/tmp/job-1.wav')).resolves.toEqual([]);
  });
});
