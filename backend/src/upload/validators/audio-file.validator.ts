import { BadRequestException, Inject, Injectable, PipeTransform } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import * as path from 'path';
import whisperConfig from '../../shared/config/whisper.config';

/**
 * Validation taille + format du fichier audio, exécutée AVANT tout appel
 * ffmpeg (règle absolue CLAUDE.md).
 */
@Injectable()
export class AudioFileValidationPipe implements PipeTransform<Express.Multer.File, Express.Multer.File> {
  constructor(
    @Inject(whisperConfig.KEY)
    private readonly config: ConfigType<typeof whisperConfig>,
  ) {}

  transform(file: Express.Multer.File): Express.Multer.File {
    if (!file) {
      throw new BadRequestException('Aucun fichier audio fourni (champ "file" attendu)');
    }

    if (file.size > this.config.maxUploadSizeBytes) {
      const maxMb = Math.round(this.config.maxUploadSizeBytes / (1024 * 1024));
      throw new BadRequestException(`Fichier trop volumineux — taille maximale autorisée : ${maxMb} Mo`);
    }

    const extension = path.extname(file.originalname).toLowerCase();
    if (!this.config.allowedAudioExtensions.includes(extension as never)) {
      throw new BadRequestException(
        `Format de fichier non supporté (${extension || 'inconnu'}) — formats acceptés : ${this.config.allowedAudioExtensions.join(', ')}`,
      );
    }

    return file;
  }
}
