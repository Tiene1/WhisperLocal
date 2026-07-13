import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import SideNav from "./SideNav";

const usePathnameMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => usePathnameMock(),
}));

describe("SideNav", () => {
  it("met en avant l'onglet Transcribe sur la page d'accueil", () => {
    usePathnameMock.mockReturnValue("/");
    render(<SideNav />);

    const transcribeLink = screen.getByRole("link", { name: /transcribe/i });
    expect(transcribeLink.className).toContain("bg-secondary-container");
  });

  it("met en avant l'onglet History sur /history", () => {
    usePathnameMock.mockReturnValue("/history");
    render(<SideNav />);

    const historyLink = screen.getByRole("link", { name: /history/i });
    expect(historyLink.className).toContain("bg-secondary-container");
  });

  it("affiche le lien 'New Transcription'", () => {
    usePathnameMock.mockReturnValue("/");
    render(<SideNav />);
    expect(screen.getByRole("link", { name: /new transcription/i })).toHaveAttribute("href", "/");
  });
});
