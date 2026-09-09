import { STILE_LIVELLO } from "@/lib/statusStyles";
import { giorniTra } from "@/lib/roadmap";

export function formatEuro(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

export function formatNumero(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", { maximumFractionDigits: 0 }).format(value);
}

export function formatPercentuale(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

/** Come formatPercentuale, ma con segno esplicito — per una variazione vs periodo precedente,
 * dove "12%" da solo non direbbe se in aumento o in calo (vedi confrontoPeriodo.ts). */
export function formatVariazionePercentuale(value: number): string {
  const segno = value > 0 ? "+" : value < 0 ? "−" : "";
  const testo = new Intl.NumberFormat("it-IT", { style: "percent", maximumFractionDigits: 0 }).format(Math.abs(value));
  return `${segno}${testo}`;
}

/** Iniziali di un nome/nome+cognome, per gli avatar circolari (responsabile attività, consulente). */
export function iniziali(nome: string): string {
  const parti = nome.trim().split(/\s+/).filter(Boolean);
  if (parti.length === 0) return "?";
  if (parti.length === 1) return parti[0].slice(0, 2).toUpperCase();
  return (parti[0][0] + parti[1][0]).toUpperCase();
}

export function formatRoas(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}x`;
}

export const MESI_BREVI = [
  "Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic",
];

export function formatMese(mese: string): string {
  const [anno, m] = mese.split("-");
  const idx = Number(m) - 1;
  return `${MESI_BREVI[idx] ?? m} ${anno.slice(2)}`;
}

/** Formatta una data YYYY-MM-DD (il lunedì di inizio settimana) come "24 Lug". */
export function formatSettimana(settimana: string): string {
  const [, m, giorno] = settimana.split("-");
  const idx = Number(m) - 1;
  return `${Number(giorno)} ${MESI_BREVI[idx] ?? m}`;
}

/** Formatta una data ISO (YYYY-MM-DD, anche con orario — si guarda solo ai primi 10 caratteri) come "5 ago 2026". */
export function formatDataBreve(dataIso: string): string {
  const [anno, m, giorno] = dataIso.slice(0, 10).split("-");
  const idx = Number(m) - 1;
  return `${Number(giorno)} ${(MESI_BREVI[idx] ?? m).toLowerCase()} ${anno}`;
}

// Solo per il default di oggi nelle due funzioni sotto (mai chiamata nei test, che iniettano
// sempre `oggi`) — stesso schema di oggiDefault()/oraAttualeMs già in uso altrove (ghl.ts,
// kpiSettimanale.ts): ogni modulo si tiene la sua, niente dipendenza in più solo per questo.
function oggiDefault(): string {
  return new Date().toISOString().slice(0, 10);
}

const GIORNI_BREVI = ["dom", "lun", "mar", "mer", "gio", "ven", "sab"]; // indice = Date.getUTCDay()

/** "5 ago", senza anno — usata da formatDataBreve (che invece lo include) e da formatDataRelativa;
 * esportata anche per KpiSection.tsx (testo di chiarimento sotto al selettore periodo). */
export function giornoMeseBreve(dataIso: string): string {
  const [, m, giorno] = dataIso.slice(0, 10).split("-");
  const idx = Number(m) - 1;
  return `${Number(giorno)} ${(MESI_BREVI[idx] ?? m).toLowerCase()}`;
}

/**
 * Data ISO come l'avrebbe letta un consulente in italiano, mai un formato assoluto americano
 * (MM/DD/YYYY) — il problema che questa funzione risolve insieme al date-picker "invisibile" in
 * AttivitaLista.tsx/NuovaAttivitaForm.tsx (redesign Attività, 08/09/2026). "oggi"/"domani"/"ieri"
 * per un giorno di distanza, "ven 11 set" (giorno settimana breve + giorno + mese breve) per un
 * raggio di una settimana in entrambe le direzioni, altrimenti come formatDataBreve ma SENZA
 * l'anno se coincide con l'anno di `oggi` (un anno diverso resta sempre esplicito, mai ambiguo).
 */
export function formatDataRelativa(dataIso: string, oggi: string = oggiDefault()): string {
  const diff = giorniTra(oggi, dataIso); // positivo = dataIso nel futuro rispetto a oggi
  if (diff === 0) return "oggi";
  if (diff === 1) return "domani";
  if (diff === -1) return "ieri";
  if (diff >= -6 && diff <= 6) {
    const giorno = GIORNI_BREVI[new Date(`${dataIso.slice(0, 10)}T00:00:00Z`).getUTCDay()];
    return `${giorno} ${giornoMeseBreve(dataIso)}`;
  }
  return dataIso.slice(0, 4) === oggi.slice(0, 4) ? giornoMeseBreve(dataIso) : formatDataBreve(dataIso);
}

export type DescrizioneScadenza = { testo: string; scaduta: boolean };

/**
 * Testo per la colonna Scadenza di una riga attività (blocco 2 del redesign Attività). "Scaduta"
 * = stesso criterio di attivitaInRitardo in roadmap.ts (stato non "done" E dataFine già passata,
 * confronto stretto — la scadenza di oggi stesso non è ancora scaduta), riusato non reimplementato
 * qui: "Scaduta ieri"/"Scaduta da N giorni" (mai un numero negativo o zero: quel caso è "ieri").
 * Altrimenti formatDataRelativa. `scaduta` dice al chiamante se colorare il testo in rosso
 * (STILE_LIVELLO.critico) — mai un rosso inventato in questo file.
 */
export function descrizioneScadenza(dataFine: string, stato: string, oggi: string = oggiDefault()): DescrizioneScadenza {
  const inRitardo = stato !== "done" && dataFine < oggi;
  if (!inRitardo) return { testo: formatDataRelativa(dataFine, oggi), scaduta: false };
  const giorni = giorniTra(dataFine, oggi); // positivo: oggi è dopo dataFine
  return { testo: giorni === 1 ? "Scaduta ieri" : `Scaduta da ${giorni} giorni`, scaduta: true };
}

export type StatoCampagnaInfo = { label: string; classe: string; puntino: string };

const STATI_CAMPAGNA: Record<string, StatoCampagnaInfo> = {
  ACTIVE: { label: "Attiva", ...STILE_LIVELLO.successo },
  PAUSED: { label: "In pausa", ...STILE_LIVELLO.neutro },
  ARCHIVED: { label: "Archiviata", ...STILE_LIVELLO.neutro },
  DELETED: { label: "Eliminata", ...STILE_LIVELLO.critico },
  PENDING_REVIEW: { label: "In revisione", ...STILE_LIVELLO.attenzione },
  DISAPPROVED: { label: "Rifiutata", ...STILE_LIVELLO.critico },
};

/** Traduce lo stato grezzo Meta (ACTIVE/PAUSED/...) in etichetta + colore per i badge. Stringa vuota = non ancora sincronizzato. */
export function formatStatoCampagna(stato: string): StatoCampagnaInfo | null {
  if (!stato) return null;
  return (
    STATI_CAMPAGNA[stato] ?? {
      label: stato.charAt(0) + stato.slice(1).toLowerCase().replace(/_/g, " "),
      ...STILE_LIVELLO.neutro,
    }
  );
}

export type StatoAttivitaInfo = { label: string; classe: string; puntino: string; barra: string };

const STATI_ATTIVITA: Record<string, StatoAttivitaInfo> = {
  todo: { label: "Da fare", ...STILE_LIVELLO.neutro },
  wip: { label: "In corso", ...STILE_LIVELLO.attenzione },
  done: { label: "Fatto", ...STILE_LIVELLO.successo },
  blocked: { label: "Bloccato", ...STILE_LIVELLO.critico },
};

/** Traduce lo stato di un'attività (todo/wip/done/blocked) in etichetta + colori per badge e Gantt. */
export function formatStatoAttivita(stato: string): StatoAttivitaInfo {
  return STATI_ATTIVITA[stato] ?? STATI_ATTIVITA.todo;
}
