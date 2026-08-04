# Architecture Frontend — Speech To Text Local Web

> Révision 2 : intègre les 4 écrans des maquettes UI/UX validées
> (Upload, Traitement, Résultat, Historique) et les nouvelles features
> (modèle/langue, annulation, progression, export multi-format).
> Révision 3 : intègre la diarisation (case à cocher à l'upload,
> affichage du résultat groupé par locuteur) — voir `backend/docs/ADR.md`
> section 11 pour le contexte complet côté API.

---

## Structure de dossiers (Next.js App Router)

```
app/
├── layout.tsx                   # Layout partagé (polices, SideNav)
├── page.tsx                     # Écran Upload — formulaire + mini-historique récent
├── jobs/[id]/page.tsx           # Écran Traitement / Résultat (état selon le statut du job)
├── history/page.tsx             # Écran Historique complet (table + filtre + pagination)
├── components/
│   ├── SideNav.tsx              # Navigation latérale partagée (Transcribe/History)
│   ├── UploadForm.tsx           # Zone drag & drop + validation taille/format + case diarisation
│   ├── ModelSelector.tsx        # Sélecteur modèle (base/small/medium/large)
│   ├── LanguageSelector.tsx     # Sélecteur langue (auto/fr/en/es)
│   ├── JobStatusPoller.tsx      # Polling GET /jobs/:id, gère PENDING/PROCESSING/DONE/FAILED
│   ├── ProcessingView.tsx       # Vue "Traitement en cours" — badge, waveform, temps, cancel
│   ├── TranscriptionResult.tsx  # Vue résultat — texte (groupé par locuteur si diarisation) + export TXT/SRT/DOCX + copier
│   ├── HistoryList.tsx          # Table historique — statut, modèle, durée, actions
│   └── StatusBadge.tsx          # Badge réutilisable (couleur selon status)
├── lib/
│   ├── api-client.ts            # Fonctions fetch vers l'API NestJS
│   └── format.ts                # Formatage durée/date (affichage pur, pas de logique métier)
└── types/
    └── job.ts                   # Types partagés (status, model, language, SpeakerSegment, job complet)
```

---

## Écrans (alignés sur les maquettes validées)

1. **Upload** (`app/page.tsx`) — `UploadForm` + `ModelSelector` +
   `LanguageSelector` + mini-liste des travaux récents
2. **Traitement en cours** (`app/jobs/[id]/page.tsx`, si `status` ∈
   {PENDING, PROCESSING}) — `ProcessingView` : badge de statut, temps
   écoulé / durée totale (`durationSeconds`), progression si disponible
   (sinon indicateur indéterminé), bouton Annuler
3. **Résultat** (`app/jobs/[id]/page.tsx`, si `status = DONE`) —
   `TranscriptionResult` : texte transcrit (regroupé par locuteur avec
   badge coloré si `speakerSegments` non vide, sinon paragraphes bruts
   comme avant), boutons export TXT/SRT/DOCX, copier le texte. Si
   `diarizationEnabled` mais `speakerSegments` reste `null` (service
   indisponible/échec), une note neutre l'indique — pas une erreur
4. **Historique** (`app/history/page.tsx`) — `HistoryList` : table
   complète avec filtre, actions contextuelles selon le statut (ouvrir/
   réessayer/annuler/supprimer)

---

## Comportement par statut (StatusBadge / actions contextuelles)

| Statut | Couleur | Actions disponibles |
|---|---|---|
| `PENDING` | gris | Annuler |
| `PROCESSING` | bleu (pulse) | Annuler |
| `DONE` | vert | Ouvrir, Exporter, Supprimer |
| `FAILED` | orange | Réessayer (si fichier encore présent), Supprimer |

Note : `FAILED` couvre à la fois les échecs réels et les annulations
(`errorMessage` distingue les deux à l'affichage si besoin, mais le badge
visuel reste identique — pas de statut "Annulé" séparé, cf. ADR).

---

## Décisions à respecter

- **Cases TXT/SRT à l'upload** : le backend génère toujours les deux
  formats. Ces cases peuvent rester à l'écran pour cohérence visuelle
  avec la maquette, mais n'ont pas besoin d'être reliées à une logique
  côté frontend — elles n'affectent rien côté serveur.
- **Progression** : toujours prévoir le cas où `progress` reste à 0/absent
  (best-effort côté backend) — ne pas afficher "0%" comme si c'était une
  vraie mesure, préférer un indicateur d'activité générique dans ce cas.
- **Durée affichée pendant le traitement** : `durationSeconds` (durée
  totale de l'audio, connue dès l'upload) vs temps écoulé calculé
  côté client depuis `startedAt` — ce n'est PAS une estimation de temps
  restant de traitement (qui n'est pas fournie, cf. ADR Risque 4).

---

## Règles d'intégration API

- Toutes les requêtes passent par `lib/api-client.ts`
- Le polling s'arrête dès qu'un statut terminal (`DONE`/`FAILED`) est atteint
- Pas de WebSocket, pas de SSE — polling REST uniquement

## Diarisation (case à cocher, opt-in)

- `UploadForm` envoie `diarizationEnabled` dans le FormData d'upload
  (décoché par défaut, avec une note sur le temps de traitement
  supplémentaire)
- **Point important côté timing** : côté backend, la diarisation est
  tentée *avant* que le job passe à `DONE` (pas après) — donc quand le
  frontend arrête son polling sur `DONE`, `speakerSegments` est déjà
  disponible s'il a réussi. Ne pas continuer à poller après `DONE` "au
  cas où" les locuteurs arrivent plus tard — ce n'est plus le cas.
