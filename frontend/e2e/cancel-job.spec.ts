import { expect, test } from "@playwright/test";
import { buildJob, mockCancel, mockJobSequence, mockJobsList } from "./mocks";

test.describe("Annulation d'un job", () => {
  test("annuler un job PROCESSING affiche le badge FAILED standard avec le message d'annulation", async ({
    page,
  }) => {
    const jobId = "job-cancel-1";

    const processingJob = buildJob({
      id: jobId,
      status: "PROCESSING",
      progress: 10,
      startedAt: "2026-07-11T10:00:00.000Z",
    });
    const cancelledJob = buildJob({
      id: jobId,
      status: "FAILED",
      progress: 10,
      startedAt: "2026-07-11T10:00:00.000Z",
      completedAt: "2026-07-11T10:00:20.000Z",
      errorMessage: "Annulé par l'utilisateur",
    });

    // Deux premières requêtes GET renvoient PROCESSING (chargement initial +
    // éventuel tick de polling), puis la valeur reste FAILED après l'annulation.
    await mockJobSequence(page, jobId, [processingJob, processingJob, cancelledJob]);
    await mockCancel(page, jobId);
    await mockJobsList(page, [processingJob]);

    await page.goto(`/jobs/${jobId}`);

    await expect(page.getByRole("heading", { name: "Transcription en cours" })).toBeVisible();

    const cancelButton = page.getByRole("button", { name: /cancel job/i });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    // Après l'annulation : badge FAILED standard ("Échec"), pas de badge
    // "Annulé" séparé — seul errorMessage distingue l'annulation à l'affichage.
    await expect(page.getByRole("heading", { name: "Échec de la transcription" })).toBeVisible();
    await expect(page.getByText("Annulé par l'utilisateur")).toBeVisible();

    // Pas de badge "Annulé" séparé (cf. CLAUDE.md règle 3) — seul le message
    // d'erreur distingue l'annulation, aucun libellé de badge dédié n'existe.
    await expect(page.getByText("Annulé", { exact: true })).toHaveCount(0);
  });

  test("bouton Annuler visible uniquement pour PENDING et PROCESSING, absent pour DONE", async ({ page }) => {
    const jobId = "job-done-no-cancel";
    const doneJob = buildJob({
      id: jobId,
      status: "DONE",
      progress: 100,
      resultText: "Texte terminé.",
      completedAt: "2026-07-11T10:05:00.000Z",
    });

    await mockJobSequence(page, jobId, [doneJob]);
    await mockJobsList(page, [doneJob]);

    await page.goto(`/jobs/${jobId}`);

    await expect(page.getByText("Texte terminé.")).toBeVisible();
    await expect(page.getByRole("button", { name: /cancel job/i })).toHaveCount(0);
  });
});
