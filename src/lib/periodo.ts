import { formatDataBreve, giornoMeseBreve } from "@/lib/format";
import { settimanaDiData, ultimoGiornoDelMese } from "@/lib/kpi";
import { aggiungiGiorni, giorniTra, oggiIso } from "@/lib/roadmap";

/**
 * Aritmetica del selettore periodo in stile Meta Ads Manager (richiesta utente, 26/09/2026): un
 * intervallo è sempre una coppia di GIORNI `YYYY-MM-DD` inclusi, mai un mese o una settimana come
 * unità (vedi normalizzaIntervallo in kpi.ts per la compatibilità coi chiamanti a mese). Tutto puro
 * e testabile: `oggi` è iniettabile nei test, stesso schema di kpiSettimanale.ts/ghl.ts.
 */
export type Intervallo = { da: string; a: string };

/** Stesso numero di giorni di [da, a], immediatamente prima di `da` — il confronto automatico
 * sotto alle tessere di sintesi (SintesiTessere.tsx), quando l'utente non ne sceglie uno a mano. */
export function periodoPrecedente(da: string, a: string): Intervallo {
  const giorni = giorniTra(da, a) + 1;
  return { da: aggiungiGiorni(da, -giorni), a: aggiungiGiorni(da, -1) };
}

/** "Quanti mesi" copre [da, a] — un intervallo di giorni qualsiasi non ha un numero intero di mesi:
 * si usa la durata media di un mese (365,25/12 giorni). Passato a confrontaTargetCommerciali
 * (targetCommerciali.ts) come divisore per riportare investimento/fatturato del periodo a un
 * ritmo "per mese" confrontabile col target mensile — un mese di calendario intero vale ~0,99-1,02,
 * scarto trascurabile rispetto all'1 esatto di prima. */
export function mesiEquivalenti(da: string, a: string): number {
  return ((giorniTra(da, a) + 1) * 12) / 365.25;
}

export const PRESET_PERIODO = [
  { id: "oggi", label: "Oggi" },
  { id: "ieri", label: "Ieri" },
  { id: "ultimi-7-giorni", label: "Ultimi 7 giorni" },
  { id: "ultimi-14-giorni", label: "Ultimi 14 giorni" },
  { id: "ultimi-28-giorni", label: "Ultimi 28 giorni" },
  { id: "ultimi-30-giorni", label: "Ultimi 30 giorni" },
  { id: "questa-settimana", label: "Questa settimana" },
  { id: "settimana-scorsa", label: "Settimana scorsa" },
  { id: "questo-mese", label: "Questo mese" },
  { id: "mese-scorso", label: "Mese scorso" },
  { id: "ultimi-3-mesi", label: "Ultimi 3 mesi" },
  { id: "ultimi-6-mesi", label: "Ultimi 6 mesi" },
  { id: "anno-corrente", label: "Anno corrente" },
  { id: "anno-precedente", label: "Anno precedente" },
] as const;

export type PresetPeriodoId = (typeof PRESET_PERIODO)[number]["id"];

export function isPresetPeriodoId(v: string): v is PresetPeriodoId {
  return PRESET_PERIODO.some((p) => p.id === v);
}

export function etichettaPreset(id: PresetPeriodoId): string {
  return PRESET_PERIODO.find((p) => p.id === id)?.label ?? id;
}

/** `mese` (YYYY-MM) + `delta` mesi, anche a cavallo d'anno — esportata per DateRangePicker.tsx
 * (navigazione dei due calendari), stessa aritmetica UTC di aggiungiGiorni. */
export function spostaMese(mese: string, delta: number): string {
  const [y, m] = mese.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/**
 * Intervallo di un preset rispetto a `oggi`. I preset "Ultimi N giorni" includono oggi (N giorni
 * in tutto — "Ultimi 30 giorni" il 25/09 = 27/08 → 25/09, come Meta); "Questa settimana"/"Questo
 * mese"/"Anno corrente" arrivano a oggi, non alla fine del periodo (i giorni futuri non hanno dati);
 * "Ultimi 3/6 mesi" partono dal 1° del mese N-2/N-5, stessa semantica dei preset precedenti.
 */
export function intervalloPreset(id: PresetPeriodoId, oggi: string = oggiIso()): Intervallo {
  const mese = oggi.slice(0, 7);
  switch (id) {
    case "oggi":
      return { da: oggi, a: oggi };
    case "ieri": {
      const ieri = aggiungiGiorni(oggi, -1);
      return { da: ieri, a: ieri };
    }
    case "ultimi-7-giorni":
      return { da: aggiungiGiorni(oggi, -6), a: oggi };
    case "ultimi-14-giorni":
      return { da: aggiungiGiorni(oggi, -13), a: oggi };
    case "ultimi-28-giorni":
      return { da: aggiungiGiorni(oggi, -27), a: oggi };
    case "ultimi-30-giorni":
      return { da: aggiungiGiorni(oggi, -29), a: oggi };
    case "questa-settimana":
      return { da: settimanaDiData(oggi), a: oggi };
    case "settimana-scorsa": {
      const lunedi = aggiungiGiorni(settimanaDiData(oggi), -7);
      return { da: lunedi, a: aggiungiGiorni(lunedi, 6) };
    }
    case "questo-mese":
      return { da: `${mese}-01`, a: oggi };
    case "mese-scorso": {
      const scorso = spostaMese(mese, -1);
      return { da: `${scorso}-01`, a: ultimoGiornoDelMese(scorso) };
    }
    case "ultimi-3-mesi":
      return { da: `${spostaMese(mese, -2)}-01`, a: oggi };
    case "ultimi-6-mesi":
      return { da: `${spostaMese(mese, -5)}-01`, a: oggi };
    case "anno-corrente":
      return { da: `${oggi.slice(0, 4)}-01-01`, a: oggi };
    case "anno-precedente": {
      const anno = Number(oggi.slice(0, 4)) - 1;
      return { da: `${anno}-01-01`, a: `${anno}-12-31` };
    }
  }
}

/** "27 ago 2026 – 25 set 2026" (un solo giorno: "25 set 2026") — etichetta del bottone del picker. */
export function etichettaIntervallo(da: string, a: string): string {
  return da === a ? formatDataBreve(da) : `${formatDataBreve(da)} – ${formatDataBreve(a)}`;
}

/** Come sopra ma con l'anno scritto una volta sola quando i due giorni sono dello stesso anno:
 * "27 ago – 25 set 2026". Per gli spazi stretti (la striscia dei filtri su telefono). */
export function etichettaIntervalloBreve(da: string, a: string): string {
  if (da === a || da.slice(0, 4) !== a.slice(0, 4)) return etichettaIntervallo(da, a);
  return `${giornoMeseBreve(da)} – ${formatDataBreve(a)}`;
}
