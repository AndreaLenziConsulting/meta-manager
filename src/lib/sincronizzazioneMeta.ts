import type { Campagna, MetaDailyRow, Sede } from "@/types/kpi";
import { aggiungiGiorni, giorniTra } from "@/lib/roadmap";

// Avviso "Dati Meta non aggiornati" in cima alla pagina Clienti (richiesta utente 01/10/2026).
// Nasce da un incidente reale: il token Meta è scaduto il 24/09/2026 e la sincronizzazione è rimasta
// ferma una settimana per tutti i clienti senza che nulla lo segnalasse — i dati fermi sembrano
// semplicemente "nessuna spesa".
//
// Due passi, il primo puro e il secondo con una verifica dal vivo su Meta:
// 1. sediConDatiMetaFermi: le sedi che hanno campagne ATTIVE ma nessun dato da più di
//    GIORNI_TOLLERANZA_DATI_META giorni. Da solo non basta: una campagna attiva può semplicemente
//    non erogare (gruppi di inserzioni in pausa, budget esaurito) e non è un problema di
//    sincronizzazione.
// 2. diagnosticaDatiFermi: per ognuna di quelle sedi chiede a Meta la spesa delle campagne attive
//    dopo l'ultimo giorno presente in app. Meta rifiuta la chiamata -> problema di accesso (token
//    scaduto, account non più assegnato). Meta risponde con spesa > 0 -> la spesa c'è ma non è
//    arrivata in app, la sincronizzazione automatica non è andata a buon fine. Spesa zero -> le
//    campagne non stanno erogando: nessun avviso, mai un falso allarme. Meta non risponde in tempo
//    -> lo si dice per quello che è ("verifica senza risposta"), mai spacciato per un accesso negato.

/** Giorni di tolleranza prima di considerare fermi i dati di una sede: la sincronizzazione gira una
 * volta al giorno e scrive anche il giorno in corso, quindi con tutto in ordine l'ultimo giorno
 * presente è oggi o ieri. Oltre 2 giorni significa almeno due sincronizzazioni saltate. */
export const GIORNI_TOLLERANZA_DATI_META = 2;

/** Finestra massima della verifica dal vivo: mai più indietro di così, anche se l'ultimo dato in
 * app è molto più vecchio (o non c'è). Una sede con campagne attive che non erogano da mesi resta
 * candidata a ogni caricamento della pagina: la sua verifica deve restare una chiamata leggera. */
const GIORNI_MASSIMI_VERIFICA = 30;

export type SedeDatiFermi = {
  clienteId: string;
  sedeId: string;
  adAccountId: string;
  /** campaignId delle campagne Meta con stato ACTIVE (all'ultima sincronizzazione riuscita). */
  campagneAttive: string[];
  /** Ultimo giorno (YYYY-MM-DD) con un dato per una di quelle campagne — null se nessuno. */
  ultimoGiorno: string | null;
  giorniSenzaDati: number | null;
};

/**
 * Sedi attive, con un ad account collegato e almeno una campagna Meta ACTIVE, i cui dati più
 * recenti (fra le campagne attive) sono più vecchi di GIORNI_TOLLERANZA_DATI_META giorni rispetto a
 * `oggi`. Una sede con tutte le campagne in pausa non è mai candidata: non avere dati lì è normale.
 * Solo canale Meta (Google Ads ha la sua sincronizzazione e il suo accesso).
 */
export function sediConDatiMetaFermi(input: { sedi: Sede[]; campagne: Campagna[]; metaDaily: MetaDailyRow[]; oggi: string }): SedeDatiFermi[] {
  const chiaveSede = (clienteId: string, sedeId: string) => `${clienteId}|${sedeId}`;
  const sediValide = input.sedi.filter((s) => s.attivo && s.adAccountId);
  const sediPerChiave = new Map(sediValide.map((s) => [chiaveSede(s.clienteId, s.sedeId), s]));

  // clienteId|campaignId -> sede, solo campagne Meta attive di una sede valida. La chiave include il
  // clienteId perché lo stesso ad account (quindi le stesse campagne) può essere collegato a due
  // clienti diversi, e le righe MetaDaily portano il clienteId ma non la sede.
  const sedeDellaCampagna = new Map<string, string>();
  const attivePerSede = new Map<string, string[]>();
  for (const c of input.campagne) {
    if ((c.canale ?? "meta") !== "meta" || c.stato !== "ACTIVE") continue;
    const chiave = chiaveSede(c.clienteId, c.sedeId);
    if (!sediPerChiave.has(chiave)) continue;
    sedeDellaCampagna.set(`${c.clienteId}|${c.campaignId}`, chiave);
    attivePerSede.set(chiave, [...(attivePerSede.get(chiave) ?? []), c.campaignId]);
  }

  const ultimoGiornoPerSede = new Map<string, string>();
  for (const riga of input.metaDaily) {
    if ((riga.canale ?? "meta") !== "meta") continue;
    const chiave = sedeDellaCampagna.get(`${riga.clienteId}|${riga.campaignId}`);
    if (!chiave) continue;
    const attuale = ultimoGiornoPerSede.get(chiave);
    if (!attuale || riga.data > attuale) ultimoGiornoPerSede.set(chiave, riga.data);
  }

  const ferme: SedeDatiFermi[] = [];
  for (const [chiave, campagneAttive] of attivePerSede) {
    const sede = sediPerChiave.get(chiave);
    if (!sede) continue;
    const ultimoGiorno = ultimoGiornoPerSede.get(chiave) ?? null;
    const giorniSenzaDati = ultimoGiorno ? giorniTra(ultimoGiorno, input.oggi) : null;
    if (giorniSenzaDati !== null && giorniSenzaDati <= GIORNI_TOLLERANZA_DATI_META) continue;
    ferme.push({ clienteId: sede.clienteId, sedeId: sede.sedeId, adAccountId: sede.adAccountId, campagneAttive, ultimoGiorno, giorniSenzaDati });
  }
  return ferme;
}

export type ProblemaSincronizzazione = SedeDatiFermi &
  (
    | {
        /** Meta ha rifiutato la verifica: token scaduto/non valido, account non più leggibile.
         * `dettaglio` è il messaggio di Meta, mostrato così com'è. */
        causa: "accesso";
        dettaglio: string;
      }
    | {
        /** Meta non ha risposto in tempo alla verifica: i dati sono fermi ma la causa non è nota. */
        causa: "non-verificato";
      }
    | {
        /** Meta risponde e riporta spesa dopo `ultimoGiorno`: i dati esistono ma non sono in app. */
        causa: "sincronizzazione";
        spesaNonSincronizzata: number;
      }
  );

/**
 * Verifica dal vivo delle sedi candidate (vedi il commento in cima al file). `leggiSpesa` è
 * iniettata (fetchSpesaCampagne di lib/meta.ts in produzione) per restare testabile senza rete:
 * torna la spesa, `null` se Meta non ha risposto in tempo, oppure si rifiuta se Meta nega la
 * lettura. Una sede le cui campagne attive non hanno speso nulla dopo l'ultimo giorno in app NON è
 * un problema e non compare nel risultato.
 */
export async function diagnosticaDatiFermi(
  ferme: SedeDatiFermi[],
  oggi: string,
  leggiSpesa: (adAccountId: string, campaignIds: string[], since: string, until: string) => Promise<number | null>
): Promise<ProblemaSincronizzazione[]> {
  const inizioMassimo = aggiungiGiorni(oggi, -GIORNI_MASSIMI_VERIFICA);
  const esiti = await Promise.all(
    ferme.map(async (sede): Promise<ProblemaSincronizzazione | null> => {
      const dopoUltimoDato = sede.ultimoGiorno ? aggiungiGiorni(sede.ultimoGiorno, 1) : inizioMassimo;
      const since = dopoUltimoDato > inizioMassimo ? dopoUltimoDato : inizioMassimo;
      try {
        const spesa = await leggiSpesa(sede.adAccountId, sede.campagneAttive, since, oggi);
        if (spesa === null) return { ...sede, causa: "non-verificato" };
        return spesa > 0 ? { ...sede, causa: "sincronizzazione", spesaNonSincronizzata: spesa } : null;
      } catch (err) {
        return { ...sede, causa: "accesso", dettaglio: err instanceof Error ? err.message : String(err) };
      }
    })
  );
  return esiti.filter((e): e is ProblemaSincronizzazione => e !== null);
}
