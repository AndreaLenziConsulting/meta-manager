import type { KpiGroup, Salute } from "@/types/kpi";

// Sotto questa spesa (multiplo del target) non c'è abbastanza segnale per giudicare —
// vedi regola "spesa minima prima di giudicare".
const MOLTIPLICATORE_SPESA_MINIMA = 2.5;

export type ValutazioneSalute = {
  stato: Salute;
  metricaUsata: "vendita" | "lead" | null;
  valoreAttuale: number | null;
  targetUsato: number | null;
};

function classifica(valore: number, target: number): Salute {
  const rapporto = valore / target;
  if (rapporto <= 0.8) return "scala";
  if (rapporto <= 1.2) return "mantieni";
  return "interveni";
}

/**
 * Valuta la salute di un cliente sul totale KPI di un periodo, seguendo la regola:
 * prima la metrica di business (CPA su vendita), poi il proxy (CPA su lead) se non
 * ci sono ancora vendite nel periodo. Nessun giudizio sotto la spesa minima.
 */
export function calcolaSalute(
  totale: Pick<KpiGroup, "investimento" | "numeroVendite" | "cpa" | "costoPerLead">,
  targetCpa: number | null,
  targetCpl: number | null
): ValutazioneSalute {
  if (totale.numeroVendite > 0 && targetCpa) {
    if (totale.investimento < targetCpa * MOLTIPLICATORE_SPESA_MINIMA) {
      return { stato: "dati-insufficienti", metricaUsata: "vendita", valoreAttuale: totale.cpa, targetUsato: targetCpa };
    }
    return {
      stato: totale.cpa === null ? "dati-insufficienti" : classifica(totale.cpa, targetCpa),
      metricaUsata: "vendita",
      valoreAttuale: totale.cpa,
      targetUsato: targetCpa,
    };
  }

  if (targetCpl) {
    if (totale.investimento < targetCpl * MOLTIPLICATORE_SPESA_MINIMA) {
      return {
        stato: "dati-insufficienti",
        metricaUsata: "lead",
        valoreAttuale: totale.costoPerLead,
        targetUsato: targetCpl,
      };
    }
    return {
      stato: totale.costoPerLead === null ? "dati-insufficienti" : classifica(totale.costoPerLead, targetCpl),
      metricaUsata: "lead",
      valoreAttuale: totale.costoPerLead,
      targetUsato: targetCpl,
    };
  }

  return { stato: "no-target", metricaUsata: null, valoreAttuale: null, targetUsato: null };
}
