import sharp from "sharp";

// Lato lungo massimo del logo restituito: il riquadro più grande in cui compare è di 88px, il triplo
// basta per gli schermi più densi.
const LATO_MASSIMO = 360;
// Sotto questa misura il rifilo ha tolto troppo (un logo quasi tutto dello stesso colore): si tiene l'originale.
const LATO_MINIMO = 12;

/**
 * Toglie a un logo i margini vuoti attorno al disegno e lo restituisce in PNG, a una misura adatta
 * allo schermo (richiesta dell'utente, 10/10/2026: rendere meglio i loghi, che spesso sono quadrati).
 *
 * Perché serve: molti loghi arrivano come un quadrato grande col disegno piccolo al centro (2048×2048
 * con metà del foglio vuota). Mostrato in un riquadro di 44px, il disegno restava un francobollo.
 * Rifilato, il disegno riempie il riquadro, quadrato o largo che sia.
 *
 * Il margine da togliere è quello del colore dell'angolo in alto a sinistra: trasparente, o il bianco
 * dei loghi senza trasparenza. Un logo che il programma non sa leggere fa fallire la funzione: chi
 * chiama mostra l'originale così com'è.
 */
export async function rifilaLogo(dati: Buffer): Promise<Buffer> {
  // `density`: un SVG viene disegnato abbastanza grande da restare nitido.
  const origine = () => sharp(dati, { density: 300, limitInputPixels: 60_000_000 });
  let rifilato: Buffer;
  try {
    const esito = await origine().trim({ threshold: 12 }).png().toBuffer({ resolveWithObject: true });
    rifilato = esito.info.width >= LATO_MINIMO && esito.info.height >= LATO_MINIMO ? esito.data : await origine().png().toBuffer();
  } catch {
    // Immagine di un solo colore, o niente da rifilare: resta com'è.
    rifilato = await origine().png().toBuffer();
  }
  return sharp(rifilato).resize({ width: LATO_MASSIMO, height: LATO_MASSIMO, fit: "inside", withoutEnlargement: true }).png().toBuffer();
}
