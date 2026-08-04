import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Configuration Playwright — tests E2E du frontend Speech To Text Local.
 *
 * Toutes les requêtes vers l'API NestJS sont interceptées avec
 * `page.route()` (cf. e2e/mocks.ts) : aucun backend réel ni whisper.cpp
 * n'est nécessaire pour exécuter cette suite.
 *
 * Le serveur Next.js de test tourne sur le port 3100 pour ne jamais entrer
 * en conflit avec `NEXT_PUBLIC_API_URL` (http://localhost:3000 par défaut,
 * cf. app/lib/api-client.ts), qui reste l'URL mockée par les tests.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
