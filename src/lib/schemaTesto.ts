/**
 * Testi degli schemi della sezione "Processi" quando dentro ci finisce un nome che cambia da cliente
 * a cliente (l'azienda): un disegno a coordinate fisse non va a capo da solo, quindi il testo va
 * accorciato, diviso e, se serve, stretto prima di disegnarlo. Funzioni pure, senza browser.
 */

/** Un nome troppo lungo per il posto che ha: si taglia e si chiude coi puntini. */
export function accorcia(testo: string, massimo: number): string {
  const pulito = testo.trim();
  if (pulito.length <= massimo) return pulito;
  return `${pulito.slice(0, Math.max(massimo - 1, 1)).trimEnd()}…`;
}

/** Il nome del cliente da scrivere in uno schema, o `null` se manca: lo schema usa la sua dicitura generica. */
export function nomeNelloSchema(nomeCliente: string | undefined, massimo: number): string | null {
  const nome = nomeCliente?.trim();
  return nome ? accorcia(nome, massimo) : null;
}

/**
 * Divide una frase in due righe il più possibile uguali, spezzando su uno spazio. Senza spazi (una
 * parola sola) resta una riga.
 */
export function dividiInDue(testo: string): string[] {
  const pulito = testo.trim();
  let migliore = -1;
  let scarto = Infinity;
  for (let i = 0; i < pulito.length; i++) {
    if (pulito[i] !== " ") continue;
    const differenza = Math.abs(i - (pulito.length - i - 1));
    if (differenza < scarto) {
      scarto = differenza;
      migliore = i;
    }
  }
  return migliore < 0 ? [pulito] : [pulito.slice(0, migliore), pulito.slice(migliore + 1)];
}

/**
 * Larghezza stimata di una riga in Montserrat, in "em" (va moltiplicata per la misura del carattere).
 * Stima prudente, un po' per eccesso: serve solo a capire se una riga rischia di uscire dal suo
 * riquadro, nel qual caso il disegno la stringe (vedi `Testo` in processi/primitive.tsx).
 */
export function larghezzaStimata(testo: string): number {
  let em = 0;
  for (const carattere of testo) {
    if (carattere === " ") em += 0.27;
    else if (/[.,:;'’!·|()\-–]/.test(carattere)) em += 0.3;
    else if (/[A-ZÀ-Ý0-9&@%€]/.test(carattere)) em += 0.7;
    else em += 0.54;
  }
  return em;
}

/** I commerciali di una sede. `sede` vuoto = il cliente ha una sede sola, il suo nome non serve. */
export type CommercialiDiSede = { sede: string; nomi: string[] };

/**
 * Un elenco di nomi come lo si dice: "Anna", "Anna e Marco", "Anna, Marco e Sara". Oltre `massimo`
 * nomi i restanti si contano: "Anna, Marco, Sara, Luca e altri 2".
 */
export function elencoNomi(nomi: string[], massimo = 4): string {
  if (nomi.length <= 1) return nomi[0] ?? "";
  if (nomi.length <= massimo) return `${nomi.slice(0, -1).join(", ")} e ${nomi[nomi.length - 1]}`;
  const restanti = nomi.length - massimo;
  return `${nomi.slice(0, massimo).join(", ")} e ${restanti === 1 ? "un altro" : `altri ${restanti}`}`;
}

/**
 * I commerciali di un cliente in una riga, o `null` se non ce ne sono (lo schema resta generico).
 * Sede sola: "Vittorio e Stefano". Più sedi: "Sesto (Giovanni e Ruben) · Anagnina (Claudia)".
 */
export function rigaCommerciali(commerciali: CommercialiDiSede[] | undefined, massimoPerSede = 4): string | null {
  const gruppi = (commerciali ?? []).filter((g) => g.nomi.length > 0);
  if (gruppi.length === 0) return null;
  return gruppi.map((g) => (g.sede ? `${g.sede} (${elencoNomi(g.nomi, massimoPerSede)})` : elencoNomi(g.nomi, massimoPerSede))).join(" · ");
}

/** Quanti commerciali in tutto: serve a scegliere fra singolare e plurale ("conduce" / "conducono"). */
export function quantiCommerciali(commerciali: CommercialiDiSede[] | undefined): number {
  return (commerciali ?? []).reduce((somma, g) => somma + g.nomi.length, 0);
}
