# Meta Manager ALC

Dashboard KPI multi-cliente per **Andrea Lenzi Consulting** che unisce spesa/lead di Meta Ads (tirati automaticamente) con il funnel post-lead (richieste, appuntamenti, vendite, fatturato) tracciato a mano dal team.

## Stack

- **Next.js 16** (App Router), deploy su **Vercel**
- **Google Sheets API** (service account) come database condiviso
- **Meta Graph API** (Marketing API) per spesa/lead, via cron giornaliero (Vercel Cron)

## Setup

### 1. Google Sheet centrale

Crea uno spreadsheet Google con **4 tab**, ognuna con la riga 1 come intestazione (i nomi delle colonne sono liberi, l'app legge per posizione):

**Clienti**
| A cliente_id | B nome | C ad_account_id | D access_code | E attivo |
|---|---|---|---|---|
| es. `alc-01` | Nome Cliente | ID ad account Meta (senza `act_`) | codice univoco per il link cliente | `TRUE`/`FALSE` |

**Campagne** — popolata automaticamente dal cron alla prima comparsa di una campagna (tipo_campagna vuoto); valorizza `tipo_campagna` a mano.
| A campaign_id | B cliente_id | C nome_campagna | D tipo_campagna |
|---|---|---|---|

**MetaDaily** — scritta SOLO dal cron, non modificare a mano.
| A data | B cliente_id | C campaign_id | D spesa | E impressions | F clicks | G ctr | H cpc | I cpm | J lead |
|---|---|---|---|---|---|---|---|---|---|

**Funnel** — aggiornata a mano da Andrea/team, una riga per mese+cliente+tipo campagna.
| A mese (YYYY-MM) | B cliente_id | C tipo_campagna | D richieste | E appuntamenti_fissati | F appuntamenti_effettuati | G vendite | H fatturato |
|---|---|---|---|---|---|---|---|

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

## Accessi

- **Team**: `/login` con `TEAM_PASSWORD` → `/dashboard` con selettore cliente
- **Cliente finale**: link diretto `/report/<access_code>` (colonna D della tab Clienti) — sola lettura, filtrato sul suo cliente

## Deploy

Push su `main` → deploy automatico su Vercel. Il cron gira ogni giorno alle 05:00 UTC (`vercel.json`) e rilegge gli ultimi 3 giorni per catturare aggiornamenti tardivi di attribuzione Meta.
