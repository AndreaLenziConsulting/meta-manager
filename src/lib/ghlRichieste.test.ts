import { describe, expect, it } from "vitest";
import { conCacheGhl, richiestaGhlConRiprova } from "./ghlRichieste";

function risposta(status: number, intervalloMs?: number): Response {
  return new Response(status === 429 ? '{"statusCode":429,"message":"Too Many Requests"}' : "{}", {
    status,
    headers: intervalloMs ? { "x-ratelimit-interval-milliseconds": String(intervalloMs) } : {},
  });
}

/** Orologio finto: `dormi` fa avanzare il tempo invece di aspettare davvero. */
function orologio() {
  let ora = 1_000_000;
  const attese: number[] = [];
  return {
    attese,
    adesso: () => ora,
    dormi: async (ms: number) => {
      attese.push(ms);
      ora += ms;
    },
  };
}

describe("richiestaGhlConRiprova", () => {
  it("risposta buona al primo colpo: nessuna attesa, una sola chiamata", async () => {
    const o = orologio();
    let chiamate = 0;
    const res = await richiestaGhlConRiprova("ok-subito", async () => (chiamate++, risposta(200)), o);
    expect(res.status).toBe(200);
    expect(chiamate).toBe(1);
    expect(o.attese).toEqual([]);
  });

  it("429 poi 200: aspetta un quarto dell'intervallo e riprova", async () => {
    const o = orologio();
    const esiti = [risposta(429, 10_000), risposta(200)];
    const res = await richiestaGhlConRiprova("una-riprova", async () => esiti.shift()!, o);
    expect(res.status).toBe(200);
    expect(o.attese).toEqual([2500]);
  });

  it("429 ripetuti: attese crescenti (2,5 / 5 / 7,5 / 10 secondi), poi rinuncia e torna l'ultimo 429", async () => {
    const o = orologio();
    let chiamate = 0;
    const res = await richiestaGhlConRiprova("sempre-429", async () => (chiamate++, risposta(429, 10_000)), o);
    expect(res.status).toBe(429);
    expect(chiamate).toBe(5);
    expect(o.attese).toEqual([2500, 5000, 7500, 10_000]);
  });

  it("senza intestazione dell'intervallo usa 10 secondi", async () => {
    const o = orologio();
    const esiti = [risposta(429), risposta(200)];
    await richiestaGhlConRiprova("senza-intestazione", async () => esiti.shift()!, o);
    expect(o.attese).toEqual([2500]);
  });

  it("un errore diverso dal 429 non viene riprovato: passa al chiamante", async () => {
    const o = orologio();
    let chiamate = 0;
    const res = await richiestaGhlConRiprova("errore-401", async () => (chiamate++, risposta(401)), o);
    expect(res.status).toBe(401);
    expect(chiamate).toBe(1);
  });

  it("la pausa vale per tutte le chiamate dello stesso account: un'altra chiamata aspetta prima ancora di partire", async () => {
    const a = orologio();
    const esiti = [risposta(429, 10_000), risposta(200)];
    await richiestaGhlConRiprova("account-condiviso", async () => esiti.shift()!, a);
    // Un'altra chiamata dello stesso account, vista "nello stesso istante" del 429 (orologio nuovo,
    // non ancora avanzato): non parte subito, aspetta la scadenza fissata dalla prima.
    const b = orologio();
    let partitaDopoAttesa = false;
    await richiestaGhlConRiprova("account-condiviso", async () => ((partitaDopoAttesa = b.attese.length === 1), risposta(200)), b);
    expect(b.attese).toEqual([2500]);
    expect(partitaDopoAttesa).toBe(true);
  });

  it("account diversi non si rallentano a vicenda", async () => {
    const a = orologio();
    await richiestaGhlConRiprova("account-a", async () => risposta(429, 10_000), { ...a, tentativiMassimi: 2 });
    const b = orologio();
    await richiestaGhlConRiprova("account-b", async () => risposta(200), b);
    expect(b.attese).toEqual([]);
  });
});

describe("conCacheGhl", () => {
  it("due richieste contemporanee con la stessa chiave fanno una sola lettura", async () => {
    let letture = 0;
    const carica = async () => {
      letture++;
      return [1, 2, 3];
    };
    const [x, y] = await Promise.all([conCacheGhl("stessa-chiave", carica), conCacheGhl("stessa-chiave", carica)]);
    expect(letture).toBe(1);
    expect(x).toBe(y);
  });

  it("chiavi diverse leggono separatamente", async () => {
    let letture = 0;
    const carica = async () => ++letture;
    await Promise.all([conCacheGhl("chiave-1", carica), conCacheGhl("chiave-2", carica)]);
    expect(letture).toBe(2);
  });

  it("dopo un minuto rilegge", async () => {
    let ora = 0;
    let letture = 0;
    const carica = async () => ++letture;
    await conCacheGhl("scade", carica, () => ora);
    ora = 59_000;
    await conCacheGhl("scade", carica, () => ora);
    expect(letture).toBe(1);
    ora = 61_000;
    await conCacheGhl("scade", carica, () => ora);
    expect(letture).toBe(2);
  });

  it("una lettura fallita non resta in cache: la successiva riprova", async () => {
    let letture = 0;
    const carica = async () => {
      letture++;
      if (letture === 1) throw new Error("GHL giù");
      return "ok";
    };
    await expect(conCacheGhl("fallisce-poi-va", carica)).rejects.toThrow("GHL giù");
    await expect(conCacheGhl("fallisce-poi-va", carica)).resolves.toBe("ok");
    expect(letture).toBe(2);
  });
});
