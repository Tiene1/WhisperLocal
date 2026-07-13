import { expect, test } from "@playwright/test";
import { buildJob, mockJobSequence, mockJobsList, mockUpload } from "./mocks";

test.describe("Parcours Upload -> Suivi -> Résultat", () => {
  test("upload d'un fichier, suivi PROCESSING puis affichage du résultat DONE", async ({ page }) => {
    const jobId = "job-happy-1";

    await mockJobsList(page, []); // mini-historique vide sur l'écran Upload
    await mockUpload(page, jobId);
    await mockJobSequence(page, jobId, [
      buildJob({ id: jobId, status: "PROCESSING", progress: 42, startedAt: "2026-07-11T10:00:05.000Z" }),
      buildJob({ id: jobId, status: "PROCESSING", progress: 42, startedAt: "2026-07-11T10:00:05.000Z" }),
      buildJob({
        id: jobId,
        status: "DONE",
        progress: 100,
        startedAt: "2026-07-11T10:00:05.000Z",
        completedAt: "2026-07-11T10:01:30.000Z",
        resultText: "Ceci est le texte transcrit de la réunion.\n\nDeuxième paragraphe du résultat.",
      }),
    ]);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Nouvelle Transcription" })).toBeVisible();

    // Upload du fichier via l'input caché.
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "reunion-equipe.mp3",
      mimeType: "audio/mpeg",
      buffer: Buffer.from("contenu audio factice"),
    });

    await expect(page.getByText("reunion-equipe.mp3")).toBeVisible();

    await page.getByRole("button", { name: /démarrer la transcription/i }).click();

    // Redirection vers /jobs/:id
    await page.waitForURL(`**/jobs/${jobId}`);

    // Statut PROCESSING affiché (badge + vue traitement)
    await expect(page.getByRole("heading", { name: "Transcription en cours" })).toBeVisible();
    await expect(page.getByText("En cours", { exact: false }).first()).toBeVisible();

    // Le polling (intervalle 4s) finit par renvoyer DONE.
    await expect(page.getByText("Ceci est le texte transcrit de la réunion.")).toBeVisible({ timeout: 15_000 });

    // Les 3 boutons export sont affichés.
    await expect(page.getByRole("link", { name: /télécharger txt/i })).toBeVisible();
    await expect(page.getByRole("link", { name: "SRT" })).toBeVisible();
    await expect(page.getByRole("link", { name: "DOCX" })).toBeVisible();
  });

  test("un fichier dépassant 250 Mo est rejeté côté client sans requête réseau", async ({ page }) => {
    await mockJobsList(page, []);

    let uploadRequestSent = false;
    await page.route("http://localhost:3000/uploads", async (route) => {
      uploadRequestSent = true;
      await route.fulfill({ status: 200, json: { jobId: "should-not-happen" } });
    });

    await page.goto("/");

    // On simule un fichier de 251 Mo sans réellement transférer 251 Mo de
    // données au navigateur : on force la propriété `size` du File créé
    // côté page, ce qui est suffisant pour exercer la validation client
    // (`candidate.size > MAX_UPLOAD_SIZE_BYTES` dans UploadForm.tsx).
    await page.evaluate(() => {
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["contenu factice"], "fichier-trop-gros.wav", { type: "audio/wav" });
      Object.defineProperty(file, "size", { value: 251 * 1024 * 1024 });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    await expect(page.getByText(/dépasse la taille maximale autorisée/i)).toBeVisible();

    // Le bouton d'envoi reste désactivé — aucun fichier valide sélectionné.
    await expect(page.getByRole("button", { name: /démarrer la transcription/i })).toBeDisabled();

    // Laisse le temps à une éventuelle requête erronée de partir.
    await page.waitForTimeout(500);
    expect(uploadRequestSent).toBe(false);
  });
});
