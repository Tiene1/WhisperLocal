"""Service de diarisation (identification des locuteurs) — Speech To Text Local.

Service Python séparé (FastAPI + pyannote.audio), volontairement isolé de
l'API NestJS pour ne pas embarquer PyTorch dans son image (cf. ADR
`backend/docs/ADR.md`, section 11, "Décision — nouveau service dédié").

Fonctionnalité opt-in côté API : ce service n'est JAMAIS appelé sur le
chemin critique de la transcription de base. Si son appel échoue côté
NestJS, le job continue normalement sans info de locuteur — cette règle
est appliquée côté `DiarizationProvider` (NestJS), pas ici : ce service se
contente de répondre 404/500 explicitement en cas d'erreur.

Lecture du fichier audio : pas d'upload HTTP — le service tourne dans le
même réseau Docker que l'API et lit directement le fichier WAV depuis le
volume partagé `uploads_tmp` (accès en lecture seule suffit).
"""

import logging
import os
from pathlib import Path
from typing import List

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("diarization")

HF_TOKEN = os.environ.get("HF_TOKEN")
PIPELINE_NAME = "pyannote/speaker-diarization-3.1"

app = FastAPI(title="Speech To Text Local — Service de diarisation")

# Chargé une seule fois au démarrage du service (pas à chaque requête) —
# cf. mission section 1. `None` tant que le chargement n'a pas réussi ou
# a échoué (voir `startup_error` pour distinguer les deux cas).
pipeline = None
startup_error: str | None = None


class DiarizeRequest(BaseModel):
    filePath: str


class SpeakerSegment(BaseModel):
    speaker: str
    start: float
    end: float


class DiarizeResponse(BaseModel):
    segments: List[SpeakerSegment]


@app.on_event("startup")
def load_pipeline() -> None:
    global pipeline, startup_error

    if not HF_TOKEN:
        startup_error = (
            "Variable d'environnement HF_TOKEN absente — impossible de charger "
            f"le pipeline {PIPELINE_NAME} (modèle gated Hugging Face)."
        )
        logger.error(startup_error)
        return

    try:
        # Import différé : évite de payer le coût d'import de torch/pyannote
        # si jamais ce module était importé sans être lancé (ex. tests).
        from pyannote.audio import Pipeline

        logger.info("Chargement du pipeline %s ...", PIPELINE_NAME)
        pipeline = Pipeline.from_pretrained(PIPELINE_NAME, use_auth_token=HF_TOKEN)
        logger.info("Pipeline de diarisation chargé avec succès.")
    except Exception as error:  # noqa: BLE001 — on veut logger toute erreur de chargement
        startup_error = f"Échec du chargement du pipeline {PIPELINE_NAME} : {error}"
        logger.exception(startup_error)


@app.get("/health")
def health() -> dict:
    return {"status": "ok" if pipeline is not None else "degraded", "error": startup_error}


@app.post("/diarize", response_model=DiarizeResponse)
def diarize(request: DiarizeRequest) -> DiarizeResponse:
    if pipeline is None:
        detail = startup_error or "Pipeline de diarisation non disponible."
        logger.error(detail)
        raise HTTPException(status_code=500, detail=detail)

    wav_path = Path(request.filePath)
    if not wav_path.is_file():
        detail = f"Fichier WAV introuvable : {wav_path}"
        logger.warning(detail)
        raise HTTPException(status_code=404, detail=detail)

    try:
        diarization = pipeline(str(wav_path))
    except Exception as error:  # noqa: BLE001 — erreur pyannote à la volée
        detail = f"Échec de la diarisation pour {wav_path} : {error}"
        logger.exception(detail)
        raise HTTPException(status_code=500, detail=detail) from error

    segments = [
        SpeakerSegment(speaker=str(speaker), start=float(turn.start), end=float(turn.end))
        for turn, _, speaker in diarization.itertracks(yield_label=True)
    ]

    return DiarizeResponse(segments=segments)
