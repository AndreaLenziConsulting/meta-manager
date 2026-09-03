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
