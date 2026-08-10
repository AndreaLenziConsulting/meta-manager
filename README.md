# Meta Manager ALC

Dashboard KPI multi-cliente per **Andrea Lenzi Consulting** che unisce spesa/lead di Meta Ads (tirati automaticamente) con il funnel post-lead (richieste, appuntamenti, vendite, fatturato) tracciato a mano dal team.

## Stack

- **Next.js 16** (App Router), deploy su **Vercel**
- **Google Sheets API** (service account) come database condiviso
- **Meta Graph API** (Marketing API) per spesa/lead, via cron giornaliero (Vercel Cron)

## Setup

### 1. Google Sheet centrale

Crea uno spreadsheet Google con **6 tab**, ognuna con la riga 1 come intestazione (i nomi delle colonne sono liberi, l'app legge per posizione):

**Clienti**
| A cliente_id | B nome | C ad_account_id | D access_code | E attivo | F consulente_id | G target_cpa | H target_cpl | I mostra_tab_extra |
|---|---|---|---|---|---|---|---|---|
| es. `alc-01` | Nome Cliente | ID ad account Meta (senza `act_`) | codice univoco per il link cliente | `TRUE`/`FALSE` | id del consulente assegnato (vedi tab Consulenti) | € costo per vendita obiettivo (opzionale) | € costo per lead obiettivo (opzionale) | `TRUE` per mostrare al cliente finale anche i tab Attività/Meeting (default `FALSE` = solo KPI) |

**Consulenti** — un consulente vede solo i clienti con il proprio `consulente_id` in colonna F della tab Clienti.
| A consulente_id | B nome | C password | D attivo |
|---|---|---|---|

**Campagne** — popolata automaticamente dal cron alla prima comparsa di una campagna (tipo_campagna vuoto); valorizza `tipo_campagna` a mano. `stato` è scritta SOLO dal sync (stato Meta grezzo: `ACTIVE`, `PAUSED`, ...), non modificare a mano.
| A campaign_id | B cliente_id | C nome_campagna | D tipo_campagna | E stato |
|---|---|---|---|---|

**MetaDaily** — scritta SOLO dal cron, non modificare a mano.
| A data | B cliente_id | C campaign_id | D spesa | E impressions | F clicks | G ctr | H cpc | I cpm | J lead |
|---|---|---|---|---|---|---|---|---|---|

**Funnel** — aggiornata a mano da Andrea/team, una riga per mese+cliente+tipo campagna.
| A mese (YYYY-MM) | B cliente_id | C tipo_campagna | D richieste | E appuntamenti_fissati | F appuntamenti_effettuati | G vendite | H fatturato |
|---|---|---|---|---|---|---|---|

**StoricoStatoCampagne** — scritta SOLO dal sync, non modificare a mano. Una riga per ogni transizione di stato rilevata (non una riga per sync): se lo stato non cambia da un sync all'altro non si scrive nulla. La prima volta che una campagna viene sincronizzata genera comunque una riga con `stato_precedente` vuoto (prima rilevazione, non un vero cambiamento). `data_ora` è il momento in cui il sync se n'è accorto, non necessariamente l'istante esatto del cambio su Meta Ads (dipende da finestra rolling e cadenza del cron). Usata per mostrare "dal 5 ago 2026" sotto il badge di stato nella tabella "per singola campagna".
| A data_ora (ISO) | B campaign_id | C cliente_id | D nome_campagna | E stato_precedente | F stato_nuovo |
|---|---|---|---|---|---|

Nessuna condivisione necessaria: l'app accede allo Sheet con il tuo stesso account Google (OAuth2), non con un service account.

### 2. OAuth2 con il tuo account Google

Le policy dell'organizzazione possono bloccare la creazione di chiavi di service account
(`iam.disableServiceAccountKeyCreation`) — in quel caso si usa OAuth2 con il tuo account Google:

1. Google Cloud Console → crea/seleziona progetto → abilita **Google Sheets API**
2. **API e servizi → Schermata di consenso OAuth**: tipo utente **Interno** (se il progetto è nell'organizzazione Workspace) o **Esterno** con te stesso come test user; nome app "Meta Manager ALC"
3. **API e servizi → Credenziali → Crea credenziali → ID client OAuth** → tipo **App desktop** → copia **Client ID** e **Client secret**
4. Esegui in locale:
   ```bash
   node scripts/get-refresh-token.js <CLIENT_ID> <CLIENT_SECRET>
   ```
   Si apre il browser, accedi con l'account Google che possiede lo spreadsheet e concedi l'accesso a Google Sheets. Lo script stampa un **refresh token** in console.
5. In `.env.local`: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_REFRESH_TOKEN` (dal passo 4), `SHEET_ID` (dall'URL dello spreadsheet)

### 3. Meta Marketing API

Usa il system user token del Business Manager ALC (già configurato con accesso `ads_read` su tutti gli ad account clienti) come `META_ACCESS_TOKEN`.

### 4. Variabili d'ambiente

Copia `.env.local.example` in `.env.local` e compila tutti i valori (vedi anche `TEAM_PASSWORD`, `SESSION_SECRET`, `CRON_SECRET` — stringhe casuali a scelta).

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

- **Amministratore**: `/login` con `TEAM_PASSWORD` → `/dashboard` con tutti i clienti + link "Salute clienti" (`/dashboard/salute`, panoramica con badge 🔴🟡🟢 basato su CPA/CPL vs target)
- **Consulente**: stesso `/login`, ma con la password individuale definita nella tab `Consulenti` → `/dashboard` mostra solo i clienti con quel `consulente_id` assegnato
- **Cliente finale**: link diretto `/report/<access_code>` (colonna D della tab Clienti) — sola lettura, filtrato sul suo cliente, non passa da `/login`

## Scheda cliente — tab

Team/consulente/admin vedono sempre 3 tab: **KPI** (quello di sempre), **Attività** e **Meeting** (placeholder, da sviluppare — il secondo integrerà Fast Report). Il cliente finale vede solo KPI a meno che `mostra_tab_extra` sia `TRUE` per quel cliente in `Clienti`.

## Deploy

Push su `main` → deploy automatico su Vercel. Il cron gira ogni giorno alle 05:00 UTC (`vercel.json`) e rilegge gli ultimi 3 giorni per catturare aggiornamenti tardivi di attribuzione Meta.
