# WhisperLocal

Application web personnelle de transcription audio → texte, exécutée
**entièrement en local** via [whisper.cpp](https://github.com/ggerganov/whisper.cpp).
Aucun service cloud payant, aucune clé API : le seul coût est le temps
de calcul de votre propre machine.

Usage mono-utilisateur, sans authentification. Distribué en open-source
— si vous clonez ce repo, vous faites tourner votre propre instance isolée.

![Démo WhisperLocal](assets/demo.gif)

*Conteneurs Docker → transcription WhisperLocal → comparaison avec
TurboScribe (plateforme commerciale).*

---

## Prérequis

### 1. Docker & Docker Compose

C'est la méthode recommandée — voir [Démarrage rapide](#démarrage-rapide).

### 2. whisper.cpp compilé

whisper.cpp n'est **pas embarqué** dans l'image Docker de l'API (pour
garder l'image légère et parce que le binaire dépend de l'architecture
CPU de votre machine — AVX2, ARM NEON, etc.). Vous devez le compiler vous-même :

```bash
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp
cmake -B build
cmake --build build --config Release
```

Le binaire compilé (`whisper-cli`, ou `main` selon la version) doit être
copié dans `./whisper-bin/` à la racine de ce repo :

```
whisper-bin/
└── whisper-cli   (ou main)
```

> Si le nom du binaire diffère, adapte `WHISPER_CPP_BINARY_PATH` dans
> `docker-compose.yml` (variable `environment.WHISPER_CPP_BINARY_PATH`
> du service `api`).

### 3. Modèle Whisper — `medium` (requis)

Un seul modèle est **requis** pour un premier lancement fonctionnel :
`medium`. Téléchargez-le avec le script fourni par whisper.cpp :

```bash
cd whisper.cpp
bash ./models/download-ggml-model.sh medium
```

Puis copie (ou déplace) le fichier `ggml-medium.bin` obtenu dans
`./models/` à la racine de ce repo :

```
models/
└── ggml-medium.bin
```

### 4. Modèles optionnels — `base` / `small` / `large`

Ces modèles ne sont **pas** téléchargés par défaut (le modèle `large`
pèse plusieurs Go — inutile d'alourdir le setup initial pour rien). Si
vous voulez les proposer dans le sélecteur de modèle du frontend, téléchargez-
les à la demande de la même façon et déposez-les dans `./models/` :

```bash
bash ./models/download-ggml-model.sh base
bash ./models/download-ggml-model.sh small
bash ./models/download-ggml-model.sh large-v3
```

> Le fichier `ggml-large.bin` n'existe pas tel quel sur le dépôt officiel
> des modèles — seules des versions numérotées existent (`large-v1/v2/v3`).
> Le script `download-ggml-model.sh` gère cet alias automatiquement ; si vous
> téléchargez manuellement, renommez le fichier obtenu (`ggml-large-v3.bin`)
> en `ggml-large.bin` pour qu'il corresponde au nom attendu
> (`ggml-${model}.bin`, où `model` = valeur du sélecteur frontend, ex.
> `large`).

Un modèle non présent dans `./models/` fera simplement échouer les jobs
qui le sélectionnent (`errorMessage` explicite en base, fichier audio
conservé pour un nouvel essai).

### 5. Réglages de performance (optionnel)

Par défaut, whisper.cpp utilise 4 threads. Sur une machine disposant de
plus de coeurs, vous pouvez augmenter ce nombre via `WHISPER_THREADS`
(`.env` racine ou `backend/.env.example` selon votre mode de lancement) :

```
WHISPER_THREADS=8
```

> Sur un CPU Intel hybride (coeurs Performance/Efficience), augmenter
> `WHISPER_THREADS` n'accélère pas toujours la transcription — mesurez
> avant d'ajuster cette valeur. Laisser `0` (ou la variable absente)
> conserve le comportement par défaut de whisper.cpp.

---

## Diarisation (optionnelle)

WhisperLocal peut identifier **qui parle** dans un audio multi-locuteurs,
via [pyannote.audio](https://github.com/pyannote/pyannote-audio), exécuté
dans un service Python séparé (`diarization/`). C'est une fonctionnalité
**opt-in** (case à cocher à l'upload) qui **n'affecte jamais** le
fonctionnement de base : si le service de diarisation est absent,
indisponible ou en erreur, la transcription texte classique se déroule
normalement — seule l'info de locuteur est absente du résultat.

### Prérequis (uniquement si vous voulez utiliser la diarisation)

1. Un compte [Hugging Face](https://huggingface.co/) et un [token
   d'accès](https://huggingface.co/settings/tokens) (lecture suffit).
2. Accepter les conditions d'utilisation des **deux** modèles gated
   suivants (nécessaire pour que le token fonctionne) :
   - https://huggingface.co/pyannote/speaker-diarization-3.1
   - https://huggingface.co/pyannote/segmentation-3.0
3. Ajouter le token dans le fichier `.env` **à la racine du repo**
   (à côté de `docker-compose.yml`, pas dans `backend/.env`) :

   ```
   HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

Docker Compose lit automatiquement ce `.env` racine et le transmet au
service `diarization`.

### Fonctionnement

- Le service `diarization` (FastAPI + pyannote.audio, CPU uniquement)
  charge le pipeline une seule fois au démarrage du conteneur, puis
  reste à l'écoute en interne (jamais exposé côté hôte).
- À l'upload, si la case "diarisation" est cochée, l'API appelle ce
  service **après** la transcription whisper.cpp réussie, sur le même
  fichier WAV, puis fusionne les locuteurs détectés avec les cues du
  SRT par recouvrement temporel.
- Si `HF_TOKEN` est absent/invalide, si les conditions HF n'ont pas été
  acceptées, ou si le service est simplement indisponible : le job
  reste `DONE` avec le texte transcrit, `speakerSegments` reste `null`.
  Aucune erreur n'est remontée à l'utilisateur pour ce seul motif.

Sans `HF_TOKEN` configuré, vous pouvez ignorer entièrement cette section —
le reste de l'application fonctionne à l'identique.

---

## Démarrage rapide

```bash
git clone https://github.com/Tiene1/WhisperLocal.git
cd WhisperLocal

# 1. Placer le binaire whisper.cpp dans ./whisper-bin/
# 2. Placer ggml-medium.bin dans ./models/
# 3. Lancer

docker compose up --build
```

Le frontend est disponible sur `http://localhost:3001`, l'API sur
`http://localhost:3010` (voir section Infrastructure ci-dessous pour le
détail des ports).

Au démarrage du conteneur `api`, le schéma de base de données est
synchronisé automatiquement (`prisma db push`) — pas d'étape de
migration manuelle nécessaire pour un premier lancement.

**Pour tester rapidement** sans préparer votre propre fichier audio, un
échantillon d'1 minute (domaine public) est fourni dans
[`samples/`](samples/) — dépose-le simplement dans l'interface d'upload.

---

## Infrastructure

4 services Docker Compose, sur le même réseau interne (résolution DNS
par nom de service — ex. l'API joint PostgreSQL via `postgres:5432`,
jamais via `localhost`).

| Service | Rôle | Port hôte | Port interne | Exposé côté hôte ? |
|---|---|---|---|---|
| `frontend` | Next.js (UI) | `3001` | `3001` | Oui |
| `api` | NestJS (backend) | `3010`* | `3000` | Oui |
| `postgres` | Base de données | — | `5432` | **Non** — accès uniquement via le réseau interne |
| `diarization` | Service Python (pyannote) | — | `8001` | **Non** — jamais exposé, appelé uniquement par `api` |

\* Le port hôte de l'API a été remappé de `3000` à `3010` (au lieu du
port par défaut) pour éviter un conflit avec un autre service déjà
présent sur la machine de développement — purement local à cet
environnement, adaptez `docker-compose.yml` si `3000` est libre chez vous.

**Volumes**

| Volume | Type | Contenu | Persistant entre redémarrages ? |
|---|---|---|---|
| `postgres_data` | Nommé (Docker) | Données PostgreSQL | Oui |
| `uploads_tmp` | Nommé (Docker) | Fichiers audio temporaires (WAV convertis), partagé en lecture seule avec `diarization` | Non nécessaire (fichiers de travail, nettoyés par l'app) |
| `./whisper-bin` | Bind mount (hôte), lecture seule | Binaire whisper.cpp compilé sur l'hôte | N/A (fourni par vous, cf. prérequis) |
| `./models` | Bind mount (hôte), lecture seule | Modèles ggml Whisper | N/A (fourni par vous, cf. prérequis) |

**Variables d'environnement racine** (fichier `.env` à la racine, lu
automatiquement par Docker Compose — voir `.env.example`) :
`HF_TOKEN` (diarisation, optionnel), `NEXT_PUBLIC_API_URL`,
`MAX_UPLOAD_SIZE_MB`, `CORS_ORIGIN`.

---

## Développement local (sans Docker pour l'API)

Utile si vous modifiez le code backend fréquemment.

```bash
cd backend
npm install
cp .env.example .env
# Édite .env : chemins whisper.cpp/ffmpeg locaux, DATABASE_URL, etc.

# Démarre uniquement PostgreSQL via Docker
docker compose up postgres -d

npm run prisma:generate
npm run prisma:migrate   # crée une migration + synchronise le schéma
npm run start:dev
```

### Tests

```bash
cd backend
npm test
```

### Build de production

```bash
cd backend
npm run build
npm run start:prod
```

---

## Architecture

Le backend suit une **architecture en couches** (NestJS), documentée
en détail dans :
- [`backend/docs/ADR.md`](backend/docs/ADR.md) — décisions et justifications
- [`backend/docs/architecture.md`](backend/docs/architecture.md) — structure de dossiers, contrat API, schéma Prisma

### Contrat API

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/uploads` | Upload d'un fichier audio (+ `model`, `language`, `diarizationEnabled`), crée un job |
| `GET` | `/jobs/:id` | Statut détaillé d'un job (statut, progression, résultat, erreur) |
| `GET` | `/jobs` | Liste de l'historique |
| `GET` | `/jobs/:id/export?format=txt\|srt\|docx` | Téléchargement du résultat |
| `POST` | `/jobs/:id/cancel` | Annule un job en attente ou en cours |
| `DELETE` | `/jobs/:id` | Supprime une entrée d'historique |

### Règles de fonctionnement importantes

- Le fichier audio original est supprimé après conversion en WAV — seul
  le WAV (16kHz mono) circule ensuite dans le pipeline.
- Ce WAV est supprimé **uniquement** en cas de succès ou d'annulation
  confirmée de la transcription — jamais en cas d'échec réel (pour
  permettre un diagnostic ou un nouvel essai).
- Un job annulé passe au statut `FAILED` avec le message *"Annulé par
  l'utilisateur"* — il n'y a pas de statut `CANCELLED` dédié.
- La progression (`progress`, 0-100) est calculée au mieux à partir de
  la sortie de whisper.cpp : si le binaire ne l'expose pas, elle reste
  à `0` (le frontend doit alors afficher un indicateur indéterminé).
- Un seul job est traité à la fois (file d'attente en mémoire,
  concurrence = 1, pas de Redis/BullMQ).
- Un redémarrage du serveur pendant un job en cours le fait repasser à
  `FAILED` au boot (`"Interrompu par un redémarrage du serveur"`).
- La diarisation (identification des locuteurs) est opt-in et jamais
  bloquante — voir [Diarisation (optionnelle)](#diarisation-optionnelle).
- Un garde-fou de confiance calcule, en best-effort et jamais bloquant
  (même philosophie que la diarisation), la part de tokens peu fiables
  de chaque transcription (`isLowConfidenceWarning`) — c'est un simple
  avertissement affiché côté résultat, jamais un blocage de
  l'enregistrement ni une suppression de contenu.

---

## Variables d'environnement (backend)

Voir [`backend/.env.example`](backend/.env.example) pour la liste complète
et les valeurs par défaut.

---

## Licence

MIT
