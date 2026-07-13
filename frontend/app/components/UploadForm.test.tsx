import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import UploadForm from "./UploadForm";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const uploadAudioMock = vi.fn();

vi.mock("@/app/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/api-client")>(
    "@/app/lib/api-client",
  );
  return {
    ...actual,
    uploadAudio: (...args: unknown[]) => uploadAudioMock(...args),
  };
});

function buildFile(name: string, sizeBytes: number, type = "audio/mpeg"): File {
  const file = new File(["contenu"], name, { type });
  Object.defineProperty(file, "size", { value: sizeBytes });
  return file;
}

describe("UploadForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    uploadAudioMock.mockReset();
  });

  it("rejette un fichier > 250 Mo côté client SANS appeler l'API", async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const tooLarge = buildFile("gros-fichier.mp3", 251 * 1024 * 1024);

    await user.upload(input, tooLarge);

    expect(await screen.findByText(/dépasse la taille maximale autorisée/i)).toBeInTheDocument();
    expect(uploadAudioMock).not.toHaveBeenCalled();

    // Le bouton de soumission reste désactivé puisqu'aucun fichier valide n'est retenu.
    const submitButton = screen.getByRole("button", { name: /démarrer la transcription/i });
    expect(submitButton).toBeDisabled();
  });

  it("accepte un fichier valide (< 250 Mo) et active le bouton de soumission", async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = buildFile("interview.mp3", 10 * 1024 * 1024);

    await user.upload(input, validFile);

    expect(screen.getByText("interview.mp3")).toBeInTheDocument();
    const submitButton = screen.getByRole("button", { name: /démarrer la transcription/i });
    expect(submitButton).toBeEnabled();
  });

  it("soumet le fichier via uploadAudio puis redirige vers /jobs/:id", async () => {
    uploadAudioMock.mockResolvedValue({ jobId: "job-123" });
    const user = userEvent.setup();
    render(<UploadForm />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, buildFile("interview.mp3", 1024));

    await user.click(screen.getByRole("button", { name: /démarrer la transcription/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/jobs/job-123"));
    expect(uploadAudioMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "interview.mp3" }),
      "medium",
      "fr",
      false,
    );
  });

  it("transmet diarizationEnabled=true à uploadAudio quand la case est cochée", async () => {
    uploadAudioMock.mockResolvedValue({ jobId: "job-123" });
    const user = userEvent.setup();
    render(<UploadForm />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, buildFile("interview.mp3", 1024));

    await user.click(screen.getByRole("checkbox", { name: /identifier les locuteurs/i }));
    await user.click(screen.getByRole("button", { name: /démarrer la transcription/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/jobs/job-123"));
    expect(uploadAudioMock).toHaveBeenCalledWith(
      expect.objectContaining({ name: "interview.mp3" }),
      "medium",
      "fr",
      true,
    );
  });

  it("affiche la case 'Identifier les locuteurs' décochée par défaut", () => {
    render(<UploadForm />);
    const checkbox = screen.getByRole("checkbox", { name: /identifier les locuteurs/i });
    expect(checkbox).not.toBeChecked();
  });

  it("affiche un message d'erreur si l'upload échoue côté API, sans rediriger", async () => {
    const { ApiError } = await import("@/app/lib/api-client");
    uploadAudioMock.mockRejectedValue(new ApiError("Format non supporté", 400));
    const user = userEvent.setup();
    render(<UploadForm />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, buildFile("interview.mp3", 1024));
    await user.click(screen.getByRole("button", { name: /démarrer la transcription/i }));

    expect(await screen.findByText("Format non supporté")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("accepte un fichier déposé via drag & drop (dataTransfer)", async () => {
    render(<UploadForm />);
    const dropzone = screen.getByText(/glissez & déposez/i).closest("div")!;
    const file = buildFile("dropped.mp3", 2048);

    fireEvent.dragOver(dropzone);
    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(await screen.findByText("dropped.mp3")).toBeInTheDocument();
  });

  it("affiche un message d'erreur générique si l'exception n'est pas une ApiError", async () => {
    uploadAudioMock.mockRejectedValue(new Error("erreur réseau inattendue"));
    const user = userEvent.setup();
    render(<UploadForm />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, buildFile("interview.mp3", 1024));
    await user.click(screen.getByRole("button", { name: /démarrer la transcription/i }));

    expect(await screen.findByText(/échec de l'envoi du fichier/i)).toBeInTheDocument();
  });

  it("ne fait rien au clic si aucun fichier n'est sélectionné", async () => {
    const user = userEvent.setup();
    render(<UploadForm />);

    const submitButton = screen.getByRole("button", { name: /démarrer la transcription/i });
    expect(submitButton).toBeDisabled();
    await user.click(submitButton);
    expect(uploadAudioMock).not.toHaveBeenCalled();
  });
});
