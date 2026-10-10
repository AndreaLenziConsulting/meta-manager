/**
 * Manipolazione di colori hex #RRGGBB — usata per derivare le varianti "dark"/"light" di un
 * colore di brand cliente (vedi temaCliente.ts) dalle sole 2 tinte che un cliente fornisce
 * (primario + secondario), stesso numero di varianti del brand ALC in globals.css (primary/dark/
 * light) ma calcolate invece che scelte a mano una per una.
 */

const HEX_VALIDO = /^#[0-9a-fA-F]{6}$/;

export function isHexValido(hex: string): boolean {
  return HEX_VALIDO.test(hex);
}

function hexInRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbInHex([r, g, b]: [number, number, number]): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
}

/** Mescola `hex` con un colore neutro (bianco o nero) di una frazione 0-1 (0 = hex invariato,
 * 1 = tutto il colore neutro). Usata sia per scurire (verso nero) sia per schiarire (verso bianco). */
function mescola(hex: string, frazioneNeutro: number, neutro: [number, number, number]): string {
  const [r, g, b] = hexInRgb(hex);
  const f = Math.max(0, Math.min(1, frazioneNeutro));
  return rgbInHex([r + (neutro[0] - r) * f, g + (neutro[1] - g) * f, b + (neutro[2] - b) * f]);
}

/** Verso il nero — variante "dark" di un colore di brand. */
export function scurisci(hex: string, frazione: number): string {
  return mescola(hex, frazione, [0, 0, 0]);
}

/** Verso il bianco — tinta leggera per sfondi ("chip"/box informativi), variante "light". */
export function schiarisci(hex: string, frazione: number): string {
  return mescola(hex, frazione, [255, 255, 255]);
}

/** Mescola due colori: 0 = tutto `a`, 1 = tutto `b`. */
export function mescolaColori(a: string, b: string, frazione: number): string {
  return mescola(a, frazione, hexInRgb(b));
}

/** Il colore come `rgba(r,g,b,alfa)`: serve a ombre e bagliori, che sono tinte trasparenti. */
export function rgba(hex: string, alfa: number): string {
  const [r, g, b] = hexInRgb(hex);
  return `rgba(${r},${g},${b},${alfa})`;
}

/** Luminanza relativa (WCAG 2): 0 = nero, 1 = bianco. */
export function luminanza(hex: string): number {
  const lineare = hexInRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lineare[0] + 0.7152 * lineare[1] + 0.0722 * lineare[2];
}

/** Rapporto di contrasto WCAG fra due colori, da 1 (uguali) a 21 (nero su bianco). */
export function contrasto(a: string, b: string): number {
  const la = luminanza(a);
  const lb = luminanza(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Il colore più vicino a `colore` che raggiunge almeno `minimo` di contrasto su `fondo`, cercato
 * mescolandolo un po' alla volta con `verso` (di solito nero, per un testo su fondo chiaro; bianco,
 * per un testo su fondo scuro). Se `colore` ci arriva già, torna invariato; se non ci arriva nemmeno
 * `verso`, torna `verso`.
 */
export function conContrasto(colore: string, fondo: string, minimo: number, verso: string): string {
  if (contrasto(colore, fondo) >= minimo) return colore;
  if (contrasto(verso, fondo) < minimo) return verso;
  let basso = 0;
  let alto = 1;
  for (let i = 0; i < 20; i++) {
    const mezzo = (basso + alto) / 2;
    if (contrasto(mescolaColori(colore, verso, mezzo), fondo) >= minimo) alto = mezzo;
    else basso = mezzo;
  }
  return mescolaColori(colore, verso, alto);
}

/**
 * La tinta più CHIARA di `colore` (mescolato col bianco) che tiene ancora almeno `minimo` di contrasto
 * sul bianco: così si ricavano i grigi di testo e di bordo da un colore scuro di marca.
 */
export function tintaConContrasto(colore: string, minimo: number): string {
  const BIANCO = "#ffffff";
  if (contrasto(colore, BIANCO) <= minimo) return colore;
  let basso = 0; // tutto colore: contrasto sufficiente
  let alto = 1; // tutto bianco: contrasto 1
  for (let i = 0; i < 20; i++) {
    const mezzo = (basso + alto) / 2;
    if (contrasto(mescolaColori(colore, BIANCO, mezzo), BIANCO) >= minimo) basso = mezzo;
    else alto = mezzo;
  }
  return mescolaColori(colore, BIANCO, basso);
}
