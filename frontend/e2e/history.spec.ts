import { expect, test } from "@playwright/test";
import { buildJob, mockCancel, mockDelete, mockJobsList } from "./mocks";

const PENDING_JOB = buildJob({
  id: "job-pending",
  filename: "note-vocale.wav",
  status: "PENDING",
});
const PROCESSING_JOB = buildJob({
  id: "job-processing",
  filename: "podcast-episode-12.mp3",
  status: "PROCESSING",
  progress: 55,
  startedAt: "2026-07-11T09:50:00.000Z",
});
const DONE_JOB = buildJob({
  id: "job-done",
  filename: "interview-client.m4a",
  status: "DONE",
  progress: 100,
  resultText: "Texte de l'interview.",
  completedAt: "2026-07-11T09:00:00.000Z",
});
const FAILED_JOB = buildJob({
  id: "job-failed",
  filename: "reunion-corrompue.mp3",
  status: "FAILED",
  errorMessage: "Le fichier audio est corrompu ou dans un format non supporté.",
});

const ALL_JOBS = [PENDING_JOB, PROCESSING_JOB, DONE_JOB, FAILED_JOB];

test.describe("Écran Historique", () => {
  test.beforeEach(async ({ page }) => {
    await mockJobsList(page, ALL_JOBS);
  });

  test("affiche les 4 statuts et les actions contextuelles correctes", async ({ page }) => {
    await page.goto("/history");

    await expect(page.getByText("note-vocale.wav")).toBeVisible();
    await expect(page.getByText("podcast-episode-12.mp3")).toBeVisible();
    await expect(page.getByText("interview-client.m4a")).toBeVisible();
    await expect(page.getByText("reunion-corrompue.mp3")).toBeVisible();

    // DONE -> ouvrir, exporter (lien vers /jobs/:id), supprimer
    const doneRow = page.locator("div.group", { hasText: "interview-client.m4a" });
    await expect(doneRow.getByTitle("Ouvrir le texte")).toBeVisible();
    await expect(doneRow.getByTitle("Supprimer")).toBeVisible();
    await expect(doneRow.getByTitle("Annuler")).toHaveCount(0);

    // FAILED -> réessayer, supprimer + errorMessage affiché
    const failedRow = page.locator("div.group", { hasText: "reunion-corrompue.mp3" });
    await expect(failedRow.getByTitle("Réessayer (nouvelle transcription)")).toBeVisible();
    await expect(failedRow.getByTitle("Supprimer")).toBeVisible();
    await expect(page.getByText("Le fichier audio est corrompu ou dans un format non supporté.")).toBeVisible();

    // PENDING / PROCESSING -> annuler uniquement
    const pendingRow = page.locator("div.group", { hasText: "note-vocale.wav" });
    await expect(pendingRow.getByTitle("Annuler")).toBeVisible();
    await expect(pendingRow.getByTitle("Supprimer")).toHaveCount(0);

    const processingRow = page.locator("div.group", { hasText: "podcast-episode-12.mp3" });
    await expect(processingRow.getByTitle("Annuler")).toBeVisible();
  });

  test("le filtre par statut réduit la liste affichée", async ({ page }) => {
    await page.goto("/history");

    await expect(page.getByText("note-vocale.wav")).toBeVisible();
    await expect(page.getByText("interview-client.m4a")).toBeVisible();

    await page.getByRole("button", { name: "Terminé" }).click();

    await expect(page.getByText("interview-client.m4a")).toBeVisible();
    await expect(page.getByText("note-vocale.wav")).toHaveCount(0);
    await expect(page.getByText("podcast-episode-12.mp3")).toHaveCount(0);
    await expect(page.getByText("reunion-corrompue.mp3")).toHaveCount(0);

    await page.getByRole("button", { name: "Échec" }).click();
    await expect(page.getByText("reunion-corrompue.mp3")).toBeVisible();
    await expect(page.getByText("interview-client.m4a")).toHaveCount(0);
  });

  test("annuler depuis l'historique appelle POST /jobs/:id/cancel", async ({ page }) => {
    await mockCancel(page, PENDING_JOB.id);
    await page.goto("/history");

    const pendingRow = page.locator("div.group", { hasText: "note-vocale.wav" });
    const cancelRequest = page.waitForRequest(
      (req) => req.url().includes(`/jobs/${PENDING_JOB.id}/cancel`) && req.method() === "POST",
    );
    await pendingRow.getByTitle("Annuler").click();
    await cancelRequest;
  });

  test("supprimer depuis l'historique appelle DELETE /jobs/:id après confirmation", async ({ page }) => {
    await mockDelete(page, DONE_JOB.id);
    page.once("dialog", (dialog) => dialog.accept());

    await page.goto("/history");

    const doneRow = page.locator("div.group", { hasText: "interview-client.m4a" });
    const deleteRequest = page.waitForRequest(
      (req) => req.url().includes(`/jobs/${DONE_JOB.id}`) && req.method() === "DELETE",
    );
    await doneRow.getByTitle("Supprimer").click();
    await deleteRequest;
  });
});
