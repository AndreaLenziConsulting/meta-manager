/**
 * Geometria del visualizzatore di schemi (sezione "Processi" della scheda cliente): dove si trova lo
 * schema dentro il riquadro e quanto è ingrandito. Funzioni pure, senza browser: il componente
 * (src/components/processi/VisualizzatoreSchema.tsx) le usa per trascinare, ingrandire e "adattare".
 */

export type Punto = { x: number; y: number };
export type Misure = { larghezza: number; altezza: number };

/** Un punto dello schema `(px, py)` compare nel riquadro in `(px * k + x, py * k + y)`. */
export type Vista = { x: number; y: number; k: number };

/** Spazio libero attorno allo schema quando è "adattato" al riquadro. */
export const MARGINE_ADATTATA = 24;
/** Quanto si può ingrandire e rimpicciolire rispetto alla misura "adattata". */
export const ZOOM_MASSIMO = 8;
export const ZOOM_MINIMO = 0.5;
/** Trascinando, almeno questi pixel di schema restano nel riquadro: non lo si può perdere di vista. */
export const VISIBILE_MINIMO = 80;

/** Lo schema intero, il più grande possibile, al centro del riquadro. */
export function vistaAdattata(area: Misure, schema: Misure, margine = MARGINE_ADATTATA): Vista {
  const larghezzaUtile = Math.max(area.larghezza - margine * 2, 1);
  const altezzaUtile = Math.max(area.altezza - margine * 2, 1);
  const k = Math.min(larghezzaUtile / schema.larghezza, altezzaUtile / schema.altezza);
  return {
    k,
    x: (area.larghezza - schema.larghezza * k) / 2,
    y: (area.altezza - schema.altezza * k) / 2,
  };
}

/** Tiene l'ingrandimento fra metà e otto volte la misura "adattata". */
export function limitaZoom(k: number, kAdattata: number): number {
  return Math.min(Math.max(k, kAdattata * ZOOM_MINIMO), kAdattata * ZOOM_MASSIMO);
}

/** Porta l'ingrandimento a `k` lasciando fermo il punto dello schema che sta sotto `perno`. */
export function zoomAttorno(vista: Vista, perno: Punto, k: number): Vista {
  const sottoIlPerno = versoSchema(vista, perno);
  return { k, x: perno.x - sottoIlPerno.x * k, y: perno.y - sottoIlPerno.y * k };
}

/** Riporta la vista entro i bordi: un pezzo di schema resta sempre dentro il riquadro. */
export function trattieni(vista: Vista, area: Misure, schema: Misure, visibile = VISIBILE_MINIMO): Vista {
  const larghezza = schema.larghezza * vista.k;
  const altezza = schema.altezza * vista.k;
  const restaX = Math.min(visibile, larghezza, area.larghezza);
  const restaY = Math.min(visibile, altezza, area.altezza);
  return {
    k: vista.k,
    x: Math.min(Math.max(vista.x, restaX - larghezza), area.larghezza - restaX),
    y: Math.min(Math.max(vista.y, restaY - altezza), area.altezza - restaY),
  };
}

/** Da un punto del riquadro al punto dello schema che gli sta sotto. */
export function versoSchema(vista: Vista, punto: Punto): Punto {
  return { x: (punto.x - vista.x) / vista.k, y: (punto.y - vista.y) / vista.k };
}

/** L'ingrandimento come lo legge chi usa lo schema: 100 = lo schema intero nel riquadro. */
export function percentualeZoom(k: number, kAdattata: number): number {
  return Math.round((k / kAdattata) * 100);
}
