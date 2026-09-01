import { STILE_LIVELLO } from "@/lib/statusStyles";

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
