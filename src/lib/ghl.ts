import { settimanaDiData } from "@/lib/kpi";
import { conCacheGhl, richiestaGhlConRiprova } from "@/lib/ghlRichieste";
import type { GhlAppuntamento, GhlBreakdownCampagna, GhlBreakdownTag, GhlCalendario, GhlOpportunita, GhlPipeline, GhlSettimanaVenditore, PerimetroVenditori } from "@/types/ghl";

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
  const res = await richiestaGhlConRiprova(token, () => fetch(url, { headers: ghlHeaders(token) }));
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GHL API error (${res.status}) su ${path}: ${body.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/** Come ghlGet, ma per gli endpoint POST-come-query di GHL (es. /contacts/search — filtri
 * strutturati nel body, non nella querystring: unico endpoint qui a richiederlo). */
async function ghlPost<T>(path: string, token: string, body: unknown): Promise<T> {
  const res = await richiestaGhlConRiprova(token, () =>
    fetch(GHL_API_BASE + path, {
      method: "POST",
      headers: { ...ghlHeaders(token), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  if (!res.ok) {
    const testo = await res.text().catch(() => "");
    throw new Error(`GHL API error (${res.status}) su ${path}: ${testo.slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

/**
 * GET /opportunities/pipelines — le pipeline di una location, ognuna con i suoi stadi nell'ordine in
 * cui GHL li mostra (`position`, verificato con una chiamata reale l'08/10/2026). Una pipeline senza
 * stadi in risposta torna con l'elenco vuoto.
 */
export async function fetchPipeline(locationId: string, token: string): Promise<Required<GhlPipeline>[]> {
  const body = await ghlGet<{ pipelines?: { id: string; name: string; stages?: { id: string; name: string; position?: number }[] }[] }>(
    "/opportunities/pipelines",
    token,
    { locationId }
  );
  return (body.pipelines ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    stadi: (p.stages ?? []).map((st, i) => ({ id: st.id, name: st.name, position: st.position ?? i })).sort((a, b) => a.position - b.position),
  }));
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
  // Condiviso per un minuto fra richieste con la stessa finestra (vedi conCacheGhl): "Target
  // mensili" e "venditori" chiedono lo stesso mese nello stesso momento, e così ogni ricarica.
  return conCacheGhl(`eventi|${locationId}|${calendarId}|${startTimeMs}|${endTimeMs}`, async () => {
    const body = await ghlGet<{ events?: GhlAppuntamento[] }>("/calendars/events", token, {
      locationId,
      calendarId,
      startTime: String(startTimeMs),
      endTime: String(endTimeMs),
    });
    return body.events ?? [];
  });
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
 * Riduce la lista al PRIMO appuntamento per contatto (startTime più basso) — un lead che riprenota
 * (rinvio, consulenza di follow-up, secondo giro di vendita) non deve gonfiare il conteggio
 * "appuntamenti generati dal marketing": solo il primo vero contatto commerciale conta, decisione
 * esplicita dell'utente (08/09/2026). Applicata SEMPRE prima di riepilogoAppuntamenti/
 * appuntamentiGhlPerSettimana/breakdownGhlPerCampagna — non un filtro opzionale, corregge una
 * sovrastima esistente. `deleted` escluso a monte, stessa regola di riepilogoAppuntamenti.
 *
 * Limite onesto: "primo" è relativo alla finestra scaricata da fetchAppuntamenti (±1 anno oltre il
 * periodo richiesto, vedi MARGINE_RICERCA_MS) — un contatto il cui vero primo appuntamento è più
 * vecchio di un anno rispetto a quella finestra non è visibile qui, stesso compromesso pragmatico
 * già scelto per MARGINE_RICERCA_MS (evitare una query illimitata).
 */
export function primoAppuntamentoPerContatto(appuntamenti: GhlAppuntamento[]): GhlAppuntamento[] {
  const primoPer = new Map<string, GhlAppuntamento>();
  for (const a of appuntamenti) {
    if (a.deleted) continue;
    const esistente = primoPer.get(a.contactId);
    if (!esistente || new Date(a.startTime).getTime() < new Date(esistente.startTime).getTime()) {
      primoPer.set(a.contactId, a);
    }
  }
  return Array.from(primoPer.values());
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
export function fetchOpportunita(locationId: string, token: string, opts: { status?: string } = {}): Promise<GhlOpportunita[]> {
  // La lettura più pesante (tutte le opportunità della location, una pagina ogni 100) ed è identica
  // per ogni periodo richiesto: le 4 richieste /api/ghl di una pagina la condividono (conCacheGhl).
  return conCacheGhl(`opportunita|${locationId}|${opts.status ?? ""}`, () => scaricaOpportunita(locationId, token, opts));
}

async function scaricaOpportunita(locationId: string, token: string, opts: { status?: string }): Promise<GhlOpportunita[]> {
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
 * Id di campagna Meta (stesso formato di Campagna.campaignId) dal PRIMO touchpoint pubblicitario
 * di un'opportunità GHL — verificato con chiamate reali su 3 account: il numero arriva in punti
 * diversi secondo come il cliente porta il traffico Meta dentro GHL (vedi GhlAttribuzione in
 * types/ghl.ts). Non fidarsi di un solo campo: si provano `utmCampaignId` poi `utmCampaign` in
 * ordine, si accetta solo un valore puramente numerico (un id Meta reale, mai un nome di campagna
 * testuale finito per errore in utmCampaign). Torna null se nessuno dei due risolve — traffico non
 * da Meta o non tracciato (organico, referral, form senza UTM), mai un dato inventato.
 */
export function estraiCampaignIdAttribuzione(o: GhlOpportunita): string | null {
  const touchpoint = o.attributions?.find((a) => a.isFirst) ?? o.attributions?.[0];
  if (!touchpoint) return null;
  for (const candidato of [touchpoint.utmCampaignId, touchpoint.utmCampaign]) {
    if (candidato && /^\d+$/.test(candidato)) return candidato;
  }
  return null;
}

/**
 * Per ogni contatto con almeno un'opportunità attribuibile a una campagna Meta, la campagna del
 * SUO primo contatto commerciale in assoluto (l'opportunità con `createdAt` più basso fra quelle
 * risolvibili) — un contatto con più opportunità nel tempo (nuova trattativa, riacquisto) resta
 * legato alla campagna che l'ha generato la prima volta, stessa filosofia "primo touch" di
 * primoAppuntamentoPerContatto sopra. Usata per attribuire gli APPUNTAMENTI a una campagna: un
 * appuntamento non porta attribuzione propria, solo `contactId` — il collegamento passa sempre da
 * qui (join contatto->opportunità->attributions).
 */
export function mappaCampagnaPerContatto(opportunita: GhlOpportunita[]): Map<string, string> {
  const mappa = new Map<string, string>();
  for (const [contactId, o] of primaOpportunitaAttribuitaPerContatto(opportunita)) {
    const campaignId = estraiCampaignIdAttribuzione(o);
    if (campaignId) mappa.set(contactId, campaignId);
  }
  return mappa;
}

/**
 * Per ogni contatto, la sua PRIMA opportunità (createdAt più basso) fra quelle con una campagna
 * Meta risolvibile — l'unica fonte di attribuzione del contatto, condivisa da
 * mappaCampagnaPerContatto sopra e mappaInserzionePerContatto sotto: campagna e inserzione di un
 * contatto vengono SEMPRE dalla stessa opportunità, così un'inserzione non può mai risultare
 * attribuita a un contatto la cui campagna è un'altra.
 */
function primaOpportunitaAttribuitaPerContatto(opportunita: GhlOpportunita[]): Map<string, GhlOpportunita> {
  const primaPer = new Map<string, GhlOpportunita>();
  for (const o of opportunita) {
    if (estraiCampaignIdAttribuzione(o) === null) continue;
    const esistente = primaPer.get(o.contactId);
    if (!esistente || new Date(o.createdAt).getTime() < new Date(esistente.createdAt).getTime()) {
      primaPer.set(o.contactId, o);
    }
  }
  return primaPer;
}

/**
 * Id dell'INSERZIONE Meta (ad) dal primo touchpoint di un'opportunità GHL — stesso touchpoint di
 * estraiCampaignIdAttribuzione sopra, due campi provati in ordine (vedi GhlAttribuzione in
 * types/ghl.ts): `utmAdId` (form Lead Ads nativo) poi `utmContent` (sito con `utm_content=
 * {{ad.id}}`). Si accetta solo un numero di almeno 10 cifre — un id Meta reale ne ha 15-18:
 * `utmContent` nel pattern Lead Ads porta il NOME dell'inserzione, e un nome fatto di sole poche
 * cifre (es. "2024") non deve mai passare per un id. null se non risolvibile, mai un match per nome.
 */
export function estraiAdIdAttribuzione(o: GhlOpportunita): string | null {
  const touchpoint = o.attributions?.find((a) => a.isFirst) ?? o.attributions?.[0];
  if (!touchpoint) return null;
  for (const candidato of [touchpoint.utmAdId, touchpoint.utmContent]) {
    if (candidato && /^\d{10,}$/.test(candidato)) return candidato;
  }
  return null;
}

/**
 * Come mappaCampagnaPerContatto, ma verso l'INSERZIONE: per ogni contatto, l'inserzione della
 * stessa opportunità che ne decide la campagna (primaOpportunitaAttribuitaPerContatto). Un contatto
 * con campagna risolvibile ma senza id inserzione (lead più vecchi del form Lead Ads, vedi
 * GhlAttribuzione) resta fuori da questa mappa — sottoinsieme di mappaCampagnaPerContatto, mai un
 * contatto in più.
 */
export function mappaInserzionePerContatto(opportunita: GhlOpportunita[]): Map<string, string> {
  const mappa = new Map<string, string>();
  for (const [contactId, o] of primaOpportunitaAttribuitaPerContatto(opportunita)) {
    const adId = estraiAdIdAttribuzione(o);
    if (adId) mappa.set(contactId, adId);
  }
  return mappa;
}

/**
 * Riepilogo appuntamenti nel periodo [startMs, endMs] — filtrato su dateAdded (quando la
 * prenotazione è stata fatta), non su startTime (quando si tiene l'incontro): coerente con
 * appuntamentiFissati di RisultatiCommerciali esistente, un conteggio di attività del mese, non un'agenda
 * futura — vedi il commento su GhlAppuntamento.dateAdded.
 *
 * `effettuati` — standard operativo deciso dall'utente (27/08/2026), non un vero segnale di
 * presenza da GHL: appointmentStatus nell'account porta solo "confirmed"/"cancelled" (mai
 * "showed"/"noshow"), quindi GHL da solo non sa se il cliente si è presentato davvero. La regola
 * concordata per i commerciali è: un appuntamento con data dell'incontro (startTime, non
 * dateAdded) già passata e MAI annullato attivamente conta come effettuato — chi non si presenta
 * va annullato a mano, altrimenti resta conteggiato come avvenuto. `oraAttualeMs` è un parametro
 * (default Date.now()) solo per rendere la funzione testabile senza dipendere dall'orologio reale.
 */
export function riepilogoAppuntamenti(
  appuntamenti: GhlAppuntamento[],
  startMs: number,
  endMs: number,
  oraAttualeMs: number = Date.now()
): { totali: number; confermati: number; annullati: number; effettuati: number } {
  const nelPeriodo = appuntamenti.filter((a) => {
    if (a.deleted) return false;
    const t = new Date(a.dateAdded).getTime();
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  });
  return {
    totali: nelPeriodo.length,
    confermati: nelPeriodo.filter((a) => a.appointmentStatus === "confirmed").length,
    annullati: nelPeriodo.filter((a) => a.appointmentStatus === "cancelled").length,
    effettuati: nelPeriodo.filter(
      (a) => a.appointmentStatus !== "cancelled" && new Date(a.startTime).getTime() < oraAttualeMs
    ).length,
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

/**
 * Come riepilogoOpportunita, ma fatturato e conteggio vendite sono raggruppati per settimana
 * (lunedì di lastStatusChangeAt, stessa chiave di trendSettimanale in kpi.ts) invece che sommati in
 * un unico totale — alimenta il grafico "Investimento vs Fatturato" (fatturato) e "Saldo netto
 * cumulato" (fatturato + vendite) del tab KPI (vedi kpiGhlOverlay.ts/TrendChart.tsx). `vendite` è
 * additivo rispetto alla versione precedente di questa funzione (prima solo fatturato): stesso giro
 * sui dati, un solo contatore in più — niente di nuovo da scaricare né una seconda funzione quasi
 * identica da mantenere in parallelo.
 *
 * A differenza di riepilogoOpportunita, il filtro effettivo NON è [startMs, endMs] alla lettera:
 * si allarga al lunedì della prima settimana e alla domenica dell'ultima settimana coperte da quel
 * range — le settimane di bordo del grafico (che quasi mai iniziano/finiscono esattamente a
 * inizio/fine mese) devono mostrare il fatturato reale dell'intera settimana, non solo dei giorni
 * dentro il mese richiesto. route.ts continua a passare lo stesso startMs/endMs calendario-mese di
 * sempre (identico a quello usato per la griglia di settimane in kpi.ts): l'allargamento qui
 * dentro combacia esattamente con quella griglia, nessuna settimana di bordo scoperta. Nessuna
 * chiamata API in più: usa la stessa lista `opportunita` (l'intera location, già scaricata da
 * fetchOpportunita) già passata a riepilogoOpportunita.
 */
export function fatturatoGhlPerSettimana(
  opportunita: GhlOpportunita[],
  startMs: number,
  endMs: number
): { settimana: string; fatturato: number; vendite: number }[] {
  const inizioSettimana = settimanaDiData(new Date(startMs).toISOString().slice(0, 10));
  const fineSettimana = settimanaDiData(new Date(endMs).toISOString().slice(0, 10));
  const inizioMs = new Date(`${inizioSettimana}T00:00:00Z`).getTime();
  const fineMs = new Date(`${fineSettimana}T00:00:00Z`).getTime() + 7 * 86400000 - 1; // fine della domenica di quella settimana

  const perSettimana = new Map<string, { fatturato: number; vendite: number }>();
  for (const o of opportunita) {
    if (o.status !== "won") continue;
    const t = new Date(o.lastStatusChangeAt).getTime();
    if (!Number.isFinite(t) || t < inizioMs || t > fineMs) continue;
    const settimana = settimanaDiData(o.lastStatusChangeAt.slice(0, 10));
    const entry = perSettimana.get(settimana) ?? { fatturato: 0, vendite: 0 };
    entry.fatturato += o.monetaryValue || 0;
    entry.vendite += 1;
    perSettimana.set(settimana, entry);
  }
  return Array.from(perSettimana.entries())
    .map(([settimana, v]) => ({ settimana, ...v }))
    .sort((a, b) => a.settimana.localeCompare(b.settimana));
}

/**
 * Come fatturatoGhlPerSettimana sopra, ma per gli appuntamenti (fissati/effettuati) invece delle
 * opportunità vinte — alimenta il grafico "Andamento appuntamenti" (blocco 6d). Stessa griglia
 * settimanale allargata ai bordi, stesso raggruppamento per settimana di `dateAdded` (quando la
 * prenotazione è stata fatta, non quando si tiene l'incontro — coerente con riepilogoAppuntamenti
 * sopra) e stessa regola "effettuato" (incontro passato e mai annullato). Nessuna chiamata API in
 * più: usa la stessa lista `appuntamenti` già scaricata da fetchAppuntamenti.
 */
export function appuntamentiGhlPerSettimana(
  appuntamenti: GhlAppuntamento[],
  startMs: number,
  endMs: number,
  oraAttualeMs: number = Date.now()
): { settimana: string; fissati: number; effettuati: number }[] {
  const inizioSettimana = settimanaDiData(new Date(startMs).toISOString().slice(0, 10));
  const fineSettimana = settimanaDiData(new Date(endMs).toISOString().slice(0, 10));
  const inizioMs = new Date(`${inizioSettimana}T00:00:00Z`).getTime();
  const fineMs = new Date(`${fineSettimana}T00:00:00Z`).getTime() + 7 * 86400000 - 1;

  const perSettimana = new Map<string, { fissati: number; effettuati: number }>();
  for (const a of appuntamenti) {
    if (a.deleted) continue;
    const t = new Date(a.dateAdded).getTime();
    if (!Number.isFinite(t) || t < inizioMs || t > fineMs) continue;
    const settimana = settimanaDiData(a.dateAdded.slice(0, 10));
    const entry = perSettimana.get(settimana) ?? { fissati: 0, effettuati: 0 };
    entry.fissati += 1;
    if (a.appointmentStatus !== "cancelled" && new Date(a.startTime).getTime() < oraAttualeMs) entry.effettuati += 1;
    perSettimana.set(settimana, entry);
  }
  return Array.from(perSettimana.entries())
    .map(([settimana, v]) => ({ settimana, ...v }))
    .sort((a, b) => a.settimana.localeCompare(b.settimana));
}

/**
 * Riepilogo appuntamenti/opportunità per singola campagna Meta reale (blocco 7, tabella Dettaglio
 * "per singola campagna") — join `contactId` -> campagna via `mappaCampagna` (vedi
 * mappaCampagnaPerContatto sopra): un appuntamento non porta attribuzione propria, un'opportunità
 * la porterebbe anche da sola (estraiCampaignIdAttribuzione) ma qui si usa sempre la mappa per
 * CONTATTO, non l'attribuzione della singola opportunità — stessa filosofia "primo touch" ovunque:
 * tutte le opportunità/appuntamenti dello stesso contatto restano legati alla campagna che l'ha
 * generato la prima volta, anche se una trattativa successiva porta un'attribuzione diversa.
 *
 * `appuntamentiPrimi` è atteso già ridotto con primoAppuntamentoPerContatto, `opportunitaVinte`
 * già filtrato a status="won" — questa funzione non applica di nuovo quei filtri, solo il
 * raggruppamento per campagna. Solo le campagne con almeno un contatto attribuito compaiono nella
 * mappa risultato: l'assenza di una chiave è "nessun dato", non un implicito zero.
 */
export function breakdownGhlPerCampagna(
  appuntamentiPrimi: GhlAppuntamento[],
  opportunitaVinte: GhlOpportunita[],
  mappaCampagna: Map<string, string>,
  startMs: number,
  endMs: number,
  oraAttualeMs: number = Date.now()
): Record<string, GhlBreakdownCampagna> {
  const campagne = new Set(mappaCampagna.values());
  const risultato: Record<string, GhlBreakdownCampagna> = {};
  for (const campaignId of campagne) {
    const appuntamentiCampagna = appuntamentiPrimi.filter((a) => mappaCampagna.get(a.contactId) === campaignId);
    const opportunitaCampagna = opportunitaVinte.filter((o) => mappaCampagna.get(o.contactId) === campaignId);
    risultato[campaignId] = {
      appuntamenti: riepilogoAppuntamenti(appuntamentiCampagna, startMs, endMs, oraAttualeMs),
      opportunita: riepilogoOpportunita(opportunitaCampagna, startMs, endMs),
    };
  }
  return risultato;
}

/**
 * Riepilogo appuntamenti/opportunità per singola INSERZIONE Meta (vista "Per singola inserzione"
 * della tabella Dettaglio, 01/10/2026) — stesso identico raggruppamento di breakdownGhlPerCampagna,
 * la chiave di join è solo un'altra mappa contatto->chiave (mappaInserzionePerContatto). Un nome
 * distinto per leggibilità ai punti di chiamata, non una seconda implementazione.
 */
export function breakdownGhlPerInserzione(
  appuntamentiPrimi: GhlAppuntamento[],
  opportunitaVinte: GhlOpportunita[],
  mappaInserzione: Map<string, string>,
  startMs: number,
  endMs: number,
  oraAttualeMs: number = Date.now()
): Record<string, GhlBreakdownCampagna> {
  return breakdownGhlPerCampagna(appuntamentiPrimi, opportunitaVinte, mappaInserzione, startMs, endMs, oraAttualeMs);
}

/**
 * GET (POST) /contacts/search filtrato per tag — Fase 3 categorie commerciali (11/2026): questo
 * account divide i contatti in cluster tramite tag GHL (es. "mobilieri - cluster a (<500k)"),
 * verificato con chiamate reali su un account vero. Endpoint nativo di ricerca per tag (filters:
 * [{field:"tags", operator:"contains", value:tag}]) — MAI un fetch-tutti-i-contatti-e-filtra
 * client-side, una location può averne migliaia. Paginazione a `page` (1-based) + `pageLimit`,
 * verificata dal vivo (pagine successive senza sovrapposizioni) — diversa dal cursore
 * startAfter/startAfterId di fetchOpportunita sopra, un endpoint GHL diverso con contratto diverso.
 * Ritorna solo id + dateAdded: il minimo che serve a riepilogoPerTag sotto (il join con
 * appuntamenti/opportunità passa per id, "richieste" del periodo passa per dateAdded).
 */
export function fetchContattiPerTag(locationId: string, token: string, tag: string): Promise<{ id: string; dateAdded: string }[]> {
  // Indipendente dal periodo, come fetchOpportunita: condivisa fra richieste contemporanee.
  return conCacheGhl(`contatti-tag|${locationId}|${tag}`, () => scaricaContattiPerTag(locationId, token, tag));
}

async function scaricaContattiPerTag(locationId: string, token: string, tag: string): Promise<{ id: string; dateAdded: string }[]> {
  const risultato: { id: string; dateAdded: string }[] = [];
  const PAGE_LIMIT = 100;
  for (let page = 1; page <= 50; page++) {
    const body = await ghlPost<{ contacts?: { id: string; dateAdded: string }[] }>("/contacts/search", token, {
      locationId,
      page,
      pageLimit: PAGE_LIMIT,
      filters: [{ field: "tags", operator: "contains", value: tag }],
    });
    const contatti = body.contacts ?? [];
    risultato.push(...contatti.map((c) => ({ id: c.id, dateAdded: c.dateAdded })));
    if (contatti.length < PAGE_LIMIT) break;
  }
  return risultato;
}

/**
 * Conteggio dei contatti creati in [startMs, endMs] che non hanno NESSUNO dei tag passati — le
 * "richieste" del blocco "Senza cluster" (segnalato dall'utente, 20/09/2026: i lead più recenti a
 * volte arrivano senza ancora un tag cluster assegnato). UNA sola chiamata: /contacts/search con un
 * `not_contains` per tag (in AND tra loro) + filtro `dateAdded` a intervallo, pageLimit 1, e si
 * legge `total` dalla risposta — entrambi verificati con una chiamata reale (27/09/2026).
 *
 * Sostituisce la paginazione dell'intera location di prima (fetchContattiSenzaTag, senza filtro
 * di data): su questo account un import massivo di ~3.800 contatti senza tag (23/09/2026) faceva
 * sbattere quel giro contro il tetto di 50 pagine e portava /api/ghl a ~40s — oltre il timeout in
 * produzione, dashboard a zero e avviso "risultati non compilati" falso positivo (bug segnalato).
 * Appuntamenti/opportunità "senza cluster" non passano più da qui: sono il complemento locale dei
 * contatti già taggati, vedi riepilogoSenzaTag sotto — un contatto vecchio mai taggato con un
 * appuntamento nuovo nel periodo resta contato lì, senza dover scaricare la location.
 */
export function contaContattiSenzaTagNelPeriodo(
  locationId: string,
  token: string,
  tags: string[],
  startMs: number,
  endMs: number
): Promise<number> {
  return conCacheGhl(`senza-tag|${locationId}|${tags.join("|")}|${startMs}|${endMs}`, async () => {
    const body = await ghlPost<{ total?: number }>("/contacts/search", token, {
      locationId,
      page: 1,
      pageLimit: 1,
      filters: [
        ...tags.map((tag) => ({ field: "tags", operator: "not_contains", value: tag })),
        { field: "dateAdded", operator: "range", value: { gte: new Date(startMs).toISOString(), lte: new Date(endMs).toISOString() } },
      ],
    });
    return body.total ?? 0;
  });
}

/**
 * Riepilogo "senza cluster": complemento di riepilogoPerTag sotto — appuntamenti/opportunità dei
 * contatti che NON stanno in nessun set taggato (`idTaggati` = unione dei contatti di
 * fetchContattiPerTag di ogni categoria), più le `richieste` già contate da
 * contaContattiSenzaTagNelPeriodo. Nessuna chiamata GHL: `appuntamentiPrimi`/`opportunitaVinte`
 * sono già scaricati per tutta la sede, basta escludere chi ha un tag.
 */
export function riepilogoSenzaTag(
  richieste: number,
  idTaggati: Set<string>,
  appuntamentiPrimi: GhlAppuntamento[],
  opportunitaVinte: GhlOpportunita[],
  startMs: number,
  endMs: number,
  oraAttualeMs: number = Date.now()
): GhlBreakdownTag {
  return {
    richieste,
    appuntamenti: riepilogoAppuntamenti(
      appuntamentiPrimi.filter((a) => !idTaggati.has(a.contactId)),
      startMs,
      endMs,
      oraAttualeMs
    ),
    opportunita: riepilogoOpportunita(
      opportunitaVinte.filter((o) => !idTaggati.has(o.contactId)),
      startMs,
      endMs
    ),
  };
}

/**
 * Riepilogo appuntamenti/opportunità/richieste per UN tag contatto (una categoria commerciale) —
 * mirror di breakdownGhlPerCampagna sopra, ma la chiave di join è l'appartenenza al set di contatti
 * taggati (fetchContattiPerTag) invece della mappa campagna. `richieste` = contatti taggati la cui
 * dateAdded cade nel periodo, il diretto equivalente GHL di RisultatoCommercialeRow.richieste per
 * questa categoria. `appuntamentiPrimi`/`opportunitaVinte` attesi già filtrati (stessa convenzione
 * di breakdownGhlPerCampagna: primoAppuntamentoPerContatto/status="won" già applicati dal chiamante).
 */
export function riepilogoPerTag(
  contattiTag: { id: string; dateAdded: string }[],
  appuntamentiPrimi: GhlAppuntamento[],
  opportunitaVinte: GhlOpportunita[],
  startMs: number,
  endMs: number,
  oraAttualeMs: number = Date.now()
): GhlBreakdownTag {
  const idTag = new Set(contattiTag.map((c) => c.id));
  const richieste = contattiTag.filter((c) => {
    const t = new Date(c.dateAdded).getTime();
    return Number.isFinite(t) && t >= startMs && t <= endMs;
  }).length;
  const appuntamentiTag = appuntamentiPrimi.filter((a) => idTag.has(a.contactId));
  const opportunitaTag = opportunitaVinte.filter((o) => idTag.has(o.contactId));
  return {
    richieste,
    appuntamenti: riepilogoAppuntamenti(appuntamentiTag, startMs, endMs, oraAttualeMs),
    opportunita: riepilogoOpportunita(opportunitaTag, startMs, endMs),
  };
}

/**
 * Riepilogo appuntamenti/opportunità per UN venditore (Fase 4, 11/2026) — join diretto su
 * assignedUserId/assignedTo, già presenti sull'oggetto GHL (verificato con una chiamata reale:
 * nessun fetch /users/ o /contacts/ in più necessario, a differenza di riepilogoPerTag sopra).
 *
 * `appuntamenti` qui è DELIBERATAMENTE l'elenco grezzo, NON ridotto con
 * primoAppuntamentoPerContatto come altrove in questo file: quel filtro serve a non gonfiare
 * l'attribuzione MARKETING (un contatto che riprenota non è un nuovo lead generato), ma per il
 * CARICO DI LAVORO di un venditore ogni appuntamento tenuto conta — 3 incontri di follow-up con lo
 * stesso cliente sono 3 appuntamenti di lavoro fatti, non 1. `opportunitaVinte` resta invece
 * l'elenco già filtrato a status="won" usato ovunque: un'opportunità non si "ripete" come un
 * appuntamento, niente da dedurre qui.
 */
export function riepilogoPerVenditoreGhl(
  ghlUserId: string,
  appuntamenti: GhlAppuntamento[],
  opportunitaVinte: GhlOpportunita[],
  startMs: number,
  endMs: number,
  oraAttualeMs: number = Date.now()
): GhlBreakdownCampagna {
  const appuntamentiVenditore = appuntamenti.filter((a) => a.assignedUserId === ghlUserId);
  const opportunitaVenditore = opportunitaVinte.filter((o) => o.assignedTo === ghlUserId);
  return {
    appuntamenti: riepilogoAppuntamenti(appuntamentiVenditore, startMs, endMs, oraAttualeMs),
    opportunita: riepilogoOpportunita(opportunitaVenditore, startMs, endMs),
  };
}

/**
 * L'andamento di un venditore settimana per settimana: appuntamenti presi ed effettuati, vendite e
 * fatturato, dagli appuntamenti e dalle opportunità vinte assegnati a lui su GHL. Stessi criteri di
 * riepilogoPerVenditoreGhl (ogni appuntamento conta, anche i successivi con lo stesso contatto) e
 * stessa griglia di settimane dei grafici del marketing (appuntamentiGhlPerSettimana e
 * fatturatoGhlPerSettimana: le settimane ai bordi del periodo sono intere).
 *
 * Restituisce solo le settimane in cui è successo qualcosa, in ordine: per le altre il valore è
 * zero — uno zero vero, perché GHL è stato letto e non c'era nulla.
 */
export function andamentoPerVenditoreGhl(
  ghlUserId: string,
  appuntamenti: GhlAppuntamento[],
  opportunitaVinte: GhlOpportunita[],
  startMs: number,
  endMs: number,
  oraAttualeMs: number = Date.now()
): GhlSettimanaVenditore[] {
  const perSettimana = new Map<string, GhlSettimanaVenditore>();
  const voce = (settimana: string) => {
    let v = perSettimana.get(settimana);
    if (!v) {
      v = { settimana, fissati: 0, effettuati: 0, vendite: 0, fatturato: 0 };
      perSettimana.set(settimana, v);
    }
    return v;
  };
  const suoiAppuntamenti = appuntamenti.filter((a) => a.assignedUserId === ghlUserId);
  for (const s of appuntamentiGhlPerSettimana(suoiAppuntamenti, startMs, endMs, oraAttualeMs)) {
    const v = voce(s.settimana);
    v.fissati = s.fissati;
    v.effettuati = s.effettuati;
  }
  const sueVendite = opportunitaVinte.filter((o) => o.assignedTo === ghlUserId);
  for (const s of fatturatoGhlPerSettimana(sueVendite, startMs, endMs)) {
    const v = voce(s.settimana);
    v.vendite = s.vendite;
    v.fatturato = s.fatturato;
  }
  return Array.from(perSettimana.values()).sort((a, b) => a.settimana.localeCompare(b.settimana));
}

/**
 * I numeri di tutti i venditori di una sede, col filtro campagne della pagina (08/10/2026: l'utente
 * ha scelto che il filtro valga anche per il riquadro dei venditori, prima contavano sempre tutto).
 *
 * Con un filtro attivo contano solo gli appuntamenti e le vendite dei contatti arrivati da quelle
 * campagne (`mappaCampagna`, vedi mappaCampagnaPerContatto): un contatto senza campagna resta fuori,
 * come nelle tessere. Stessa regola di onestà delle tessere (kpiGhlOverlay.ts): se su GHL nessun
 * contatto della sede è attribuito a una campagna (`campagneAttribuibili` falso), restringere
 * darebbe zero a tutti — un falso zero. Allora i venditori contano tutto e `perimetro` lo dice, così
 * il riquadro lo scrive invece di mostrare numeri che sembrano filtrati.
 *
 * Restano i criteri di riepilogoPerVenditoreGhl: ogni appuntamento conta, anche i successivi con lo
 * stesso contatto.
 */
export function venditoriGhlNelPerimetro(input: {
  venditori: { venditoreId: string; ghlUserId: string }[];
  appuntamenti: GhlAppuntamento[];
  opportunitaVinte: GhlOpportunita[];
  mappaCampagna: Map<string, string>;
  /** `null` = nessun filtro campagne. */
  campagneFiltro: Set<string> | null;
  campagneAttribuibili: boolean;
  startMs: number;
  endMs: number;
  oraAttualeMs?: number;
}): { perimetro: PerimetroVenditori; perVenditore: Record<string, GhlBreakdownCampagna>; perVenditoreSettimanale: Record<string, GhlSettimanaVenditore[]> } {
  const { venditori, mappaCampagna, campagneFiltro, campagneAttribuibili, startMs, endMs, oraAttualeMs = Date.now() } = input;
  const perimetro: PerimetroVenditori = !campagneFiltro ? "tutti" : campagneAttribuibili ? "campagne-scelte" : "non-distinguibili";
  const nelFiltro = (contactId: string) => {
    const campaignId = mappaCampagna.get(contactId);
    return campaignId !== undefined && Boolean(campagneFiltro?.has(campaignId));
  };
  const ristretto = perimetro === "campagne-scelte";
  const appuntamenti = ristretto ? input.appuntamenti.filter((a) => nelFiltro(a.contactId)) : input.appuntamenti;
  const opportunitaVinte = ristretto ? input.opportunitaVinte.filter((o) => nelFiltro(o.contactId)) : input.opportunitaVinte;

  const perVenditore: Record<string, GhlBreakdownCampagna> = {};
  const perVenditoreSettimanale: Record<string, GhlSettimanaVenditore[]> = {};
  for (const venditore of venditori) {
    const ghlUserId = venditore.ghlUserId.trim();
    perVenditore[venditore.venditoreId] = riepilogoPerVenditoreGhl(ghlUserId, appuntamenti, opportunitaVinte, startMs, endMs, oraAttualeMs);
    // Lo stesso, settimana per settimana, per il grafico "Andamento venditori".
    perVenditoreSettimanale[venditore.venditoreId] = andamentoPerVenditoreGhl(ghlUserId, appuntamenti, opportunitaVinte, startMs, endMs, oraAttualeMs);
  }
  return { perimetro, perVenditore, perVenditoreSettimanale };
}

/** Id pipeline di una categoria commerciale (CategoriaCommerciale.pipelineGhl, separati da virgola)
 * — [] se la categoria non è definita per pipeline. */
export function pipelineDiCategoria(categoria: { pipelineGhl?: string }): string[] {
  return (categoria.pipelineGhl ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

/**
 * Perimetro di UNA sede dentro una location GHL condivisa da più sedi (GhlConnessione.pipelineIds,
 * 01/10/2026 — Agricobots Italia/Spagna: una sola location, pipeline "(IT)" e "(ES)"). Con
 * `pipelineIds` vuoto non cambia nulla (tutta la location, comportamento di sempre). Altrimenti:
 * - opportunità: solo quelle in una delle pipeline indicate;
 * - appuntamenti: solo quelli dei contatti che hanno almeno un'opportunità in quelle pipeline. Un
 *   appuntamento non porta una pipeline e il calendario è spesso unico per tutte le divisioni: il
 *   contatto è l'unico ponte. Un appuntamento di un contatto senza nessuna opportunità non è
 *   attribuibile a nessuna sede e resta fuori da tutte — mai assegnato a caso.
 * Va applicata PRIMA di ogni altro calcolo di /api/ghl, così totali, attribuzione a campagna/
 * inserzione, cluster e venditori partono tutti dallo stesso perimetro.
 */
export function restringiAllePipeline(
  opportunita: GhlOpportunita[],
  appuntamenti: GhlAppuntamento[],
  pipelineIds: string[]
): { opportunita: GhlOpportunita[]; appuntamenti: GhlAppuntamento[] } {
  if (pipelineIds.length === 0) return { opportunita, appuntamenti };
  const pipeline = new Set(pipelineIds);
  const opportunitaSede = opportunita.filter((o) => o.pipelineId !== undefined && pipeline.has(o.pipelineId));
  const contattiSede = new Set(opportunitaSede.map((o) => o.contactId));
  return { opportunita: opportunitaSede, appuntamenti: appuntamenti.filter((a) => contattiSede.has(a.contactId)) };
}

function creataNelPeriodo(o: GhlOpportunita, startMs: number, endMs: number): boolean {
  const t = new Date(o.createdAt).getTime();
  return Number.isFinite(t) && t >= startMs && t <= endMs;
}

/**
 * Riepilogo richieste/appuntamenti/vendite di UN cluster definito per pipeline (mirror di
 * riepilogoPerTag, dove l'appartenenza al cluster è avere un'opportunità in una delle pipeline
 * invece di un tag sul contatto):
 * - richieste: contatti distinti con un'opportunità del cluster CREATA nel periodo (l'arrivo di un
 *   nuovo lead in quella pipeline — l'equivalente della dateAdded del contatto in riepilogoPerTag);
 * - appuntamenti: quelli dei contatti che hanno un'opportunità nel cluster;
 * - vendite/fatturato: le opportunità VINTE che stanno in quelle pipeline.
 * `opportunita` è l'elenco grezzo (ogni stato) già ristretto alla sede; `appuntamentiPrimi` già
 * ridotto con primoAppuntamentoPerContatto, stessa convenzione di riepilogoPerTag.
 */
export function riepilogoPerPipeline(
  pipelineIds: string[],
  opportunita: GhlOpportunita[],
  appuntamentiPrimi: GhlAppuntamento[],
  startMs: number,
  endMs: number,
  oraAttualeMs: number = Date.now()
): GhlBreakdownTag {
  const pipeline = new Set(pipelineIds);
  const delCluster = opportunita.filter((o) => o.pipelineId !== undefined && pipeline.has(o.pipelineId));
  const contatti = new Set(delCluster.map((o) => o.contactId));
  const richieste = new Set(delCluster.filter((o) => creataNelPeriodo(o, startMs, endMs)).map((o) => o.contactId)).size;
  return {
    richieste,
    appuntamenti: riepilogoAppuntamenti(
      appuntamentiPrimi.filter((a) => contatti.has(a.contactId)),
      startMs,
      endMs,
      oraAttualeMs
    ),
    opportunita: riepilogoOpportunita(
      delCluster.filter((o) => o.status === "won"),
      startMs,
      endMs
    ),
  };
}

/**
 * Complemento di riepilogoPerPipeline (il blocco "Senza cluster"): tutto ciò che la sede contiene e
 * nessun cluster per pipeline cattura — opportunità in pipeline della sede che non sono di nessun
 * cluster (per Agricobots le pipeline "Concessionari"). `pipelineDeiCluster` = unione delle pipeline
 * di tutti i cluster della sede. Un contatto che ha anche un'opportunità in un cluster conta lì,
 * non qui.
 */
export function riepilogoSenzaPipeline(
  pipelineDeiCluster: string[],
  opportunita: GhlOpportunita[],
  appuntamentiPrimi: GhlAppuntamento[],
  startMs: number,
  endMs: number,
  oraAttualeMs: number = Date.now()
): GhlBreakdownTag {
  const pipeline = new Set(pipelineDeiCluster);
  const inCluster = (o: GhlOpportunita) => o.pipelineId !== undefined && pipeline.has(o.pipelineId);
  const contattiInCluster = new Set(opportunita.filter(inCluster).map((o) => o.contactId));
  const fuori = opportunita.filter((o) => !inCluster(o));
  const richieste = new Set(
    fuori.filter((o) => creataNelPeriodo(o, startMs, endMs) && !contattiInCluster.has(o.contactId)).map((o) => o.contactId)
  ).size;
  return {
    richieste,
    appuntamenti: riepilogoAppuntamenti(
      appuntamentiPrimi.filter((a) => !contattiInCluster.has(a.contactId)),
      startMs,
      endMs,
      oraAttualeMs
    ),
    opportunita: riepilogoOpportunita(
      fuori.filter((o) => o.status === "won"),
      startMs,
      endMs
    ),
  };
}
