-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "TranscriptionJob" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "model" TEXT NOT NULL DEFAULT 'medium',
    "language" TEXT NOT NULL DEFAULT 'fr',
    "durationSeconds" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "resultText" TEXT,
    "resultSrt" TEXT,
    "errorMessage" TEXT,
    "lowConfidenceRatio" DOUBLE PRECISION,
    "isLowConfidenceWarning" BOOLEAN NOT NULL DEFAULT false,
    "diarizationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "speakerSegments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TranscriptionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranscriptionJob_status_idx" ON "TranscriptionJob"("status");

-- CreateIndex
CREATE INDEX "TranscriptionJob_createdAt_idx" ON "TranscriptionJob"("createdAt");
