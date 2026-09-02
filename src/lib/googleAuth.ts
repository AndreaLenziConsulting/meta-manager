import { google } from "googleapis";

/**
 * Client OAuth2 condiviso tra Google Sheets (sheets.ts) e Google Drive (drive.ts) — stesso account
 * del team, stesso refresh token, stesse tre env var (mai un service account separato per Drive,
 * a differenza di Gmail — vedi gmail.ts — che usa domain-wide delegation per un motivo diverso:
 * lì serve "diventare" un indirizzo diverso ad ogni chiamata, qui basta un account fisso, esattamente
 * come per Sheets). Estratto qui perché altrimenti andrebbe duplicato identico in entrambi i moduli
 * (prima viveva solo dentro sheets.ts, che oggi lo consuma da qui).
 *
 * Richiede che il refresh token sia stato generato (o rigenerato) includendo anche lo scope Drive
 * (`https://www.googleapis.com/auth/drive`, vedi scripts/get-refresh-token.js) — un refresh token
 * generato solo per `spreadsheets` continua a funzionare per Sheets ma fallisce con 403 su ogni
 * chiamata Drive: nessun modo di saperlo in anticipo, solo provando la chiamata.
 */
export function getGoogleOAuth2Client() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Google OAuth2 non configurato: mancano GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET / GOOGLE_OAUTH_REFRESH_TOKEN"
    );
  }

  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}
