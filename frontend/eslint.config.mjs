import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Ce projet n'utilise pas le React Compiler et repose volontairement
      // sur le pattern "polling REST via useEffect + setInterval" imposé
      // par frontend/CLAUDE.md (jamais de WebSocket/SSE). Ce pattern est
      // l'un des deux usages légitimes d'un effet documentés par React
      // (synchroniser avec un système externe, ici l'API HTTP) — les
      // règles react-hooks/set-state-in-effect et react-hooks/purity de
      // eslint-config-next 16 sont taillées pour l'adoption du React
      // Compiler et génèrent des faux positifs sur ce pattern de fetch/poll.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
