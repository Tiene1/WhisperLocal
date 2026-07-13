/** DTO de sortie — `POST /uploads`. */
export class UploadResponseDto {
  jobId!: string;

  static of(jobId: string): UploadResponseDto {
    const dto = new UploadResponseDto();
    dto.jobId = jobId;
    return dto;
  }
}
