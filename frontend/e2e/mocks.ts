import type { Page } from "@playwright/test";

/**
 * Helpers de mock API pour les tests E2E — interceptent toutes les
 * requêtes vers l'API NestJS via `page.route()` (cf. mission QA : pas de
 * backend réel ni de whisper.cpp disponible dans cet environnement).
 *
 * Miroir du contrat exposé par `app/lib/api-client.ts` et
 * `backend/docs/architecture.md` (section "Contrat API").
 */

export type JobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";

export interface MockSpeakerSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

export interface MockJob {
  id: string;
  filename: string;
  status: JobStatus;
  model: string;
  language: string;
  durationSeconds: number | null;
  progress: number;
  resultText: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  diarizationEnabled: boolean;
  speakerSegments: MockSpeakerSegment[] | null;
}

const NOW = "2026-07-11T10:00:00.000Z";

/**
 * Origine de l'API mockée — doit correspondre à `NEXT_PUBLIC_API_URL`
 * (par défaut `http://localhost:3000`, cf. app/lib/api-client.ts).
 *
 * Important : les patterns de route doivent toujours être préfixés par
 * cette origine absolue. Un pattern relatif comme `**\/jobs/:id` matcherait
 * aussi bien l'URL de l'API que l'URL de la page Next.js elle-même
 * (`http://localhost:3100/jobs/:id`), ce qui interromprait la navigation
 * de l'app avec le JSON mocké au lieu du HTML de la page.
 */
const API_ORIGIN = "http://localhost:3000";

/** Construit un job complet avec des valeurs par défaut raisonnables — ne
 * fournir que les champs pertinents pour le scénario testé. */
export function buildJob(overrides: Partial<MockJob> & { id: string }): MockJob {
  return {
    filename: "reunion-equipe.mp3",
    status: "PENDING",
    model: "medium",
    language: "fr",
    durationSeconds: 125,
    progress: 0,
    resultText: null,
    errorMessage: null,
    createdAt: NOW,
    updatedAt: NOW,
    startedAt: null,
    completedAt: null,
    diarizationEnabled: false,
    speakerSegments: null,
    ...overrides,
  };
}

/** Mocke `POST /uploads` -> `{ jobId }`. */
export async function mockUpload(page: Page, jobId: string) {
  await page.route(`${API_ORIGIN}/uploads`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, json: { jobId } });
  });
}

/**
 * Mocke `GET /jobs/:id` avec une séquence de réponses successives : la
 * première requête reçoit `sequence[0]`, la suivante `sequence[1]`, etc.
 * La dernière valeur de la séquence est répétée pour toute requête
 * supplémentaire (utile pour simuler l'arrêt du polling une fois l'état
 * terminal atteint).
 */
export async function mockJobSequence(page: Page, id: string, sequence: MockJob[]) {
  let callCount = 0;
  await page.route(`${API_ORIGIN}/jobs/${id}`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    const index = Math.min(callCount, sequence.length - 1);
    callCount += 1;
    await route.fulfill({ status: 200, json: sequence[index] });
  });
}

/** Mocke `GET /jobs/:id` avec une réponse fixe (pas de polling multi-étapes). */
export async function mockJob(page: Page, job: MockJob) {
  await mockJobSequence(page, job.id, [job]);
}

/** Mocke `GET /jobs` (liste complète — écran Historique + mini-liste Upload). */
export async function mockJobsList(page: Page, jobs: MockJob[]) {
  await page.route(`${API_ORIGIN}/jobs`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, json: jobs });
  });
}

/** Mocke `POST /jobs/:id/cancel`. */
export async function mockCancel(page: Page, id: string) {
  await page.route(`${API_ORIGIN}/jobs/${id}/cancel`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 200, json: {} });
  });
}

/** Mocke `DELETE /jobs/:id`. */
export async function mockDelete(page: Page, id: string) {
  await page.route(`${API_ORIGIN}/jobs/${id}`, async (route) => {
    if (route.request().method() !== "DELETE") {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 204 });
  });
}
