import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import whisperConfig from '../../shared/config/whisper.config';
import { DiarizationSegment } from './speaker-merge';

/**
 * Délai d'attente avant abandon de l'appel au service de diarisation.
 * Décision technique non couverte par l'ADR : la diarisation pyannote sur
 * CPU peut prendre plusieurs minutes sur un audio long — 10 minutes laisse
 * une marge raisonnable sans bloquer indéfiniment un job en cas de service
 * bloqué (cf. règle "jamais bloquant", ADR section 11).
 */
const DIARIZATION_TIMEOUT_MS = 10 * 60 * 1000;

/**
 * Infrastructure — appel HTTP vers le service Python de diarisation
 * (`diarization/`, FastAPI + pyannote.audio), interne au réseau Docker
 * Compose.
 *
 * Règle absolue (ADR section 11) : cette méthode ne doit JAMAIS lever
 * d'exception au sens où l'appelant aurait à la traiter comme un échec de
 * job — toute erreur (timeout, service down, erreur pyannote) est
 * capturée ici, loguée en warning, et se traduit par un retour `null`.
 */
@Injectable()
export class DiarizationProvider {
  private readonly logger = new Logger(DiarizationProvider.name);

  constructor(
    @Inject(whisperConfig.KEY)
    private readonly config: ConfigType<typeof whisperConfig>,
  ) {}

  async diarize(wavFilePath: string): Promise<DiarizationSegment[] | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DIARIZATION_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.config.diarizationServiceUrl}/diarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: wavFilePath }),
        signal: controller.signal,
      });

      if (!response.ok) {
        this.logger.warn(
          `Service de diarisation en échec (HTTP ${response.status}) pour ${wavFilePath} — job conservé sans locuteurs`,
        );
        return null;
      }

      const data = (await response.json()) as { segments?: DiarizationSegment[] };
      return data.segments ?? [];
    } catch (error) {
      this.logger.warn(
        `Appel au service de diarisation impossible pour ${wavFilePath} : ${(error as Error).message} — job conservé sans locuteurs`,
      );
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }
}
