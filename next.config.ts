import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // playwright-core/@sparticuz/chromium-min (usati in src/lib/estrazione.ts per lo scraping
  // Fathom/Circleback/Loom) leggono file non-JS a runtime (es. browsers.json) che il bundler di
  // Next.js non traccia se il pacchetto viene incluso nel bundle. Escluderli dal bundling e
  // lasciarli come dipendenze Node normali risolve un 502 in produzione ("Cannot find module
  // .../playwright-core/browsers.json") — stessa configurazione già in uso in Fast Report.
  serverExternalPackages: ["playwright-core", "@sparticuz/chromium-min"],
};

export default nextConfig;
