import { registerAs } from '@nestjs/config';

/**
 * Configuration centralisée whisper.cpp / ffmpeg / stockage temporaire.
 *
 * Règle absolue (CLAUDE.md) : aucun chemin ni secret hardcodé ailleurs
 * dans le code — tout passe par ce fichier, alimenté par les variables
 * d'environnement (.env).
 */
const whisperConfig = registerAs('whisper', () => ({
  /** Chemin vers le binaire whisper.cpp compilé (ex: whisper-cli). */
  binaryPath: process.env.WHISPER_CPP_BINARY_PATH ?? '/usr/local/bin/whisper-cli',

  /** Dossier contenant les modèles ggml (ggml-medium.bin, etc.). */
  modelsDir: process.env.WHISPER_MODELS_DIR ?? '/models',

  /** Chemin vers le binaire ffmpeg (conversion audio). */
  ffmpegPath: process.env.FFMPEG_BINARY_PATH ?? '/usr/bin/ffmpeg',

  /** Chemin vers le binaire ffprobe (extraction de la durée audio). */
  ffprobePath: process.env.FFPROBE_BINARY_PATH ?? '/usr/bin/ffprobe',

  /** Dossier de travail pour les fichiers audio uploadés/convertis. */
  uploadTmpDir: process.env.UPLOAD_TMP_DIR ?? '/tmp/whisperlocal-uploads',

  /** Taille maximale d'un fichier audio, en octets (250 Mo par défaut). */
  maxUploadSizeBytes: (Number(process.env.MAX_UPLOAD_SIZE_MB) || 250) * 1024 * 1024,

  /**
   * Concurrence de la file d'attente de transcription.
   * Fixée à 1 (cf. ADR — pas de Redis/BullMQ, un seul job whisper.cpp
   * à la fois sur la machine locale).
   */
  queueConcurrency: 1,

  /** Modèles Whisper supportés — "medium" est le seul requis au setup. */
  availableModels: ['base', 'small', 'medium', 'large'] as const,

  /** Langues supportées côté sélection utilisateur. */
  availableLanguages: ['auto', 'fr', 'en', 'es'] as const,

  /** Extensions de fichiers audio autorisées à l'upload. */
  allowedAudioExtensions: [
    '.wav',
    '.mp3',
    '.m4a',
    '.flac',
    '.ogg',
    '.webm',
    '.aac',
    '.mp4',
  ] as const,

  /**
   * URL du service Python de diarisation (`diarization/`, FastAPI +
   * pyannote.audio), interne au réseau Docker Compose — jamais exposé côté
   * hôte. Fonctionnalité opt-in, jamais bloquante (cf. ADR section 11).
   */
  diarizationServiceUrl: process.env.DIARIZATION_SERVICE_URL ?? 'http://diarization:8001',
}));

export type WhisperConfig = ReturnType<typeof whisperConfig>;
export default whisperConfig;
