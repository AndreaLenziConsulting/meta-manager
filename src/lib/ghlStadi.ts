import type { GhlAppuntamento, GhlOpportunita, StadiGhl } from "@/types/ghl";

/**
 * Appuntamenti e vendite letti dagli STADI di pipeline, per i clienti che su GHL li tracciano così
 * invece che col calendario e con lo stato "vinta" (08/10/2026, chiesto dall'utente per Agricobots:
 * lì gli appuntamenti sono gli stadi "Videocall 1 - Programmata" / "Videocall 1 - Effettuata", e la
 * vendita è "Acconto Versato - Diventa Cliente"; il calendario è quasi vuoto e nessuna opportunità
 * viene mai segnata vinta). Funzioni pure.
 *
 * Come si configura (GhlConnessione.stadi): tre nomi di stadio, validi per tutte le pipeline della
 * sede che hanno uno stadio con quel nome —
 *   - "appuntamento fissato da": chi sta in quello stadio, o in uno che viene dopo, ha preso un
 *     appuntamento;
 *   - "appuntamento effettuato da": idem, l'appuntamento c'è stato;
 *   - "vendita da": idem, è diventato cliente.
 * "Dopo" è l'ordine degli stadi nella pipeline. Gli stadi `ignorati` non contano mai, nemmeno se
 * vengono dopo (un "OLD" in fondo alla pipeline non è una vendita).
 *
 * Come entra nel resto dell'app: ogni opportunità che ha raggiunto lo stadio diventa un appuntamento
 * (o una vendita) nella stessa forma di quelli letti dal calendario (o dallo stato "vinta"). Così
 * tessere, grafici, Dettaglio per campagna e inserzione, cluster e venditori funzionano come sempre,
 * senza sapere da dove arriva il dato.
 *
 * IL LIMITE, da dire a chi legge i numeri: GHL dice solo in che stadio è un'opportunità ADESSO e
 * quando ci è entrata (`lastStageChangeAt`), non la storia dei passaggi. Quindi ogni opportunità si
 * conta UNA volta, alla data del suo ultimo spostamento. Chi ha preso l'appuntamento a settembre e ha
 * fatto la videocall a ottobre oggi risulta "fissato ed effettuato a ottobre", e da settembre è
 * sparito: i numeri di un periodo passato possono calare quando le opportunità avanzano. Per averli
 * fermi nel tempo l'app dovrebbe registrare i passaggi giorno per giorno (non fatto).
 */

export type StadioPipeline = { id: string; name: string; position: number };
export type PipelineConStadi = { id: string; name: string; stadi: StadioPipeline[] };

export const STADI_VUOTI: StadiGhl = { appuntamentoFissato: "", appuntamentoEffettuato: "", vendita: "", ignorati: [] };

/** I nomi degli stadi si confrontano senza badare a maiuscole e spazi doppi. */
const pulito = (nome: string) => nome.trim().toLowerCase().replace(/\s+/g, " ");
const testo = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** Da ciò che arriva dal database o da una richiesta: sempre la forma completa, mai un campo mancante. */
export function normalizzaStadi(v: unknown): StadiGhl {
  const o = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const ignorati = Array.isArray(o.ignorati) ? Array.from(new Set(o.ignorati.map(testo).filter(Boolean))) : [];
  return { appuntamentoFissato: testo(o.appuntamentoFissato), appuntamentoEffettuato: testo(o.appuntamentoEffettuato), vendita: testo(o.vendita), ignorati };
}

/** Cosa si legge dagli stadi per questa connessione: gli appuntamenti, le vendite, o nessuno dei due. */
export function usoStadi(stadi: StadiGhl | undefined): { appuntamenti: boolean; vendite: boolean } {
  return { appuntamenti: Boolean(stadi?.appuntamentoFissato && stadi.appuntamentoEffettuato), vendite: Boolean(stadi?.vendita) };
}

/** Perché questa configurazione non si può salvare, o null se va bene. */
export function erroreStadi(stadi: StadiGhl): string | null {
  const { appuntamentoFissato: fissato, appuntamentoEffettuato: effettuato, vendita, ignorati } = stadi;
  if (Boolean(fissato) !== Boolean(effettuato)) {
    return "Per contare gli appuntamenti dagli stadi servono tutti e due: lo stadio da cui l'appuntamento è fissato e quello da cui è effettuato";
  }
  if (fissato && pulito(fissato) === pulito(effettuato)) return "Lo stadio dell'appuntamento fissato e quello dell'appuntamento effettuato devono essere diversi";
  const scelti = [fissato, effettuato, vendita].filter(Boolean).map(pulito);
  if (ignorati.some((nome) => scelti.includes(pulito(nome)))) return "Uno stadio scelto per appuntamenti o vendite non può stare anche fra quelli da non contare";
  return null;
}

type Soglie = { fissato: number | null; effettuato: number | null; vendita: number | null; posizione: Map<string, number>; ignorati: Set<string> };

function soglieDi(pipeline: PipelineConStadi, stadi: StadiGhl): Soglie {
  const posizioneDelNome = (nome: string) => (nome ? (pipeline.stadi.find((s) => pulito(s.name) === pulito(nome))?.position ?? null) : null);
  const daIgnorare = new Set(stadi.ignorati.map(pulito));
  return {
    fissato: posizioneDelNome(stadi.appuntamentoFissato),
    effettuato: posizioneDelNome(stadi.appuntamentoEffettuato),
    vendita: posizioneDelNome(stadi.vendita),
    posizione: new Map(pipeline.stadi.map((s) => [s.id, s.position])),
    ignorati: new Set(pipeline.stadi.filter((s) => daIgnorare.has(pulito(s.name))).map((s) => s.id)),
  };
}

// Un incontro non ancora avvenuto: per riepilogoAppuntamenti "effettuato" è un incontro già passato.
const MAI = "9999-12-31T00:00:00.000Z";

/**
 * `opportunita` è l'elenco già ristretto alla sede (restringiAllePipeline). Torna:
 *   - `appuntamenti`: uno per ogni opportunità che ha raggiunto lo stadio dell'appuntamento fissato,
 *     datato al suo ultimo spostamento; "effettuato" se ha raggiunto anche quello stadio;
 *   - `vendute`: le opportunità che hanno raggiunto lo stadio della vendita, nella forma di
 *     un'opportunità vinta in quella data (col valore che hanno su GHL, anche zero);
 *   - `nonTrovati`: le pipeline in cui uno degli stadi configurati non esiste con quel nome — lì quel
 *     conteggio non si può fare, e va detto invece di contare zero in silenzio.
 * Ciò che non è configurato (vedi usoStadi) torna vuoto: lo decide il chiamante da dove prenderlo.
 */
export function leggiDaStadi(
  opportunita: GhlOpportunita[],
  pipeline: PipelineConStadi[],
  stadi: StadiGhl
): { appuntamenti: GhlAppuntamento[]; vendute: GhlOpportunita[]; nonTrovati: string[] } {
  const uso = usoStadi(stadi);
  const usate = new Set(opportunita.map((o) => o.pipelineId).filter((id): id is string => Boolean(id)));
  const soglie = new Map(pipeline.filter((p) => usate.has(p.id)).map((p) => [p.id, soglieDi(p, stadi)]));

  const nonTrovati: string[] = [];
  for (const p of pipeline) {
    const s = soglie.get(p.id);
    if (!s) continue;
    if (uso.appuntamenti && s.fissato === null) nonTrovati.push(`${p.name}: ${stadi.appuntamentoFissato}`);
    if (uso.appuntamenti && s.effettuato === null) nonTrovati.push(`${p.name}: ${stadi.appuntamentoEffettuato}`);
    if (uso.vendite && s.vendita === null) nonTrovati.push(`${p.name}: ${stadi.vendita}`);
  }

  const appuntamenti: GhlAppuntamento[] = [];
  const vendute: GhlOpportunita[] = [];
  for (const o of opportunita) {
    const s = o.pipelineId ? soglie.get(o.pipelineId) : undefined;
    const quando = o.lastStageChangeAt;
    if (!s || !o.pipelineStageId || !quando || s.ignorati.has(o.pipelineStageId)) continue;
    const posizione = s.posizione.get(o.pipelineStageId);
    if (posizione === undefined) continue;

    // Senza lo stadio dell'effettuato in questa pipeline gli appuntamenti qui non si contano affatto:
    // contarli tutti come "non effettuati" sarebbe un dato inventato.
    if (uso.appuntamenti && s.fissato !== null && s.effettuato !== null && posizione >= s.fissato) {
      appuntamenti.push({
        id: `stadio:${o.id}`,
        calendarId: "",
        contactId: o.contactId,
        title: o.name,
        appointmentStatus: "confirmed",
        startTime: posizione >= s.effettuato ? quando : MAI,
        endTime: posizione >= s.effettuato ? quando : MAI,
        dateAdded: quando,
        deleted: false,
        assignedUserId: o.assignedTo,
      });
    }
    if (uso.vendite && s.vendita !== null && posizione >= s.vendita) {
      vendute.push({ ...o, status: "won", lastStatusChangeAt: quando });
    }
  }
  return { appuntamenti, vendute, nonTrovati };
}

/**
 * Applica la configurazione degli stadi a ciò che /api/ghl ha letto per una sede, PRIMA di ogni altro
 * calcolo: da qui in poi il resto della route lavora come sempre.
 *   - appuntamenti dagli stadi: sostituiscono quelli dei calendari (che per questi clienti sono
 *     quasi vuoti: sommarli conterebbe due volte lo stesso incontro);
 *   - vendite dagli stadi: un'opportunità è "vinta" se ha raggiunto lo stadio della vendita, alla
 *     data in cui ci è entrata. Lo stato "vinta" di GHL non fa più testo — chi lavora a stadi non lo
 *     usa, e un'opportunità segnata vinta per sbaglio in uno stadio iniziale non è una vendita.
 * Senza configurazione torna tutto com'è, e `daStadi` non c'è.
 */
export function applicaStadi(input: {
  /** Le opportunità già ristrette alla sede (restringiAllePipeline). */
  opportunita: GhlOpportunita[];
  appuntamentiCalendario: GhlAppuntamento[];
  pipeline: PipelineConStadi[];
  stadi: StadiGhl | undefined;
}): { opportunita: GhlOpportunita[]; appuntamenti: GhlAppuntamento[]; daStadi?: { appuntamenti: boolean; vendite: boolean; nonTrovati: string[] } } {
  const { opportunita, appuntamentiCalendario, pipeline, stadi } = input;
  const uso = usoStadi(stadi);
  if (!stadi || (!uso.appuntamenti && !uso.vendite)) return { opportunita, appuntamenti: appuntamentiCalendario };

  const letto = leggiDaStadi(opportunita, pipeline, stadi);
  const vendute = new Map(letto.vendute.map((o) => [o.id, o]));
  return {
    opportunita: uso.vendite ? opportunita.map((o) => vendute.get(o.id) ?? (o.status === "won" ? { ...o, status: "open" } : o)) : opportunita,
    appuntamenti: uso.appuntamenti ? letto.appuntamenti : appuntamentiCalendario,
    daStadi: { ...uso, nonTrovati: letto.nonTrovati },
  };
}

/** I nomi degli stadi fra cui scegliere: quelli delle pipeline date, nell'ordine in cui compaiono, ognuno una volta. */
export function nomiStadi(pipeline: PipelineConStadi[]): string[] {
  const visti = new Map<string, string>();
  for (const p of pipeline) {
    for (const s of [...p.stadi].sort((a, b) => a.position - b.position)) {
      if (!visti.has(pulito(s.name))) visti.set(pulito(s.name), s.name.trim());
    }
  }
  return Array.from(visti.values());
}

/**
 * Gli stadi che ha senso poter escludere: quelli che in almeno una pipeline vengono DOPO il primo
 * stadio scelto (quindi conterebbero), tolti gli stadi scelti. Quelli che vengono prima non contano
 * comunque: proporli sarebbe solo rumore. Uno stadio già escluso resta in elenco anche se GHL non lo
 * ha più, così si vede e si può togliere.
 */
export function stadiEscludibili(pipeline: PipelineConStadi[], stadi: StadiGhl): string[] {
  const scelti = [stadi.appuntamentoFissato, stadi.appuntamentoEffettuato, stadi.vendita].filter(Boolean).map(pulito);
  const dopo = new Map<string, string>();
  for (const p of pipeline) {
    const posizioni = p.stadi.filter((st) => scelti.includes(pulito(st.name))).map((st) => st.position);
    if (posizioni.length === 0) continue;
    const prima = Math.min(...posizioni);
    for (const st of [...p.stadi].sort((a, b) => a.position - b.position)) {
      if (st.position > prima && !scelti.includes(pulito(st.name)) && !dopo.has(pulito(st.name))) dopo.set(pulito(st.name), st.name.trim());
    }
  }
  for (const nome of stadi.ignorati) if (!dopo.has(pulito(nome))) dopo.set(pulito(nome), nome);
  return Array.from(dopo.values());
}
