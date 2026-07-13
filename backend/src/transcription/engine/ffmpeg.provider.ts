import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { spawn } from 'child_process';
import whisperConfig from '../../shared/config/whisper.config';

/**
 * Infrastructure — conversion audio (ffmpeg) et extraction de la durée
 * (ffprobe) en subprocess.
 *
 * Règle absolue (CLAUDE.md) : jamais `exec()` — toujours `spawn()` avec
 * arguments en tableau, pour éviter toute injection shell.
 */
@Injectable()
export class FfmpegProvider {
  private readonly logger = new Logger(FfmpegProvider.name);

  constructor(
    @Inject(whisperConfig.KEY)
    private readonly config: ConfigType<typeof whisperConfig>,
  ) {}

  /**
   * Convertit un fichier audio quelconque en WAV 16kHz mono PCM 16 bits,
   * format attendu par whisper.cpp.
   */
  async convertToWav(inputPath: string, outputPath: string): Promise<void> {
    const args = [
      '-y', // écrase le fichier de sortie s'il existe déjà
      '-i',
      inputPath,
      '-ar',
      '16000',
      '-ac',
      '1',
      '-c:a',
      'pcm_s16le',
      outputPath,
    ];

    await this.runProcess(this.config.ffmpegPath, args, 'ffmpeg');
  }

  /** Extrait la durée du fichier audio en secondes (arrondi). */
  async getDurationSeconds(inputPath: string): Promise<number | null> {
    const args = [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      inputPath,
    ];

    try {
      const stdout = await this.runProcess(this.config.ffprobePath, args, 'ffprobe');
      const duration = Number.parseFloat(stdout.trim());
      if (Number.isNaN(duration)) {
        return null;
      }
      return Math.round(duration);
    } catch (error) {
      this.logger.warn(`Impossible d'extraire la durée audio : ${(error as Error).message}`);
      return null;
    }
  }

  private runProcess(binaryPath: string, args: string[], label: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(binaryPath, args);
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        reject(new Error(`Échec du lancement de ${label} (${binaryPath}) : ${error.message}`));
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`${label} a échoué (code ${code}) : ${stderr || 'erreur inconnue'}`));
        }
      });
    });
  }
}
