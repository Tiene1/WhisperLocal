# ─── Étape 1 : build ─────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ─── Étape 2 : image d'exécution ────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

# ffmpeg est nécessaire pour la conversion audio (cf. FfmpegProvider).
# whisper.cpp n'est PAS installé ici : voir README — soit monté en volume
# depuis l'hôte (binaire pré-compilé), soit construit dans une image
# dérivée. Ce choix garde l'image de base légère et portable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Note : on garde ici les devDependencies (dont la CLI `prisma`), utilisée
# au démarrage du conteneur pour synchroniser le schéma (`prisma db push`,
# cf. docker-compose.yml). Choix assumé pour la simplicité de setup
# (NFR Portabilité) au prix d'une image un peu plus lourde.
COPY package.json package-lock.json prisma.config.ts ./
RUN npm ci

COPY --from=build /app/dist ./dist
COPY --from=build /app/src/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push --accept-data-loss --skip-generate --schema=./prisma/schema.prisma && node dist/src/main.js"]
