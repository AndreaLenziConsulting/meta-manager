/**
 * Ottiene un refresh token OAuth2 per l'account Google che avrà accesso allo Sheet.
 * Uso: node scripts/get-refresh-token.js <CLIENT_ID> <CLIENT_SECRET>
 */
const http = require("http");
const { URL } = require("url");
const { execSync } = require("child_process");
const { google } = require("googleapis");

const [, , clientId, clientSecret] = process.argv;

if (!clientId || !clientSecret) {
  console.error("Uso: node scripts/get-refresh-token.js <CLIENT_ID> <CLIENT_SECRET>");
  process.exit(1);
}

const PORT = 53682;
const redirectUri = `http://localhost:${PORT}`;
const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/spreadsheets"],
});

console.log("\nApri questo link nel browser e accedi con l'account Google da usare per lo Sheet:\n");
console.log(authUrl + "\n");

try {
  execSync(`start "" "${authUrl}"`, { shell: "cmd.exe" });
} catch {
  // Se non si apre da solo, copia e incolla il link sopra nel browser.
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, redirectUri);
  const code = url.searchParams.get("code");

  if (!code) {
    res.end("Nessun codice ricevuto su questa richiesta.");
    return;
  }

  res.end("Fatto! Puoi chiudere questa finestra e tornare al terminale.");

  oauth2Client
    .getToken(code)
    .then(({ tokens }) => {
      console.log("\nRefresh token:\n");
      console.log(tokens.refresh_token);
      console.log("\nAggiungilo a .env.local come GOOGLE_OAUTH_REFRESH_TOKEN\n");
      server.close();
      process.exit(0);
    })
    .catch((err) => {
      console.error("Errore nello scambio del codice:", err.message);
      server.close();
      process.exit(1);
    });
});

server.listen(PORT, () => {
  console.log(`In ascolto su ${redirectUri} — completa il login nel browser…`);
});
