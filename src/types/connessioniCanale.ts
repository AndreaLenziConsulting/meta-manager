import type { Canale } from "@/types/kpi";

/**
 * Connessione a un canale pubblicitario (Meta Ads/Google Ads) per una sede — generalizza
 * `Sede.adAccountId` (un solo account Meta per sede, oggi) a N connessioni, una per canale.
 * Stesso schema/precedente di `GhlConnessione` (una per sede, non per cliente — vedi
 * `src/types/ghl.ts`: "il locationId di GHL è concettualmente la stessa unità di una Sede", stesso
 * ragionamento vale qui per un secondo account pubblicitario.
 *
 * Introdotta in Fase 2 del redesign multi-canale (vedi piano) — **non ancora il percorso di lettura
 * reale**: `syncSede` (src/lib/sync.ts) continua a leggere `Sede.adAccountId`/`tipoConversioneLead`
 * finché il cutover non avviene esplicitamente. Questa tabella è preparatoria: popolata dalla
 * migrazione una tantum `migraConnessioniMeta`, non ancora consumata dal sync vero.
 */
export type ConnessioneCanale = {
  connessioneId: string; // deterministico: `${sedeId}--${canale}`, stesso schema di `${sedeId}--ghl`
  sedeId: string;
  canale: Canale;
  accountId: string; // id numerico Meta (senza "act_") o Customer ID Google Ads (senza trattini) — vedi lib/adAccountId.ts
  // Solo per canale "meta": lo stesso action_type esatto di Meta Insights di Sede.tipoConversioneLead
  // — vuoto per canale "google" (Google Ads non ha un equivalente universale, le conversion action
  // sono configurate per account: vedi il piano). Deliberatamente non condiviso cross-canale.
  tipoConversioneLead: string;
  attivo: boolean;
  note: string;
  creataIl: string; // ISO datetime
};
