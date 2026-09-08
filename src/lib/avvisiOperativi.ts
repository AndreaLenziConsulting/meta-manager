import type { ValutazioneSalute } from "@/lib/salute";
import type { MeseSenzaFunnel } from "@/lib/kpiQualita";
import type { InserzioneOutlier } from "@/lib/inserzioniOutlier";
import { SOGLIA_OUTLIER_CPL } from "@/lib/inserzioniOutlier";
import type { ConfrontoTarget, ConfrontoTargetCommerciali } from "@/lib/targetCommerciali";
import type { GhlRiepilogoResponse } from "@/types/ghl";
import { formatEuro, formatMese, formatNumero } from "@/lib/format";

export type TonoAvviso = "attenzione" | "da-sistemare" | "da-sapere";
export type AvvisoOperativo = { id: string; tono: TonoAvviso; titolo: string; messaggio: string };

// "il peggio vince" applicato all'ORDINE di lettura, non solo a un giudizio aggregato — stesso
// idioma di ORDINE_SEVERITA in salute.ts/valutazioneCampagna.ts: chi ha più bisogno di attenzione
// va letto per primo.
const ORDINE_TONO: Record<TonoAvviso, number> = { attenzione: 0, "da-sistemare": 1, "da-sapere": 2 };

// Tolleranza sui target commerciali (budget/lead/appuntamenti/fatturato, Fase 1 roadmap) — stesso
// multiplo 0,8×/1,2× già usato per le soglie "scala"/"interveni" di salute.ts (coerenza di soglia
// in tutta l'app, non un nuovo numero inventato qui). Lead/appuntamenti/fatturato segnalano solo se
// SOTTO l'80% del concordato (superare il target non è mai un problema per questi tre). Il budget è
// l'unico simmetrico: spendere molto più del concordato (oltre il 120%) è a sua volta un segnale da
// guardare, non solo spendere meno.
const SOGLIA_TARGET_BASSA = 0.8;
const SOGLIA_TARGET_ALTA = 1.2;

function sottoTarget(confronto: ConfrontoTarget): boolean {
  return confronto.atteso > 0 && confronto.effettivo < confronto.atteso * SOGLIA_TARGET_BASSA;
}

function fuoriBandaBudget(confronto: ConfrontoTarget): boolean {
  return (
    confronto.atteso > 0 &&
    (confronto.effettivo < confronto.atteso * SOGLIA_TARGET_BASSA || confronto.effettivo > confronto.atteso * SOGLIA_TARGET_ALTA)
  );
}

/**
 * Blocco 4 del redesign KPI — genera gli avvisi operativi automatici per il pannello visibile solo
 * a consulente/admin (gated su Boolean(clienteId) dal chiamante, mai sul link pubblico `code`).
 * Pura funzione di derivazione: nessun fetch, nessuno stato — tutti gli input sono già calcolati
 * dal chiamante (KpiSection.tsx) per il periodo/campagne correnti, quindi il pannello si ricalcola
 * da solo (useMemo) ogni volta che quei filtri cambiano, senza bisogno di logica dedicata qui.
 *
 * Deliberatamente NON riceve `adAccountCollegato`: quel caso ha già un proprio banner dedicato e
 * azionabile (form inline "+ Aggiungi ad account" in KpiSection.tsx, solo admin) — duplicarlo qui
 * come una riga di solo testo avrebbe tolto l'azione diretta senza aggiungere nulla.
 */
export function generaAvvisiOperativi(input: {
  valutazioneSalute: ValutazioneSalute;
  attivitaInRitardoCount: number;
  meseSenzaFunnel: MeseSenzaFunnel[];
  ghl: GhlRiepilogoResponse | null;
  campagneFrequenzaAlta: { nomeCampagna: string; frequenza: number }[];
  inserzioniOutlier: InserzioneOutlier[];
  confrontoTarget: ConfrontoTargetCommerciali;
}): AvvisoOperativo[] {
  const avvisi: AvvisoOperativo[] = [];
  const { valutazioneSalute: v } = input;

  if (v.stato === "interveni" && v.valoreAttuale !== null && v.targetUsato !== null && v.targetUsato > 0) {
    const percentualeSopra = Math.round((v.valoreAttuale / v.targetUsato - 1) * 100);
    const metrica = v.metricaUsata === "vendita" ? "CPA su vendita" : "Costo per lead";
    avvisi.push({
      id: "salute",
      tono: "attenzione",
      titolo: "Costo sopra target",
      messaggio: `${metrica} a ${formatEuro(v.valoreAttuale)}, il ${percentualeSopra}% sopra il target di ${formatEuro(v.targetUsato)}.`,
    });
  }

  if (input.attivitaInRitardoCount > 0) {
    avvisi.push({
      id: "attivita-ritardo",
      tono: "attenzione",
      titolo: "Attività in ritardo",
      messaggio:
        input.attivitaInRitardoCount === 1
          ? "1 attività aperta è in ritardo."
          : `${input.attivitaInRitardoCount} attività aperte sono in ritardo.`,
    });
  }

  if (input.campagneFrequenzaAlta.length > 0) {
    // Elenca le prime 3 per nome, riassume il resto — mai una riga lunghissima con decine di nomi.
    const nomi = input.campagneFrequenzaAlta.slice(0, 3).map((c) => `${c.nomeCampagna} (${c.frequenza.toFixed(2)})`);
    const restanti = input.campagneFrequenzaAlta.length - nomi.length;
    const suffisso = restanti > 0 ? ` e altre ${restanti}` : "";
    avvisi.push({
      id: "frequenza-alta",
      tono: "attenzione",
      titolo: "Frequenza alta",
      messaggio: `${nomi.join(", ")}${suffisso} — creatività da rinnovare.`,
    });
  }

  // Controllo qualità richiesto esplicitamente dall'utente: il CPL medio di campagna può essere
  // nella norma pur nascondendo una singola inserzione outlier che sta bruciando budget — vedi
  // trovaInserzioniOutlier in inserzioniOutlier.ts (già filtrate: solo ACTIVE, solo con spesa).
  if (input.inserzioniOutlier.length > 0) {
    const nomi = input.inserzioniOutlier.slice(0, 3).map((i) => {
      const cpl = Number.isFinite(i.costoPerLead) ? formatEuro(i.costoPerLead) : "nessun lead";
      return `${i.adName} (${cpl})`;
    });
    const restanti = input.inserzioniOutlier.length - nomi.length;
    const suffisso = restanti > 0 ? ` e altre ${restanti}` : "";
    avvisi.push({
      id: "inserzioni-outlier",
      tono: "attenzione",
      titolo: "Inserzioni outlier",
      messaggio: `${nomi.join(", ")}${suffisso} — costo per lead oltre ${SOGLIA_OUTLIER_CPL}× il target, valuta di spegnerle.`,
    });
  }

  // Target commerciali concordati col cliente (Fase 1 roadmap) — vedi confrontaTargetCommerciali
  // in targetCommerciali.ts per come si calcola l'effettivo. Un avviso per dimensione, non uno
  // combinato: sono segnali indipendenti, un consulente deve poterli leggere separatamente.
  const { budgetMensile, leadSettimana, appuntamentiSettimana, fatturatoMensile } = input.confrontoTarget;

  if (budgetMensile && fuoriBandaBudget(budgetMensile)) {
    const sopra = budgetMensile.effettivo > budgetMensile.atteso;
    avvisi.push({
      id: "target-budget",
      tono: "attenzione",
      titolo: "Budget fuori dal concordato",
      messaggio: `Investimento medio mensile a ${formatEuro(budgetMensile.effettivo)}, ${sopra ? "sopra" : "sotto"} il budget concordato di ${formatEuro(budgetMensile.atteso)}.`,
    });
  }

  if (leadSettimana && sottoTarget(leadSettimana)) {
    avvisi.push({
      id: "target-lead-settimana",
      tono: "attenzione",
      titolo: "Lead sotto target",
      messaggio: `${formatNumero(leadSettimana.effettivo)} lead/settimana in media, sotto il target concordato di ${formatNumero(leadSettimana.atteso)}/settimana.`,
    });
  }

  if (appuntamentiSettimana && sottoTarget(appuntamentiSettimana)) {
    avvisi.push({
      id: "target-appuntamenti-settimana",
      tono: "attenzione",
      titolo: "Appuntamenti sotto target",
      messaggio: `${formatNumero(appuntamentiSettimana.effettivo)} appuntamenti/settimana in media, sotto il target concordato di ${formatNumero(appuntamentiSettimana.atteso)}/settimana.`,
    });
  }

  if (fatturatoMensile && sottoTarget(fatturatoMensile)) {
    avvisi.push({
      id: "target-fatturato-mensile",
      tono: "attenzione",
      titolo: "Fatturato sotto target",
      messaggio: `${formatEuro(fatturatoMensile.effettivo)}/mese in media, sotto il target concordato di ${formatEuro(fatturatoMensile.atteso)}/mese.`,
    });
  }

  // Una sede connessa a GHL con calendari configurati compila appuntamenti/effettuati/vendite/
  // fatturato in automatico dall'overlay (vedi applicaOverlayGhl in kpiGhlOverlay.ts) — un Funnel
  // vuoto in quel caso è atteso, non un gap da segnalare: il team lavora con GHL, non a mano sul
  // foglio Funnel. Senza questo controllo l'avviso era un falso positivo per ogni cliente GHL
  // pienamente configurato (bug segnalato dal vivo su un cliente reale).
  const ghlCompilaAutomaticamente = Boolean(input.ghl && input.ghl.connesso && input.ghl.calendariConfigurati);
  if (input.meseSenzaFunnel.length > 0 && !ghlCompilaAutomaticamente) {
    const mesi = input.meseSenzaFunnel.map((m) => formatMese(m.mese)).join(", ");
    avvisi.push({
      id: "funnel-mancante",
      tono: "da-sistemare",
      titolo: "Funnel non compilato",
      messaggio: `Spesa pubblicitaria registrata ma nessun dato Funnel per ${mesi}.`,
    });
  }

  if (input.ghl && input.ghl.connesso && !input.ghl.calendariConfigurati) {
    avvisi.push({
      id: "ghl-calendari-non-configurati",
      tono: "da-sistemare",
      titolo: "Calendari GHL da collegare",
      messaggio: "La sede è connessa a GHL ma nessun calendario è stato scelto: appuntamenti ed effettuati restano dal Funnel finché non li colleghi.",
    });
  }

  if (input.ghl && input.ghl.connesso && input.ghl.calendariFalliti > 0) {
    avvisi.push({
      id: "ghl-calendari-falliti",
      tono: "da-sapere",
      titolo: "Calendari GHL non raggiungibili",
      messaggio:
        input.ghl.calendariFalliti === 1
          ? "1 calendario non era raggiungibile all'ultimo caricamento: il conteggio appuntamenti potrebbe essere incompleto."
          : `${input.ghl.calendariFalliti} calendari non erano raggiungibili all'ultimo caricamento: il conteggio appuntamenti potrebbe essere incompleto.`,
    });
  }

  return avvisi.sort((a, b) => ORDINE_TONO[a.tono] - ORDINE_TONO[b.tono]);
}
