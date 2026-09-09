/**
 * Assegnatari di un'attività — sostituisce il vecchio `responsabile: string` (testo libero) con
 * `assegnatari: string[]`, decisione esplicita dell'utente (08/09/2026) dopo aver verificato sui
 * dati reali che quel campo mescolava persone singole ("Andrea"), il ruolo interno ("Project
 * Manager"/"Consulente Senior" — SOLO questi due, verificato su tutto TemplateAttivita), il
 * cliente stesso ("Cliente"), il sentinella "Da assegnare" e combinazioni già scritte a mano con
 * delimitatori diversi e incoerenti (" + ", " & ", " e ", "/"). Nel foglio Google la colonna resta
 * la stessa (nessun nuovo tab/colonna): da testo libero a lista comma-separated canonica, stesso
 * pattern già in uso per GhlConnessione.calendarIds (src/lib/sheets.ts).
 */

export const RUOLI_INTERNI = ["Project Manager", "Consulente Senior"] as const;
export const ETICHETTA_CLIENTE = "Cliente";
export const SENTINELLA_NON_ASSEGNATO = "Da assegnare";

export type TipoAssegnatario = "persona" | "ruolo" | "cliente" | "non-assegnato";

/** Classifica un singolo assegnatario ATOMICO (già separato dagli altri, mai una stringa con
 * ancora un delimitatore dentro — per quello vedi normalizzaAssegnatari sotto). */
export function classificaAssegnatario(nome: string): TipoAssegnatario {
  const pulito = nome.trim();
  if (!pulito || pulito === SENTINELLA_NON_ASSEGNATO) return "non-assegnato";
  if (pulito === ETICHETTA_CLIENTE) return "cliente";
  if ((RUOLI_INTERNI as readonly string[]).includes(pulito)) return "ruolo";
  return "persona";
}

/**
 * True se NESSUNO degli assegnatari è una persona reale o il cliente — solo ruoli interni e/o il
 * sentinella "Da assegnare". Usata per il quick-filter "Da assegnare" (blocco 4 del redesign
 * Attività): un task "Consulente Senior + Cliente" NON è orfano (il cliente è comunque
 * responsabile), un task "Project Manager" da solo lo è (nessuna persona reale l'ha mai preso in
 * carico). Array vuoto -> orfano (non dovrebbe capitare dopo normalizzaAssegnatari, che non
 * produce mai [], ma qui è comunque il comportamento onesto).
 */
export function taskOrfana(assegnatari: string[]): boolean {
  return assegnatari.every((a) => {
    const tipo = classificaAssegnatario(a);
    return tipo === "ruolo" || tipo === "non-assegnato";
  });
}

// Delimitatori informali osservati nei dati reali (AttivitaCliente/TemplateAttivita), in ordine di
// specificità decrescente (" e " prima di "/" così "Orlando e Alessandro" non finisce spaccato a
// metà da un eventuale "/" dentro un nome — mai osservato, ma l'ordine costa zero e previene il
// caso). Split case-insensitive su " e " (parola intera, non "e" dentro un nome) via regex con i
// confini di parola \b.
const DELIMITATORI = [/\s*\+\s*/g, /\s*&\s*/g, /\s+e\s+/gi, /\s*\/\s*/g];

/**
 * Spacca un testo libero storico (il vecchio `responsabile`, o un `assignee` grezzo estratto da un
 * meeting) nei suoi assegnatari atomici, riconoscendo tutti i delimitatori osservati nei dati
 * reali. Trim + dedup (case-sensitive: "PM"/"pm" restano distinti, mai osservato un caso reale che
 * lo richieda), stringa vuota/solo spazi -> ["Da assegnare"] (mai un array vuoto: un'attività ha
 * sempre almeno un "assegnatario", anche se è il sentinella). Punto UNICO di normalizzazione —
 * usato dalla migrazione una tantum e da ogni punto che produce ancora un responsabile da testo
 * libero (estrazione meeting, creazione manuale con un solo campo testo).
 */
export function normalizzaAssegnatari(testoLibero: string): string[] {
  let testo = testoLibero.trim();
  if (!testo) return [SENTINELLA_NON_ASSEGNATO];

  for (const delimitatore of DELIMITATORI) {
    testo = testo.replace(delimitatore, ",");
  }
  const parti = Array.from(new Set(testo.split(",").map((p) => p.trim()).filter(Boolean)));
  return parti.length > 0 ? parti : [SENTINELLA_NON_ASSEGNATO];
}
