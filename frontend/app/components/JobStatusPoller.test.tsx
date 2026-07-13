import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import JobStatusPoller from "./JobStatusPoller";
import type { TranscriptionJob } from "@/app/types/job";

const fetchJobMock = vi.fn();
const cancelJobMock = vi.fn();

vi.mock("@/app/lib/api-client", async () => {
  const actual = await vi.importActual<typeof import("@/app/lib/api-client")>(
    "@/app/lib/api-client",
  );
  return {
    ...actual,
    fetchJob: (...args: unknown[]) => fetchJobMock(...args),
    cancelJob: (...args: unknown[]) => cancelJobMock(...args),
  };
});

vi.mock("@/app/components/ProcessingView", () => ({
  default: ({ job }: { job: TranscriptionJob }) => <div data-testid="processing-view">{job.status}</div>,
}));

vi.mock("@/app/components/TranscriptionResult", () => ({
  default: ({ job }: { job: TranscriptionJob }) => <div data-testid="result-view">{job.status}</div>,
}));

function buildJob(overrides: Partial<TranscriptionJob> = {}): TranscriptionJob {
  return {
    id: "job-1",
    filename: "a.mp3",
    status: "PROCESSING",
    model: "medium",
    language: "fr",
    durationSeconds: 60,
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

/** Flush le rendu initial (loadJob() appelé dans le useEffect) sans dépendre
 * du polling réel de `waitFor`, incompatible avec les fake timers. */
async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("JobStatusPoller", () => {
  beforeEach(() => {
    fetchJobMock.mockReset();
    cancelJobMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("interroge GET /jobs/:id immédiatement au montage", async () => {
    fetchJobMock.mockResolvedValue(buildJob({ status: "PROCESSING" }));
    render(<JobStatusPoller jobId="job-1" />);
    await flush();

    expect(fetchJobMock).toHaveBeenCalledTimes(1);
    expect(fetchJobMock).toHaveBeenCalledWith("job-1");
  });

  it("continue de sonder à intervalle régulier tant que le statut n'est pas terminal", async () => {
    fetchJobMock.mockResolvedValue(buildJob({ status: "PROCESSING" }));
    render(<JobStatusPoller jobId="job-1" />);
    await flush();
    expect(fetchJobMock).toHaveBeenCalledTimes(1);

    await flush(4000);
    expect(fetchJobMock).toHaveBeenCalledTimes(2);

    await flush(4000);
    expect(fetchJobMock).toHaveBeenCalledTimes(3);
  });

  it("arrête le polling dès que le statut devient DONE", async () => {
    fetchJobMock.mockResolvedValue(buildJob({ status: "DONE" }));
    render(<JobStatusPoller jobId="job-1" />);
    await flush();
    expect(fetchJobMock).toHaveBeenCalledTimes(1);

    await flush(20000);

    // Aucun appel supplémentaire après le statut terminal.
    expect(fetchJobMock).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("result-view")).toBeInTheDocument();
  });

  it("arrête le polling dès que le statut devient FAILED", async () => {
    fetchJobMock.mockResolvedValue(buildJob({ status: "FAILED", errorMessage: "crash" }));
    render(<JobStatusPoller jobId="job-1" />);
    await flush();
    expect(fetchJobMock).toHaveBeenCalledTimes(1);

    await flush(20000);

    expect(fetchJobMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Échec de la transcription/)).toBeInTheDocument();
  });

  it("n'utilise jamais WebSocket ni EventSource (polling REST uniquement)", async () => {
    const originalWebSocket = globalThis.WebSocket;
    const originalEventSource = (globalThis as { EventSource?: unknown }).EventSource;
    const webSocketCtor = vi.fn();
    const eventSourceCtor = vi.fn();
    // @ts-expect-error — stub volontaire pour la durée du test
    globalThis.WebSocket = webSocketCtor;
    // @ts-expect-error — stub volontaire pour la durée du test
    globalThis.EventSource = eventSourceCtor;

    fetchJobMock.mockResolvedValue(buildJob({ status: "PROCESSING" }));
    render(<JobStatusPoller jobId="job-1" />);
    await flush();
    await flush(8000);

    expect(webSocketCtor).not.toHaveBeenCalled();
    expect(eventSourceCtor).not.toHaveBeenCalled();

    globalThis.WebSocket = originalWebSocket;
    (globalThis as { EventSource?: unknown }).EventSource = originalEventSource;
  });

  it("arrête le polling au démontage du composant (cleanup de l'interval)", async () => {
    fetchJobMock.mockResolvedValue(buildJob({ status: "PROCESSING" }));
    const { unmount } = render(<JobStatusPoller jobId="job-1" />);
    await flush();
    expect(fetchJobMock).toHaveBeenCalledTimes(1);

    unmount();
    await flush(20000);

    expect(fetchJobMock).toHaveBeenCalledTimes(1);
  });
});
