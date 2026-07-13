import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  MAX_UPLOAD_SIZE_BYTES,
  cancelJob,
  deleteJob,
  fetchJob,
  fetchJobs,
  getExportUrl,
  uploadAudio,
} from "./api-client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api-client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("MAX_UPLOAD_SIZE_BYTES vaut bien 250 Mo, aligné sur la limite backend", () => {
    expect(MAX_UPLOAD_SIZE_BYTES).toBe(250 * 1024 * 1024);
  });

  describe("fetchJob", () => {
    it("appelle GET /jobs/:id et retourne le job parsé", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ id: "job-1", status: "DONE" }),
      );

      const result = await fetchJob("job-1");

      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/jobs/job-1"),
        expect.objectContaining({ cache: "no-store" }),
      );
      expect(result).toEqual({ id: "job-1", status: "DONE" });
    });

    it("lève ApiError avec le message du corps JSON en cas d'erreur HTTP", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ message: "Job inconnu" }, 404),
      );

      await expect(fetchJob("inconnu")).rejects.toMatchObject({
        name: "ApiError",
        status: 404,
        message: "Job inconnu",
      });
    });

    it("joint un tableau de messages de validation avec une virgule", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ message: ["model invalide", "language invalide"] }, 400),
      );

      await expect(fetchJob("job-1")).rejects.toMatchObject({
        message: "model invalide, language invalide",
      });
    });

    it("retombe sur un message générique si le corps d'erreur n'est pas du JSON exploitable", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        new Response("<html>500</html>", { status: 500 }),
      );

      await expect(fetchJob("job-1")).rejects.toMatchObject({
        message: "Erreur API (500)",
        status: 500,
      });
    });

    it("lève ApiError(status=0) si le réseau est injoignable (backend non démarré)", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new TypeError("fetch failed"));

      await expect(fetchJob("job-1")).rejects.toMatchObject({
        status: 0,
        name: "ApiError",
      });
    });
  });

  describe("fetchJobs", () => {
    it("appelle GET /jobs", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(jsonResponse([]));
      await fetchJobs();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/jobs$/),
        expect.anything(),
      );
    });
  });

  describe("uploadAudio", () => {
    it("envoie un FormData multipart avec file/model/language en POST /uploads", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ jobId: "job-42" }, 201),
      );
      const file = new File(["contenu"], "a.mp3", { type: "audio/mpeg" });

      const result = await uploadAudio(file, "medium", "fr");

      expect(result).toEqual({ jobId: "job-42" });
      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain("/uploads");
      expect(init.method).toBe("POST");
      expect(init.body).toBeInstanceOf(FormData);
      expect((init.body as FormData).get("model")).toBe("medium");
      expect((init.body as FormData).get("language")).toBe("fr");
      expect((init.body as FormData).get("diarizationEnabled")).toBe("false");
    });

    it("envoie diarizationEnabled=true quand demandé explicitement", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
        jsonResponse({ jobId: "job-42" }, 201),
      );
      const file = new File(["contenu"], "a.mp3", { type: "audio/mpeg" });

      await uploadAudio(file, "medium", "fr", true);

      const [, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect((init.body as FormData).get("diarizationEnabled")).toBe("true");
    });
  });

  describe("cancelJob / deleteJob", () => {
    it("cancelJob() appelle POST /jobs/:id/cancel et gère une réponse 204 sans corps", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(null, { status: 204 }));

      await expect(cancelJob("job-1")).resolves.toBeUndefined();
      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain("/jobs/job-1/cancel");
      expect(init.method).toBe("POST");
    });

    it("deleteJob() appelle DELETE /jobs/:id", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(new Response(null, { status: 204 }));

      await deleteJob("job-1");
      const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain("/jobs/job-1");
      expect(init.method).toBe("DELETE");
    });
  });

  describe("getExportUrl", () => {
    it("construit une URL de téléchargement directe pour chaque format", () => {
      expect(getExportUrl("job-1", "txt")).toContain("/jobs/job-1/export?format=txt");
      expect(getExportUrl("job-1", "srt")).toContain("/jobs/job-1/export?format=srt");
      expect(getExportUrl("job-1", "docx")).toContain("/jobs/job-1/export?format=docx");
    });
  });

  describe("ApiError", () => {
    it("porte bien le status HTTP associé", () => {
      const error = new ApiError("oups", 500);
      expect(error.status).toBe(500);
      expect(error.message).toBe("oups");
      expect(error.name).toBe("ApiError");
    });
  });
});
