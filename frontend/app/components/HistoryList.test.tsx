import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HistoryList from "./HistoryList";
import type { TranscriptionJob } from "@/app/types/job";

const fetchJobsMock = vi.fn();
const cancelJobMock = vi.fn();
const deleteJobMock = vi.fn();

vi.mock("@/app/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/api-client")>(
    "@/app/lib/api-client",
  );
  return {
    ...actual,
    fetchJobs: (...args: unknown[]) => fetchJobsMock(...args),
    cancelJob: (...args: unknown[]) => cancelJobMock(...args),
    deleteJob: (...args: unknown[]) => deleteJobMock(...args),
  };
});

function buildJob(overrides: Partial<TranscriptionJob> = {}): TranscriptionJob {
  return {
    id: "job-1",
    filename: "interview.mp3",
    status: "DONE",
    model: "medium",
    language: "fr",
    durationSeconds: 90,
    progress: 100,
    resultText: "texte",
    errorMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    diarizationEnabled: false,
    speakerSegments: null,
    ...overrides,
  };
}

describe("HistoryList", () => {
  beforeEach(() => {
    fetchJobsMock.mockReset();
    cancelJobMock.mockReset();
    deleteJobMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche la liste des jobs après chargement", async () => {
    fetchJobsMock.mockResolvedValue([buildJob({ id: "job-1", filename: "a.mp3" })]);
    render(<HistoryList />);

    expect(await screen.findByText("a.mp3")).toBeInTheDocument();
  });

  it("affiche un état vide si aucun job pour le filtre courant", async () => {
    fetchJobsMock.mockResolvedValue([]);
    render(<HistoryList />);

    expect(await screen.findByText(/aucune transcription pour ce filtre/i)).toBeInTheDocument();
  });

  it("affiche une erreur avec bouton Réessayer si le chargement échoue", async () => {
    const { ApiError } = await import("@/app/lib/api-client");
    fetchJobsMock.mockRejectedValue(new ApiError("Backend indisponible", 500));
    render(<HistoryList />);

    expect(await screen.findByText("Backend indisponible")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /réessayer/i })).toBeInTheDocument();
  });

  it("filtre la liste par statut au clic sur un onglet de filtre", async () => {
    fetchJobsMock.mockResolvedValue([
      buildJob({ id: "job-1", filename: "done.mp3", status: "DONE" }),
      buildJob({ id: "job-2", filename: "failed.mp3", status: "FAILED" }),
    ]);
    const user = userEvent.setup();
    render(<HistoryList />);

    await screen.findByText("done.mp3");
    expect(screen.getByText("failed.mp3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Terminé" }));

    expect(screen.getByText("done.mp3")).toBeInTheDocument();
    expect(screen.queryByText("failed.mp3")).not.toBeInTheDocument();
  });

  it("annule un job PENDING/PROCESSING via le bouton Annuler", async () => {
    fetchJobsMock.mockResolvedValue([buildJob({ id: "job-1", filename: "cours.mp3", status: "PROCESSING" })]);
    cancelJobMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<HistoryList />);

    await screen.findByText("cours.mp3");
    await user.click(screen.getByTitle("Annuler"));

    await waitFor(() => expect(cancelJobMock).toHaveBeenCalledWith("job-1"));
    expect(fetchJobsMock).toHaveBeenCalledTimes(2); // chargement initial + rechargement post-annulation
  });

  it("supprime un job DONE après confirmation via window.confirm", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fetchJobsMock.mockResolvedValue([buildJob({ id: "job-1", filename: "termine.mp3", status: "DONE" })]);
    deleteJobMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<HistoryList />);

    await screen.findByText("termine.mp3");
    await user.click(screen.getByTitle("Supprimer"));

    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(deleteJobMock).toHaveBeenCalledWith("job-1"));
  });

  it("n'appelle pas deleteJob si l'utilisateur annule la confirmation", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    fetchJobsMock.mockResolvedValue([buildJob({ id: "job-1", filename: "termine.mp3", status: "DONE" })]);
    const user = userEvent.setup();
    render(<HistoryList />);

    await screen.findByText("termine.mp3");
    await user.click(screen.getByTitle("Supprimer"));

    expect(deleteJobMock).not.toHaveBeenCalled();
  });
});
