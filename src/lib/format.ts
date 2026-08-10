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
  ACTIVE: { label: "Attiva", classe: "bg-green-50 text-green-700 border-green-100", puntino: "bg-green-500" },
  PAUSED: { label: "In pausa", classe: "bg-gray-100 text-gray-600 border-gray-200", puntino: "bg-gray-400" },
  ARCHIVED: { label: "Archiviata", classe: "bg-gray-100 text-gray-500 border-gray-200", puntino: "bg-gray-400" },
  DELETED: { label: "Eliminata", classe: "bg-red-50 text-red-600 border-red-100", puntino: "bg-red-400" },
  PENDING_REVIEW: { label: "In revisione", classe: "bg-yellow-50 text-yellow-700 border-yellow-100", puntino: "bg-yellow-500" },
  DISAPPROVED: { label: "Rifiutata", classe: "bg-red-50 text-red-600 border-red-100", puntino: "bg-red-400" },
};

/** Traduce lo stato grezzo Meta (ACTIVE/PAUSED/...) in etichetta + colore per i badge. Stringa vuota = non ancora sincronizzato. */
export function formatStatoCampagna(stato: string): StatoCampagnaInfo | null {
  if (!stato) return null;
  return (
    STATI_CAMPAGNA[stato] ?? {
      label: stato.charAt(0) + stato.slice(1).toLowerCase().replace(/_/g, " "),
      classe: "bg-gray-100 text-gray-500 border-gray-200",
      puntino: "bg-gray-400",
    }
  );
}
