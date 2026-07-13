import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProcessingView from "./ProcessingView";
import type { TranscriptionJob } from "@/app/types/job";

function buildJob(overrides: Partial<TranscriptionJob> = {}): TranscriptionJob {
  return {
    id: "job-1",
    filename: "interview.mp3",
    status: "PROCESSING",
    model: "medium",
    language: "fr",
    durationSeconds: 120,
    progress: 0,
    resultText: null,
    errorMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    diarizationEnabled: false,
    speakerSegments: null,
    ...overrides,
  };
}

describe("ProcessingView", () => {
  it("bascule sur un indicateur générique si progress reste à 0 en PROCESSING (pas de '0%' trompeur)", () => {
    render(<ProcessingView job={buildJob({ status: "PROCESSING", progress: 0 })} onCancel={vi.fn()} isCancelling={false} />);

    expect(screen.getByText(/durée non estimable/i)).toBeInTheDocument();
    // Le badge de statut ne doit jamais afficher "(0%)" comme une mesure fiable.
    expect(screen.queryByText(/\(0%\)/)).not.toBeInTheDocument();
  });

  it("affiche la waveform de progression réelle quand progress > 0", () => {
    render(<ProcessingView job={buildJob({ status: "PROCESSING", progress: 55 })} onCancel={vi.fn()} isCancelling={false} />);

    expect(screen.queryByText(/durée non estimable/i)).not.toBeInTheDocument();
    // Le badge de statut affiche bien le pourcentage fiable dans ce cas.
    expect(screen.getByText(/55%/)).toBeInTheDocument();
  });

  it("affiche le bouton Annuler pour PENDING et PROCESSING", () => {
    const { rerender } = render(
      <ProcessingView job={buildJob({ status: "PENDING" })} onCancel={vi.fn()} isCancelling={false} />,
    );
    expect(screen.getByRole("button", { name: /cancel job/i })).toBeInTheDocument();

    rerender(<ProcessingView job={buildJob({ status: "PROCESSING" })} onCancel={vi.fn()} isCancelling={false} />);
    expect(screen.getByRole("button", { name: /cancel job/i })).toBeInTheDocument();
  });

  it("appelle onCancel au clic sur le bouton Annuler", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<ProcessingView job={buildJob({ status: "PROCESSING" })} onCancel={onCancel} isCancelling={false} />);

    await user.click(screen.getByRole("button", { name: /cancel job/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("désactive le bouton Annuler et affiche 'Annulation...' pendant l'annulation", () => {
    render(<ProcessingView job={buildJob({ status: "PROCESSING" })} onCancel={vi.fn()} isCancelling={true} />);

    const button = screen.getByRole("button", { name: /annulation/i });
    expect(button).toBeDisabled();
  });

  it("affiche le titre 'En attente de traitement' pour PENDING", () => {
    render(<ProcessingView job={buildJob({ status: "PENDING" })} onCancel={vi.fn()} isCancelling={false} />);
    expect(screen.getByText(/en attente de traitement/i)).toBeInTheDocument();
  });
});
