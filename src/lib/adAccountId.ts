import type { Canale } from "@/types/kpi";

export type EsitoValidazioneAccountId = { ok: true; valore: string } | { ok: false; errore: string };

/**
 * Valida e normalizza un account id pubblicitario per canale — accorpa una regola prima duplicata
 * 7 volte (4 route API + 3 componenti, solo per Meta: "solo cifre, senza act_"), estesa qui anche a
 * Google Ads. Introdotta con `ConnessioniCanale` (Fase 2 del redesign multi-canale) — i 7 punti
 * esistenti restano sul loro controllo Meta-only invariato per ora (nessun rischio nuovo introdotto
 * lì), da consolidare più avanti se si tocca comunque quel codice.
 *
 * Meta: solo cifre, l'utente non deve includere il prefisso "act_".
 * Google Ads: il Customer ID si presenta ovunque nell'interfaccia Google Ads come "123-456-7890"
 * (con trattini) — ma sia `google-ads-api` sia l'header `login-customer-id` vogliono solo cifre
 * (vedi google-ads-api-setup.md), quindi i trattini vengono tolti automaticamente qui, non richiesti
 * come assenti in input come per Meta.
 */
export function validaAccountId(canale: Canale, valoreGrezzo: string): EsitoValidazioneAccountId {
  const valore = canale === "google" ? valoreGrezzo.replace(/-/g, "").trim() : valoreGrezzo.trim();
  if (!/^\d+$/.test(valore)) {
    return canale === "google"
      ? { ok: false, errore: "Customer ID non valido: solo cifre (i trattini vengono tolti automaticamente)" }
      : { ok: false, errore: 'Ad account id non valido: solo cifre, senza il prefisso "act_"' };
  }
  return { ok: true, valore };
}
