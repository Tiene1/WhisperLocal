import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import { promises as fs } from 'fs';
import * as path from 'path';
import whisperConfig from '../../shared/config/whisper.config';
import { WhisperLanguageCode, WhisperModelName } from '../domain/transcription-job.entity';
import { JobCancelledError } from '../errors/job-cancelled.error';
import { stripKnownHallucinations, stripKnownHallucinationsFromSrt } from './hallucination-filter';

export interface WhisperTranscribeOptions {
  jobId: string;
  wavFilePath: string;
  model: WhisperModelName;
  language: WhisperLanguageCode;
  /** Appelé au mieux (best-effort) avec un pourcentage 0-100 dès qu'il est détecté. */
  onProgress?: (progressPercent: number) => void;
}

export interface WhisperTranscribeResult {
  text: string;
  srt: string;
}

/** Délai avant repli SIGKILL si SIGTERM n'a pas suffi (cf. ADR Risque 7). */
const SIGKILL_FALLBACK_DELAY_MS = 3000;

/** Regex best-effort pour capter une ligne de progression sur stderr. */
const PROGRESS_REGEX = /progress\s*=\s*(\d{1,3})%/i;

/**
 * Infrastructure — appel whisper.cpp en subprocess.
 *
 * Règle absolue (CLAUDE.md) : jamais `exec()` — toujours `spawn()`.
 */
@Injectable()
export class WhisperCppProvider {
  private readonly logger = new Logger(WhisperCppProvider.name);

  /** Processus actifs indexés par jobId, pour permettre l'annulation. */
  private readonly activeProcesses = new Map<string, ChildProcessWithoutNullStreams>();
  /** Jobs marqués comme annulés par l'utilisateur (pour distinguer d'un échec réel). */
  private readonly cancelledJobIds = new Set<string>();

  constructor(
    @Inject(whisperConfig.KEY)
    private readonly config: ConfigType<typeof whisperConfig>,
  ) {}

  async transcribe(options: WhisperTranscribeOptions): Promise<WhisperTranscribeResult> {
    const { jobId, wavFilePath, model, language, onProgress } = options;
    const modelPath = path.join(this.config.modelsDir, `ggml-${model}.bin`);
    const outputBase = wavFilePath.replace(/\.wav$/i, '');

    const args = [
      '-m',
      modelPath,
      '-f',
      wavFilePath,
      '-l',
      language,
      '-otxt',
      '-osrt',
      '-of',
      outputBase,
    ];

    await this.runWhisperProcess(jobId, args, onProgress);

    const [rawText, rawSrt] = await Promise.all([
      this.readOutputFile(`${outputBase}.txt`),
      this.readOutputFile(`${outputBase}.srt`),
    ]);

    // Whisper hallucine parfois un générique de fin de sous-titrage appris
    // à l'entraînement (ex. crédit Amara.org) — artefact connu du modèle,
    // filtré ici plutôt que laissé visible à l'utilisateur.
    return {
      text: stripKnownHallucinations(rawText),
      srt: stripKnownHallucinationsFromSrt(rawSrt),
    };
  }

  /**
   * Annule un job en cours : SIGTERM puis SIGKILL en repli si le
   * subprocess ne se termine pas dans le délai imparti
   * (cf. CLAUDE.md règle 8 / ADR Risque 7).
   */
  async kill(jobId: string): Promise<void> {
    const child = this.activeProcesses.get(jobId);
    if (!child) {
      return;
    }

    this.cancelledJobIds.add(jobId);
    child.kill('SIGTERM');

    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        if (this.activeProcesses.has(jobId)) {
          child.kill('SIGKILL');
        }
        resolve();
      }, SIGKILL_FALLBACK_DELAY_MS);

      child.once('close', () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  }

  private runWhisperProcess(
    jobId: string,
    args: string[],
    onProgress?: (progressPercent: number) => void,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.config.binaryPath, args);
      this.activeProcesses.set(jobId, child);

      let stderrBuffer = '';

      child.stderr.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        stderrBuffer += text;

        // Progression best-effort (Risque 5 ADR) — ne lève jamais d'erreur
        // si le binaire n'expose pas cette info.
        const match = PROGRESS_REGEX.exec(text);
        if (match && onProgress) {
          const percent = Number.parseInt(match[1], 10);
          if (!Number.isNaN(percent)) {
            onProgress(Math.min(100, Math.max(0, percent)));
          }
        }
      });

      child.on('error', (error) => {
        this.activeProcesses.delete(jobId);
        reject(new Error(`Échec du lancement de whisper.cpp : ${error.message}`));
      });

      child.on('close', (code) => {
        this.activeProcesses.delete(jobId);
        const wasCancelled = this.cancelledJobIds.delete(jobId);

        if (wasCancelled) {
          reject(new JobCancelledError(jobId));
          return;
        }

        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(
              `whisper.cpp a échoué (code ${code}) : ${stderrBuffer.trim() || 'erreur inconnue'}`,
            ),
          );
        }
      });
    });
  }

  private async readOutputFile(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      this.logger.warn(`Fichier de sortie whisper.cpp introuvable : ${filePath}`);
      return '';
    }
  }
}
