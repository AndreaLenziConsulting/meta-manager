import { describe, expect, it } from "vitest";
import { generaAvvisiOperativi } from "./avvisiOperativi";
import type { ValutazioneSalute } from "./salute";
import type { GhlRiepilogoResponse } from "@/types/ghl";
import { formatEuro, formatMese } from "./format";

const SALUTE_OK: ValutazioneSalute = { stato: "mantieni", metricaUsata: "vendita", valoreAttuale: 100, targetUsato: 100 };
const SALUTE_INTERVENI: ValutazioneSalute = { stato: "interveni", metricaUsata: "vendita", valoreAttuale: 150, targetUsato: 100 };

const INPUT_VUOTO = {
  valutazioneSalute: SALUTE_OK,
  attivitaInRitardoCount: 0,
  meseSenzaFunnel: [],
  ghl: null,
  campagneFrequenzaAlta: [],
};

describe("generaAvvisiOperativi", () => {
  it("nessun avviso quando tutto è a posto", () => {
    expect(generaAvvisiOperativi(INPUT_VUOTO)).toEqual([]);
  });

  it("salute 'interveni' genera un avviso attenzione con la percentuale sopra target", () => {
    const avvisi = generaAvvisiOperativi({ ...INPUT_VUOTO, valutazioneSalute: SALUTE_INTERVENI });
    expect(avvisi).toHaveLength(1);
    expect(avvisi[0]).toEqual({
      id: "salute",
      tono: "attenzione",
      titolo: "Costo sopra target",
      messaggio: `CPA su vendita a ${formatEuro(150)}, il 50% sopra il target di ${formatEuro(100)}.`,
    });
  });

  it("salute 'scala'/'mantieni'/'dati-insufficienti'/'no-target' non generano l'avviso salute", () => {
    for (const stato of ["scala", "mantieni", "dati-insufficienti", "no-target"] as const) {
      const avvisi = generaAvvisiOperativi({ ...INPUT_VUOTO, valutazioneSalute: { ...SALUTE_INTERVENI, stato } });
      expect(avvisi.find((a) => a.id === "salute")).toBeUndefined();
    }
  });

  it("attività in ritardo, singolare vs plurale", () => {
    const uno = generaAvvisiOperativi({ ...INPUT_VUOTO, attivitaInRitardoCount: 1 });
    expect(uno[0].messaggio).toBe("1 attività aperta è in ritardo.");
    const tre = generaAvvisiOperativi({ ...INPUT_VUOTO, attivitaInRitardoCount: 3 });
    expect(tre[0].messaggio).toBe("3 attività aperte sono in ritardo.");
  });

  it("frequenza alta elenca le campagne fino a 3, poi riassume il resto", () => {
    const poche = generaAvvisiOperativi({
      ...INPUT_VUOTO,
      campagneFrequenzaAlta: [{ nomeCampagna: "A", frequenza: 2.8 }],
    });
    expect(poche[0]).toEqual({
      id: "frequenza-alta",
      tono: "attenzione",
      titolo: "Frequenza alta",
      messaggio: "A (2.80) — creatività da rinnovare.",
    });

    const molte = generaAvvisiOperativi({
      ...INPUT_VUOTO,
      campagneFrequenzaAlta: [
        { nomeCampagna: "A", frequenza: 2.8 },
        { nomeCampagna: "B", frequenza: 3.1 },
        { nomeCampagna: "C", frequenza: 2.6 },
        { nomeCampagna: "D", frequenza: 4.0 },
        { nomeCampagna: "E", frequenza: 2.7 },
      ],
    });
    expect(molte[0].messaggio).toBe("A (2.80), B (3.10), C (2.60) e altre 2 — creatività da rinnovare.");
  });

  it("mese senza Funnel elenca i mesi coinvolti", () => {
    const avvisi = generaAvvisiOperativi({
      ...INPUT_VUOTO,
      meseSenzaFunnel: [
        { mese: "2026-06", investimento: 100 },
        { mese: "2026-07", investimento: 50 },
      ],
    });
    expect(avvisi[0]).toEqual({
      id: "funnel-mancante",
      tono: "da-sistemare",
      titolo: "Funnel non compilato",
      messaggio: `Spesa pubblicitaria registrata ma nessun dato Funnel per ${formatMese("2026-06")}, ${formatMese("2026-07")}.`,
    });
  });

  it("GHL connesso senza calendari configurati -> da-sistemare", () => {
    const ghl: GhlRiepilogoResponse = {
      connesso: true,
      calendariConfigurati: false,
      appuntamenti: { totali: 0, confermati: 0, annullati: 0, effettuati: 0 },
      opportunita: { vendite: 0, fatturato: 0 },
      fatturatoPerSettimana: [],
      appuntamentiPerSettimana: [],
      calendariFalliti: 0,
    };
    const avvisi = generaAvvisiOperativi({ ...INPUT_VUOTO, ghl });
    expect(avvisi[0]).toEqual({
      id: "ghl-calendari-non-configurati",
      tono: "da-sistemare",
      titolo: "Calendari GHL da collegare",
      messaggio: "La sede è connessa a GHL ma nessun calendario è stato scelto: appuntamenti ed effettuati restano dal Funnel finché non li colleghi.",
    });
  });

  it("GHL con calendari configurati non genera l'avviso 'da collegare'", () => {
    const ghl: GhlRiepilogoResponse = {
      connesso: true,
      calendariConfigurati: true,
      appuntamenti: { totali: 0, confermati: 0, annullati: 0, effettuati: 0 },
      opportunita: { vendite: 0, fatturato: 0 },
      fatturatoPerSettimana: [],
      appuntamentiPerSettimana: [],
      calendariFalliti: 0,
    };
    const avvisi = generaAvvisiOperativi({ ...INPUT_VUOTO, ghl });
    expect(avvisi).toEqual([]);
  });

  it("GHL non connesso non genera nessun avviso GHL", () => {
    const avvisi = generaAvvisiOperativi({ ...INPUT_VUOTO, ghl: { connesso: false } });
    expect(avvisi).toEqual([]);
  });

  it("calendari GHL falliti, singolare vs plurale, tono da-sapere", () => {
    const base: GhlRiepilogoResponse = {
      connesso: true,
      calendariConfigurati: true,
      appuntamenti: { totali: 0, confermati: 0, annullati: 0, effettuati: 0 },
      opportunita: { vendite: 0, fatturato: 0 },
      fatturatoPerSettimana: [],
      appuntamentiPerSettimana: [],
      calendariFalliti: 1,
    };
    const uno = generaAvvisiOperativi({ ...INPUT_VUOTO, ghl: base });
    expect(uno[0]).toEqual({
      id: "ghl-calendari-falliti",
      tono: "da-sapere",
      titolo: "Calendari GHL non raggiungibili",
      messaggio: "1 calendario non era raggiungibile all'ultimo caricamento: il conteggio appuntamenti potrebbe essere incompleto.",
    });
    const due = generaAvvisiOperativi({ ...INPUT_VUOTO, ghl: { ...base, calendariFalliti: 2 } });
    expect(due[0].messaggio).toBe("2 calendari non erano raggiungibili all'ultimo caricamento: il conteggio appuntamenti potrebbe essere incompleto.");
  });

  it("ordina gli avvisi per severità: attenzione, poi da-sistemare, poi da-sapere", () => {
    const ghl: GhlRiepilogoResponse = {
      connesso: true,
      calendariConfigurati: true,
      appuntamenti: { totali: 0, confermati: 0, annullati: 0, effettuati: 0 },
      opportunita: { vendite: 0, fatturato: 0 },
      fatturatoPerSettimana: [],
      appuntamentiPerSettimana: [],
      calendariFalliti: 1, // da-sapere
    };
    const avvisi = generaAvvisiOperativi({
      valutazioneSalute: SALUTE_OK,
      attivitaInRitardoCount: 0,
      meseSenzaFunnel: [{ mese: "2026-06", investimento: 100 }], // da-sistemare
      ghl,
      campagneFrequenzaAlta: [{ nomeCampagna: "A", frequenza: 3 }], // attenzione
    });
    expect(avvisi.map((a) => a.tono)).toEqual(["attenzione", "da-sistemare", "da-sapere"]);
  });
});
