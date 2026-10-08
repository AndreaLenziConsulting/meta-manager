import { SENTINELLA_NON_ASSEGNATO } from "@/lib/assegnatari";
import type { TemplateTask } from "@/types/kpi";

/**
 * Regole della pagina Impostazioni (squadra, prodotti, modelli di attività), condivise fra i moduli
 * della pagina e gli indirizzi che salvano. Funzioni pure: ogni controllo restituisce il messaggio
 * d'errore da mostrare, o null se va bene.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** L'email è facoltativa (senza, le email automatiche non partono a nome di quella persona), ma se c'è deve essere un indirizzo. */
export function erroreAnagraficaPersona(dati: { nome?: string; email?: string }): string | null {
  if (dati.nome !== undefined && !dati.nome.trim()) return "Il nome è obbligatorio";
  if (dati.nome !== undefined && dati.nome.trim().length > 80) return "Il nome è troppo lungo (massimo 80 caratteri)";
  if (dati.email !== undefined && dati.email.trim() && !EMAIL.test(dati.email.trim())) return "L'email non sembra un indirizzo valido";
  return null;
}

/** Sotto questa lunghezza una password nuova non viene accettata: è l'unica cosa che identifica chi entra. */
export const LUNGHEZZA_MINIMA_PASSWORD = 10;

/** Una password nuova: abbastanza lunga da non essere indovinabile, e senza spazi ai bordi (finiscono lì copiandola da un messaggio). */
export function errorePasswordNuova(password: string): string | null {
  if (password.length < LUNGHEZZA_MINIMA_PASSWORD) return `La password deve avere almeno ${LUNGHEZZA_MINIMA_PASSWORD} caratteri`;
  if (password.length > 200) return "La password è troppo lunga (massimo 200 caratteri)";
  if (password !== password.trim()) return "La password non può cominciare o finire con uno spazio";
  return null;
}

export const DURATA_MASSIMA_SETTIMANE = 260;

export function erroreProdotto(dati: { nome?: string; durataSettimane?: number }): string | null {
  if (dati.nome !== undefined && !dati.nome.trim()) return "Il nome del prodotto è obbligatorio";
  if (dati.durataSettimane !== undefined && !(Number.isInteger(dati.durataSettimane) && dati.durataSettimane >= 1 && dati.durataSettimane <= DURATA_MASSIMA_SETTIMANE)) {
    return `La durata deve essere un numero intero di settimane, da 1 a ${DURATA_MASSIMA_SETTIMANE}`;
  }
  return null;
}

/** I due momenti di un progetto in cui cade un'attività del modello, come li usano i modelli esistenti. */
export const BLOCCHI_MODELLO = [
  { id: "setup", etichetta: "Avvio" },
  { id: "gestione", etichetta: "Gestione" },
] as const;

/** Le sigle che danno il colore a un'attività nella roadmap. */
export const TIPI_ATTIVITA_MODELLO = [
  { id: "PM", etichetta: "Project Manager" },
  { id: "CS", etichetta: "Consulente Senior" },
  { id: "CL", etichetta: "Cliente" },
  { id: "MIL", etichetta: "Tappa" },
] as const;

export type DatiTaskModello = Omit<TemplateTask, "prodottoId" | "taskId" | "ordine">;

/**
 * Ripulisce i dati di un'attività del modello e li controlla. Gli assegnatari vuoti diventano "Da
 * assegnare", come ovunque nell'app (un'attività ha sempre almeno un assegnatario).
 */
export function controllaTaskModello(grezzi: Partial<Record<keyof DatiTaskModello, unknown>>): { ok: true; dati: DatiTaskModello } | { ok: false; errore: string } {
  const testo = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const descrizione = testo(grezzi.descrizione);
  if (!descrizione) return { ok: false, errore: "La descrizione dell'attività è obbligatoria" };
  if (descrizione.length > 500) return { ok: false, errore: "La descrizione è troppo lunga (massimo 500 caratteri)" };

  const settimanaInizio = grezzi.settimanaInizio;
  const settimanaFine = grezzi.settimanaFine;
  const settimana = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= DURATA_MASSIMA_SETTIMANE;
  if (!settimana(settimanaInizio)) return { ok: false, errore: `La settimana di inizio deve essere un numero intero, da 1 a ${DURATA_MASSIMA_SETTIMANE}` };
  if (!settimana(settimanaFine)) return { ok: false, errore: `La settimana di fine deve essere un numero intero, da 1 a ${DURATA_MASSIMA_SETTIMANE}` };
  if (settimanaFine < settimanaInizio) return { ok: false, errore: "La settimana di fine non può venire prima di quella di inizio" };

  const assegnatari = Array.isArray(grezzi.assegnatari) ? [...new Set(grezzi.assegnatari.map(testo).filter(Boolean))] : [];
  return {
    ok: true,
    dati: {
      blocco: testo(grezzi.blocco),
      fase: testo(grezzi.fase),
      descrizione,
      assegnatari: assegnatari.length > 0 ? assegnatari : [SENTINELLA_NON_ASSEGNATO],
      tipo: testo(grezzi.tipo),
      settimanaInizio,
      settimanaFine,
      giorniTesto: testo(grezzi.giorniTesto),
      nota: testo(grezzi.nota),
    },
  };
}

/**
 * L'ordine in cui disporre le attività di un modello dopo averne inserita una nuova: subito dopo
 * `dopoTaskId` se indicato e presente, altrimenti in fondo. `inOrdine` sono gli id attuali, già ordinati.
 */
export function ordineConNuova(inOrdine: string[], nuovaTaskId: string, dopoTaskId?: string): string[] {
  const senza = inOrdine.filter((id) => id !== nuovaTaskId);
  const posizione = dopoTaskId ? senza.indexOf(dopoTaskId) : -1;
  if (posizione < 0) return [...senza, nuovaTaskId];
  return [...senza.slice(0, posizione + 1), nuovaTaskId, ...senza.slice(posizione + 1)];
}

/** Vero se `proposto` contiene esattamente gli stessi id di `attuale`, ognuno una volta: solo allora è un riordino. */
export function stessiElementi(attuale: string[], proposto: string[]): boolean {
  return attuale.length === proposto.length && new Set(proposto).size === proposto.length && proposto.every((id) => attuale.includes(id));
}
