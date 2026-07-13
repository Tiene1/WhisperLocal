# Service de diarisation (identification des locuteurs) — pyannote.audio.
# CPU uniquement, cohérent avec le reste du projet (whisper.cpp tourne
# aussi sur CPU) — pas besoin d'image CUDA, nettement plus lourde.
FROM python:3.11-slim-bookworm

WORKDIR /app

# libsndfile1 : requis par torchaudio/soundfile pour lire les fichiers WAV.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

# Installation en 2 étapes séparées (au lieu d'un unique `pip install -r
# requirements.txt`) : sur une connexion instable, un install monolithique
# de ~10-15 min échoue souvent en cours de route et repart de zéro à chaque
# retry. En isolant torch/torchaudio (le plus long/gros téléchargement) dans
# sa propre couche Docker, un échec sur les paquets suivants ne fait pas
# retélécharger torch — le cache de couche Docker le conserve.
# --retries/--timeout : tolère aussi les coupures transitoires au sein
# d'une même étape.
RUN pip install --no-cache-dir --retries 10 --timeout 60 \
    torch==2.5.1 torchaudio==2.5.1 \
    --extra-index-url https://download.pytorch.org/whl/cpu

RUN pip install --no-cache-dir --retries 10 --timeout 60 -r requirements.txt \
    --extra-index-url https://download.pytorch.org/whl/cpu

COPY main.py .

EXPOSE 8001

# Pas de --reload en production, un seul worker : le pipeline pyannote est
# chargé une fois en mémoire au démarrage (cf. main.py) — plusieurs workers
# dupliqueraient inutilement ce coût mémoire pour un usage mono-utilisateur.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "1"]
