/**
 * Backfill storico: recupera spesa/lead per campagna da Meta Ads su una finestra ampia
 * e li scrive in MetaDaily. Da lanciare in locale (non ha il limite di 60s del cron su Vercel).
 * Uso: node --env-file=.env.local scripts/backfill.js [YYYY-MM-DD since]
 */
const { google } = require("googleapis");

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;
const sheetId = process.env.SHEET_ID;
const metaToken = process.env.META_ACCESS_TOKEN;
const metaApiVersion = process.env.META_API_VERSION || "v21.0";

if (!clientId || !clientSecret || !refreshToken || !sheetId || !metaToken) {
  console.error("Mancano variabili d'ambiente. Esegui con: node --env-file=.env.local scripts/backfill.js");
  process.exit(1);
}

const auth = new google.auth.OAuth2(clientId, clientSecret);
auth.setCredentials({ refresh_token: refreshToken });
const sheets = google.sheets({ version: "v4", auth });

const twoYearsAgo = new Date();
twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
const since = process.argv[2] || twoYearsAgo.toISOString().slice(0, 10);
const until = new Date().toISOString().slice(0, 10);

const LEAD_ACTION_PRIORITY = ["onsite_conversion.lead_grouped", "lead", "offsite_conversion.fb_pixel_lead"];

function guessTipoCampagnaFromNome(nomeCampagna) {
  const match = nomeCampagna.match(/^\[([^\]]+)\]/);
  const testo = match?.[1]?.trim();
  if (!testo) return "";
  return testo.charAt(0).toUpperCase() + testo.slice(1).toLowerCase();
}

function extractLeads(actions) {
  if (!actions) return 0;
  for (const type of LEAD_ACTION_PRIORITY) {
    const match = actions.find((a) => a.action_type === type);
    if (match) return Number(match.value || 0);
  }
  return 0;
}

async function fetchCampaignInsights(adAccountId, clienteId) {
  const fields = "campaign_id,campaign_name,spend,impressions,clicks,ctr,cpc,cpm,actions";
  const url = new URL(`https://graph.facebook.com/${metaApiVersion}/act_${adAccountId}/insights`);
  url.searchParams.set("level", "campaign");
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("fields", fields);
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("access_token", metaToken);
  url.searchParams.set("limit", "500");

  const rows = [];
  const campagneVisteMap = new Map();
  let nextUrl = url.toString();

  while (nextUrl) {
    const res = await fetch(nextUrl);
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(`Meta API error: ${json.error?.message || res.statusText}`);
    }
    for (const item of json.data ?? []) {
      campagneVisteMap.set(item.campaign_id, item.campaign_name);
      rows.push([
        item.date_start,
        clienteId,
        item.campaign_id,
        Number(item.spend || 0),
        Number(item.impressions || 0),
        Number(item.clicks || 0),
        Number(item.ctr || 0),
        Number(item.cpc || 0),
        Number(item.cpm || 0),
        extractLeads(item.actions),
      ]);
    }
    nextUrl = json.paging?.next ?? null;
  }

  return { rows, campagne: Array.from(campagneVisteMap.entries()).map(([id, nome]) => ({ id, nome })) };
}

async function main() {
  console.log(`Backfill dal ${since} al ${until}\n`);

  const clientiRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Clienti!A2:E",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const clienti = (clientiRes.data.values || [])
    .filter((r) => r[0])
    .map((r) => ({ clienteId: String(r[0]), adAccountId: String(r[2]), attivo: String(r[4]).toUpperCase() === "TRUE" }))
    .filter((c) => c.attivo);

  const campagneRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "Campagne!A2:D",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const campagneEsistenti = new Set((campagneRes.data.values || []).map((r) => String(r[0])));

  const metaDailyRes = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: "MetaDaily!A2:C",
    valueRenderOption: "UNFORMATTED_VALUE",
  });
  const indexByKey = new Map();
  (metaDailyRes.data.values || []).forEach((r, i) => {
    indexByKey.set(`${r[1]}|${r[2]}|${r[0]}`, i + 2);
  });

  for (const cliente of clienti) {
    console.log(`Cliente ${cliente.clienteId} (ad account ${cliente.adAccountId})...`);
    const { rows, campagne } = await fetchCampaignInsights(cliente.adAccountId, cliente.clienteId);
    console.log(`  ${rows.length} righe trovate, ${campagne.length} campagne`);

    const nuoveCampagne = campagne.filter((c) => !campagneEsistenti.has(c.id));
    if (nuoveCampagne.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "Campagne!A:D",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: nuoveCampagne.map((c) => [c.id, cliente.clienteId, c.nome, guessTipoCampagnaFromNome(c.nome)]),
        },
      });
      nuoveCampagne.forEach((c) => campagneEsistenti.add(c.id));
      console.log(`  aggiunte ${nuoveCampagne.length} nuove campagne in Campagne (da classificare)`);
    }

    const daAggiornare = [];
    const daAggiungere = [];
    for (const row of rows) {
      const key = `${row[1]}|${row[2]}|${row[0]}`;
      const rigaEsistente = indexByKey.get(key);
      if (rigaEsistente) {
        daAggiornare.push({ range: `MetaDaily!A${rigaEsistente}:J${rigaEsistente}`, values: [row] });
      } else {
        daAggiungere.push(row);
      }
    }

    if (daAggiornare.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: sheetId,
        requestBody: { valueInputOption: "USER_ENTERED", data: daAggiornare },
      });
      console.log(`  aggiornate ${daAggiornare.length} righe esistenti`);
    }
    if (daAggiungere.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: "MetaDaily!A:J",
        valueInputOption: "USER_ENTERED",
        requestBody: { values: daAggiungere },
      });
      console.log(`  aggiunte ${daAggiungere.length} nuove righe`);
    }
  }

  console.log("\nBackfill completato.");
}

main().catch((err) => {
  console.error("Errore:", err.message);
  process.exit(1);
});
