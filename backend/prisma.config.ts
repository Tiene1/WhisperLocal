import { defineConfig } from 'prisma/config';

// Depuis qu'un fichier prisma.config.ts est présent, la CLI Prisma ne
// charge plus automatiquement `.env` (comportement historique) — on le
// fait explicitement pour que DATABASE_URL reste disponible pour
// `prisma migrate` / `prisma studio`, etc.
try {
  process.loadEnvFile('.env');
} catch {
  // .env absent (ex: variables fournies autrement, CI, Docker) — ignoré.
}

/**
 * Configuration Prisma CLI (remplace la clé `prisma` de package.json,
 * dépréciée à partir de Prisma 7).
 */
export default defineConfig({
  schema: 'src/prisma/schema.prisma',
});
