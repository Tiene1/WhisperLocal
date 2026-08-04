# Architecture Backend — Speech To Text Local API

> Pattern : Architecture en Couches (voir `docs/ADR.md` section 3)
> Révision 2 : intègre sélection modèle/langue, annulation, progression,
> export multi-format (issus des maquettes UI/UX validées).
> Révision 3 : intègre la diarisation (identification des locuteurs,
> opt-in, via un service Python séparé) — voir `docs/ADR.md` section 11.

---

## Structure de dossiers

```
src/
├── upload/
│   ├── upload.controller.ts        # Présentation — reçoit fichier + model + language + diarizationEnabled
│   ├── upload.service.ts           # Application — orchestre validation + durée + conversion
│   ├── dto/
│   │   └── upload-audio.dto.ts     # inclut model (enum), language (enum), diarizationEnabled (bool, défaut false)
│   └── validators/
│       └── audio-file.validator.ts # taille max 250Mo, format audio autorisé
│
├── transcription/
│   ├── transcription.controller.ts # Présentation — GET /jobs/:id, GET /jobs, POST /jobs/:id/cancel
│   ├── transcription.service.ts    # Application — orchestre file + annulation + diarisation (opt-in, jamais bloquante)
│   ├── queue/
│   │   └── in-memory-queue.service.ts   # file FIFO, concurrence = 1, supporte le retrait/kill
│   ├── engine/
│   │   ├── whisper-cpp.provider.ts    # Infrastructure — subprocess, -otxt -osrt, parsing progress
│   │   ├── ffmpeg.provider.ts         # Infrastructure — conversion WAV + ffprobe (durée audio)
│   │   ├── hallucination-filter.ts    # Filtre les hallucinations connues de Whisper (ex. crédit Amara.org)
│   │   ├── diarization.provider.ts    # Appel HTTP vers le service Python de diarisation, jamais bloquant
│   │   └── speaker-merge.ts           # Fusion locuteurs (pyannote) × cues SRT par recouvrement temporel
│   ├── errors/
│   │   └── job-cancelled.error.ts     # Erreur dédiée à l'annulation (distincte d'un échec réel)
│   └── domain/
│       └── transcription-job.entity.ts  # Domain — statuts valides, règles de transition
│
├── history/
│   ├── history.controller.ts       # Présentation — GET /jobs, DELETE /jobs/:id, GET /jobs/:id/export
│   ├── history.service.ts          # Application
│   ├── history.repository.ts       # Infrastructure — accès Prisma (seul point d'accès, partagé avec TranscriptionModule)
│   ├── dto/
│   │   └── job-response.dto.ts     # Expose diarizationEnabled / speakerSegments (détail uniquement)
│   └── export/
│       └── docx-export.provider.ts # Infrastructure — génère un .docx à la demande depuis resultText
│
├── prisma/
│   └── schema.prisma
│
└── shared/
    └── config/
        └── whisper.config.ts       # chemins binaires, modèles disponibles, concurrence, URL du service de diarisation

diarization/                        # Service séparé (racine du repo, PAS dans backend/src)
├── main.py                         # FastAPI — POST /diarize, pipeline pyannote chargé une fois au démarrage
├── requirements.txt
└── Dockerfile                      # Python + PyTorch CPU, jamais exposé côté hôte
```

---

## Contrat API (endpoints Must Have)

| Méthode | Route | Rôle |
|---|---|---|
| `POST` | `/uploads` | Reçoit fichier + `model` + `language` + `diarizationEnabled` (opt-in, défaut false), valide, extrait la durée (ffprobe), convertit (ffmpeg), crée le job `PENDING`, retourne `{ jobId }` |
| `GET` | `/jobs/:id` | Statut détaillé : `status`, `progress`, `model`, `language`, `durationSeconds`, `resultText`/`resultSrt` si `done`, `errorMessage` si `failed`, `diarizationEnabled`, `speakerSegments` (`null` si non demandée ou si le service a échoué) |
| `GET` | `/jobs` | Liste de l'historique, avec `durationSeconds` et `diarizationEnabled` (PAS `speakerSegments`, réservé au détail) |
| `GET` | `/jobs/:id/export?format=txt\|srt\|docx` | Téléchargement du résultat dans le format demandé (`docx` généré à la volée) |
| `POST` | `/jobs/:id/cancel` | Annule un job `PENDING` (retrait de file) ou `PROCESSING` (kill subprocess) → statut `FAILED`, `errorMessage = "Annulé par l'utilisateur"` |
| `DELETE` | `/jobs/:id` | Suppression d'une entrée d'historique (optionnel) |

---

## Schéma Prisma

```prisma
model TranscriptionJob {
  id                 String    @id @default(uuid())
  filename           String
  status             JobStatus @default(PENDING)
  model              String    @default("medium")
  language           String    @default("fr")
  durationSeconds    Int?
  progress           Int       @default(0)
  resultText         String?
  resultSrt          String?
  errorMessage       String?
  diarizationEnabled Boolean   @default(false)
  speakerSegments    Json?     // [{ speaker, start, end, text }] — null si non demandée/échec
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
  startedAt          DateTime?
  completedAt        DateTime?
}

enum JobStatus {
  PENDING
  PROCESSING
  DONE
  FAILED
}
```

Pas de statut `CANCELLED` séparé — une annulation aboutit à `FAILED`
avec un `errorMessage` explicite (cf. ADR section 3, décision actée).

---

## Flux d'une requête (upload → résultat)

```
Client HTTP
    │
    ▼
🟦 UploadController      → valide le DTO (taille, format, model, language)
    │
    ▼
🟨 UploadService         → ffprobe (durée) → ffmpeg (conversion WAV 16kHz mono)
    │                       → crée le TranscriptionJob (PENDING, model, language, durationSeconds)
    │                       → pousse le job dans InMemoryQueueService
    ▼
🟨 InMemoryQueueService  → traite 1 job à la fois (FIFO)
    │                       → status → PROCESSING, startedAt renseigné
    ▼
🟥 WhisperCppProvider    → spawn whisper.cpp (-m {model} -l {language} -otxt -osrt)
    │                       → parse stderr pour progress (best-effort, cf. Risque 5 ADR)
    │                       → filtre les hallucinations connues (hallucination-filter.ts)
    │
    ├── succès  → si diarizationEnabled : appelle DiarizationProvider AVANT markDone
    │              (jamais bloquant — échec/timeout → speakerSegments reste null, cf. ADR
    │              section 11) — l'ordre est important : la diarisation doit être tentée
    │              AVANT que le statut passe à DONE, sinon le frontend arrête son polling
    │              avant que les locuteurs soient prêts (bug observé et corrigé)
    │            → status → DONE, resultText + resultSrt (+ speakerSegments) remplis,
    │              fichier audio SUPPRIMÉ
    └── échec   → status → FAILED, errorMessage rempli, fichier audio CONSERVÉ
```

**Diarisation (si `diarizationEnabled = true`)**
```
TranscriptionService (après succès whisper.cpp, sur le même WAV)
    │
    ▼
🟥 DiarizationProvider   → HTTP POST vers le service Python (http://diarization:8001/diarize)
    │                       → jamais bloquant : erreur/timeout → renvoie null, warning logué
    │
    ▼ (si segments reçus)
🟨 speaker-merge.ts      → recoupe les segments pyannote avec les cues du SRT whisper.cpp
    │                       (recouvrement temporel maximal)
    ▼
speakerSegments passé à markDone() → persisté en même temps que le passage à DONE
```

**Annulation (à tout moment PENDING/PROCESSING)**
```
POST /jobs/:id/cancel
    │
    ├── si PENDING     → retiré de InMemoryQueueService, jamais lancé
    └── si PROCESSING  → kill('SIGTERM') sur le subprocess whisper.cpp,
                          repli SIGKILL après timeout court
    │
    ▼
status → FAILED, errorMessage = "Annulé par l'utilisateur"
fichier audio temporaire supprimé (même logique que succès)
```

**Export**
```
GET /jobs/:id/export?format=txt   → retourne resultText tel quel
GET /jobs/:id/export?format=srt   → retourne resultSrt tel quel
GET /jobs/:id/export?format=docx  → DocxExportProvider convertit resultText
                                     en .docx à la volée (pas de stockage)
```

**Règle absolue** : suppression audio uniquement sur succès ou annulation
confirmée — jamais sur un échec réel (cf. ADR Risque 1).

---

## Nettoyage au démarrage

Au boot de l'application, tout job en statut `PROCESSING` repasse à
`FAILED` avec `"Interrompu par un redémarrage du serveur"` (cf. ADR
Risque 3).
