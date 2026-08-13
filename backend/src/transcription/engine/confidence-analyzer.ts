/**
 * whisper.cpp ne produit aucun signal d'échec structuré (pas de
 * `no_speech_prob` — ce champ n'existe que dans le Whisper Python
 * d'OpenAI). En revanche, l'option `-ojf` (`--output-json-full`) expose
 * la probabilité `p` de chaque token décodé. On l'utilise ici comme
 * garde-fou PRÉVENTIF (détecte un audio globalement peu exploitable),
 * complémentaire à la liste noire CURATIVE de `hallucination-filter.ts`
 * (qui ne retire que des artefacts déjà répertoriés).
 *
 * Valeurs mesurées en lab (modèle `small`, seuil token à 0,5) : audio
 * propre → ~6% de tokens sous le seuil ; audio très bruité (SNR 0dB)
 * → ~48%. La PROPORTION de tokens bas discrimine mieux que la moyenne
 * des `p` (une poignée de mots très incertains noyés dans une bonne
 * moyenne globale resterait invisible autrement).
 */

export interface WhisperJsonToken {
  text: string;
  p: number;
  timestamps?: { from: string; to: string };
  offsets?: { from: number; to: number };
  id?: number;
  t_dtw?: number;
}

export interface WhisperJsonSegment {
  text?: string;
  tokens: WhisperJsonToken[];
  timestamps?: { from: string; to: string };
  offsets?: { from: number; to: number };
}

export interface WhisperJsonOutput {
  transcription?: WhisperJsonSegment[];
}

export interface ConfidenceAnalysis {
  lowConfidenceRatio: number;
  isLowConfidenceWarning: boolean;
}

/** Un token spécial whisper.cpp a un texte encadré de crochets
 * (`[_BEG_]`, `[_TT_123]`, etc.) — ce n'est pas un mot transcrit, il est
 * exclu du calcul de confiance. */
const SPECIAL_TOKEN_PATTERN = /^\[.*\]$/;

/**
 * Calcule la part de tokens peu fiables (`p` < `tokenThreshold`) sur
 * l'ensemble du JSON `-ojf`, hors tokens spéciaux, et signale — sans
 * jamais lever — si cette part dépasse `ratioThreshold`.
 */
export function analyzeConfidence(
  output: WhisperJsonOutput,
  tokenThreshold: number,
  ratioThreshold: number,
): ConfidenceAnalysis {
  const segments = output.transcription ?? [];

  let totalTokens = 0;
  let lowConfidenceTokens = 0;

  for (const segment of segments) {
    for (const token of segment.tokens ?? []) {
      if (SPECIAL_TOKEN_PATTERN.test(token.text.trim())) {
        continue;
      }

      totalTokens += 1;
      if (token.p < tokenThreshold) {
        lowConfidenceTokens += 1;
      }
    }
  }

  if (totalTokens === 0) {
    return { lowConfidenceRatio: 0, isLowConfidenceWarning: false };
  }

  const lowConfidenceRatio = lowConfidenceTokens / totalTokens;
  return {
    lowConfidenceRatio,
    isLowConfidenceWarning: lowConfidenceRatio >= ratioThreshold,
  };
}
