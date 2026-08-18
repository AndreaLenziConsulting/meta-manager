import type { AttivitaClienteRow, Cliente } from "@/types/kpi";
import type { ValutazioneSalute } from "@/lib/salute";

/**
 * Riga della Dashboard Amministratore: incrocia i due segnali che l'admin deve monitorare per
 * cliente — salute ads (già esisteva, vedi salute.ts) e avanzamento lavori (nuovo, vedi
 * roadmap.ts#attivitaInRitardo). Tenuto in un modulo pure (nessun import JSX) così resta
 * testabile con Vitest puro, coerente con lo standard del progetto.
 */
export type SaluteClienteItem = {
  cliente: Cliente;
  investimento: number;
  numeroLead: number;
  valutazione: ValutazioneSalute;
  attivitaInRitardo: AttivitaClienteRow[];
};

export type RiepilogoDashboard = {
  clientiAdsCritici: number; // valutazione.stato === "interveni"
  clientiConAttivitaInRitardo: number; // attivitaInRitardo.length > 0
  totaleAttivitaInRitardo: number; // somma di tutte le attività in ritardo, su tutti i clienti
};

export function calcolaRiepilogo(items: SaluteClienteItem[]): RiepilogoDashboard {
  let clientiAdsCritici = 0;
  let clientiConAttivitaInRitardo = 0;
  let totaleAttivitaInRitardo = 0;
  for (const item of items) {
    if (item.valutazione.stato === "interveni") clientiAdsCritici++;
    if (item.attivitaInRitardo.length > 0) {
      clientiConAttivitaInRitardo++;
      totaleAttivitaInRitardo += item.attivitaInRitardo.length;
    }
  }
  return { clientiAdsCritici, clientiConAttivitaInRitardo, totaleAttivitaInRitardo };
}

// Severità ads a parità di bucket di urgenza combinata (vedi ordinaPerPriorita) — "interveni" non
// compare mai qui: è già catturato per intero dai bucket 0/1, quindi la scala parte da "mantieni".
const ORDINE_STATO_ADS: Record<string, number> = {
  interveni: 0,
  mantieni: 1,
  scala: 2,
  "dati-insufficienti": 3,
  "no-target": 4,
};

/**
 * Ordina per urgenza combinata, senza mutare l'array in input:
 * 1. entrambi i problemi (ads da intervenire E attività in ritardo)
 * 2. solo ads da intervenire
 * 3. solo attività in ritardo (più ne ha, più urgente)
 * 4. il resto, nello stesso ordine di severità ads già in uso prima di questa funzionalità
 */
export function ordinaPerPriorita(items: SaluteClienteItem[]): SaluteClienteItem[] {
  const bucket = (item: SaluteClienteItem): number => {
    const adsCritico = item.valutazione.stato === "interveni";
    const inRitardo = item.attivitaInRitardo.length > 0;
    if (adsCritico && inRitardo) return 0;
    if (adsCritico) return 1;
    if (inRitardo) return 2;
    return 3;
  };

  return [...items].sort((a, b) => {
    const bucketA = bucket(a);
    const bucketB = bucket(b);
    if (bucketA !== bucketB) return bucketA - bucketB;
    if (bucketA === 2) return b.attivitaInRitardo.length - a.attivitaInRitardo.length;
    return ORDINE_STATO_ADS[a.valutazione.stato] - ORDINE_STATO_ADS[b.valutazione.stato];
  });
}
