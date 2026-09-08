import type { AttivitaClienteRow, Cliente, Consulente, Sede } from "@/types/kpi";
import type { ValutazioneSalute } from "@/lib/salute";

/** Salute ads di una singola sede — un cliente ne aggrega una o più, vedi SaluteClienteItem sotto. */
export type SaluteSedeValutazione = {
  sede: Sede;
  investimento: number;
  numeroLead: number;
  valutazione: ValutazioneSalute;
};

/**
 * Riga della Dashboard Amministratore: incrocia i due segnali che l'admin deve monitorare per
 * cliente — salute ads (una per sede, aggregata "il peggio vince" da aggregaValutazioniSedi in
 * salute.ts) e avanzamento lavori (vedi roadmap.ts#attivitaInRitardo, resta a livello cliente).
 * Tenuto in un modulo pure (nessun import JSX) così resta testabile con Vitest puro, coerente con
 * lo standard del progetto.
 */
export type SaluteClienteItem = {
  cliente: Cliente;
  sedi: SaluteSedeValutazione[];
  valutazione: ValutazioneSalute; // aggregata — calcolaRiepilogo/ordinaPerPriorita leggono solo questa, invariati
  investimento: number; // somma delle sedi
  numeroLead: number; // somma delle sedi
  attivitaInRitardo: AttivitaClienteRow[];
  // "Cliente a rischio" secondo l'andamento del sentiment nel tempo, non solo l'ultimo meeting
  // isolato (vedi andamentoSentiment in src/lib/sentimentCliente.ts — Fase 1 roadmap, monitoraggio
  // sentiment) — solo un segnale aggiuntivo mostrato in card, NON entra in ordinaPerPriorita:
  // quella logica di priorità ads/attività è già testata e in produzione, non la tocchiamo per
  // aggiungere questo.
  sentimentCritico: boolean;
};

export type RiepilogoDashboard = {
  clientiAdsCritici: number; // valutazione.stato === "interveni"
  clientiConAttivitaInRitardo: number; // attivitaInRitardo.length > 0
  totaleAttivitaInRitardo: number; // somma di tutte le attività in ritardo, su tutti i clienti
  clientiSentimentNegativo: number; // sentimentCritico === true
};

export function calcolaRiepilogo(items: SaluteClienteItem[]): RiepilogoDashboard {
  let clientiAdsCritici = 0;
  let clientiConAttivitaInRitardo = 0;
  let totaleAttivitaInRitardo = 0;
  let clientiSentimentNegativo = 0;
  for (const item of items) {
    if (item.valutazione.stato === "interveni") clientiAdsCritici++;
    if (item.attivitaInRitardo.length > 0) {
      clientiConAttivitaInRitardo++;
      totaleAttivitaInRitardo += item.attivitaInRitardo.length;
    }
    if (item.sentimentCritico) clientiSentimentNegativo++;
  }
  return { clientiAdsCritici, clientiConAttivitaInRitardo, totaleAttivitaInRitardo, clientiSentimentNegativo };
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

export type GruppoConsulente = { consulente: Consulente; items: SaluteClienteItem[] };
export type RaggruppamentoConsulenti = { gruppi: GruppoConsulente[]; nonAssegnati: SaluteClienteItem[] };

/**
 * Raggruppa gli item per consulente assegnato — la vista "roster" della pagina Clienti unificata
 * (toggle "Per priorità"/"Per consulente" in DashboardClienti.tsx, solo admin: il consulente vede
 * sempre e solo i propri, raggruppare per consulente non aggiungerebbe nulla). Sostituisce
 * GruppiPerConsulente, che viveva come logica di pagina in dashboard/clienti/page.tsx (pagina
 * eliminata, unificata in dashboard/page.tsx) — stessa idea ma su SaluteClienteItem invece che su
 * Cliente grezzo, per riusare le stesse card con salute/attività/sentiment già calcolate.
 *
 * Un consulente attivo compare sempre, anche con `items: []` (roster completo — "chi è in arrivo",
 * non solo chi ha già qualcosa assegnato). Ordinati per carico decrescente, a parità di conteggio
 * per nome. `nonAssegnati` è un secchio a parte (non un altro GruppoConsulente): item il cui
 * consulenteId non corrisponde a nessun consulente attivo (dato orfano: consulente disattivato/
 * rimosso senza riassegnare i suoi clienti) — non vanno persi dalla vista.
 */
export function raggruppaPerConsulente(items: SaluteClienteItem[], consulenti: Consulente[]): RaggruppamentoConsulenti {
  const idAttivi = new Set(consulenti.filter((c) => c.attivo).map((c) => c.consulenteId));
  const perConsulente = new Map<string, SaluteClienteItem[]>();
  for (const item of items) {
    const lista = perConsulente.get(item.cliente.consulenteId) ?? [];
    lista.push(item);
    perConsulente.set(item.cliente.consulenteId, lista);
  }

  const gruppi = consulenti
    .filter((c) => c.attivo)
    .map((consulente) => ({ consulente, items: perConsulente.get(consulente.consulenteId) ?? [] }))
    .sort((a, b) => b.items.length - a.items.length || a.consulente.nome.localeCompare(b.consulente.nome));

  const nonAssegnati = items.filter((i) => !idAttivi.has(i.cliente.consulenteId));

  return { gruppi, nonAssegnati };
}
