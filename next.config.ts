import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // playwright-core/@sparticuz/chromium-min (usati in src/lib/estrazione.ts per lo scraping
  // Fathom/Circleback/Loom) leggono file non-JS a runtime (es. browsers.json) che il bundler di
  // Next.js non traccia se il pacchetto viene incluso nel bundle. Escluderli dal bundling e
  // lasciarli come dipendenze Node normali (stessa configurazione già in uso in Fast Report) è
  // necessario ma NON sufficiente da solo: il tracciamento file di Vercel (@vercel/nft) analizza
  // staticamente require/import/fs e non individua comunque browsers.json (caricato da
  // playwright-core in un modo che l'analisi statica non traccia) — resta un 502 "Cannot find
  // module .../playwright-core/browsers.json" anche con solo serverExternalPackages. Serve
  // FORZARE l'inclusione esplicita del pacchetto per la route che lo usa.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium-min"],
  outputFileTracingIncludes: {
    "/api/meeting/estrai": ["./node_modules/playwright-core/**/*"],
    "/api/report-commerciale/estrai": ["./node_modules/playwright-core/**/*"],
  },
};

export default nextConfig;
