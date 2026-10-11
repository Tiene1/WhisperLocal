# Échantillons audio de test

Fichiers audio courts fournis pour tester rapidement WhisperLocal après
installation, sans avoir à chercher/préparer ton propre fichier.

## `apollo11-sample-1min.mp3`

- **Durée** : ~60 secondes
- **Langue** : anglais
- **Contenu** : extrait des communications radio de la mission Apollo 11
  (dialogue entre plusieurs interlocuteurs — astronautes et centre de
  contrôle à Houston), utile pour tester à la fois la transcription et
  la diarisation (identification des locuteurs)
- **Source** : [NASA Audio Highlight Reels](https://archive.org/details/NasaAudioHighlightReels)
  (Internet Archive), extrait depuis `Apollo11Highlights.mp3`
- **Licence** : domaine public — œuvre du gouvernement fédéral américain
  (NASA), non soumise au droit d'auteur aux États-Unis (17 U.S.C. § 105)
- **Qualité** : enregistrement radio d'époque (1969), légèrement bruité —
  bon test de robustesse pour whisper.cpp

## `precieuses-1min.mp3`

- **Durée** : ~60 secondes
- **Langue** : français
- **Contenu** : annonce LibriVox puis début de la scène 1 des *Précieuses
  ridicules* de Molière, dialogue entre La Grange et Du Croisy, utile pour
  tester la transcription en français et la diarisation
- **Source** : [LibriVox, Les Précieuses ridicules](https://archive.org/details/precieusesridicules_1012_librivox)
  (Internet Archive), extrait de `precieusesridicules_01_moliere_64kb.mp3`
- **Licence** : domaine public (Public Domain Mark sur archive.org).
  Lecteurs bénévoles LibriVox, dont Nadine Eckert-Boulet, Maud Benard,
  Michaël Cadilhac et Christian Al-Kadi
- **Qualité** : lecture de bénévoles, voix claires, bien transcrite par
  `medium` en français

## Utilisation

1. Lance l'application (`docker compose up`, voir README principal)
2. Va sur `http://localhost:3001`
3. Dépose `samples/apollo11-sample-1min.mp3` (anglais) ou
   `samples/precieuses-1min.mp3` (français)
4. Choisis la langue correspondante, **anglais** ou **français** (le modèle
   `medium` suffit pour un premier test)
5. Coche "Identifier les locuteurs" si tu veux tester la diarisation
