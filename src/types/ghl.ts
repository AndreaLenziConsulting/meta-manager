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
};

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
 */
export type GhlAttribuzione = {
  utmCampaignId?: string;
  utmCampaign?: string;
  utmSource?: string;
  isFirst?: boolean;
  isLast?: boolean;
};

export type GhlOpportunita = {
  id: string;
  name: string;
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
};

/** Riepilogo appuntamenti/opportunità attribuiti a UNA campagna Meta (vedi breakdownGhlPerCampagna
 * in src/lib/ghl.ts) — stessa forma di GhlRiepilogoResponse.appuntamenti/opportunita, per campagna
 * invece che totale sede. */
export type GhlBreakdownCampagna = {
  appuntamenti: { totali: number; confermati: number; annullati: number; effettuati: number };
  opportunita: { vendite: number; fatturato: number };
};

/** Riepilogo aggregato per un periodo — deliberatamente NON compatibile con KpiGroup, vedi kpi.ts. */
export type GhlRiepilogoResponse =
  | { connesso: false }
  | {
      connesso: true;
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
      // true se questa location ha ALMENO un'opportunità con un campaignId Meta risolvibile —
      // distingue "il filtro campagne selezionato ha davvero zero risultati" da "questa sede non
      // ha ancora nessuna attribuzione campagna disponibile" (traffico non tracciato/non da Meta):
      // nel secondo caso un conteggio scoped-a-zero sarebbe un falso zero, vedi kpiGhlOverlay.ts.
      campagneAttribuibili: boolean;
    };
