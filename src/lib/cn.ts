import clsx, { type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Compone classi Tailwind risolvendo i conflitti (l'ultima vince sulla stessa proprietà, es.
 * `p-4` + `p-6` -> resta solo `p-6`) invece di limitarsi a concatenare stringhe. Base dei
 * componenti condivisi in src/components/ui/ — permette a un consumer di passare `className`
 * per override puntuali senza rischiare conflitti silenziosi con lo stile di default.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
