import type { Prodotto, RuoloSquadra, TemplateTask } from "@/types/kpi";

/** Una persona della squadra come la vede la pagina Impostazioni: senza password, solo se ne ha una. */
export type PersonaSquadra = {
  ruolo: RuoloSquadra;
  id: string;
  nome: string;
  email: string;
  attivo: boolean;
  haPassword: boolean;
  /** Clienti attivi assegnati (consulente) o prospect attivi (commerciale). */
  assegnati: number;
};

export type ProdottoConModello = Prodotto & {
  /** Clienti (attivi o no) che hanno questo prodotto. */
  clienti: number;
  /** Le attività del modello, già in ordine. */
  modello: TemplateTask[];
};

/** Chiama un indirizzo dell'app e restituisce il corpo, o lancia l'errore col messaggio ricevuto. */
export async function chiama<T = unknown>(url: string, metodo: "POST" | "PATCH" | "PUT" | "DELETE", corpo?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: metodo,
    headers: corpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const dati = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((dati as { error?: string }).error || "Operazione non riuscita");
  return dati as T;
}
