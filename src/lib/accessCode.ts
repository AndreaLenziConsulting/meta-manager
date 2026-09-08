import { randomBytes } from "node:crypto";

function slugify(testo: string): string {
  return testo
    .normalize("NFD")
    .replace(/\p{Mark}/gu, "") // rimuove i segni diacritici (accenti) lasciati dalla normalizzazione NFD
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Genera un clienteId leggibile dallo slug del nome, con suffisso numerico se collide con uno
 * già esistente ("mobilieri-bianchi", "mobilieri-bianchi-2", ...). Mai vuoto: un nome senza
 * caratteri alfanumerici (raro) ripiega su "cliente".
 */
export function generaClienteId(nome: string, esistenti: Set<string>): string {
  const base = slugify(nome) || "cliente";
  if (!esistenti.has(base)) return base;
  let n = 2;
  while (esistenti.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/** Codice d'accesso per il link cliente pubblico: 10 caratteri esadecimali, nessuna nuova dipendenza. */
export function generaAccessCode(): string {
  return randomBytes(5).toString("hex");
}

/** Genera un prospectId leggibile dallo slug della ragione sociale — stesso schema di generaClienteId. */
export function generaProspectId(ragioneSociale: string, esistenti: Set<string>): string {
  const base = slugify(ragioneSociale) || "prospect";
  if (!esistenti.has(base)) return base;
  let n = 2;
  while (esistenti.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Genera un sedeId leggibile ("mobilieri-bianchi--milano"), unico sull'intera tab Sedi (non solo
 * dentro lo stesso cliente) — stesso schema slug+suffisso di generaClienteId, con clienteId come
 * prefisso così l'id resta leggibile a colpo d'occhio anche fuori contesto.
 */
export function generaSedeId(clienteId: string, nomeSede: string, esistenti: Set<string>): string {
  const base = `${clienteId}--${slugify(nomeSede) || "sede"}`;
  if (!esistenti.has(base)) return base;
  let n = 2;
  while (esistenti.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

/**
 * Genera un taskId leggibile dallo slug della descrizione, per un'attività aggiunta manualmente
 * (non da template prodotto né da meeting, che hanno i propri schemi opachi — vedi
 * generaAttivitaPerCliente/generaAttivitaDaMeeting) — stesso schema slug+suffisso di
 * generaClienteId/generaProspectId sopra, troncato a 40 caratteri (una descrizione può essere una
 * frase intera) e senza trattino residuo al taglio. `esistenti` è l'insieme dei taskId già in uso
 * per QUEL cliente (attivitaId = `${clienteId}::${taskId}`): la stessa base può ripetersi su
 * clienti diversi senza collidere davvero, il chiamante passa solo i taskId del cliente in corso.
 */
export function generaTaskIdManuale(descrizione: string, esistenti: Set<string>): string {
  const base = slugify(descrizione).slice(0, 40).replace(/-+$/, "") || "attivita";
  if (!esistenti.has(base)) return base;
  let n = 2;
  while (esistenti.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
