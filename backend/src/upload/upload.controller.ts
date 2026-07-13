import { Body, Controller, HttpCode, HttpStatus, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadAudioDto } from './dto/upload-audio.dto';
import { UploadResponseDto } from './dto/upload-response.dto';
import { AudioFileValidationPipe } from './validators/audio-file.validator';
import { UploadService } from './upload.service';

/**
 * Présentation — `POST /uploads`. Aucune logique métier ici : validation
 * déléguée à `AudioFileValidationPipe`, orchestration à `UploadService`.
 */
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile(AudioFileValidationPipe) file: Express.Multer.File,
    @Body() dto: UploadAudioDto,
  ): Promise<UploadResponseDto> {
    const jobId = await this.uploadService.handleUpload(file, dto);
    return UploadResponseDto.of(jobId);
  }
}
