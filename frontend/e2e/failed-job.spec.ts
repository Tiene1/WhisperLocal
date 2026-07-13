import { expect, test } from "@playwright/test";
import { buildJob, mockJobSequence, mockJobsList } from "./mocks";

test.describe("Job en échec réel (non annulé)", () => {
  test("affiche l'errorMessage réel du job FAILED", async ({ page }) => {
    const jobId = "job-real-failure";
    const failedJob = buildJob({
      id: jobId,
      filename: "enregistrement-corrompu.wav",
      status: "FAILED",
      startedAt: "2026-07-11T08:00:00.000Z",
      completedAt: "2026-07-11T08:00:12.000Z",
      errorMessage: "whisper.cpp a échoué : format audio non reconnu après conversion ffmpeg.",
    });

    await mockJobSequence(page, jobId, [failedJob]);
    await mockJobsList(page, [failedJob]);

    await page.goto(`/jobs/${jobId}`);

    await expect(page.getByRole("heading", { name: "Échec de la transcription" })).toBeVisible();
    await expect(page.getByText("enregistrement-corrompu.wav")).toBeVisible();
    await expect(
      page.getByText("whisper.cpp a échoué : format audio non reconnu après conversion ffmpeg."),
    ).toBeVisible();

    // Pas de bouton Annuler sur un job déjà terminal.
    await expect(page.getByRole("button", { name: /cancel job/i })).toHaveCount(0);

    // Actions de repli disponibles.
    await expect(page.getByRole("link", { name: /retour à l'historique/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /nouvelle transcription/i })).toBeVisible();
  });
});
