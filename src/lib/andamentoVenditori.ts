import { formatMese, formatSettimana } from "@/lib/format";
import { ultimoGiornoDelMese } from "@/lib/kpi";
import { spostaMese } from "@/lib/periodo";
import type { GhlBreakdownCampagna, GhlSettimanaVenditore } from "@/types/ghl";
import type { RisultatoVenditoreRow, Venditore } from "@/types/kpi";

/**
 * Ciò che il riquadro "Venditori" del tab KPI mostra per il periodo scelto in alto: i totali di ogni
 * venditore e il suo andamento nel tempo. Funzioni pure: mettono insieme le due fonti possibili.
 *
 *   - GHL, per un venditore a cui è stato indicato il suo utente GHL in una sede collegata: numeri
 *     esatti al giorno, e un andamento settimana per settimana;
 *   - i risultati inseriti a mano, che sono mensili: contano solo i mesi che stanno per intero nel
 *     periodo (la stessa regola dei risultati commerciali, mai una quota inventata di un mese
 *     coperto a metà).
 *
 * Mai un falso zero: un venditore per cui nessuno ha inserito risultati è "non compilato", non zero;
 * uno che GHL non ha restituito è "non disponibile". Lo zero è solo quello che una fonte ha detto.
 */

/** Cosa si sa di GHL per i venditori di questa sede, in questo momento. */
export type GhlPerVenditori =
  | { stato: "assente" } // la sede non legge da GHL: valgono i risultati inseriti a mano
  | { stato: "caricamento" }
  | { stato: "errore" }
  | {
      stato: "ok";
      /** Senza calendari collegati GHL non sa nulla degli appuntamenti: non è zero, è ignoto. */
      calendariCollegati: boolean;
      perVenditore: Record<string, GhlBreakdownCampagna>;
      perSettimana: Record<string, GhlSettimanaVenditore[]>;
    };

export type RisultatoMensileVenditore = Omit<RisultatoVenditoreRow, "sedeId">;

export type MisuraVenditori = "appuntamenti" | "vendite" | "fatturato";

export type RigaVenditore = {
  venditoreId: string;
  nome: string;
  fonte: "ghl" | "manuale";
  disponibilita: "ok" | "caricamento" | "non-disponibile" | "non-compilato";
  appuntamentiFissati: number | null;
  /** Solo da GHL: i risultati inseriti a mano non li distinguono. */
  appuntamentiEffettuati: number | null;
  vendite: number | null;
  fatturato: number | null;
  /** Vendite ogni appuntamento preso, da 0 a 1; null se non ci sono appuntamenti su cui calcolarla. */
  chiusura: number | null;
};

export type PuntoVenditori = {
  chiave: string;
  etichetta: string;
  /** Per venditore: i valori del punto, o null se per quel punto non c'è un dato (un buco, non uno zero). */
  valori: Record<string, Record<MisuraVenditori, number | null> | null>;
};

export type AndamentoVenditori = {
  righe: RigaVenditore[];
  /** A settimane se almeno un venditore arriva da GHL, altrimenti a mesi (i risultati a mano sono mensili). */
  grana: "settimana" | "mese";
  punti: PuntoVenditori[];
  /** I venditori che il grafico disegna, nell'ordine in cui sono configurati. */
  nelGrafico: string[];
  /** Venditori con soli risultati mensili, quando il grafico è a settimane: stanno solo nella tabella. */
  fuoriDalGrafico: string[];
  statoGrafico: "ok" | "caricamento" | "non-disponibile";
};

/** I mesi (AAAA-MM) che stanno per intero fra `da` e `a` (giorni inclusi). */
export function mesiInteriNelPeriodo(da: string, a: string): string[] {
  const mesi: string[] = [];
  for (let mese = da.slice(0, 7); mese <= a.slice(0, 7); mese = spostaMese(mese, 1)) {
    if (`${mese}-01` >= da && ultimoGiornoDelMese(mese) <= a) mesi.push(mese);
  }
  return mesi;
}

/** I risultati mensili inseriti a mano per i venditori di una sede, solo per i mesi interi nel periodo. */
export function risultatiVenditoriInteriNelPeriodo(risultati: RisultatoVenditoreRow[], sedeId: string, da: string, a: string): RisultatoMensileVenditore[] {
  const mesi = new Set(mesiInteriNelPeriodo(da, a));
  return risultati
    .filter((r) => r.sedeId === sedeId && mesi.has(r.mese))
    .map((r) => ({ mese: r.mese, venditoreId: r.venditoreId, appuntamentiFissati: r.appuntamentiFissati, vendite: r.vendite, fatturato: r.fatturato }));
}

/** Vero se i numeri di questo venditore arrivano da GHL: ha il suo utente GHL e la sede è collegata. */
export function venditoreDaGhl(venditore: Venditore, ghl: GhlPerVenditori): boolean {
  return ghl.stato !== "assente" && venditore.ghlUserId.trim() !== "";
}

const NESSUN_VALORE = { appuntamentiFissati: null, appuntamentiEffettuati: null, vendite: null, fatturato: null, chiusura: null };

function chiusura(vendite: number | null, appuntamenti: number | null): number | null {
  return vendite !== null && appuntamenti !== null && appuntamenti > 0 ? vendite / appuntamenti : null;
}

function rigaDi(venditore: Venditore, ghl: GhlPerVenditori, mensili: RisultatoMensileVenditore[]): RigaVenditore {
  const base = { venditoreId: venditore.venditoreId, nome: venditore.nome };
  if (venditoreDaGhl(venditore, ghl)) {
    const daGhl = ghl.stato === "ok" ? ghl.perVenditore[venditore.venditoreId] : undefined;
    if (ghl.stato === "caricamento") return { ...base, fonte: "ghl", disponibilita: "caricamento", ...NESSUN_VALORE };
    if (ghl.stato !== "ok" || !daGhl) return { ...base, fonte: "ghl", disponibilita: "non-disponibile", ...NESSUN_VALORE };
    const fissati = ghl.calendariCollegati ? daGhl.appuntamenti.totali : null;
    return {
      ...base,
      fonte: "ghl",
      disponibilita: "ok",
      appuntamentiFissati: fissati,
      appuntamentiEffettuati: ghl.calendariCollegati ? daGhl.appuntamenti.effettuati : null,
      vendite: daGhl.opportunita.vendite,
      fatturato: daGhl.opportunita.fatturato,
      chiusura: chiusura(daGhl.opportunita.vendite, fissati),
    };
  }
  const suoi = mensili.filter((m) => m.venditoreId === venditore.venditoreId);
  if (suoi.length === 0) return { ...base, fonte: "manuale", disponibilita: "non-compilato", ...NESSUN_VALORE };
  const somma = (campo: "appuntamentiFissati" | "vendite" | "fatturato") => suoi.reduce((s, m) => s + m[campo], 0);
  return {
    ...base,
    fonte: "manuale",
    disponibilita: "ok",
    appuntamentiFissati: somma("appuntamentiFissati"),
    appuntamentiEffettuati: null,
    vendite: somma("vendite"),
    fatturato: somma("fatturato"),
    chiusura: chiusura(somma("vendite"), somma("appuntamentiFissati")),
  };
}

/**
 * `settimane` è la griglia di settimane del periodo (i lunedì), la stessa dei grafici del marketing:
 * così i due riquadri hanno lo stesso asse. `mensili` sono già i soli mesi interi nel periodo.
 */
export function costruisciAndamentoVenditori(input: {
  venditori: Venditore[];
  settimane: string[];
  da: string;
  a: string;
  ghl: GhlPerVenditori;
  mensili: RisultatoMensileVenditore[];
}): AndamentoVenditori {
  const { venditori, settimane, da, a, ghl, mensili } = input;
  const righe = venditori.map((v) => rigaDi(v, ghl, mensili));
  const daGhl = venditori.filter((v) => venditoreDaGhl(v, ghl));

  if (daGhl.length > 0) {
    const perVenditore = new Map(
      daGhl.map((v) => [v.venditoreId, new Map((ghl.stato === "ok" ? (ghl.perSettimana[v.venditoreId] ?? []) : []).map((s) => [s.settimana, s]))])
    );
    const conAppuntamenti = ghl.stato === "ok" && ghl.calendariCollegati;
    return {
      righe,
      grana: "settimana",
      punti: settimane.map((settimana) => ({
        chiave: settimana,
        etichetta: formatSettimana(settimana),
        valori: Object.fromEntries(
          daGhl.map((v) => {
            if (ghl.stato !== "ok" || !ghl.perVenditore[v.venditoreId]) return [v.venditoreId, null];
            const s = perVenditore.get(v.venditoreId)?.get(settimana);
            return [v.venditoreId, { appuntamenti: conAppuntamenti ? (s?.fissati ?? 0) : null, vendite: s?.vendite ?? 0, fatturato: s?.fatturato ?? 0 }];
          })
        ),
      })),
      nelGrafico: daGhl.map((v) => v.venditoreId),
      fuoriDalGrafico: venditori.filter((v) => !venditoreDaGhl(v, ghl)).map((v) => v.venditoreId),
      statoGrafico: ghl.stato === "ok" ? "ok" : ghl.stato === "caricamento" ? "caricamento" : "non-disponibile",
    };
  }

  return {
    righe,
    grana: "mese",
    punti: mesiInteriNelPeriodo(da, a).map((mese) => ({
      chiave: mese,
      etichetta: formatMese(mese),
      valori: Object.fromEntries(
        venditori.map((v) => {
          const m = mensili.find((r) => r.mese === mese && r.venditoreId === v.venditoreId);
          return [v.venditoreId, m ? { appuntamenti: m.appuntamentiFissati, vendite: m.vendite, fatturato: m.fatturato } : null];
        })
      ),
    })),
    nelGrafico: venditori.map((v) => v.venditoreId),
    fuoriDalGrafico: [],
    statoGrafico: "ok",
  };
}
