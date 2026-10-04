import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { google } from "googleapis";
import { configRiprovaSheets, deveRiprovareSheets } from "./sheetsRiprova";

function errore(stato: number | undefined, metodo = "GET", tentativi = 0) {
  return {
    config: { method: metodo, retryConfig: { currentRetryAttempt: tentativi, retry: 7 } },
    response: stato === undefined ? undefined : { status: stato },
  };
}

describe("deveRiprovareSheets", () => {
  it("quota superata (429): riprova con qualsiasi metodo, anche una scrittura", () => {
    expect(deveRiprovareSheets(errore(429, "GET"))).toBe(true);
    expect(deveRiprovareSheets(errore(429, "POST"))).toBe(true);
    expect(deveRiprovareSheets(errore(429, "PUT"))).toBe(true);
  });

  it("errore del server (5xx): riprova solo le letture, mai una scrittura (potrebbe essere già applicata)", () => {
    expect(deveRiprovareSheets(errore(503, "GET"))).toBe(true);
    expect(deveRiprovareSheets(errore(500, "POST"))).toBe(false);
    expect(deveRiprovareSheets(errore(503, "PUT"))).toBe(false);
  });

  it("errori della richiesta (400, 403, 404) non si riprovano", () => {
    expect(deveRiprovareSheets(errore(400))).toBe(false);
    expect(deveRiprovareSheets(errore(403))).toBe(false);
    expect(deveRiprovareSheets(errore(404))).toBe(false);
  });

  it("nessuna risposta (rete): al massimo 2 riprove, solo per le letture", () => {
    expect(deveRiprovareSheets(errore(undefined, "GET", 0))).toBe(true);
    expect(deveRiprovareSheets(errore(undefined, "GET", 2))).toBe(false);
    expect(deveRiprovareSheets(errore(undefined, "POST", 0))).toBe(false);
  });

  it("finite le riprove si arrende, anche sul 429", () => {
    expect(deveRiprovareSheets(errore(429, "GET", 7))).toBe(false);
  });

  it("una richiesta annullata non si riprova", () => {
    expect(deveRiprovareSheets({ ...errore(429), name: "AbortError" })).toBe(false);
  });
});

// Prova vera del client Google con questa configurazione, contro un server locale che si comporta
// come Sheets a quota esaurita (429 per le prime N richieste): verifica che il client chiami davvero
// la nostra regola e riprovi fino al successo.
describe("client Google Sheets con configRiprovaSheets", () => {
  let server: Server;
  let base = "";
  let rispondi429 = 0;
  let richieste = 0;

  beforeAll(async () => {
    server = createServer((req, res) => {
      richieste++;
      if (rispondi429 > 0) {
        rispondi429--;
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { code: 429, message: "Quota exceeded for quota metric 'Read requests'" } }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ range: "Clienti!A2:Z", values: [["mobilieri", "Andrea Lenzi Consulting"]] }));
    });
    await new Promise<void>((risolvi) => server.listen(0, "127.0.0.1", () => risolvi()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
  });

  afterAll(() => new Promise<void>((risolvi) => server.close(() => risolvi())));

  function client() {
    return google.sheets({ version: "v4", rootUrl: base, retryConfig: configRiprovaSheets(1) });
  }

  it("tre 429 di fila, poi la risposta: la lettura riesce", async () => {
    rispondi429 = 3;
    richieste = 0;
    const res = await client().spreadsheets.values.get({ spreadsheetId: "x", range: "Clienti!A2:Z" });
    expect(res.data.values).toEqual([["mobilieri", "Andrea Lenzi Consulting"]]);
    expect(richieste).toBe(4);
  }, 20_000);

  it("anche una scrittura (POST) viene riprovata sul 429", async () => {
    rispondi429 = 2;
    richieste = 0;
    await client().spreadsheets.values.append({
      spreadsheetId: "x",
      range: "Clienti!A:Z",
      valueInputOption: "RAW",
      requestBody: { values: [["a"]] },
    });
    expect(richieste).toBe(3);
  }, 20_000);
});
