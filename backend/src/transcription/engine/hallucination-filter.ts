/**
 * Whisper (tous binaires confondus, y compris whisper.cpp) hallucine parfois
 * des génériques de fin de sous-titrage appris pendant l'entraînement —
 * notamment le crédit de la communauté Amara.org — surtout sur des silences
 * ou de courts passages sans parole. Ce n'est pas une erreur de notre pipeline :
 * c'est un artefact connu et documenté du modèle. On le filtre en sortie.
 *
 * Liste non exhaustive, complétée au fil des retours (fr/en/es, cf. langues
 * supportées par UploadModule).
 */
const KNOWN_HALLUCINATION_PATTERNS: RegExp[] = [
  /sous-titres?\s+r[ée]alis[ée]s?\s+(par|para)\s+la\s+communaut[ée]\s+d['’]?amara\.org/i,
  /sous-titrage\s+st'?\s*501/i,
  /merci\s+d['’]avoir\s+regard[ée]\s+(cette\s+vid[ée]o|la\s+vid[ée]o)/i,
  /subtitles?\s+by\s+the\s+amara\.org\s+community/i,
  /thanks?\s+for\s+watching!?/i,
  /subt[ií]tulos?\s+realizados?\s+por\s+la\s+comunidad\s+de\s+amara\.org/i,
];

/** Vrai uniquement si la ligne/cue ENTIÈRE (une fois nettoyée des espaces et
 * de la ponctuation finale) correspond à une hallucination connue — une
 * ligne qui contient du vrai contenu avant/après ne doit pas être perdue. */
function isKnownHallucination(candidate: string): boolean {
  const trimmed = candidate.trim().replace(/[.!?]+$/, '');
  if (!trimmed) return false;
  return KNOWN_HALLUCINATION_PATTERNS.some((pattern) => new RegExp(`^${pattern.source}$`, pattern.flags).test(trimmed));
}

/** Retire les phrases hallucinées connues d'un texte brut (TXT), qu'elles
 * apparaissent seules sur une ligne/paragraphe ou en fin de texte. */
export function stripKnownHallucinations(text: string): string {
  if (!text) return text;

  const cleaned = text
    .split(/\n/)
    .filter((line) => !isKnownHallucination(line))
    .join('\n');

  // Repli : certains builds émettent la phrase collée en fin de texte sans
  // saut de ligne dédié — on la retire aussi si elle termine le texte.
  let result = cleaned;
  for (const pattern of KNOWN_HALLUCINATION_PATTERNS) {
    const trailing = new RegExp(`\\s*${pattern.source}\\s*$`, 'i');
    result = result.replace(trailing, '');
  }

  return result.trim();
}

interface SrtCue {
  index: string;
  timing: string;
  text: string;
}

/** Retire les cues SRT dont le texte correspond entièrement à une
 * hallucination connue, puis renumérote les cues restantes. */
export function stripKnownHallucinationsFromSrt(srt: string): string {
  if (!srt) return srt;

  const blocks = srt.replace(/\r\n/g, '\n').split(/\n\n+/);
  const cues: SrtCue[] = [];
  let removedAny = false;

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.length > 0);
    if (lines.length < 2) continue;

    const [index, timing, ...textLines] = lines;
    const text = textLines.join('\n');

    if (isKnownHallucination(text)) {
      removedAny = true;
      continue;
    }

    cues.push({ index, timing, text });
  }

  // Rien à filtrer : on renvoie le SRT original tel quel, sans reformater
  // son espacement (évite de perturber les tests/consommateurs qui
  // comparent la sortie brute de whisper.cpp octet pour octet).
  if (!removedAny) {
    return srt;
  }

  return cues
    .map((cue, i) => `${i + 1}\n${cue.timing}\n${cue.text}`)
    .join('\n\n')
    .concat(cues.length > 0 ? '\n' : '');
}
