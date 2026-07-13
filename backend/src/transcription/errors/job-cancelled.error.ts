/**
 * Erreur interne levée par `WhisperCppProvider` lorsqu'un subprocess est
 * tué suite à une annulation demandée par l'utilisateur (SIGTERM/SIGKILL),
 * par opposition à un échec réel du moteur whisper.cpp.
 *
 * Permet à `TranscriptionService` de distinguer les deux cas afin
 * d'appliquer la bonne règle de suppression du fichier audio
 * (cf. CLAUDE.md — règle 1 et règle 8).
 */
export class JobCancelledError extends Error {
  constructor(jobId: string) {
    super(`Job ${jobId} annulé par l'utilisateur`);
    this.name = 'JobCancelledError';
  }
}
