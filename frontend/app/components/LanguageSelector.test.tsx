import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LanguageSelector from "./LanguageSelector";

describe("LanguageSelector", () => {
  it("affiche les 4 langues disponibles", () => {
    render(<LanguageSelector value="fr" onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: /détection automatique/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /français/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /anglais/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /espagnol/i })).toBeInTheDocument();
  });

  it("appelle onChange avec la nouvelle valeur sélectionnée", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<LanguageSelector value="fr" onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/langue de l'audio/i), "en");

    expect(onChange).toHaveBeenCalledWith("en");
  });

  it("désactive le sélecteur si disabled=true", () => {
    render(<LanguageSelector value="fr" onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText(/langue de l'audio/i)).toBeDisabled();
  });
});
