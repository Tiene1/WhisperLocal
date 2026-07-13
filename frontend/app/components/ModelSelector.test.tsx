import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ModelSelector from "./ModelSelector";

describe("ModelSelector", () => {
  it("affiche les 4 modèles disponibles", () => {
    render(<ModelSelector value="medium" onChange={vi.fn()} />);
    expect(screen.getByRole("option", { name: /large/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /medium/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /small/i })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /base/i })).toBeInTheDocument();
  });

  it("appelle onChange avec la nouvelle valeur sélectionnée", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ModelSelector value="medium" onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText(/taille du modèle/i), "large");

    expect(onChange).toHaveBeenCalledWith("large");
  });

  it("désactive le sélecteur si disabled=true", () => {
    render(<ModelSelector value="medium" onChange={vi.fn()} disabled />);
    expect(screen.getByLabelText(/taille du modèle/i)).toBeDisabled();
  });
});
