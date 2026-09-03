# Meta Manager ALC

Dashboard KPI multi-cliente per **Andrea Lenzi Consulting** che unisce spesa/lead di Meta Ads (tirati automaticamente) con il funnel post-lead (richieste, appuntamenti, vendite, fatturato) tracciato a mano dal team.

## Stack

- **Next.js 16** (App Router), deploy su **Vercel**
- **Google Sheets API** (service account) come database condiviso
- **Meta Graph API** (Marketing API) per spesa/lead, via cron giornaliero (Vercel Cron)

## Setup

### 1. Google Sheet centrale

Crea uno spreadsheet Google con **16 tab** (5 di supporto — `Commerciali`, `Prospect`, `ReportCommerciale`, `GhlConnessioni` e `Sedi` sotto — più le 11 già presenti prima del modulo commerciale/GHL), ognuna con la riga 1 come intestazione (i nomi delle colonne sono liberi, l'app legge per posizione). In pratica non serve crearle a mano: la prima volta bastano `Clienti`/`Consulenti` (vedi sotto), le altre le crea l'app scrivendoci — ma se parti da zero, la struttura è questa:

**Clienti** — un cliente si può creare anche dalla UI (`+ Nuovo cliente`, nella home admin o nella pagina Clienti), che genera `cliente_id`/`access_code` da sola; questa tabella resta comunque editabile a mano.
| A cliente_id | B nome | C ad_account_id | D access_code | E attivo | F consulente_id | G target_cpa | H target_cpl | I mostra_tab_extra | J prodotto_id | K data_inizio_progetto | L tipo_conversione_lead | M email | N logo_url | O colore_primario | P colore_secondario | Q font_personalizzato |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| es. `alc-01` | Nome Cliente | **vestigiale**, non più letta/scritta (vedi sotto) | codice univoco per il link cliente | `TRUE`/`FALSE` | id del consulente assegnato (vedi tab Consulenti) | **vestigiale** | **vestigiale** | `TRUE` per mostrare al cliente finale anche il tab Meeting (default `FALSE` = solo KPI) | prodotto acquistato (vedi tab Prodotti), vuoto se nessuno | `YYYY-MM-DD`, base per le scadenze della roadmap — obbligatoria se è impostato un prodotto | **vestigiale** | email cliente, per l'invio automatico del follow-up meeting | opzionale, URL del logo — sostituisce il nome testuale nell'header (scheda cliente + link pubblico) | opzionale, hex `#RRGGBB` — sostituisce il brand ALC standard | opzionale, hex `#RRGGBB` — genera la tinta di sfondo chiara | opzionale, solo valori nella whitelist di `src/lib/temaCliente.ts` (oggi solo `poppins`) |

Colonne C/G/H/L **vestigiali**: `ad_account_id`/`target_cpa`/`target_cpl`/`tipo_conversione_lead` vivevano qui prima della migrazione a Sedi (un cliente può avere più sedi/account pubblicitari) — restano fisicamente su questo foglio per non spostare colonne su uno sheet guardato a mano, ma l'app non le legge/scrive più: i valori veri sono nella tab **Sedi**, sotto.

**Colonne N→Q, personalizzazione visiva per-cliente** (vedi `src/lib/temaCliente.ts`) — impostabili dalla UI (form "Nuovo cliente" o modale "Modifica cliente"), tutte opzionali: vuote = brand ALC standard (League Spartan/Roboto, blu ufficiale). Da 2 soli colori forniti (`colore_primario`/`colore_secondario`) l'app deriva 3 varianti CSS (come il brand ALC ha primary/dark/light) — il secondario diventa sempre una tinta di sfondo chiara (schiarito verso il bianco), mai un colore di testo diretto. `font_personalizzato` non è testo libero: `next/font/google` richiede un import statico per ogni font, quindi solo i valori aggiunti a mano in `layout.tsx` + `FONT_CLIENTE_DISPONIBILI` sono accettati (oggi solo Poppins) — un valore fuori whitelist viene silenziosamente ignorato (torna al font di default), mai un errore.

**Sedi** — un cliente ha sempre almeno una sede ("Principale", creata insieme al cliente); sedi aggiuntive si aggiungono dalla modale "Modifica cliente" (home admin o pagina Clienti). Ogni sede ha il proprio account pubblicitario Meta e i propri target: ads e funnel restano separati tra sedi diverse dello stesso cliente.
| A sede_id | B cliente_id | C nome | D ad_account_id | E target_cpa | F target_cpl | G tipo_conversione_lead | H attivo |
|---|---|---|---|---|---|---|---|
| es. `alc-01::principale` | | Es. "Milano", "Principale" | ID ad account Meta (senza `act_`), opzionale | € costo per vendita obiettivo (opzionale) | € costo per lead obiettivo (opzionale) | opzionale, vuoto per la maggior parte delle sedi (vedi sotto, stessa logica della colonna L vestigiale di Clienti) | `TRUE`/`FALSE` |

**Colonna L, `tipo_conversione_lead`** — da valorizzare **solo** per i clienti il cui funnel Meta non usa Lead Ads/Instant Form classici ma un altro evento di conversione (es. iscrizioni a webinar/eventi dal vivo, tracciate come "Completamento registrazione"). Il sync conta come "lead" l'`action_type` esatto restituito dalle Insight di Meta per quella campagna — di default prova in ordine `onsite_conversion.lead_grouped` → `lead` → `offsite_conversion.fb_pixel_lead` (le rappresentazioni note del vero evento "Lead"), ma se il cliente traccia un funnel diverso questi non esistono mai e il conteggio lead resta a 0 anche con spesa/click reali. Per scoprire l'`action_type` giusto per un nuovo cliente: chiamata diretta a `/act_<ad_account_id>/insights` con `fields=actions` su un intervallo con dati noti, e cercare tra i tipi restituiti quello che corrisponde all'evento di conversione reale del funnel (es. `offsite_conversion.fb_pixel_complete_registration` per iscrizioni webinar via pixel). Se impostata, questa colonna è l'**unico** criterio usato per quel cliente (non un fallback aggiuntivo alla lista di default) — evita di sommare per errore lead "veri" ed eventi diversi con semantica ambigua. Dopo averla impostata su un cliente già sincronizzato, ricalcolare lo storico con `node --env-file=.env.local scripts/backfill.js <since> <cliente_id>` (secondo argomento opzionale per limitare il backfill a un solo cliente).

**Consulenti** — un consulente vede solo i clienti con il proprio `consulente_id` in colonna F della tab Clienti.
| A consulente_id | B nome | C password | D attivo |
|---|---|---|---|

**Campagne** — popolata automaticamente dal cron alla prima comparsa di una campagna (tipo_campagna vuoto); valorizza `tipo_campagna` a mano. `stato` è scritta SOLO dal sync (stato Meta grezzo: `ACTIVE`, `PAUSED`, ...), non modificare a mano.
| A campaign_id | B cliente_id | C nome_campagna | D tipo_campagna | E stato |
|---|---|---|---|---|

**Convenzione di naming su Meta Ads Manager, per farsi classificare `tipo_campagna` da sole**: dai alla campagna un nome che inizia con `[Tipo]` tra parentesi quadre — es. `[Mobilieri] Lead Ads - Dal 20 Luglio`. Al primo sync, `guessTipoCampagnaFromNome` (`src/lib/sheets.ts`) legge il prefisso tra `[` e `]` e lo scrive in `tipo_campagna` (Title Case) automaticamente — zero lavoro manuale, sempre che il nome segua la convenzione. **Importante**: la deduzione avviene **solo la prima volta** che la campagna viene scoperta (mai più dopo, `tipo_campagna` resta editabile a mano senza essere sovrascritto ai sync successivi) — rinominare una campagna già presente in questa tab non la riclassifica da sola, va corretto a mano il valore in colonna D.

Per clienti con **più edizioni dello stesso tipo di funnel** (es. webinar/eventi ricorrenti, un cliente diverso ogni poche settimane) — il Funnel (sotto) è tracciato per mese + `tipo_campagna`, quindi se più edizioni cadono nello stesso mese finirebbero sommate insieme sotto un unico tipo generico. Includi anche la data nel prefisso per tenerle distinte: `[Presentazione 20.08] Studente Felice - LAL`, `[Presentazione 27.08] Studente Felice - BROAD`, `[Challenge 3-7.08] Studente Felice - LAL` — così ogni edizione ha il proprio `tipo_campagna` e resta tracciabile separatamente nel Funnel, anche a distanza di pochi giorni nello stesso mese.

**MetaDaily** — scritta SOLO dal cron, non modificare a mano.
| A data | B cliente_id | C campaign_id | D spesa | E impressions | F clicks | G ctr | H cpc | I cpm | J lead | K clic_link |
|---|---|---|---|---|---|---|---|---|---|---|

Colonna K aggiunta dopo il redesign KPI di fine agosto 2026 (blocco 7) — righe sincronizzate prima di allora la leggono come 0, non un errore. Ha già cambiato significato una volta: da "clic unici in uscita" (Meta `unique_outbound_clicks`, richiedeva un campo a sé) a "clic sul link" (Meta `link_click`, dentro lo stesso `actions` dei lead — vedi extractClicLink in lib/meta.ts) dopo che si è osservato dal vivo che "clic unici in uscita" restava quasi sempre a zero per le campagne Lead Ads a Modulo Istantaneo (il modulo si apre dentro l'app, mai un'uscita verso un sito esterno) — "clic sul link" scatta invece sia lì sia su una landing page esterna, significativo per entrambi i tipi di campagna. Un cambio di significato di questa colonna richiede sempre un backfill una tantum (rilettura da Meta su un intervallo ampio) per le righe già scritte, non è automatico. La **Frequenza** per campagna (stesso blocco 7) NON è invece una colonna qui: `frequency = impressions/reach` non è sommabile/mediabile su righe giornaliere (una persona vista in due giorni diversi non va contata due volte) — va letta live su tutto il periodo richiesto via `/api/meta-frequenza`, mai persistita.

**Funnel** — aggiornata a mano da Andrea/team, una riga per mese+cliente+tipo campagna.
| A mese (YYYY-MM) | B cliente_id | C tipo_campagna | D richieste | E appuntamenti_fissati | F appuntamenti_effettuati | G vendite | H fatturato |
|---|---|---|---|---|---|---|---|

**StoricoStatoCampagne** — scritta SOLO dal sync, non modificare a mano. Una riga per ogni transizione di stato rilevata (non una riga per sync): se lo stato non cambia da un sync all'altro non si scrive nulla. La prima volta che una campagna viene sincronizzata genera comunque una riga con `stato_precedente` vuoto (prima rilevazione, non un vero cambiamento). `data_ora` è il momento in cui il sync se n'è accorto, non necessariamente l'istante esatto del cambio su Meta Ads (dipende da finestra rolling e cadenza del cron). Usata per mostrare "dal 5 ago 2026" sotto il badge di stato nella tabella "per singola campagna".
| A data_ora (ISO) | B campaign_id | C cliente_id | D nome_campagna | E stato_precedente | F stato_nuovo |
|---|---|---|---|---|---|

**Prodotti** — editabile a mano, un prodotto acquistabile per riga. Oggi: `gtm` (Go To Market, 15 settimane) e `ac` (Acquisition Control, 14 settimane). Aggiunti entrambi senza scrivere codice, solo righe su questa tab + `TemplateAttivita` — è esattamente lo scopo per cui lo schema è fatto così.
| A prodotto_id | B nome | C attivo | D durata_settimane | E note |
|---|---|---|---|---|

**TemplateAttivita** — editabile a mano, mai scritta dall'app: è la roadmap standard di un prodotto, da cui si genera quella di ogni singolo cliente. Aggiungere un nuovo prodotto significa solo aggiungere righe qui + una riga in `Prodotti`, senza toccare codice.
| A prodotto_id | B task_id | C blocco | D fase | E descrizione | F responsabile | G tipo | H settimana_inizio | I settimana_fine | J giorni_testo | K nota | L ordine |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `gtm` | id univoco nel prodotto, es. `S01` | testo libero, es. `setup`/`gestione` | etichetta di fase, es. "Sett. 1 - Strategia & analisi" | descrizione attività | testo libero | sigla per colore/tooltip, es. `PM`/`CS`/`CL`/`MIL` (milestone) | settimana di inizio (1 = settimana di avvio progetto) | settimana di fine | solo display, es. "gg 1-3" | nota libera | ordine di visualizzazione, esplicito |

**AttivitaCliente** — generata automaticamente alla creazione del cliente (o da "Genera roadmap" nel tab Attività); stato e nota_team sono poi editabili dal team dalla UI. Non modificare le altre colonne a mano: sono uno snapshot del template al momento della generazione, una correzione futura al template non si propaga qui.
| A attivita_id | B cliente_id | C prodotto_id | D task_id | E blocco | F fase | G descrizione | H responsabile | I tipo | J data_inizio | K data_fine | L stato | M nota_team | N ordine |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `${cliente_id}::${task_id}` | | | | | | | | | `YYYY-MM-DD` | `YYYY-MM-DD` | `todo`/`wip`/`done`/`blocked` | | |

**MeetingCliente** — scritta dal tab Meeting (estrazione + salvataggio). Colonne stabili minime + `dati_json` con tutto il resto (partecipanti, riassunto, action item, campi discorsivi, ecc.), per non dover mai migrare lo schema quando cambia il template di estrazione.
| A meeting_id | B cliente_id | C data | D titolo | E sentiment | F aggiornato_il | G dati_json |
|---|---|---|---|---|---|---|
| `${cliente_id}::${sha1(url).slice(0,8)}` — deterministico, stesso link → stesso id (upsert, mai duplicati) | | `YYYY-MM-DD` (data del meeting) | | testo libero (frase, non enum) | ISO datetime dell'ultimo salvataggio | oggetto `MeetingDataLoose` serializzato — vedi `src/types/meeting.ts` |

**Prospect** — anagrafica persistente di un potenziale cliente (prima ancora di diventare un Cliente vero e proprio in questo Sheet — oggi le due entità non sono collegate, un prospect chiuso va ricreato a mano come Cliente). Un prospect si crea dalla UI (`+ Nuovo prospect`, tab Prospect del commerciale); colonne B→F si aggiornano anche da sole a ogni salvataggio di un report (vedi tab ReportCommerciale, non dettagliata qui).
| A prospect_id | B ragione_sociale | C tipo_business | D fatturato | E sedi | F email | G commerciale_id | H attivo | I creato_il | J drive_folder_url | K media_budget_mensile | L target_cpl | M target_cpa_appuntamento | N target_lead_settimana | O target_appuntamenti_settimana | P target_fatturato_mensile | Q target_margine_vendita_pct |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | | testo libero, spesso dedotto dall'estrazione AI di un report | testo libero (stima/range) | testo libero — quante/quali sedi ha il *business del prospect*, non l'entità Sede di questo Sheet | destinatario dell'invio automatico del report, vuota = disattivato | id del commerciale assegnato | `TRUE`/`FALSE` | ISO datetime | link alla cartella Drive del prospect, creata in automatico dal POST di creazione (vedi sotto) — resta comunque editabile a mano dalla UI ("Modifica dati commerciali") se si vuole puntare altrove | € spesa ads mensile pianificata/concordata | € target costo per lead | € target costo per **appuntamento fissato** (non per vendita — troppo poche vendite per periodo per essere un target sensato in questa fase) | lead attesi a settimana | appuntamenti fissati attesi a settimana | € fatturato mensile atteso | 0-100, % di utile medio per vendita sul fatturato |

Colonne J→Q aggiunte dopo il redesign KPI di inizio settembre 2026 — righe create prima di allora le leggono vuote/`null`, non un errore. K→Q impostabili solo dalla UI (modale "Modifica dati commerciali" sulla pagina del prospect); non ancora consumate da nessun indicatore di performance o calcolo automatico — per ora solo storage, pensate per alimentarli in un giro successivo.

**Hand-off commerciale su Google Drive** (vedi `src/lib/drive.ts`) — alla creazione di un prospect (`POST /api/prospect`), l'app crea in automatico, dentro lo shared drive del team (`GOOGLE_DRIVE_COMMERCIALE_ID`, vedi sotto), una cartella `<ragione sociale> | COMMERCIALE ANDREA LENZI CONSULTING` con dentro una sottocartella `Report chiamate | <ragione sociale>`, e salva il link della prima nella colonna J (`drive_folder_url`) sopra. A ogni salvataggio di un report (non solo il primo — un'edit successiva sovrascrive lo stesso PDF, individuato da un metadato invisibile `appProperties.reportId`, mai duplicato), il PDF del report viene caricato in quella sottocartella. Un prospect creato prima di questa funzionalità (colonna J vuota) o con una creazione cartella fallita all'epoca recupera la cartella al primo report salvato (stesso meccanismo, chiamato come fallback). Mai bloccante: se Drive non è raggiungibile o non configurato, la creazione del prospect / il salvataggio del report restano comunque riusciti, solo senza l'upload.

Nessuna condivisione necessaria: l'app accede allo Sheet con il tuo stesso account Google (OAuth2), non con un service account.

### 2. OAuth2 con il tuo account Google

Le policy dell'organizzazione possono bloccare la creazione di chiavi di service account
(`iam.disableServiceAccountKeyCreation`) — in quel caso si usa OAuth2 con il tuo account Google:

1. Google Cloud Console → crea/seleziona progetto → abilita **Google Sheets API** e **Google Drive API** (quest'ultima serve solo per l'hand-off commerciale, vedi sopra — se non ti interessa quella funzionalità puoi saltarla, ma allora salta anche lo scope Drive al passo 4)
2. **API e servizi → Schermata di consenso OAuth**: tipo utente **Interno** (se il progetto è nell'organizzazione Workspace) o **Esterno** con te stesso come test user; nome app "Meta Manager ALC"
3. **API e servizi → Credenziali → Crea credenziali → ID client OAuth** → tipo **App desktop** → copia **Client ID** e **Client secret**
4. Esegui in locale:
   ```bash
   node scripts/get-refresh-token.js <CLIENT_ID> <CLIENT_SECRET>
   ```
   Si apre il browser, accedi con l'account Google che possiede lo spreadsheet **e che ha già accesso in scrittura allo shared drive "COMMERCIALE ANDREA LENZI CONSULTING"** (serve lo stesso account per entrambi — un solo refresh token, uno scope per Sheets e uno per Drive), poi concedi l'accesso. Lo script stampa un **refresh token** in console.

   Se avevi già un refresh token generato prima dell'introduzione di Drive (solo scope `spreadsheets`), **rieseguilo** con lo stesso Client ID/secret: Google restituisce un nuovo refresh token con l'unione degli scope concessi in quella sessione di consenso — il vecchio smette di funzionare per Drive ma continua a funzionare per Sheets finché non sostituisci la variabile d'ambiente col nuovo.
5. In `.env.local`: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` (dal passo 4), `SHEET_ID` (dall'URL dello spreadsheet), e per l'hand-off commerciale anche `GOOGLE_DRIVE_COMMERCIALE_ID` (id dello shared drive "COMMERCIALE ANDREA LENZI CONSULTING" — apri lo shared drive su drive.google.com e prendilo dall'URL, `https://drive.google.com/drive/folders/<questo>`)

### 3. Meta Marketing API

Usa il system user token del Business Manager ALC (già configurato con accesso `ads_read` su tutti gli ad account clienti) come `META_ACCESS_TOKEN`.

### 4. Variabili d'ambiente

Copia `.env.local.example` in `.env.local` e compila tutti i valori (vedi anche `TEAM_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET` — stringhe casuali a scelta).

Per il tab Meeting (estrazione da Fathom/Circleback/Loom) servono in più: `GROQ_API_KEY` (console.groq.com/keys, usata per l'estrazione strutturata via tool calling — modello `openai/gpt-oss-120b`; piano free: 8K TPM / 30 RPM / 200K TPD, quest'ultimo un tetto reale di circa 25-40 estrazioni al giorno), `CHROME_EXECUTABLE_PATH` (obbligatorio in sviluppo locale — percorso dell'eseguibile Chrome installato, es. `C:/Program Files/Google/Chrome/Application/chrome.exe`) e opzionalmente `CHROMIUM_PACK_URL` (override del binario Chromium in produzione/serverless, di norma non serve).

Per la scrittura in parallelo sul foglio esterno "Report Operatività Clienti" (vedi sezione Meeting sotto): `REPORT_OPERATIVITA_SHEET_ID` (spreadsheetId del foglio esterno, separato da `SHEET_ID`) e opzionalmente `REPORT_OPERATIVITA_TAB_NAME` (default `"Risposte del modulo 1"`). Se non configurate, quella scrittura viene semplicemente saltata — non blocca il salvataggio del meeting.

### 5. Sviluppo locale

```bash
npm install
npm run dev
```

App su `http://localhost:3000`. Il cron (`/api/cron/sync-meta`) va chiamato manualmente in locale, es.:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/sync-meta
```

### Test

Test unitari (Vitest) sulla logica pura più delicata — aggregazione KPI, normalizzazione date da
Sheets, classificazione salute cliente, sessione firmata — nessuna chiamata di rete, nessun bisogno
di `.env.local`:

```bash
npm test          # una tantum
npm run test:watch
```

## Accessi — tre livelli

- **Amministratore**: `/login` con `TEAM_PASSWORD` → `/dashboard` è la panoramica "Salute clienti" (badge 🔴🟡🟢 basato su CPA/CPL vs target) con tutti i clienti + bottone "+ Nuovo cliente"
- **Consulente**: stesso `/login`, ma con la password individuale definita nella tab `Consulenti` → `/dashboard` mostra solo i clienti con quel `consulente_id` assegnato
- **Cliente finale**: link diretto `/report/<access_code>` (colonna D della tab Clienti) — sola lettura, filtrato sul suo cliente, non passa da `/login`

## Scheda cliente — tab

Team/consulente/admin vedono sempre 3 tab: **KPI** (quello di sempre), **Attività** (roadmap del prodotto, vedi sotto) e **Meeting** (storico meeting registrati, vedi sotto). Il cliente finale vede solo **KPI**, più **Meeting** se `mostra_tab_extra` è `TRUE` per quel cliente in `Clienti` — **Attività non è mai visibile al cliente finale**, indipendentemente da `mostra_tab_extra`: è uno strumento interno. Il cancello vero è lato API (`/api/attivita*` non ha alcun accesso via `code`, solo sessione team), il nascondimento del tab in UI è solo cosmetico.

### Roadmap prodotto (tab Attività)

Alla creazione di un cliente con un prodotto assegnato, la roadmap si genera automaticamente copiando `TemplateAttivita` del prodotto scelto, con le scadenze calcolate da `data_inizio_progetto` + `settimana_inizio`/`settimana_fine` di ogni riga template. Il tab mostra un Gantt raggruppato per fase (collassabili, solo la fase in corso è aperta di default); un click su un'attività cicla lo stato **Da fare → In corso → Fatto → Da fare**; "Bloccato" si imposta da un'azione dedicata e richiede sempre un motivo. Un cliente senza `prodotto_id`/`data_inizio_progetto` mostra un invito a assegnarli; un cliente con prodotto ma senza roadmap (es. generazione fallita) mostra un bottone "Genera roadmap" (equivalente a `POST /api/attivita/genera`, idempotente — richiamabile in sicurezza più volte).

### Meeting — storico + task automatici (tab Meeting)

Sostituisce l'uso del vecchio tool separato "Fast Report": la logica di estrazione (scraping Playwright della pagina pubblica di condivisione + lettura strutturata via Groq) è replicata direttamente qui, non più un servizio esterno. Dal tab, il team incolla il link pubblico di un meeting registrato su **Fathom**, **Circleback** o **Loom**; `POST /api/meeting/estrai` fa scraping della pagina e passa il testo a Groq (`openai/gpt-oss-120b`, tool calling forzato, schema fisso) per un'anteprima strutturata (titolo, data, durata, partecipanti, riassunto, action item, più alcuni campi ad uso interno). L'anteprima è editabile prima del salvataggio.

Al salvataggio (`POST /api/meeting`):
- il meeting viene scritto su `MeetingCliente` in **upsert per `meeting_id`** (hash deterministico di cliente+url — ri-salvare lo stesso link aggiorna la riga esistente, non la duplica);
- ogni **action item** diventa automaticamente una riga in `AttivitaCliente`, in una corsia dedicata "Meeting: \<titolo\> (\<data\>)" nel Gantt del tab Attività, con scadenza di default meeting+7 giorni e responsabile = assegnatario indicato o "Da assegnare". Solo gli action item generano task: i campi discorsivi (riassunto, programmi, ecc.) restano solo informazione salvata. La generazione è idempotente (stesso `attivita_id` per lo stesso action item), quindi ri-salvare un meeting non duplica mai i task già creati;
- una riga viene scritta anche sul foglio esterno "Report Operatività Clienti" (12 colonne, stesso formato del vecchio Fast Report — vedi `REPORT_OPERATIVITA_SHEET_ID` sopra), **in parallelo** allo storico interno. Scrittura non bloccante: se fallisce (env var mancante, foglio non raggiungibile), il salvataggio principale va comunque a buon fine.

Dal tab, sia sull'anteprima pre-salvataggio sia su ogni meeting già salvato nello storico (dove è anche possibile correggerlo con **"✎ Modifica report"**), sono disponibili **"Scarica PDF"** (report brandizzato via `@react-pdf/renderer`, stesso stile del vecchio Fast Report, riusa `public/lenzi.webp`) e **"Genera email di follow-up"** (bozza testuale editabile e copiabile negli appunti). Entrambi solo in contesto team.

**Invio automatico dell'email di follow-up**: nell'anteprima, una checkbox **"Invia email al cliente in automatico"** (selezionata di default se il cliente ha un'email impostata nella scheda cliente) fa sì che, al **primo** salvataggio del meeting, l'email parta davvero al cliente — testo di follow-up + PDF del report allegato — "da" la casella Gmail del **consulente assegnato al cliente** (via Gmail API con delega a livello di dominio, vedi setup sotto), non da un mittente unico condiviso. Deselezionando la checkbox si torna al flusso manuale (scarica PDF / copia email). L'invio non avviene mai su "✎ Modifica report" (correggere un meeting già salvato non deve rimandare l'email al cliente), e non è mai bloccante: se fallisce (credenziali non configurate, email cliente o consulente mancante, errore Google), il meeting si salva comunque e l'interfaccia mostra il motivo, con il flusso manuale sempre disponibile come ripiego.

#### Setup invio email (Gmail API, delega a livello di dominio)

Richiede Google Workspace e va fatto una tantum dall'amministratore del dominio:
1. **Google Cloud Console** → crea un service account (in un progetto qualsiasi, anche lo stesso usato per Google Sheets).
2. Sul service account, abilita **"domain-wide delegation"** e annota il suo **Client ID** (numerico).
3. **Google Workspace Admin Console** → Sicurezza → Controllo API → **Delega a livello di dominio** → aggiungi il Client ID del service account con lo scope `https://www.googleapis.com/auth/gmail.send`.
4. Scarica la **chiave JSON** del service account e imposta `GMAIL_SERVICE_ACCOUNT_EMAIL` (il campo `client_email` del JSON) e `GMAIL_SERVICE_ACCOUNT_PRIVATE_KEY` (il campo `private_key`, su una riga con `\n` letterali) nelle variabili d'ambiente.
5. Imposta l'**email** di ogni consulente che deve poter inviare (colonna E della tab "Consulenti", a mano — nessuna UI dedicata) e l'**email** di ogni cliente destinatario (dalla Dashboard Amministratore → "✎ Modifica", o alla creazione del cliente).

Finché questa configurazione non è completa, la checkbox resta disponibile ma l'invio fallisce in modo pulito (non bloccante) — la feature è quindi distribuibile e verificabile anche prima che le credenziali reali esistano.

**Priorità Fathom**: l'estrazione è testata e calibrata soprattutto su Fathom (Circleback e Loom restano supportati nel codice ma non sono la priorità attuale). Fathom spesso non ha una sezione "Action Items" esplicita — i task veri stanno in "Task della settimana"/"Task del mese" del summary — quindi `estraiMeetingData` ha un fallback (`isActionItemsSuspicious`/`actionItemsFromTaskLines` in `src/lib/estrazione.ts`) che ricostruisce gli action item da quelle sezioni se il modello restituisce solo nomi di partecipanti.

Il cliente finale (via `code`, solo se `mostra_tab_extra=TRUE`) vede lo storico meeting in sola lettura, ma **filtrato lato server** a un sottoinsieme whitelisted (titolo, data, durata, partecipanti, riassunto, action item) — mai sentiment, referente, campi di consulenza interna, KPI o il link originale del meeting. Il filtro (`campiVisibiliCliente` in `src/lib/meeting.ts`) è una whitelist positiva: un campo nuovo aggiunto in futuro al template di estrazione resta nascosto finché non viene esplicitamente aggiunto alla whitelist — nessuna migrazione di schema necessaria quando cambia il template. PDF ed email non sono esposti al cliente pubblico.

## Deploy

Push su `main` → deploy automatico su Vercel. Il cron gira ogni giorno alle 05:00 UTC (`vercel.json`) e rilegge gli ultimi 3 giorni per catturare aggiornamenti tardivi di attribuzione Meta.
