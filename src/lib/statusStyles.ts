/**
 * Fonte unica dei colori "di stato" (successo/attenzione/critico/neutro) — prima erano
 * ridichiarati in tre punti diversi con piccole variazioni inconsistenti (format.ts#STATI_CAMPAGNA,
 * format.ts#STATI_ATTIVITA, SaluteClienti.tsx#STILE_STATO). Le mappe di dominio (stato campagna,
 * stato attività, salute cliente) restano separate — sono concetti diversi — ma leggono il colore
 * da qui invece di ridichiararlo. Deliberatamente distinto dalla palette di brand in globals.css:
 * un colore di stato non deve mai coincidere con un colore identitario (vedi skill dataviz).
 */
export type LivelloStato = "successo" | "attenzione" | "critico" | "neutro";

export type StileLivello = {
  /** Badge: sfondo/testo/bordo Tailwind. */
  classe: string;
  /** Puntino/dot: sfondo Tailwind. */
  puntino: string;
  /** Esadecimale — per contesti che non possono leggere classi Tailwind (fill SVG nel Gantt, react-pdf). */
  barra: string;
};

export const STILE_LIVELLO: Record<LivelloStato, StileLivello> = {
  successo: { classe: "bg-green-50 text-green-700 border-green-100", puntino: "bg-green-500", barra: "#22c55e" },
  attenzione: { classe: "bg-yellow-50 text-yellow-700 border-yellow-100", puntino: "bg-yellow-500", barra: "#eab308" },
  critico: { classe: "bg-red-50 text-red-600 border-red-100", puntino: "bg-red-400", barra: "#f87171" },
  neutro: { classe: "bg-gray-100 text-gray-600 border-gray-200", puntino: "bg-gray-400", barra: "#9ca3af" },
};
