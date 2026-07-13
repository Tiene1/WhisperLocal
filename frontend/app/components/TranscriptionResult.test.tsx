import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TranscriptionResult from "./TranscriptionResult";
import type { TranscriptionJob } from "@/app/types/job";

function buildJob(overrides: Partial<TranscriptionJob> = {}): TranscriptionJob {
  return {
    id: "job-1",
    filename: "interview.mp3",
    status: "DONE",
    model: "medium",
    language: "fr",
    durationSeconds: 90,
    progress: 100,
    resultText: "Bonjour à tous.\n\nCeci est un second paragraphe.",
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

describe("TranscriptionResult", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("affiche le texte transcrit découpé en paragraphes", () => {
    render(<TranscriptionResult job={buildJob()} />);
    expect(screen.getByText("Bonjour à tous.")).toBeInTheDocument();
    expect(screen.getByText("Ceci est un second paragraphe.")).toBeInTheDocument();
  });

  it("affiche un message si aucun texte transcrit n'est disponible", () => {
    render(<TranscriptionResult job={buildJob({ resultText: null })} />);
    expect(screen.getByText(/aucun texte transcrit disponible/i)).toBeInTheDocument();
  });

  it("expose 3 boutons d'export distincts (TXT/SRT/DOCX)", () => {
    render(<TranscriptionResult job={buildJob()} />);
    expect(screen.getByRole("link", { name: /srt/i })).toHaveAttribute(
      "href",
      expect.stringContaining("format=srt"),
    );
    expect(screen.getByRole("link", { name: /docx/i })).toHaveAttribute(
      "href",
      expect.stringContaining("format=docx"),
    );
    expect(screen.getByRole("link", { name: /télécharger txt/i })).toHaveAttribute(
      "href",
      expect.stringContaining("format=txt"),
    );
  });

  it("copie le texte transcrit dans le presse-papiers au clic sur Copier", async () => {
    // userEvent.setup() installe son propre stub de clipboard — notre mock
    // doit être posé APRÈS, sinon il est écrasé par celui de user-event.
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<TranscriptionResult job={buildJob()} />);
    await user.click(screen.getByRole("button", { name: /copier/i }));

    expect(writeText).toHaveBeenCalledWith("Bonjour à tous.\n\nCeci est un second paragraphe.");
    expect(await screen.findByText(/copié !/i)).toBeInTheDocument();
  });

  it("ignore silencieusement une erreur de presse-papiers indisponible", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockRejectedValue(new Error("indisponible"));
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<TranscriptionResult job={buildJob()} />);
    await user.click(screen.getByRole("button", { name: /copier/i }));

    // Ne lève rien, reste sur le libellé "Copier" (pas de crash).
    expect(await screen.findByRole("button", { name: /copier/i })).toBeInTheDocument();
  });

  it("affiche le texte groupé par locuteur quand speakerSegments est fourni", () => {
    render(
      <TranscriptionResult
        job={buildJob({
          diarizationEnabled: true,
          speakerSegments: [
            { speaker: "SPEAKER_00", start: 0, end: 2, text: "Bonjour à tous." },
            { speaker: "SPEAKER_00", start: 2, end: 4, text: "Comment allez-vous ?" },
            { speaker: "SPEAKER_01", start: 4, end: 6, text: "Très bien, merci." },
          ],
        })}
      />,
    );

    expect(screen.getByText("Locuteur SPEAKER_00")).toBeInTheDocument();
    expect(screen.getByText("Locuteur SPEAKER_01")).toBeInTheDocument();
    expect(screen.getByText("Bonjour à tous. Comment allez-vous ?")).toBeInTheDocument();
    expect(screen.getByText("Très bien, merci.")).toBeInTheDocument();
  });

  it("affiche une note discrète si la diarisation a été demandée mais est indisponible", () => {
    render(<TranscriptionResult job={buildJob({ diarizationEnabled: true, speakerSegments: null })} />);

    expect(
      screen.getByText(/identification des locuteurs non disponible pour cette transcription/i),
    ).toBeInTheDocument();
    // Le texte brut reste affiché en paragraphes (comportement inchangé).
    expect(screen.getByText("Bonjour à tous.")).toBeInTheDocument();
  });

  it("n'affiche aucune note si la diarisation n'a pas été demandée", () => {
    render(<TranscriptionResult job={buildJob({ diarizationEnabled: false, speakerSegments: null })} />);

    expect(
      screen.queryByText(/identification des locuteurs non disponible/i),
    ).not.toBeInTheDocument();
  });
});
