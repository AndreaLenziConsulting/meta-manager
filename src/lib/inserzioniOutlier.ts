// Esportata: riusata da avvisiOperativi.ts per il testo dell'avviso — mai un secondo "2.5"
// duplicato altrove (stessa convenzione di SOGLIA_FREQUENZA in valutazioneCampagna.ts, un numero
// diverso per un asse di giudizio diverso: lì è la Frequenza, qui il moltiplicatore sul target CPL).
export const SOGLIA_OUTLIER_CPL = 2.5;

export type InserzioneConStato = {
  adId: string;
  adName: string;
  campaignId: string;
  nomeCampagna: string;
  spesa: number;
  lead: number;
  stato: string;
};

export type InserzioneOutlier = {
  adId: string;
  adName: string;
  campaignId: string;
  nomeCampagna: string;
  spesa: number;
  lead: number;
  costoPerLead: number;
  rapportoTarget: number;
};

/**
 * Inserzioni (ad) ATTIVE il cui costo per lead supera SOGLIA_OUTLIER_CPL volte il target di
 * sede — il controllo qualità richiesto esplicitamente dall'utente: il CPL medio di una campagna
 * può essere nella norma pur nascondendo una singola inserzione outlier che sta bruciando budget
 * (una media non mostra mai i suoi estremi). Tre filtri, in ordine:
 * - solo ACTIVE: un'inserzione già in pausa non è "da spegnere subito", è già spenta.
 * - solo con spesa > 0: nessuna base di giudizio senza spesa (0€/0 lead non è un CPL, è un vuoto).
 * - 0 lead con spesa > 0 -> costoPerLead Infinity, SEMPRE oltre soglia — il caso più netto di
 *   "spegni subito": budget bruciato senza nessun risultato, a prescindere dal moltiplicatore.
 * Ordinate dal rapporto peggiore (le prime da guardare), non per nome o spesa.
 */
export function trovaInserzioniOutlier(inserzioni: InserzioneConStato[], targetCpl: number | null): InserzioneOutlier[] {
  if (targetCpl === null || targetCpl <= 0) return [];

  return inserzioni
    .filter((i) => i.stato === "ACTIVE" && i.spesa > 0)
    .map((i) => {
      const costoPerLead = i.lead > 0 ? i.spesa / i.lead : Infinity;
      return {
        adId: i.adId,
        adName: i.adName,
        campaignId: i.campaignId,
        nomeCampagna: i.nomeCampagna,
        spesa: i.spesa,
        lead: i.lead,
        costoPerLead,
        rapportoTarget: costoPerLead / targetCpl,
      };
    })
    .filter((i) => i.rapportoTarget > SOGLIA_OUTLIER_CPL)
    .sort((a, b) => b.rapportoTarget - a.rapportoTarget);
}
