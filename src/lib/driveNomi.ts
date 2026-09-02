/**
 * Nomi di cartelle/file per l'integrazione Drive dell'hand-off commerciale (vedi drive.ts) —
 * separati in un file puro (nessuna chiamata di rete) per poterli testare senza mock di googleapis,
 * stesso spirito di ogni altra libreria pura in questo repo.
 */

const SUFFISSO = "COMMERCIALE ANDREA LENZI CONSULTING";

/** Cartella principale del prospect/cliente, dentro lo shared drive "COMMERCIALE ANDREA LENZI
 * CONSULTING" — es. "Mobilieri Bianchi | COMMERCIALE ANDREA LENZI CONSULTING". */
export function nomeCartellaPrincipale(ragioneSociale: string): string {
  return `${ragioneSociale.trim()} | ${SUFFISSO}`;
}

/** Sottocartella dove finiscono i PDF dei report chiamata — es. "Report chiamate | Mobilieri Bianchi". */
export function nomeCartellaReport(ragioneSociale: string): string {
  return `Report chiamate | ${ragioneSociale.trim()}`;
}

/**
 * Nome del PDF caricato per un singolo report — "/" nella data (formato GG/MM/AAAA) e in un
 * titolo eventuale vanno sanitizzati: Google Drive li accetta nel nome visualizzato, ma Drive
 * Desktop li sincronizza come veri file system dove "/" è un separatore di percorso, non un
 * carattere valido nel nome di un file.
 */
export function nomeFileReport(data: string, titolo?: string): string {
  const dataSlug = data.replace(/\//g, "-");
  const titoloSlug = titolo?.trim() ? ` - ${titolo.trim().replace(/\//g, "-")}` : "";
  return `Report chiamata ${dataSlug}${titoloSlug}.pdf`;
}

/** Estrae l'id cartella da un link Drive tipo "https://drive.google.com/drive/folders/<id>?...".
 * Ritorna null se il link non è nel formato atteso (es. incollato a mano, punta a un file non a
 * una cartella) — mai un crash, il chiamante ricade sulla creazione/ricerca via nome. */
export function idCartellaDaUrl(url: string): string | null {
  const match = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}
