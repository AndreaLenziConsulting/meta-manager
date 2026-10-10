import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { indirizzoLogo, indirizzoPubblico } from "./logoCliente";
import { rifilaLogo } from "./logoRifilato";

/** Un foglio con un rettangolo colorato al centro: il logo "piccolo dentro un quadrato grande". */
async function logoConMargine(lato: number, larghezza: number, altezza: number, fondo: sharp.Color): Promise<Buffer> {
  const disegno = await sharp({ create: { width: larghezza, height: altezza, channels: 4, background: "#166B85" } }).png().toBuffer();
  return sharp({ create: { width: lato, height: lato, channels: 4, background: fondo } })
    .composite([{ input: disegno, left: Math.round((lato - larghezza) / 2), top: Math.round((lato - altezza) / 2) }])
    .png()
    .toBuffer();
}

describe("rifilaLogo", () => {
  it("toglie il margine trasparente: resta il solo disegno", async () => {
    const esito = await sharp(await rifilaLogo(await logoConMargine(400, 120, 80, { r: 0, g: 0, b: 0, alpha: 0 }))).metadata();
    expect(esito.format).toBe("png");
    expect(esito.width).toBe(120);
    expect(esito.height).toBe(80);
  });

  it("toglie anche il margine bianco dei loghi senza trasparenza", async () => {
    const esito = await sharp(await rifilaLogo(await logoConMargine(400, 100, 100, "#ffffff"))).metadata();
    expect(esito.width).toBe(100);
    expect(esito.height).toBe(100);
  });

  it("riduce un logo enorme a una misura da schermo, senza cambiarne le proporzioni", async () => {
    const esito = await sharp(await rifilaLogo(await logoConMargine(2048, 1600, 800, { r: 0, g: 0, b: 0, alpha: 0 }))).metadata();
    expect(esito.width).toBe(360);
    expect(esito.height).toBe(180);
  });

  it("un'immagine di un solo colore non fa errore: torna com'è", async () => {
    const pieno = await sharp({ create: { width: 64, height: 64, channels: 4, background: "#166B85" } }).png().toBuffer();
    const esito = await sharp(await rifilaLogo(pieno)).metadata();
    expect(esito.width).toBe(64);
    expect(esito.height).toBe(64);
  });

  it("un file che non è un'immagine fa errore: chi chiama mostra l'originale", async () => {
    await expect(rifilaLogo(Buffer.from("non sono un'immagine"))).rejects.toThrow();
  });
});

describe("indirizzoLogo", () => {
  it("senza logo non c'è indirizzo", () => {
    expect(indirizzoLogo({ clienteId: "c1" }, "")).toBeUndefined();
    expect(indirizzoLogo({ clienteId: "c1" }, undefined)).toBeUndefined();
  });

  it("per il team passa il cliente, per il link pubblico il codice", () => {
    expect(indirizzoLogo({ clienteId: "metra arredamenti" }, "https://x.it/logo.png")).toMatch(/^\/api\/logo\?clienteId=metra%20arredamenti&v=/);
    expect(indirizzoLogo({ code: "abc" }, "https://x.it/logo.png")).toMatch(/^\/api\/logo\?code=abc&v=/);
  });

  it("cambia quando cambia l'indirizzo del logo, così il browser non tiene il vecchio", () => {
    expect(indirizzoLogo({ clienteId: "c1" }, "https://x.it/a.png")).not.toBe(indirizzoLogo({ clienteId: "c1" }, "https://x.it/b.png"));
  });
});

describe("indirizzoPubblico", () => {
  it("accetta un sito normale", () => {
    expect(indirizzoPubblico("https://www.agricobots.com/logo.png")).toBe(true);
    expect(indirizzoPubblico("http://esempio.it/logo.svg")).toBe(true);
  });

  it("rifiuta la rete interna e tutto ciò che non è http", () => {
    for (const url of ["http://localhost/logo.png", "http://127.0.0.1/x", "http://10.0.0.5/x", "http://192.168.1.1/x", "http://169.254.169.254/latest", "http://172.16.0.1/x", "http://intranet/x", "http://[::1]/x", "file:///etc/passwd", "data:image/png;base64,AAAA", "non un indirizzo"]) {
      expect(indirizzoPubblico(url), url).toBe(false);
    }
  });
});
