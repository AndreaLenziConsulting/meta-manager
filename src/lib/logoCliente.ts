/**
 * Indirizzo da cui l'app mostra il logo di un cliente: non più quello del suo sito, ma `/api/logo`,
 * che lo scarica, gli toglie i margini vuoti e lo restituisce (vedi src/lib/logoRifilato.ts e
 * src/app/api/logo/route.ts). Qui solo la composizione dell'indirizzo, senza nulla del server: lo
 * usano anche i componenti che girano nel browser.
 */

/** Impronta breve di un testo: cambia quando cambia l'indirizzo del logo, così il browser non tiene il vecchio. */
function impronta(testo: string): string {
  let h = 5381;
  for (let i = 0; i < testo.length; i++) h = ((h << 5) + h + testo.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

/**
 * `clienteId` per l'area del team (serve la sessione), `code` per il link pubblico del cliente.
 * `undefined` se il cliente non ha un logo: chi chiama mostra il solo nome.
 */
export function indirizzoLogo(chi: { clienteId: string } | { code: string }, logoUrl: string | undefined): string | undefined {
  if (!logoUrl) return undefined;
  const parametro = "code" in chi ? `code=${encodeURIComponent(chi.code)}` : `clienteId=${encodeURIComponent(chi.clienteId)}`;
  return `/api/logo?${parametro}&v=${impronta(logoUrl)}`;
}

/**
 * Vero se l'indirizzo è un sito raggiungibile da fuori: il server scarica solo da lì. Un indirizzo
 * della rete interna (o non http) non viene mai richiesto dal server, qualunque cosa ci sia scritto
 * nel campo del logo.
 */
export function indirizzoPubblico(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) return false;
  if (host.includes(":")) return false; // IPv6 letterale
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (ip) {
    const [a, b] = [Number(ip[1]), Number(ip[2])];
    if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) return false;
  }
  return true;
}
