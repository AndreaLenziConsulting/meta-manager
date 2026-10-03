// Due protezioni contro il limite di richieste di GHL — 100 richieste ogni 10 secondi per account
// (location), verificato dal vivo il 03/10/2026 dalle intestazioni x-ratelimit-* delle risposte.
//
// Il problema (segnalato dall'utente: "capitato spesso errore nella compilazione dei dati da GHL per
// Andrea Lenzi Consulting"): aprire la pagina KPI di un cliente lancia 4 richieste /api/ghl insieme
// (periodo, periodo precedente, Target mensili, venditori) e ognuna, per una sede con 7 calendari e
// 3 cluster, faceva circa 19 chiamate a GHL: 76 chiamate in meno di 5 secondi. Bastava ricaricare,
// cambiare periodo o mese entro 10 secondi — o avere due persone sulla stessa pagina — per superare
// le 100 e ricevere "429 Too Many Requests", che faceva fallire l'intera risposta ("Dati GHL non
// disponibili") o, peggio, scartava in silenzio alcuni calendari (conteggio appuntamenti parziale).
//
// 1. richiestaGhlConRiprova: un 429 non è un errore, è "aspetta": si attende e si riprova.
// 2. conCacheGhl: le stesse identiche letture fatte da richieste contemporanee (tutte le opportunità
//    della location, i contatti di un tag...) vengono fatte una volta sola e condivise per un minuto.

const INTERVALLO_LIMITE_PREDEFINITO_MS = 10_000;
/** 1 tentativo + 4 riprove: attese di 1/4, 2/4, 3/4 e 4/4 dell'intervallo (2,5 + 5 + 7,5 + 10 = 25
 * secondi in tutto con l'intervallo di 10 secondi) — abbastanza da attraversare con certezza almeno
 * due finestre del limite, e ben dentro i 90 secondi concessi a /api/ghl. */
const TENTATIVI_MASSIMI = 5;

/** Per account (chiave = token): fino a quando nessuna chiamata deve partire. Condivisa fra tutte le
 * chiamate in corso nello stesso processo, così dopo un 429 non riprovano una alla volta ma
 * aspettano tutte la stessa scadenza. Fra istanze serverless diverse non è condivisa: lì ogni
 * istanza scopre il limite dal proprio 429, e la riprova funziona comunque. */
const pausaFinoA = new Map<string, number>();

export type OpzioniRichiestaGhl = {
  /** Iniettabili per i test: attesa e orologio. */
  dormi?: (ms: number) => Promise<void>;
  adesso?: () => number;
  tentativiMassimi?: number;
};

/**
 * Esegue una chiamata a GHL e, se GHL risponde 429 (troppe richieste), aspetta e riprova. Torna la
 * prima risposta che non è un 429 — qualunque altra risposta, anche di errore, passa al chiamante
 * così com'è — oppure l'ultimo 429 se dopo tutte le riprove il limite è ancora superato.
 */
export async function richiestaGhlConRiprova(
  chiave: string,
  esegui: () => Promise<Response>,
  opzioni: OpzioniRichiestaGhl = {}
): Promise<Response> {
  const dormi = opzioni.dormi ?? ((ms: number) => new Promise<void>((risolvi) => setTimeout(risolvi, ms)));
  const adesso = opzioni.adesso ?? Date.now;
  const massimi = opzioni.tentativiMassimi ?? TENTATIVI_MASSIMI;

  for (let tentativo = 1; ; tentativo++) {
    const attesa = (pausaFinoA.get(chiave) ?? 0) - adesso();
    if (attesa > 0) await dormi(attesa);

    const res = await esegui();
    if (res.status !== 429 || tentativo >= massimi) return res;

    // Risposta scartata: va chiusa, altrimenti la connessione resta impegnata fino al timeout.
    await res.body?.cancel().catch(() => undefined);
    const intervallo = Number(res.headers.get("x-ratelimit-interval-milliseconds")) || INTERVALLO_LIMITE_PREDEFINITO_MS;
    const ripresa = adesso() + (intervallo / 4) * tentativo;
    pausaFinoA.set(chiave, Math.max(pausaFinoA.get(chiave) ?? 0, ripresa));
  }
}

const CACHE_TTL_MS = 60_000;
const VOCI_MASSIME = 300;
const cache = new Map<string, { scadenza: number; valore: Promise<unknown> }>();

/**
 * Condivide per un minuto il risultato di una lettura GHL fra tutti i chiamanti con la stessa
 * `chiave`, comprese le richieste ancora in corso (si conserva la promessa, non il valore: due
 * richieste partite insieme fanno UNA sola chiamata a GHL). Una lettura fallita non resta in cache:
 * il chiamante successivo riprova. Un minuto di ritardo sui dati GHL è lo stesso ordine dei 30
 * secondi già in uso per il foglio Google (sheets.ts). Il valore è condiviso: chi lo riceve non deve
 * modificarlo sul posto.
 */
export function conCacheGhl<T>(chiave: string, carica: () => Promise<T>, adesso: () => number = Date.now): Promise<T> {
  const ora = adesso();
  const voce = cache.get(chiave);
  if (voce && voce.scadenza > ora) return voce.valore as Promise<T>;

  if (cache.size >= VOCI_MASSIME) {
    for (const [k, v] of cache) if (v.scadenza <= ora) cache.delete(k);
  }
  const valore = carica();
  cache.set(chiave, { scadenza: ora + CACHE_TTL_MS, valore });
  valore.catch(() => {
    if (cache.get(chiave)?.valore === valore) cache.delete(chiave);
  });
  return valore;
}
