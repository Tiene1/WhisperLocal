/**
 * Fusion des segments de locuteurs (pyannote) avec les cues du SRT généré
 * par whisper.cpp, par recouvrement temporel maximal (cf. ADR section 11,
 * "Décision — fusion par recouvrement temporel"). Pas de dépendance
 * inverse : pyannote ne connaît pas le texte, whisper.cpp ne connaît pas
 * les locuteurs — cette fonction est le seul point qui les recoupe.
 */

/** Segment renvoyé par le service de diarisation Python. */
export interface DiarizationSegment {
  speaker: string;
  start: number;
  end: number;
}

/** Cue SRT enrichie du locuteur ayant le plus grand recouvrement temporel. */
export interface SpeakerCue {
  speaker: string;
  start: number;
  end: number;
  text: string;
}

/** Locuteur assigné quand aucun segment de diarisation ne recouvre la cue. */
const UNKNOWN_SPEAKER = 'inconnu';

interface ParsedSrtCue {
  start: number;
  end: number;
  text: string;
}

/** Parse un timestamp SRT (`00:00:01,000`) en secondes (float). */
function parseSrtTimestamp(timestamp: string): number {
  const match = /(\d{2}):(\d{2}):(\d{2}),(\d{3})/.exec(timestamp.trim());
  if (!match) return 0;
  const [, hours, minutes, seconds, millis] = match;
  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(millis) / 1000
  );
}

/** Parse le contenu SRT complet (déjà décodé) en une liste de cues datées. */
export function parseSrtCues(srt: string): ParsedSrtCue[] {
  if (!srt) return [];

  const blocks = srt.replace(/\r\n/g, '\n').split(/\n\n+/);
  const cues: ParsedSrtCue[] = [];

  for (const block of blocks) {
    const lines = block.split('\n').filter((line) => line.length > 0);
    if (lines.length < 2) continue;

    const [, timing, ...textLines] = lines;
    const timingMatch = /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/.exec(timing);
    if (!timingMatch) continue;

    cues.push({
      start: parseSrtTimestamp(timingMatch[1]),
      end: parseSrtTimestamp(timingMatch[2]),
      text: textLines.join('\n'),
    });
  }

  return cues;
}

/**
 * Pour chaque cue SRT, assigne le locuteur dont le segment de diarisation a
 * le plus grand recouvrement temporel. Une cue sans aucun recouvrement se
 * voit assigner `UNKNOWN_SPEAKER` plutôt que d'être exclue — on garde la
 * fusion best-effort, cohérente avec la philosophie "jamais bloquant".
 */
export function mergeSpeakerSegments(srt: string, segments: DiarizationSegment[]): SpeakerCue[] {
  const cues = parseSrtCues(srt);

  return cues.map((cue) => {
    let bestSpeaker = UNKNOWN_SPEAKER;
    let bestOverlap = 0;

    for (const segment of segments) {
      const overlap = Math.min(cue.end, segment.end) - Math.max(cue.start, segment.start);
      if (overlap > bestOverlap) {
        bestOverlap = overlap;
        bestSpeaker = segment.speaker;
      }
    }

    return { speaker: bestSpeaker, start: cue.start, end: cue.end, text: cue.text };
  });
}
