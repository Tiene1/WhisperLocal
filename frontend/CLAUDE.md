# CLAUDE.md — Frontend WhisperLocal Web

## Contexte

Tu travailles sur le frontend de **WhisperLocal**. Usage mono-utilisateur,
pas d'authentification, pas de session à gérer.

Lis `docs/ADR.md` et `docs/architecture.md` avant de commencer — la
Révision 2 ajoute la sélection modèle/langue, l'annulation, le suivi de
progression et l'export multi-format, en plus des maquettes UI/UX à
implémenter fidèlement (voir fichier de maquettes HTML/Tailwind fourni
séparément si disponible).

## Règles absolues

- ❌ Jamais de `lib/database/` ni d'accès direct à une base de données
- ❌ Jamais de WebSocket ni de SSE — polling REST uniquement
- ❌ Jamais d'implémentation d'authentification/login
- ✅ Toujours centraliser les appels API dans `lib/api-client.ts`

## Règles spécifiques au projet

1. **Polling contrôlé** — 3 à 5 secondes, s'arrête dès que le statut
   devient `DONE` ou `FAILED`.

2. **Validation taille côté client** — rejeter avant upload tout fichier
   dépassant 250 Mo.

3. **4 statuts visuels seulement** — `PENDING`/`PROCESSING`/`DONE`/`FAILED`.
   Une annulation aboutit à `FAILED` ; ne pas créer de badge "Annulé"
   séparé, ne pas ajouter de statut côté frontend qui n'existe pas côté API.

4. **Progression tolérante à l'absence de données** — si `progress` reste
   à 0 alors que le job est `PROCESSING` depuis un moment, ne pas afficher
   "0%" comme une vraie mesure : basculer sur un indicateur d'activité
   générique (spinner/pulse) plutôt qu'un pourcentage trompeur.

5. **Cases de format à l'upload (TXT/SRT) décoratives** — ne pas construire
   de logique conditionnelle autour de ces cases, le backend génère
   toujours les deux formats. Ne pas bloquer sur leur intégration API.

6. **Bouton Annuler** — visible uniquement pour les statuts `PENDING` et
   `PROCESSING`, appelle `POST /jobs/:id/cancel`.

7. **Export** — 3 boutons distincts (TXT/SRT/DOCX) sur l'écran résultat,
   chacun appelle `GET /jobs/:id/export?format=...` avec le format
   correspondant.

## Scope

Toutes les fonctionnalités des 4 écrans de maquette (Upload, Traitement,
Résultat, Historique) sont désormais dans le scope à implémenter — il n'y
a plus de découpage V0/V1 pour le frontend : sélection modèle/langue,
annulation, export TXT/SRT/DOCX, colonne durée et filtre dans
l'historique sont tous à construire dès cette itération.

## Ce que tu ne fais PAS

- Pas de développement backend (dépôt séparé)
- Pas de design d'authentification
- Pas d'ajout de WebSocket
