import { mergeSpeakerSegments, parseSrtCues } from './speaker-merge';

const SAMPLE_SRT = [
  '1',
  '00:00:00,000 --> 00:00:02,000',
  'Bonjour à tous.',
  '',
  '2',
  '00:00:02,500 --> 00:00:05,000',
  "Merci d'être venus.",
  '',
].join('\n');

describe('parseSrtCues', () => {
  it('parse les cues SRT en secondes (float) avec leur texte', () => {
    const cues = parseSrtCues(SAMPLE_SRT);

    expect(cues).toEqual([
      { start: 0, end: 2, text: 'Bonjour à tous.' },
      { start: 2.5, end: 5, text: "Merci d'être venus." },
    ]);
  });

  it('retourne un tableau vide pour un SRT vide', () => {
    expect(parseSrtCues('')).toEqual([]);
  });

  it('ignore les blocs malformés (timing absent ou invalide)', () => {
    const malformed = '1\nblabla\ntexte\n';
    expect(parseSrtCues(malformed)).toEqual([]);
  });
});

describe('mergeSpeakerSegments', () => {
  it('assigne à chaque cue le locuteur ayant le plus grand recouvrement temporel', () => {
    const result = mergeSpeakerSegments(SAMPLE_SRT, [
      { speaker: 'SPEAKER_00', start: 0, end: 2.2 },
      { speaker: 'SPEAKER_01', start: 2.2, end: 6 },
    ]);

    expect(result).toEqual([
      { speaker: 'SPEAKER_00', start: 0, end: 2, text: 'Bonjour à tous.' },
      { speaker: 'SPEAKER_01', start: 2.5, end: 5, text: "Merci d'être venus." },
    ]);
  });

  it("assigne 'inconnu' à une cue sans aucun recouvrement avec un segment", () => {
    const result = mergeSpeakerSegments(SAMPLE_SRT, [
      { speaker: 'SPEAKER_00', start: 10, end: 12 },
    ]);

    expect(result[0].speaker).toBe('inconnu');
    expect(result[1].speaker).toBe('inconnu');
  });

  it('retourne un tableau vide si aucun segment de diarisation ni cue', () => {
    expect(mergeSpeakerSegments('', [])).toEqual([]);
  });

  it('choisit le segment avec le plus de recouvrement en cas de chevauchement multiple', () => {
    // La cue #1 (0 → 2s) est majoritairement recouverte par SPEAKER_01
    // (0.5s → 2s = 1.5s) plutôt que SPEAKER_00 (0s → 0.5s = 0.5s).
    const result = mergeSpeakerSegments(SAMPLE_SRT, [
      { speaker: 'SPEAKER_00', start: 0, end: 0.5 },
      { speaker: 'SPEAKER_01', start: 0.5, end: 2 },
    ]);

    expect(result[0].speaker).toBe('SPEAKER_01');
  });
});
