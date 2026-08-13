import { analyzeConfidence, WhisperJsonOutput } from './confidence-analyzer';

function tokensOutput(tokens: Array<{ text: string; p: number }>): WhisperJsonOutput {
  return {
    transcription: [
      {
        text: tokens.map((t) => t.text).join(''),
        tokens,
      },
    ],
  };
}

describe('analyzeConfidence', () => {
  it('exclut les tokens spéciaux ([_BEG_], [_TT_...]) du calcul', () => {
    const output = tokensOutput([
      { text: '[_BEG_]', p: 0.1 },
      { text: ' Bonjour', p: 0.9 },
      { text: '[_TT_500]', p: 0.05 },
    ]);

    const result = analyzeConfidence(output, 0.5, 0.3);

    expect(result.lowConfidenceRatio).toBe(0);
    expect(result.isLowConfidenceWarning).toBe(false);
  });

  it('calcule un ratio correct sur un jeu de tokens mixte', () => {
    const output = tokensOutput([
      { text: ' Bonjour', p: 0.9 },
      { text: ' le', p: 0.4 },
      { text: ' monde', p: 0.2 },
      { text: " aujourd'hui", p: 0.8 },
    ]);

    const result = analyzeConfidence(output, 0.5, 0.3);

    // 2 tokens sur 4 sous le seuil de 0.5.
    expect(result.lowConfidenceRatio).toBe(0.5);
    expect(result.isLowConfidenceWarning).toBe(true);
  });

  it("audio propre (~6% de tokens sous le seuil) : pas d'avertissement avec un seuil de ratio à 0,3", () => {
    const cleanTokens = Array.from({ length: 100 }, (_, i) => ({
      text: ` mot${i}`,
      p: i < 6 ? 0.3 : 0.9,
    }));
    const output = tokensOutput(cleanTokens);

    const result = analyzeConfidence(output, 0.5, 0.3);

    expect(result.lowConfidenceRatio).toBeCloseTo(0.06);
    expect(result.isLowConfidenceWarning).toBe(false);
  });

  it('audio très bruité (~48% de tokens sous le seuil) : avertissement déclenché', () => {
    const noisyTokens = Array.from({ length: 100 }, (_, i) => ({
      text: ` mot${i}`,
      p: i < 48 ? 0.3 : 0.9,
    }));
    const output = tokensOutput(noisyTokens);

    const result = analyzeConfidence(output, 0.5, 0.3);

    expect(result.lowConfidenceRatio).toBeCloseTo(0.48);
    expect(result.isLowConfidenceWarning).toBe(true);
  });

  it('gère un JSON vide (transcription absent) sans diviser par zéro', () => {
    const result = analyzeConfidence({}, 0.5, 0.3);

    expect(result).toEqual({ lowConfidenceRatio: 0, isLowConfidenceWarning: false });
  });

  it('gère une transcription présente mais sans aucun token', () => {
    const output: WhisperJsonOutput = { transcription: [{ text: '', tokens: [] }] };

    const result = analyzeConfidence(output, 0.5, 0.3);

    expect(result).toEqual({ lowConfidenceRatio: 0, isLowConfidenceWarning: false });
  });
});
