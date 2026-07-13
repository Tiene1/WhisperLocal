import { stripKnownHallucinations, stripKnownHallucinationsFromSrt } from './hallucination-filter';

describe('stripKnownHallucinations', () => {
  it('retire le crédit Amara.org en fin de texte', () => {
    const text = "Bonjour, ceci est un test.\nSous-titres réalisés par la communauté d'Amara.org";
    expect(stripKnownHallucinations(text)).toBe('Bonjour, ceci est un test.');
  });

  it('retire le crédit Amara.org collé sans saut de ligne', () => {
    const text = "Bonjour, ceci est un test. Sous-titres réalisés par la communauté d'Amara.org";
    expect(stripKnownHallucinations(text)).toBe('Bonjour, ceci est un test.');
  });

  it("retire 'Merci d'avoir regardé cette vidéo'", () => {
    const text = 'Le contenu principal.\nMerci d\'avoir regardé cette vidéo';
    expect(stripKnownHallucinations(text)).toBe('Le contenu principal.');
  });

  it('laisse un texte normal intact', () => {
    const text = "Ceci est une transcription normale sans artefact particulier.";
    expect(stripKnownHallucinations(text)).toBe(text);
  });

  it('gère un texte vide', () => {
    expect(stripKnownHallucinations('')).toBe('');
  });
});

describe('stripKnownHallucinationsFromSrt', () => {
  it('retire la cue hallucinée et renumérote les cues restantes', () => {
    const srt = [
      '1',
      '00:00:00,000 --> 00:00:02,000',
      'Bonjour tout le monde.',
      '',
      '2',
      '00:00:02,000 --> 00:00:04,000',
      "Sous-titres réalisés par la communauté d'Amara.org",
      '',
    ].join('\n');

    const result = stripKnownHallucinationsFromSrt(srt);

    expect(result).toContain('1\n00:00:00,000 --> 00:00:02,000\nBonjour tout le monde.');
    expect(result).not.toContain('Amara.org');
    expect(result).not.toMatch(/^2\n/m);
  });

  it('gère un SRT vide', () => {
    expect(stripKnownHallucinationsFromSrt('')).toBe('');
  });
});
