import type { Campagna } from "@/types/kpi";

// Filtro predefinito "solo campagne ALC" (richiesta utente 06/10/2026: "di default il sistema dovrebbe
// considerare solo le campagne che hanno nel naming ALC o Alc o alc. Quindi filtro impostato dentro
// al cliente per far vedere solo quelle e anche nei calcoli della dashboard").
//
// Perché serve: diversi clienti hanno nello stesso account pubblicitario campagne NON gestite
// dall'agenzia (di altri fornitori o del cliente stesso). Le campagne dell'agenzia portano "ALC" nel
// nome ("[ALC] Visma | Catalogo | Settembre 2026"): contare tutto l'account attribuiva all'agenzia
// spesa e lead non suoi.
//
// Due regole che tengono il filtro onesto:
// 1. Vale solo per una sede che ha ALMENO una campagna con ALC nel nome. Per le altre (la maggior
//    parte dei clienti storici, le cui campagne non seguono questa convenzione) non c'è nulla da
//    distinguere e si continuano a considerare tutte le campagne — mai una dashboard azzerata da un
//    filtro che non trova niente.
// 2. Si può spegnere per sede (Sede.tutteLeCampagne, "Considera tutte le campagne" in Modifica
//    cliente): serve all'account proprio dell'agenzia, dove "ALC" in un nome è solo il marchio e
//    tutte le campagne sono sue.
//
// È un predefinito, non un blocco: dal filtro campagne della pagina cliente si può sempre scegliere
// "tutte" o una selezione a mano (vedi leggiFiltroCampagne).

/** "ALC" come parola a sé, maiuscole/minuscole indifferenti: "[ALC] Visma", "ALC - TF", "alc_lead",
 * "ALC2026". Non dentro un'altra parola ("Calcio", "Falco", "Alcantara"): prima e dopo non deve
 * esserci una lettera. */
const PAROLA_ALC = /(^|[^a-z])alc([^a-z]|$)/i;

export function haNomeAlc(nomeCampagna: string): boolean {
  return PAROLA_ALC.test(nomeCampagna);
}

/**
 * Le campagne che valgono di default per una sede: gli id delle sue campagne con ALC nel nome (di
 * ogni canale e di ogni periodo), oppure `null` = nessun filtro, valgono tutte — perché la sede non
 * ne ha nessuna (regola 1) o perché ha il filtro spento (regola 2).
 */
export function campagnePredefinite(
  sede: { clienteId: string; sedeId: string; tutteLeCampagne?: boolean },
  campagne: Campagna[]
): Set<string> | null {
  if (sede.tutteLeCampagne) return null;
  const ids = campagne
    .filter((c) => c.clienteId === sede.clienteId && c.sedeId === sede.sedeId && haNomeAlc(c.nomeCampagna))
    .map((c) => c.campaignId);
  return ids.length > 0 ? new Set(ids) : null;
}

/** Valore del parametro `campagne` che chiede esplicitamente TUTTE le campagne, scavalcando il
 * predefinito. Non può confondersi con un id: gli id campagna sono numerici. */
export const PARAMETRO_TUTTE_LE_CAMPAGNE = "tutte";

export type FiltroCampagneRichiesto = { tipo: "predefinito" } | { tipo: "tutte" } | { tipo: "scelte"; ids: Set<string> };

/**
 * Interpreta il parametro `campagne` di /api/kpi e /api/ghl:
 * - assente o vuoto -> il predefinito della sede (campagnePredefinite);
 * - "tutte" -> tutte le campagne, nessun filtro;
 * - "id1,id2" -> esattamente quelle (scelta a mano dal filtro).
 */
export function leggiFiltroCampagne(parametro: string | null | undefined): FiltroCampagneRichiesto {
  const valore = (parametro ?? "").trim();
  if (!valore) return { tipo: "predefinito" };
  if (valore === PARAMETRO_TUTTE_LE_CAMPAGNE) return { tipo: "tutte" };
  const ids = valore.split(",").map((id) => id.trim()).filter(Boolean);
  return ids.length > 0 ? { tipo: "scelte", ids: new Set(ids) } : { tipo: "predefinito" };
}

/** Il filtro effettivo per una richiesta: `null` = tutte le campagne. */
export function campagneDaConsiderare(
  richiesto: FiltroCampagneRichiesto,
  sede: { clienteId: string; sedeId: string; tutteLeCampagne?: boolean },
  campagne: Campagna[]
): Set<string> | null {
  if (richiesto.tipo === "scelte") return richiesto.ids;
  if (richiesto.tipo === "tutte") return null;
  return campagnePredefinite(sede, campagne);
}
