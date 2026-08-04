═══════════════════════════════════════════════════════════
  FICHE DE DÉCISION D'ARCHITECTURE
  Projet : Speech To Text Local
  Date   : 11 juillet 2026
  Auteur : Cédric Tiene
═══════════════════════════════════════════════════════════

## 0. NOTE DE RÉVISION

Cette révision intègre des fonctionnalités découvertes dans les maquettes
produites par l'agent UI/UX (sélection modèle/langue, export SRT/DOCX,
annulation de job, suivi de progression, durée audio) qui allaient
au-delà du scope initialement validé. Décision de Cédric : les intégrer
directement au scope plutôt que de redemander une simplification des
maquettes. Les sections modifiées par rapport à la Révision 1 sont
signalées.

---

## 1. RÉSUMÉ DU PROJET

**Description**
Speech To Text Local est une application web qui permet à un utilisateur d'uploader
des fichiers audio et d'obtenir leur transcription texte via Whisper
(whisper.cpp) exécuté localement, avec choix du modèle et de la langue,
afin d'éviter les coûts des plateformes de transcription payantes.

**Utilisateurs**
- Toi seul — usage strictement personnel, mono-utilisateur, pas d'authentification
- Distribution open-source sur GitHub : d'autres personnes peuvent cloner
  le repo et faire tourner leur propre instance isolée sur leur machine

**Données clés**
- Fichiers audio uploadés : jusqu'à 250 Mo / 3h, contenu neutre,
  **supprimés après transcription réussie ou annulée** (voir Risque 1)
- Transcriptions texte (TXT + SRT) : résultat du traitement, persistées en DB
- Métadonnées de job : statut, modèle, langue, durée audio, progression,
  timestamps, message d'erreur

---

## 2. NFR MAPPING

**Non-négociables (CRITICAL)**
→ Portabilité — Docker Compose, clonable et lançable sur n'importe quelle
  machine, zéro service cloud payant, setup minimal
→ Maintenabilité — structure claire et lisible, projet portfolio public sur GitHub

**Secondaires (IMPORTANT)**
→ Observabilité — logger NestJS basique + statut, progression et message
  d'erreur persistés en DB par job
→ Sécurité standard — validation des inputs (type MIME, taille max),
  pas de JWT/RBAC nécessaire

**Déprioritisés (LOW)**
→ Disponibilité — aucune exigence de SLA
→ Scalabilité — non-applicable (mono-utilisateur, une seule machine)
→ Performance temps réel — polling suffit, pas de WebSocket

---

## 3. DÉCISION D'ARCHITECTURE BACKEND

**Pattern choisi : Architecture en Couches**
(→ utiliser la structure décrite dans `backend/docs/architecture.md`)

**Justification (4 raisons)** — inchangée par rapport à la Révision 1,
l'ajout de fonctionnalités ne change pas la nature du pattern : toujours
un seul point d'entrée, logique métier simple, stack fixe, projet court terme.

**Modules identifiés** *(mis à jour)*
- **UploadModule** — réception fichier + choix modèle/langue, validation,
  extraction de la durée audio (ffprobe), conversion WAV 16kHz mono (ffmpeg)
- **TranscriptionModule** — file d'attente en mémoire (concurrence = 1),
  gestion de l'annulation (retrait de file ou kill du subprocess), appel
  whisper.cpp (génère TXT + SRT en une passe), parsing best-effort de la progression
- **HistoryModule** — persistance, consultation, suppression, et export
  (TXT/SRT depuis les champs stockés, DOCX généré à la demande)

**Fonctionnalités ajoutées suite aux maquettes UI/UX**
- [IMPORTANTE] Sélection du modèle Whisper (base/small/medium/large) et
  de la langue (auto/fr/en/es) à l'upload
- [IMPORTANTE] Annulation d'un job en cours ou en attente
- [SECONDAIRE] Suivi de progression en pourcentage (best-effort, cf. Risque 5)
- [SECONDAIRE] Export DOCX en plus de TXT/SRT

**Décision — pas de nouveau statut "CANCELLED"**
Un job annulé passe à `FAILED` avec `errorMessage = "Annulé par
l'utilisateur"`. Les maquettes ne montrent que 4 badges de statut
(PENDING/PROCESSING/DONE/FAILED) — pas la peine d'en ajouter un 5ᵉ non prévu
visuellement.

**Décision — génération TXT + SRT systématique**
whisper.cpp génère les deux formats en une seule passe (`-otxt -osrt`),
indépendamment des cases cochées côté UI. Les cases à cocher "TXT/SRT" de
l'écran d'upload n'ont donc pas besoin d'être câblées à une logique
conditionnelle côté backend — elles peuvent rester décoratives ou être
simplifiées côté frontend.

---

## 4. DÉCISION D'ARCHITECTURE FRONTEND

**Type d'interface** : Web uniquement (Next.js)

**Features identifiées** *(mis à jour)*
- Upload avec sélection du modèle et de la langue
- Polling du statut de job, avec affichage de la progression (si
  disponible) et du temps écoulé / durée totale de l'audio
- Action d'annulation pendant PENDING/PROCESSING
- Vue résultat + export TXT/SRT/DOCX
- Historique avec colonne durée, filtrage, et actions contextuelles
  (ouvrir/réessayer/supprimer selon le statut)

---

## 5. ARCHITECTURE IOT

N/A — ce projet n'a aucun volet hardware/IoT.

---

## 6. CARTE DES SERVICES EXTERNES

**Points d'entrée (Ports Primaires)**
→ HTTP REST — Frontend Next.js — seul point d'entrée

**Points de sortie (Ports Secondaires)**
→ DB : PostgreSQL via Prisma (jobs, statuts, résultats TXT/SRT, métadonnées)
→ Stockage fichiers : disque local temporaire (audio supprimé après succès
  ou annulation confirmée)
→ Moteur de transcription : whisper.cpp en subprocess (dépendance locale)
→ ffmpeg/ffprobe en subprocess (conversion audio + extraction durée)
→ Génération DOCX : librairie JS pure (pas de binaire externe, pas de
  dépendance réseau — reste cohérent avec le NFR Portabilité)

**Services externes critiques** : N/A

---

## 7. STACK TECHNIQUE RETENU

Backend        : NestJS + Prisma + PostgreSQL
Moteur transcription : whisper.cpp (subprocess), modèles base/small/medium/large
                 (medium par défaut)
Génération DOCX : librairie JS pure (ex. package `docx`), aucune dépendance
                 binaire supplémentaire
Frontend       : Next.js
Mobile         : N/A
IoT Edge       : N/A
Infra          : Docker Compose (API NestJS + PostgreSQL + volumes fichiers
                 audio temporaires + modèles whisper)
File d'attente : en mémoire dans le process NestJS, concurrence = 1

---

## 8. SCHÉMAS À PRODUIRE

**Draw.io (déjà générés — voir historique de conversation)**
[x] C4 Level 1 — Contexte
[x] C4 Level 2 — Conteneurs
[x] C4 Level 3 — Composants (API NestJS)
[x] C4 Level 3 — Composants (Frontend Next.js)

Pas de Flow EDA — pattern en Couches.

Note : les diagrammes existants restent valides dans leurs grandes lignes
(pas de nouveau conteneur ajouté par cette révision) ; seuls les modules
internes de l'API gagnent des responsabilités (cf. section 3), sans
impact sur le C4 Level 2.

---

## 9. RISQUES IDENTIFIÉS

**Risque 1 — Perte du fichier audio si la transcription échoue ou est annulée**
→ Mitigation : suppression du fichier audio **conditionnée au succès ou à
  l'annulation confirmée**. Jamais de suppression inconditionnelle en cas
  d'échec réel (pour permettre un nouvel essai).

**Risque 2 — whisper.cpp non compilé ou modèles absents au premier lancement**
→ Mitigation : README avec prérequis clairs. Seul le modèle "medium" est
  requis pour un premier lancement fonctionnel ; les autres modèles
  (base/small/large) peuvent être documentés comme téléchargement à la
  demande plutôt que tous pré-téléchargés (le modèle "large" pèse
  plusieurs Go — éviter d'alourdir le setup initial pour rien).

**Risque 3 — Redémarrage du serveur pendant un job en cours**
→ Mitigation : au démarrage, tout job en statut `PROCESSING` repasse à `FAILED`.

**Risque 4 — Fichiers volumineux → temps de traitement long sur CPU**
→ Mitigation : statut visible avec timestamp de début ; pas d'estimation
  de temps *restant* (cf. Risque 5 sur la progression).

**Risque 5 — Fiabilité du suivi de progression (%)**
→ La capacité de whisper.cpp à exposer une progression en pourcentage sur
  stderr dépend de la version/du build du binaire.
→ Mitigation : parsing best-effort. Si l'info n'est pas disponible, le
  champ `progress` reste à 0 et le frontend affiche un indicateur
  d'activité indéterminé (spinner) plutôt qu'un pourcentage figé et faux.

**Risque 6 — Setup alourdi par le support multi-modèles**
→ Supporter 4 modèles Whisper (base/small/medium/large) augmente
  potentiellement le poids du téléchargement initial pour quiconque clone
  le repo.
→ Mitigation : voir Risque 2 — documentation claire distinguant le modèle
  requis (medium) des modèles optionnels à télécharger à la demande.

**Risque 7 — Annulation d'un job en cours de traitement**
→ Tuer proprement le subprocess whisper.cpp actif est nécessaire pour
  éviter un processus fantôme qui continue de consommer du CPU après
  l'annulation côté UI.
→ Mitigation : `child_process.kill('SIGTERM')` avec repli `SIGKILL` après
  un court délai si le process ne se termine pas. Nettoyage du fichier
  audio temporaire associé après confirmation de l'arrêt (même logique
  que le Risque 1).

---

## 11. RÉVISION 3 — DIARISATION (IDENTIFICATION DES LOCUTEURS)

**Contexte** : après premier test réel du pipeline (audio multi-locuteurs),
besoin identifié de distinguer qui parle dans la transcription. Deux
options évaluées :
- `tinydiarize` (intégré à whisper.cpp) — rejeté : modèle disponible en
  anglais uniquement (`small.en-tdrz`), inutilisable pour du contenu
  français.
- `pyannote.audio` — retenu : diarisation sur le signal audio brut, donc
  indépendante de la langue. Nécessite Python/PyTorch (hors stack Node
  actuelle) et des modèles "gated" sur Hugging Face (compte + token
  `HF_TOKEN` requis, cf. README).

**Décision — nouveau service dédié, pas d'intégration dans l'API NestJS**
`pyannote.audio` tourne dans un conteneur Python séparé (`diarization/`,
FastAPI). Justification : garder l'image API NestJS légère (NFR
Portabilité) plutôt que d'y embarquer PyTorch (plusieurs Go). Le service
expose un unique endpoint HTTP interne, jamais exposé côté hôte.

**Décision — fonctionnalité opt-in, jamais bloquante**
La diarisation est déclenchée par une case à cocher à l'upload
(`diarizationEnabled`), désactivée par défaut : elle ajoute un temps de
traitement significatif (nouvelle passe sur l'audio) et un token HF est
requis pour qu'elle fonctionne. Si le service de diarisation est
indisponible ou échoue, **le job ne doit jamais passer en `FAILED` pour
cette seule raison** — la transcription texte reste valide, seule
l'info de locuteur est absente (même philosophie que le Risque 5 sur la
progression best-effort).

**Décision — fusion par recouvrement temporel**
Les segments de locuteurs renvoyés par pyannote (plages `start`/`end` en
secondes) sont recoupés avec les cues du SRT généré par whisper.cpp (qui
a ses propres timestamps) : chaque cue se voit assigner le locuteur dont
le segment a le plus grand recouvrement temporel. Pas de dépendance
inverse (pyannote ne connaît pas le texte, whisper.cpp ne connaît pas les
locuteurs).

**Schéma Prisma** : ajout d'un champ `speakerSegments Json?` sur
`TranscriptionJob` (tableau `{ speaker, start, end, text }`), rempli
uniquement si `diarizationEnabled = true` et le service a répondu.

**Risque 8 — Modèles gated Hugging Face**
→ `pyannote/speaker-diarization-3.1` et `pyannote/segmentation-3.0`
  nécessitent un compte HF + acceptation des conditions + token d'accès.
  Setup supplémentaire non automatisable pour un contributeur qui clone
  le repo.
→ Mitigation : documenté clairement dans le README comme prérequis
  optionnel (uniquement si la diarisation est utilisée), avec lien direct
  vers les 2 pages de conditions à accepter.

**Risque 9 — Poids de l'image `diarization`**
→ PyTorch + pyannote.audio pèsent nettement plus lourd que l'image API
  NestJS actuelle (plusieurs Go).
→ Mitigation : service optionnel dans `docker-compose.yml` — acceptable
  car il ne dégrade pas le NFR Portabilité du cœur du produit
  (transcription simple sans diarisation reste légère).

---

## 10. DÉCISION FINALE

Architecture validée le : 11 juillet 2026
Révisée le : 11 juillet 2026 (intégration scope UI/UX)
Révisée le : 12 juillet 2026 (ajout diarisation — pyannote.audio)
Validée par : Cédric
Prochaine révision prévue : après premier test réel de la diarisation

═══════════════════════════════════════════════════════════
