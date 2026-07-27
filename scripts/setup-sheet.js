/**
 * Crea lo spreadsheet Google "Meta Manager ALC" con le 4 tab e le intestazioni corrette.
 * Uso: node --env-file=.env.local scripts/setup-sheet.js
 */
const { google } = require("googleapis");

const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

if (!clientId || !clientSecret || !refreshToken) {
  console.error(
    "Mancano GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN.\n" +
      "Esegui con: node --env-file=.env.local scripts/setup-sheet.js"
  );
  process.exit(1);
}

const auth = new google.auth.OAuth2(clientId, clientSecret);
auth.setCredentials({ refresh_token: refreshToken });
const sheets = google.sheets({ version: "v4", auth });

const TABS = [
  { title: "Clienti", headers: ["cliente_id", "nome", "ad_account_id", "access_code", "attivo"] },
  { title: "Campagne", headers: ["campaign_id", "cliente_id", "nome_campagna", "tipo_campagna"] },
  {
    title: "MetaDaily",
    headers: ["data", "cliente_id", "campaign_id", "spesa", "impressions", "clicks", "ctr", "cpc", "cpm", "lead"],
  },
  {
    title: "Funnel",
    headers: [
      "mese",
      "cliente_id",
      "tipo_campagna",
      "richieste",
      "appuntamenti_fissati",
      "appuntamenti_effettuati",
      "vendite",
      "fatturato",
    ],
  },
];

async function main() {
  const createRes = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "Meta Manager ALC" },
      sheets: TABS.map((t) => ({ properties: { title: t.title } })),
    },
  });

  const spreadsheetId = createRes.data.spreadsheetId;

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: "USER_ENTERED",
      data: TABS.map((t) => ({
        range: `${t.title}!A1`,
        values: [t.headers],
      })),
    },
  });

  console.log("\nSpreadsheet creato:\n");
  console.log(`SHEET_ID: ${spreadsheetId}`);
  console.log(`URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit\n`);
}

main().catch((err) => {
  console.error("Errore:", err.message);
  process.exit(1);
});
