import { Transform } from 'class-transformer';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { WhisperLanguageCode, WhisperModelName } from '../../transcription/domain/transcription-job.entity';

/**
 * DTO d'entrée — `POST /uploads`.
 * Le fichier lui-même est géré séparément par l'intercepteur Multer
 * (`@UploadedFile()`), ce DTO ne porte que les champs texte du formulaire.
 */
export class UploadAudioDto {
  @IsOptional()
  @IsEnum(WhisperModelName, {
    message: `model doit être l'un de : ${Object.values(WhisperModelName).join(', ')}`,
  })
  model: WhisperModelName = WhisperModelName.MEDIUM;

  @IsOptional()
  @IsEnum(WhisperLanguageCode, {
    message: `language doit être l'un de : ${Object.values(WhisperLanguageCode).join(', ')}`,
  })
  language: WhisperLanguageCode = WhisperLanguageCode.FR;

  /**
   * Diarisation opt-in (case à cocher côté UI) — reçue en `multipart/
   * form-data` donc sous forme de chaîne ("true"/"false"), d'où le
   * `@Transform` explicite avant validation (cf. ADR section 11).
   */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  diarizationEnabled: boolean = false;
}
