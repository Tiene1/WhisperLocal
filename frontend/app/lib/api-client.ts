// Point d'entrée UNIQUE pour tous les appels à l'API NestJS.
// Règle absolue (cf. CLAUDE.md) : aucun composant ne doit fetch()
// directement — tout passe par ce module.

import type { ExportFormat, JobLanguage, ModelSize, TranscriptionJob, UploadResponse } from "@/app/types/job";

// URL de base configurable via variable d'environnement — jamais hardcodée
// (cf. mission : setup portable, cf. ADR NFR Portabilité).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

/** Taille max acceptée côté client, alignée sur le backend (cf. ADR §1, docker-compose MAX_UPLOAD_SIZE_MB). */
export const MAX_UPLOAD_SIZE_BYTES = 250 * 1024 * 1024;

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Impossible de joindre l'API WhisperLocal. Vérifiez que le backend est démarré.", 0);
  }

  if (!res.ok) {
    let message = `Erreur API (${res.status})`;
    try {
      const body = await res.json();
      if (typeof body?.message === "string") {
        message = body.message;
      } else if (Array.isArray(body?.message)) {
        message = body.message.join(", ");
      }
    } catch {
      // corps non-JSON, on garde le message générique
    }
    throw new ApiError(message, res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return (await res.json()) as T;
}

/** POST /uploads — multipart (file, model, language, diarizationEnabled) -> { jobId } */
export async function uploadAudio(
  file: File,
  model: ModelSize,
  language: JobLanguage,
  diarizationEnabled = false,
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("model", model);
  formData.append("language", language);
  formData.append("diarizationEnabled", String(diarizationEnabled));

  return request<UploadResponse>("/uploads", {
    method: "POST",
    body: formData,
  });
}

/** GET /jobs/:id — statut détaillé, utilisé par le polling. */
export async function fetchJob(id: string): Promise<TranscriptionJob> {
  return request<TranscriptionJob>(`/jobs/${id}`);
}

/** GET /jobs — liste complète pour l'historique. */
export async function fetchJobs(): Promise<TranscriptionJob[]> {
  return request<TranscriptionJob[]>("/jobs");
}

/** POST /jobs/:id/cancel — visible seulement PENDING/PROCESSING. */
export async function cancelJob(id: string): Promise<void> {
  await request<void>(`/jobs/${id}/cancel`, { method: "POST" });
}

/** DELETE /jobs/:id — suppression d'une entrée d'historique. */
export async function deleteJob(id: string): Promise<void> {
  await request<void>(`/jobs/${id}`, { method: "DELETE" });
}

/** URL de téléchargement directe pour un format d'export donné. */
export function getExportUrl(id: string, format: ExportFormat): string {
  return `${API_BASE_URL}/jobs/${id}/export?format=${format}`;
}
