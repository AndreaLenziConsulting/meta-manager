import type { GhlAppuntamento, GhlCalendario, GhlOpportunita } from "@/types/ghl";

/**
 * Client per l'API di Go High Level / Squadd — mirror strutturale di src/lib/meta.ts (funzioni
 * pure fetch* a livello di modulo, stesso stile di errore) ma senza forzare un helper di
 * paginazione condiviso: /calendars/events non risulta paginato (verificato con una chiamata
 * reale su ~2 anni di dati, mai comparsa una chiave oltre "events"/"traceId" anche con 49 eventi
 * in una risposta), /opportunities/search usa un cursore diverso (meta.startAfter/startAfterId)
 * da quello di Meta (paging.next) — due loop piccoli ed espliciti, non un'astrazione prematura.
 *
 * A differenza di META_ACCESS_TOKEN (un solo token di agenzia in env, valido per tutti i clienti
 * via Business Manager), qui token e locationId sono per-sede e arrivano sempre come parametri
 * (da GhlConnessione, src/types/ghl.ts) — mai da process.env.
 */

const GHL_API_BASE = "https://services.leadconnectorhq.com";
// Verificato con una chiamata reale contro un account vero — i valori suggeriti dalla
// documentazione pubblica di GoHighLevel sono in parte sbagliati, non fidarsi di quelli.
const GHL_API_VERSION = "2021-07-28";

function ghlHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Version: GHL_API_VERSION,
    Accept: "application/json",
  };
}

async function ghlGet<T>(path: string, token: string, params: Record<string, string>): Promise<T> {
  const url = new URL(GHL_API_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url, { headers: ghlHeaders(token) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GHL API error (${res.status}) su ${path}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** GET /calendars/ — elenco calendari di una location. */
export async function fetchCalendari(locationId: string, token: string): Promise<GhlCalendario[]> {
  const body = await ghlGet<{ calendars?: GhlCalendario[] }>("/calendars/", token, { locationId });
  return body.calendars ?? [];
}

/**
 * GET /calendars/events per un singolo calendario — locationId + calendarId + startTime/endTime
 * (epoch ms) sono tutti richiesti. Nessun endpoint "tutti gli appuntamenti della location": va
 * chiamato una volta per calendario.
 */
async function fetchAppuntamentiPerCalendario(
  locationId: string,
  token: string,
  calendarId: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<GhlAppuntamento[]> {
  const body = await ghlGet<{ events?: GhlAppuntamento[] }>("/calendars/events", token, {
    locationId,
    calendarId,
    startTime: String(startTimeMs),
    endTime: String(endTimeMs),
  });
  return body.events ?? [];
}

// startTime/endTime dell'API filtrano per QUANDO SI TIENE l'incontro, ma il periodo che interessa
// a riepilogoAppuntamenti è quando la prenotazione è stata FATTA (dateAdded) — le due date possono
// distare parecchio (prenotazione con largo anticipo, riprogrammazioni). Il margine sotto è una
// scelta pragmatica per evitare una query illimitata: cattura le prenotazioni fatte nel periodo
// richiesto anche se l'incontro si tiene fino a un anno prima/dopo, senza scaricare anni di dati.
const MARGINE_RICERCA_MS = 365 * 24 * 60 * 60 * 1000;

// Un calendario che fallisce (osservato dal vivo: un 401 "Command timed out" transitorio,
// sparito al tentativo successivo) non deve far fallire l'intero riepilogo — con 7 calendari
// configurati per sede, un solo blip lato GHL bloccherebbe l'intero pannello invece di limitarsi a
// quel calendario. Un retry immediato prima di arrendersi, poi si prosegue senza quel calendario
// (il chiamante riceve quanti sono falliti per poterlo segnalare, non lo nasconde).
async function fetchAppuntamentiPerCalendarioConRetry(
  locationId: string,
  token: string,
  calendarId: string,
  startTimeMs: number,
  endTimeMs: number
): Promise<GhlAppuntamento[] | null> {
  for (let tentativo = 1; tentativo <= 2; tentativo++) {
    try {
      return await fetchAppuntamentiPerCalendario(locationId, token, calendarId, startTimeMs, endTimeMs);
    } catch (err) {
      if (tentativo === 2) {
        console.warn(`[ghl] Calendario ${calendarId} non raggiungibile dopo 2 tentativi:`, err);
        return null;
      }
    }
  }
  return null;
}

/**
 * Recupera gli appuntamenti dei calendari indicati (scelta esplicita dell'admin — vedi
 * GhlConnessione.calendarIds — mai "tutti i calendari della location" in automatico: una location
 * porta spesso anche calendari "personal" di singoli consulenti che potrebbero non essere pagine
 * di prenotazione client-facing). Interroga l'API su una finestra più ampia di [startMs, endMs]
 * (vedi MARGINE_RICERCA_MS) perché il filtro vero per periodo lo fa riepilogoAppuntamenti su
 * dateAdded, non questa funzione.
 *
 * `calendariFalliti` conta i calendari rimasti irraggiungibili dopo il retry — il riepilogo che
 * torna è quindi parziale in quel caso, il chiamante lo segnala invece di mostrare un totale che
 * sembra completo ma non lo è.
 */
export async function fetchAppuntamenti(
  locationId: string,
  token: string,
  calendarIds: string[],
  startMs: number,
  endMs: number
): Promise<{ appuntamenti: GhlAppuntamento[]; calendariFalliti: number }> {
  if (calendarIds.length === 0) return { appuntamenti: [], calendariFalliti: 0 };
  const perCalendario = await Promise.all(
    calendarIds.map((id) =>
      fetchAppuntamentiPerCalendarioConRetry(locationId, token, id, startMs - MARGINE_RICERCA_MS, endMs + MARGINE_RICERCA_MS)
    )
  );
  const visti = new Set<string>();
  const risultato: GhlAppuntamento[] = [];
  let calendariFalliti = 0;
  for (const lista of perCalendario) {
    if (lista === null) {
      calendariFalliti++;
      continue;
    }
    for (const a of lista) {
      if (visti.has(a.id)) continue;
      visti.add(a.id);
      risultato.push(a);
    }
  }
  return { appuntamenti: risultato, calendariFalliti };
}

/**
 * GET /opportunities/search — due dettagli verificati con chiamate reali, non dai doc pubblici
 * (sbagliati su entrambi): il parametro è location_id in snake_case (non locationId), e
 * date/endDate vogliono epoch millisecondi come startTime/endTime di /calendars/events — una data
 * YYYY-MM-DD o un ISO datetime tornano entrambi 400 SEARCH_INVALID_START_DATE.
 *
 * Non espone qui un filtro data: verificato con una chiamata reale che date/endDate filtrano per
 * createdAt (data di CREAZIONE dell'opportunità), non per quando è stata vinta/persa — sbagliato
 * per "vendite del periodo" (una trattativa aperta mesi fa e chiusa questo mese andrebbe persa).
 * Il filtro per periodo si fa lato client su lastStatusChangeAt, vedi riepilogoOpportunita. `status`
 * resta un parametro server-side legittimo (non è un filtro data): passare "won" qui riduce
 * comunque il volume scaricato molto prima del filtro client-side.
 */
export async function fetchOpportunita(locationId: string, token: string, opts: { status?: string } = {}): Promise<GhlOpportunita[]> {
  const risultato: GhlOpportunita[] = [];
  let startAfter: string | undefined;
  let startAfterId: string | undefined;

  for (let pagina = 1; pagina <= 50; pagina++) {
    const params: Record<string, string> = { location_id: locationId, limit: "100" };
    if (opts.status) params.status = opts.status;
    if (startAfter) params.startAfter = startAfter;
    if (startAfterId) params.startAfterId = startAfterId;

    const body = await ghlGet<{
      opportunities?: GhlOpportunita[];
      meta?: { nextPage?: number; startAfter?: number; startAfterId?: string };
    }>("/opportunities/search", token, params);

    const opportunita = body.opportunities ?? [];
    risultato.push(...opportunita);

    const meta = body.meta;
    if (!meta?.nextPage || opportunita.length === 0) break;
    startAfter = meta.startAfter !== undefined ? String(meta.startAfter) : undefined;
    startAfterId = meta.startAfterId;
    if (!startAfter || !startAfterId) break;
  }

  return risultato;
}

/**
 * Riepilogo appuntamenti nel periodo [startMs, endMs] — filtrato su dateAdded (quando la
 * prenotazione è stata fatta), non su startTime (quando si tiene l'incontro): coerente con
 * appuntamentiFissati del Funnel esistente, un conteggio di attività del mese, non un'agenda
 * futura — vedi il commento su GhlAppuntamento.dateAdded.
 *
 * Deliberatamente "confermati"/"annullati", non "fissati"/"effettuati" come nel Funnel:
 * appointmentStatus nell'account di test porta solo "confirmed" e "cancelled" (mai "showed"/
 * "noshow"), quindi non è possibile derivare in modo affidabile una vera presenza confermata.
 * Riflettere questo onestamente invece di forzare la stessa etichettatura del Funnel è il motivo
 * per cui GhlRiepilogoResponse resta un tipo a parte da KpiGroup.
 */
export function riepilogoAppuntamenti(
  appuntamenti: GhlAppuntamento[],
  startMs: number,
  endMs: number
): { totali: number; confermati: number; annullati: number } {
  const nelPeriodo = appuntamenti.filter((a) => {
    if (a.deleted) return false;
    const t = new Date(a.dateAdded).getTime();
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
  return {
    totali: nelPeriodo.length,
    confermati: nelPeriodo.filter((a) => a.appointmentStatus === "confirmed").length,
    annullati: nelPeriodo.filter((a) => a.appointmentStatus === "cancelled").length,
  };
}

/**
 * Filtra le opportunità vinte il cui ultimo cambio di stato cade nel periodo [startMs, endMs] —
 * non per data di creazione, vedi il commento su fetchOpportunita. `opportunita` in ingresso è
 * già atteso pre-filtrato per status="won" (fetchOpportunita({ status: "won" })), ma il filtro
 * status resta anche qui per sicurezza in caso di riuso con un elenco non filtrato.
 */
export function riepilogoOpportunita(opportunita: GhlOpportunita[], startMs: number, endMs: number): { vendite: number; fatturato: number } {
  const vinte = opportunita.filter((o) => {
    if (o.status !== "won") return false;
    const t = new Date(o.lastStatusChangeAt).getTime();
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
  return {
    vendite: vinte.length,
    fatturato: vinte.reduce((somma, o) => somma + (o.monetaryValue || 0), 0),
  };
}
