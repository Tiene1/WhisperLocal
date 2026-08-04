# Service de diarisation — Speech To Text Local

Service Python indépendant qui identifie **qui parle** dans un audio
multi-locuteurs, via [pyannote.audio](https://github.com/pyannote/pyannote-audio).
Appelé par l'API NestJS (voir `backend/docs/ADR.md`, section 11), jamais
directement par le frontend.

## Pourquoi un service séparé ?

`pyannote.audio` nécessite PyTorch, ce qui alourdirait considérablement
l'image Docker de l'API NestJS (qui reste sinon volontairement légère —
NFR Portabilité, cf. ADR). Ce service tourne donc dans son propre
conteneur, jamais exposé côté hôte (accessible uniquement via le réseau
interne Docker Compose).

## Fonctionnement

1. Au démarrage du conteneur, le pipeline `pyannote/speaker-diarization-3.1`
   est chargé **une seule fois** en mémoire (pas à chaque requête) —
   voir `load_pipeline()` dans `main.py`, déclenché par l'event FastAPI
   `startup`.
2. `POST /diarize` reçoit `{ "filePath": "/tmp/whisperlocal-uploads/xxx.wav" }`
   — **pas d'upload HTTP du fichier** : le service lit directement le
   fichier WAV depuis le volume Docker partagé avec l'API (`uploads_tmp`,
   monté en lecture seule ici).
3. Retourne `{ "segments": [{ "speaker": "SPEAKER_00", "start": 0.0, "end": 4.2 }, ...] }`
   — la fusion avec le texte transcrit (association segment ↔ cue SRT)
   se fait côté NestJS (`backend/src/transcription/engine/speaker-merge.ts`),
   pas ici : ce service ne connaît que l'audio, jamais le texte.
4. `GET /health` — utile pour diagnostiquer si le pipeline a bien chargé
   (`{"status": "ok"}`) ou non (`{"status": "degraded", "error": "..."}`,
   généralement `HF_TOKEN` absent/invalide ou conditions HF non acceptées).

## Prérequis

Un token Hugging Face valide dans la variable d'environnement `HF_TOKEN`
(voir le README principal du repo, section "Diarisation (optionnelle)",
pour la procédure complète : compte HF, acceptation des conditions sur
les 2 modèles gated, génération du token).

**Sans `HF_TOKEN`** : le service démarre quand même (pas de crash), mais
`/diarize` répond systématiquement `500` — ce qui est intercepté et
toléré côté NestJS (`DiarizationProvider`, jamais bloquant pour un job).

## Règle absolue : jamais bloquant

Ce service peut être arrêté, en échec, ou absent sans jamais casser la
fonctionnalité principale de transcription. C'est une garantie côté
appelant (NestJS), pas ici — ce service se contente de répondre des
codes d'erreur HTTP explicites (`404` fichier introuvable, `500` pipeline
non chargé ou erreur pyannote), la logique "jamais bloquant" vit entièrement
dans `DiarizationProvider` côté API.

## Développement local (sans Docker)

```bash
cd diarization
python -m venv .venv
source .venv/bin/activate  # ou .venv\Scripts\activate sous Windows
pip install -r requirements.txt --extra-index-url https://download.pytorch.org/whl/cpu

export HF_TOKEN=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
uvicorn main:app --host 0.0.0.0 --port 8001
```

## Notes de build (Docker)

Le `Dockerfile` installe `torch`/`torchaudio` dans une couche séparée du
reste des dépendances — sur une connexion instable, ça évite de
retélécharger PyTorch (le plus gros téléchargement) à chaque nouvelle
tentative après un échec sur un paquet plus léger.
