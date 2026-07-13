import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBadge from "./StatusBadge";
import type { JobStatus } from "@/app/types/job";

describe("StatusBadge", () => {
  const STATUSES: { status: JobStatus; label: string }[] = [
    { status: "PENDING", label: "En attente" },
    { status: "PROCESSING", label: "En cours" },
    { status: "DONE", label: "Terminé" },
    { status: "FAILED", label: "Échec" },
  ];

  it.each(STATUSES)("affiche le libellé correct pour le statut $status", ({ status, label }) => {
    render(<StatusBadge status={status} />);
    expect(screen.getByText(new RegExp(label))).toBeInTheDocument();
  });

  it("n'expose que les 4 statuts visuels autorisés — pas de badge 'Annulé' séparé", () => {
    // Un job annulé arrive toujours avec status === 'FAILED' côté API
    // (cf. CLAUDE.md règle 3) : on vérifie qu'il rend le badge Échec standard,
    // sans texte "Annulé" quelconque codé en dur dans le composant.
    render(<StatusBadge status="FAILED" />);
    expect(screen.queryByText(/annulé/i)).not.toBeInTheDocument();
    expect(screen.getByText(/Échec/)).toBeInTheDocument();
  });

  it("affiche le pourcentage de progression uniquement si PROCESSING et progress > 0", () => {
    render(<StatusBadge status="PROCESSING" progress={42} />);
    expect(screen.getByText(/42%/)).toBeInTheDocument();
  });

  it("n'affiche pas de pourcentage si progress vaut 0 (indicateur trompeur évité)", () => {
    render(<StatusBadge status="PROCESSING" progress={0} />);
    expect(screen.queryByText(/0%/)).not.toBeInTheDocument();
  });

  it("n'affiche pas de pourcentage si progress est absent", () => {
    render(<StatusBadge status="PROCESSING" />);
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it("n'affiche pas de pourcentage pour un statut DONE même si progress=100", () => {
    render(<StatusBadge status="DONE" progress={100} />);
    expect(screen.queryByText(/100%/)).not.toBeInTheDocument();
  });

  it("applique la classe additionnelle fournie", () => {
    const { container } = render(<StatusBadge status="PENDING" className="my-extra-class" />);
    expect(container.querySelector(".my-extra-class")).toBeInTheDocument();
  });
});
