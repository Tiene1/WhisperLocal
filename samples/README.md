# Échantillons audio de test

Fichiers audio courts fournis pour tester rapidement Speech To Text Local après
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

## Utilisation

1. Lance l'application (`docker compose up`, voir README principal)
2. Va sur `http://localhost:3001`
3. Dépose `samples/apollo11-sample-1min.mp3`
4. Choisis la langue **anglais** (le modèle `medium` suffit pour un
   premier test)
5. Coche "Identifier les locuteurs" si tu veux tester la diarisation
