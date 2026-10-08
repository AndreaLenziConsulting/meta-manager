import { randomBytes, scrypt, timingSafeEqual } from "crypto";

/**
 * Le password di consulenti e commerciali non si conservano: si conserva la loro impronta, da cui la
 * password non si può ricavare. Chi legge il database (o una sua copia) non impara le password.
 *
 * L'impronta è calcolata con scrypt (in Node, nessuna libreria esterna), con un sale diverso per
 * ogni password, e si porta dietro i parametri con cui è stata fatta:
 *
 *   scrypt$<N>$<r>$<p>$<sale in base64>$<impronta in base64>
 *
 * così i parametri si possono alzare in futuro senza invalidare le impronte già salvate.
 *
 * Passaggio dal vecchio sistema (08/10/2026): prima le password stavano scritte così com'erano.
 * `verificaPassword` accetta ancora un valore salvato in chiaro, in modo che l'accesso continui a
 * funzionare finché scripts/proteggi-password.ts non ha convertito tutto; `eImpronta` dice quali
 * valori sono già convertiti.
 *
 * Solo per il server: usa la crittografia di Node. Le regole su come deve essere fatta una password
 * nuova (lunghezza minima…) stanno in src/lib/impostazioni.ts, che serve anche al browser.
 */
const PREFISSO = "scrypt";
const N = 32768;
const R = 8;
const P = 1;
const BYTE_IMPRONTA = 32;
const BYTE_SALE = 16;

function calcola(password: string, sale: Buffer, n: number, r: number, p: number, lunghezza: number): Promise<Buffer> {
  return new Promise((ok, no) => {
    // maxmem: scrypt occupa circa 128·N·r byte; il tetto predefinito di Node (32 MB) è proprio al limite.
    scrypt(password.normalize("NFKC"), sale, lunghezza, { N: n, r, p, maxmem: 256 * n * r }, (errore, chiave) => (errore ? no(errore) : ok(chiave)));
  });
}

export function eImpronta(salvata: string): boolean {
  return salvata.startsWith(`${PREFISSO}$`);
}

export async function creaImpronta(password: string): Promise<string> {
  const sale = randomBytes(BYTE_SALE);
  const impronta = await calcola(password, sale, N, R, P, BYTE_IMPRONTA);
  return [PREFISSO, N, R, P, sale.toString("base64"), impronta.toString("base64")].join("$");
}

function ugualiATempoCostante(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Vero se `password` è quella a cui corrisponde il valore salvato. Un valore salvato vuoto non
 * corrisponde a nulla (nessuna password impostata = non si entra); un'impronta illeggibile nemmeno.
 */
export async function verificaPassword(password: string, salvata: string): Promise<boolean> {
  if (!password || !salvata) return false;
  if (!eImpronta(salvata)) return ugualiATempoCostante(Buffer.from(password), Buffer.from(salvata));

  const [, n, r, p, sale, attesa] = salvata.split("$");
  const parametri = [Number(n), Number(r), Number(p)];
  if (!sale || !attesa || parametri.some((v) => !Number.isInteger(v) || v <= 0)) return false;
  const attesaByte = Buffer.from(attesa, "base64");
  try {
    return ugualiATempoCostante(await calcola(password, Buffer.from(sale, "base64"), parametri[0], parametri[1], parametri[2], attesaByte.length), attesaByte);
  } catch {
    return false;
  }
}
