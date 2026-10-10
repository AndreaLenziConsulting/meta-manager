/**
 * Fonte unica dei colori "di stato" — i tre stati del Design System ALC (`ok`, `attenzione`,
 * `critico`, ognuno col suo fondo `-tenue`) più un neutro e un informativo. Le mappe di dominio
 * (stato campagna, stato attività, salute cliente) restano separate — sono concetti diversi — ma
 * leggono il colore da qui invece di ridichiararlo. Regola del sistema: accanto al colore c'è sempre
 * una parola o un'icona, e questi colori non si usano per decorare.
 */
export type LivelloStato = "successo" | "attenzione" | "critico" | "neutro" | "info";

export type StileLivello = {
  /** Badge e box: sfondo/testo/bordo Tailwind. */
  classe: string;
  /** Puntino/dot: sfondo Tailwind. */
  puntino: string;
  /** Esadecimale — per contesti che non possono leggere classi Tailwind (fill SVG nel Gantt, react-pdf). */
  barra: string;
};

export const STILE_LIVELLO: Record<LivelloStato, StileLivello> = {
  successo: { classe: "bg-ok-tenue text-ok border-ok/20", puntino: "bg-ok", barra: "#17804f" },
  attenzione: { classe: "bg-attenzione-tenue text-attenzione border-attenzione/20", puntino: "bg-attenzione", barra: "#9a5c00" },
  critico: { classe: "bg-critico-tenue text-critico border-critico/20", puntino: "bg-critico", barra: "#b03a34" },
  // Stato senza giudizio (in pausa, bozza, archiviato): fondo `sfondo`, testo `testo-secondario`.
  neutro: { classe: "bg-surface text-ink-500 border-linea", puntino: "bg-grigio", barra: "#bcbec0" },
  // Un "da sapere" che non è un problema (es. calendari GHL momentaneamente irraggiungibili): il blu
  // di accento su `accento-tenue`, come il badge di categoria del sistema.
  info: { classe: "bg-brand-light text-accento-testo border-brand/20", puntino: "bg-brand", barra: "#08599c" },
};
