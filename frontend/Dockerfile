# ─── Étape 1 : build ─────────────────────────────────────────────────
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# URL de l'API consommée par le frontend — variable publique intégrée au
# bundle au build (NEXT_PUBLIC_*), surchageable via docker-compose build args.
ARG NEXT_PUBLIC_API_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN npm run build

# ─── Étape 2 : image d'exécution ────────────────────────────────────
FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Sortie "standalone" de Next.js : ne copie que le serveur minimal +
# node_modules nécessaires (image plus légère qu'un `npm ci` complet en
# runtime, cf. NFR Portabilité).
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

EXPOSE 3001

CMD ["node", "server.js"]
