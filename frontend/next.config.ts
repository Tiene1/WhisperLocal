import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sortie "standalone" : image Docker de production légère (ne copie que
  // le strict nécessaire au runtime, cf. Dockerfile).
  output: "standalone",
};

export default nextConfig;
