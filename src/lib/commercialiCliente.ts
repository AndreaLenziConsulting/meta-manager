import type { Sede, Venditore } from "@/types/kpi";
import type { CommercialiDiSede } from "@/lib/schemaTesto";

/**
 * I commerciali di un cliente, sede per sede, come li mostrano gli schemi della sezione "Processi"
 * (richiesta dell'utente, 10/10/2026: "su alcune sedi abbiamo anche i commerciali segnati per nome,
 * sarebbe comodo referenziarli negli schemi dedicati alla parte commerciale").
 *
 * Solo sedi attive e venditori attivi, nell'ordine in cui stanno in archivio. Una sede senza
 * venditori non compare. Il nome della sede serve solo quando il cliente ne ha più di una: con una
 * sede sola resta vuoto, e lo schema scrive i soli nomi.
 *
 * `sedi` sono già quelle del cliente; `venditori` può essere l'elenco intero.
 */
export function commercialiDelCliente(sedi: Sede[], venditori: Venditore[]): CommercialiDiSede[] {
  const attive = sedi.filter((s) => s.attivo);
  const piuSedi = attive.length > 1;
  return attive
    .map((sede) => ({
      sede: piuSedi ? sede.nome.trim() : "",
      nomi: venditori
        .filter((v) => v.sedeId === sede.sedeId && v.attivo)
        .map((v) => v.nome.trim())
        .filter(Boolean),
    }))
    .filter((gruppo) => gruppo.nomi.length > 0);
}
