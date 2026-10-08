/**
 * Tipi per l'integrazione Go High Level / Squadd (white-label italiano, stessa API sotto il
 * cofano) — Fase 1: pannello di sola lettura "vendite e appuntamenti" per sede, mai scritto nel
 * RisultatiCommerciali esistente (vedi src/lib/kpi.ts, dato 100% manuale e testato — non toccato da questa
 * feature). Un GhlConnessione vive per sedeId (non clienteId): il "locationId" di GHL è
 * concettualmente la stessa unità di una Sede — un cliente con più sedi fisiche può avere più
 * location GHL separate, stesso motivo per cui adAccountId vive già su Sede e non su Cliente.
 */

/** Riga della tab GhlConnessioni. Il token resta testo semplice, stesso precedente di Consulente.password. */
export type GhlConnessione = {
  connessioneId: string;
  sedeId: string;
  locationId: string;
  privateToken: string;
  attivo: boolean;
  note: string;
  creataIl: string; // ISO datetime
  // Calendari della location da includere nel conteggio appuntamenti — scelta esplicita
  // dell'admin, non un'euristica automatica: una location porta spesso anche calendari "personal"
  // di singoli consulenti che possono essere sia pagine di prenotazione legittime sia, in alcuni
  // casi, impegni non pertinenti — calendarType da solo non basta a distinguerli in modo
  // affidabile (vedi commento su GhlCalendario). [] = non ancora configurato.
  calendarIds: string[];
  // Pipeline della location che appartengono a QUESTA sede (01/10/2026) — per i clienti che tengono
  // più divisioni dentro una sola location GHL separandole per pipeline (Agricobots: pipeline "(IT)"
  // e "(ES)" nella stessa location, due sedi Italia/Spagna in app). Vuoto/assente = tutta la
  // location, comportamento identico a prima di questo campo. Quando è valorizzato, tutto ciò che
  // /api/ghl calcola per la sede (opportunità, vendite, attribuzione a campagna/inserzione E
  // appuntamenti) è ristretto ai contatti con un'opportunità in una di queste pipeline — vedi
  // restringiAllePipeline in src/lib/ghl.ts. Opzionale per non toccare le fixture di test esistenti.
  pipelineIds?: string[];
};

/** Una pipeline di opportunità della location (GET /opportunities/pipelines), solo id + nome: serve
 * al selettore in ModificaClienteModal.tsx, gli stadi non servono a nessun calcolo. */
export type GhlPipeline = { id: string; name: string };

/**
 * `calendarType` verificato con una chiamata reale: "round_robin" | "personal" | "collective".
 * Usato solo come suggerimento di preselezione nel picker (round_robin/collective preselezionati,
 * personal no) — mai come filtro automatico: un calendario "personal" è spesso la pagina di
 * prenotazione dedicata di un singolo consulente, non necessariamente un impegno da escludere.
 */
export type GhlCalendario = { id: string; name: string; calendarType: string };

/**
 * Appuntamento GHL così com'è restituito da /calendars/events. `appointmentStatus` resta stringa
 * libera (non un'unione stretta): nell'account osservati solo "confirmed"/"cancelled" — GHL
 * supporta anche "showed"/"noshow" per chi segna le presenze, ma non va assunto per account che
 * non lo fanno. Per questo "effettuato" (vedi riepilogoAppuntamenti in src/lib/ghl.ts) è uno
 * standard operativo deciso dall'utente (appuntamento passato e mai annullato), non un vero
 * segnale di presenza letto da GHL.
 */
export type GhlAppuntamento = {
  id: string;
  calendarId: string;
  contactId: string;
  title: string;
  appointmentStatus: string;
  startTime: string; // ISO 8601 con offset — quando si TIENE l'incontro
  endTime: string;
  // Quando la prenotazione è stata FATTA — usata per il periodo invece di startTime: un
  // appuntamento fissato ad agosto per un incontro a ottobre resta "fissato ad agosto" anche se
  // poi riprogrammato, coerente con appuntamentiFissati di RisultatiCommerciali esistente (attività del mese,
  // non agenda futura) — vedi riepilogoAppuntamenti in src/lib/ghl.ts.
  dateAdded: string;
  deleted: boolean;
  // Id utente GHL del calendario/appuntamento — presente direttamente sull'oggetto (verificato con
  // una chiamata reale, nessuna chiamata /users/ o /contacts/ in più necessaria). Fase 4 (11/2026,
  // "risultati per venditore da GHL"): join con Venditore.ghlUserId, vedi riepilogoPerVenditoreGhl
  // in src/lib/ghl.ts. Assente/vuoto per un appuntamento non assegnato a nessuno, mai un dato
  // inventato in quel caso.
  assignedUserId?: string;
};

/**
 * Un touchpoint di attribuzione marketing su un'opportunità GHL, com'è restituito da
 * /opportunities/search — verificato con chiamate reali su 3 account, NON dai doc pubblici
 * (qui ancora meno affidabili che altrove: il campo che porta l'id di campagna Meta cambia
 * posizione secondo come il cliente porta il traffico dentro GHL). Due pattern osservati:
 * - form "Lead Ads" nativo GHL↔Meta: `utmCampaignId` porta l'id numerico, `utmCampaign` il nome
 *   leggibile della campagna (i due sono distinti).
 * - sito/funnel esterno con gli UTM dinamici di Meta nell'URL dell'annuncio: nessun
 *   `utmCampaignId` — l'id numerico arriva DIRETTAMENTE in `utmCampaign` (Meta genera
 *   `?utm_campaign={{campaign.id}}`, il cliente non lo rinomina).
 * Vedi estraiCampaignIdAttribuzione in src/lib/ghl.ts, che prova entrambi in ordine. `isFirst`/
 * `isLast` marcano il primo/ultimo touchpoint della sessione quando l'array ne ha più di uno —
 * per l'attribuzione a campagna si usa sempre il primo (il canale che ha davvero generato il
 * lead), mai l'ultimo.
 *
 * Id dell'INSERZIONE (ad) — verificato con chiamate reali su 3 account (01/10/2026), stessi due
 * pattern dell'id campagna sopra:
 * - form "Lead Ads" nativo: `utmAdId` porta l'id numerico dell'inserzione, `utmContent` il suo nome
 *   leggibile (es. "Ebook light 1080x1080"). Sui lead più vecchi `utmAdId` può mancare (resta solo
 *   il nome in `utmContent`): in quel caso l'inserzione NON è risolvibile, mai un match per nome.
 * - sito/funnel esterno con gli UTM dinamici di Meta: nessun `utmAdId` — l'id numerico arriva in
 *   `utmContent` (Meta genera `utm_content={{ad.id}}`; `utmTerm` porta invece l'id del gruppo di
 *   inserzioni).
 * Vedi estraiAdIdAttribuzione in src/lib/ghl.ts.
 */
export type GhlAttribuzione = {
  utmCampaignId?: string;
  utmCampaign?: string;
  utmAdId?: string;
  utmContent?: string;
  utmSource?: string;
  isFirst?: boolean;
  isLast?: boolean;
};

export type GhlOpportunita = {
  id: string;
  name: string;
  // Pipeline in cui si trova l'opportunità — presente su ogni oggetto di /opportunities/search
  // (verificato con una chiamata reale, 01/10/2026). Opzionale solo per le fixture di test.
  pipelineId?: string;
  monetaryValue: number;
  status: string; // "open" | "won" | "lost" | "abandoned" nei fatti osservati, string per sicurezza
  source: string;
  contactId: string;
  createdAt: string;
  // Data dell'ultimo cambio di stato — usata per capire QUANDO un'opportunità è stata vinta, non
  // quando è stata creata. Il filtro date/endDate di /opportunities/search filtra per createdAt
  // (verificato con una chiamata reale), semanticamente sbagliato per "vendite del periodo": una
  // trattativa aperta mesi fa e chiusa questo mese va contata come vendita di questo mese, non
  // persa perché creata prima — vedi riepilogoOpportunita in src/lib/ghl.ts.
  lastStatusChangeAt: string;
  // Assente/vuoto per un'opportunità senza sessione tracciata (es. creata a mano dal team, non da
  // un form/funnel) — mai un dato inventato in quel caso, vedi estraiCampaignIdAttribuzione.
  attributions?: GhlAttribuzione[];
  // Id utente GHL a cui l'opportunità è assegnata (il venditore che la segue) — presente
  // direttamente sull'oggetto, stesso commento di GhlAppuntamento.assignedUserId sopra. Fase 4.
  assignedTo?: string;
};

/** Riepilogo appuntamenti/opportunità attribuiti a UNA campagna Meta (vedi breakdownGhlPerCampagna
 * in src/lib/ghl.ts) — stessa forma di GhlRiepilogoResponse.appuntamenti/opportunita, per campagna
 * invece che totale sede. */
export type GhlBreakdownCampagna = {
  appuntamenti: { totali: number; confermati: number; annullati: number; effettuati: number };
  opportunita: { vendite: number; fatturato: number };
};

/** Una settimana (il suo lunedì) di lavoro di UN venditore, da GHL: appuntamenti presi ed effettuati,
 * vendite e fatturato — vedi andamentoPerVenditoreGhl in src/lib/ghl.ts. */
export type GhlSettimanaVenditore = { settimana: string; fissati: number; effettuati: number; vendite: number; fatturato: number };

/** Come GhlBreakdownCampagna, ma per UN tag contatto GHL (Fase 3 categorie commerciali, 11/2026) —
 * vedi riepilogoPerTag in src/lib/ghl.ts. `richieste` in più rispetto a GhlBreakdownCampagna: qui
 * il "lead" è il contatto stesso taggato (join diretto), mentre per una campagna Meta il lead è già
 * contato altrove (dati.gruppi in /api/kpi) — CategoriaCommerciale non ha un equivalente. */
export type GhlBreakdownTag = GhlBreakdownCampagna & { richieste: number };

/** Riepilogo aggregato per un periodo — deliberatamente NON compatibile con KpiGroup, vedi kpi.ts. */
export type GhlRiepilogoResponse =
  | { connesso: false }
  | {
      connesso: true;
      // Da dove arrivano questi numeri (01/10/2026): "ghl" = connessione GHL della sede (anche quando
      // il campo è assente, per le risposte e le fixture di prima), "foglio" = file contatti del
      // cliente letto per le sedi SENZA GHL (vedi src/lib/foglioContatti.ts). Stessa forma in
      // entrambi i casi; cambia il significato del periodo — per il file sono i contatti ARRIVATI
      // nel periodo, nello stato in cui si trovano oggi — e l'interfaccia lo dice nelle note.
      fonte?: "ghl" | "foglio";
      // false se la connessione esiste ma nessun calendario è ancora stato selezionato — gli
      // appuntamenti restano a zero finché l'admin non sceglie quali calendari includere, invece
      // di includerli tutti in automatico (vedi GhlConnessione.calendarIds).
      calendariConfigurati: boolean;
      // Solo il PRIMO appuntamento per contatto (vedi primoAppuntamentoPerContatto in lib/ghl.ts):
      // un lead che riprenota (rinvii, consulenze di follow-up) non deve gonfiare il conteggio
      // "appuntamenti generati dal marketing" — non un filtro opzionale, applicato sempre. Se in
      // query è presente `campagne` (stessi campaignId del filtro campagne di /api/kpi), scoped
      // ai soli contatti attribuiti a quelle campagne — altrimenti il totale di tutta la sede.
      appuntamenti: { totali: number; confermati: number; annullati: number; effettuati: number };
      // Stesso scoping di `appuntamenti` sopra quando `campagne` è in query.
      opportunita: { vendite: number; fatturato: number };
      // Stessi fatturato/vendite di `opportunita`, ma spezzati per settimana (lastStatusChangeAt) —
      // alimentano i grafici "Investimento vs Fatturato" e "Saldo netto cumulato" del tab KPI,
      // tracciati a settimana intera. Vedi fatturatoGhlPerSettimana in lib/ghl.ts.
      fatturatoPerSettimana: { settimana: string; fatturato: number; vendite: number }[];
      // Appuntamenti fissati/effettuati per settimana (dateAdded) — alimenta il grafico "Andamento
      // appuntamenti". Array vuoto se calendariConfigurati è false (stessa condizione di
      // appuntamenti sopra: senza calendari scelti, GHL non ha nessun dato reale da restituire qui,
      // non uno zero vero). Vedi appuntamentiGhlPerSettimana in lib/ghl.ts.
      appuntamentiPerSettimana: { settimana: string; fissati: number; effettuati: number }[];
      // >0 se uno o più calendari erano irraggiungibili al momento della richiesta (dopo un
      // retry) — il conteggio appuntamenti è quindi parziale, non un vero zero. Vedi fetchAppuntamenti.
      calendariFalliti: number;
      // Riepilogo per singola campagna Meta reale (join contatto->opportunità->attributions, vedi
      // breakdownGhlPerCampagna) — chiavi = campaignId, solo le campagne per cui esiste almeno un
      // contatto attribuito. Assente per una campagna = "nessun dato attribuito", da mostrare come
      // non disponibile, mai come zero silenzioso (vedi DettaglioCampagneEsteso.tsx).
      perCampagna: Record<string, GhlBreakdownCampagna>;
      // Come `perCampagna`, ma per singola INSERZIONE Meta (chiavi = adId, vedi
      // mappaInserzionePerContatto/breakdownGhlPerInserzione in lib/ghl.ts) — alimenta la vista
      // "Per singola inserzione" di DettaglioCampagneEsteso.tsx (01/10/2026). Stessa regola: solo le
      // inserzioni con almeno un contatto attribuito; assente = "nessun dato attribuito", mai zero.
      // Un contatto attribuito a una campagna ma senza id inserzione risolvibile (vedi
      // GhlAttribuzione) NON compare qui: la somma per inserzione può quindi essere inferiore a
      // quella per campagna, la differenza è mostrata come riga a parte, mai nascosta. Opzionale
      // per lo stesso motivo di `perTag` sotto (fixture di test esistenti).
      perInserzione?: Record<string, GhlBreakdownCampagna>;
      // true se questa location ha ALMENO un'opportunità con un campaignId Meta risolvibile —
      // distingue "il filtro campagne selezionato ha davvero zero risultati" da "questa sede non
      // ha ancora nessuna attribuzione campagna disponibile" (traffico non tracciato/non da Meta):
      // nel secondo caso un conteggio scoped-a-zero sarebbe un falso zero, vedi kpiGhlOverlay.ts.
      campagneAttribuibili: boolean;
      // Riepilogo per categoria commerciale (Fase 3, 11/2026) — chiavi = categoriaId, solo per le
      // categorie della sede con un tagGhl configurato (vedi CategoriaCommerciale in types/kpi.ts).
      // Opzionale (come `categorie`/`venditori` in KpiResponse.sede) per non dover toccare ogni
      // fixture di test esistente che costruisce questo tipo: assente = comportamento equivalente a
      // {} (nessuna categoria con tag configurato). Consumato da PacingTargetChart.tsx per
      // sostituire, categoria per categoria, l'attuale di RisultatiCommerciali con quello derivato
      // da GHL quando disponibile.
      perTag?: Record<string, GhlBreakdownTag>;
      // Complemento di `perTag` sopra (segnalato dall'utente, 20/09/2026): contatti/appuntamenti/
      // opportunità che non hanno NESSUNO dei tag configurati — presente solo se la sede ha almeno
      // una categoria con tagGhl impostato (altrimenti "senza cluster" non ha senso: non c'è nessun
      // cluster da cui essere esclusi). Mai un target — PacingTargetChart.tsx lo mostra come sola
      // visibilità del problema, non come un obiettivo da raggiungere.
      senzaTag?: GhlBreakdownTag;
      // Riepilogo per venditore (Fase 4, 11/2026) — chiavi = venditoreId, solo per i venditori
      // della sede con un ghlUserId configurato (vedi Venditore in types/kpi.ts). Opzionale per lo
      // stesso motivo di `perTag` sopra. Consumato da PacingVenditoriChart.tsx per sostituire
      // appuntamenti/fatturato dei RisultatiVenditori inseriti a mano con quelli derivati da GHL.
      perVenditore?: Record<string, GhlBreakdownCampagna>;
      // Gli stessi venditori di `perVenditore`, settimana per settimana (08/10/2026): alimenta il
      // grafico "Andamento venditori" (AndamentoVenditori.tsx). Solo le settimane in cui il venditore
      // ha avuto almeno un appuntamento o una vendita: le altre valgono zero. Stessa griglia di
      // settimane di `appuntamentiPerSettimana` (quelle di bordo sono intere).
      perVenditoreSettimanale?: Record<string, GhlSettimanaVenditore[]>;
    };
