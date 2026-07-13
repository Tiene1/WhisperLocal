# CLAUDE.md — Backend WhisperLocal API

## Contexte

Tu travailles sur le backend de **WhisperLocal**, une application web
personnelle qui transcrit des fichiers audio en texte via whisper.cpp en
local. Usage mono-utilisateur, pas d'authentification.

Lis `docs/ADR.md` et `docs/architecture.md` avant de commencer — ils
contiennent toutes les décisions d'architecture déjà validées, y compris
la Révision 2 qui ajoute la sélection modèle/langue, l'annulation de job,
le suivi de progression et l'export multi-format.

## Pattern d'architecture

**Architecture en Couches** — strictement.

## Règles absolues

- ❌ Jamais de logique métier dans les controllers
- ❌ Jamais d'accès direct à Prisma dans les services — passer par un repository
- ❌ Jamais de secrets ou chemins hardcodés — tout via `whisper.config.ts` + env
- ❌ Jamais d'appel `exec()` pour whisper.cpp/ffmpeg/ffprobe — utiliser
  `child_process.spawn()` avec arguments en tableau
- ✅ Toujours valider taille (250 Mo max) et format du fichier audio
  AVANT de lancer la conversion ffmpeg

## Règles spécifiques au projet

1. **Suppression audio conditionnelle** — le fichier audio original n'est
   supprimé QUE si la transcription réussit OU si le job est annulé avec
   confirmation d'arrêt du subprocess. Jamais de suppression sur un échec réel.

2. **File d'attente en mémoire uniquement** — pas de Redis, pas de BullMQ.
   Concurrence = 1.

3. **Nettoyage au démarrage** — tout job `PROCESSING` au boot repasse à `FAILED`.

4. **Conversion + métadonnées audio obligatoires** — toujours passer par
   `FfmpegProvider` (conversion WAV 16kHz mono + extraction de la durée
   via ffprobe) avant tout appel à `WhisperCppProvider`.

5. **Génération TXT + SRT systématique** — whisper.cpp est toujours
   invoqué avec `-otxt -osrt` en une seule passe, indépendamment de ce que
   le frontend envoie comme préférence de format. Ne pas créer de logique
   conditionnelle pour générer un format ou l'autre.

6. **Export DOCX à la volée** — ne jamais stocker de fichier `.docx` sur
   disque ou en DB. Il est généré au moment de la requête d'export à
   partir de `resultText`, via `DocxExportProvider` (librairie JS pure,
   pas de binaire externe).

7. **Pas de statut CANCELLED** — une annulation aboutit à `FAILED` avec
   `errorMessage = "Annulé par l'utilisateur"`. Ne pas ajouter de valeur
   à l'enum `JobStatus`.

8. **Annulation propre** — `POST /jobs/:id/cancel` doit retirer le job de
   la file s'il est `PENDING`, ou tuer le subprocess whisper.cpp actif
   (`SIGTERM` puis `SIGKILL` en repli) s'il est `PROCESSING`. Toujours
   nettoyer le fichier temporaire associé après confirmation de l'arrêt.

9. **Progression best-effort** — tenter de parser la progression depuis
   stderr de whisper.cpp. Si le binaire ne l'expose pas, laisser `progress`
   à 0 sans lever d'erreur — ce n'est pas un cas d'échec, juste une info
   indisponible. Le frontend gère l'absence de progression avec un
   indicateur indéterminé.

10. **Modèles Whisper multiples** — `medium` reste le seul modèle requis
    au setup initial. Les autres modèles (`base`/`small`/`large`) sont
    documentés comme téléchargement à la demande, pas pré-téléchargés
    par défaut (le modèle `large` est volumineux).

## Ce que tu ne fais PAS

- Pas de développement du frontend (dépôt séparé)
- Pas d'implémentation de Redis/BullMQ
- Pas d'authentification/JWT
- Pas de stockage persistant de fichiers DOCX générés
