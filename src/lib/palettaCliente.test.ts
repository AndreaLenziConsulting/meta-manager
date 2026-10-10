import { describe, expect, it } from "vitest";
import { contrasto } from "@/lib/colore";
import { palettaCliente } from "./palettaCliente";

const BIANCO = "#ffffff";

// I colori veri dei clienti con una personalizzazione al 10/10/2026: primari chiari e scuri, secondari
// chiari e scuri. La tavolozza deve reggere con tutti.
const CLIENTI: Record<string, [string, string]> = {
  "verde oliva e lime": ["#76943C", "#D6DE3F"],
  "verde e lime": ["#1C864C", "#B1DB32"],
  "azzurro acceso e nero": ["#00CCFF", "#000000"],
  "ottanio e giallo": ["#39B0C8", "#FDCD2D"],
  "petrolio e grigio azzurro": ["#166B85", "#A9C2CD"],
  "blu e viola scuro": ["#006CFF", "#1C1538"],
};

describe("palettaCliente: ogni testo si legge sul suo fondo", () => {
  for (const [nome, [primario, secondario]] of Object.entries(CLIENTI)) {
    describe(nome, () => {
      const p = palettaCliente(primario, secondario);

      it("il testo dei pulsanti si legge sull'accento (4,5:1)", () => {
        expect(contrasto(p["--su-accento"], p["--accento"])).toBeGreaterThanOrEqual(4.5);
      });

      it("titoli, testo e testo secondario si leggono su bianco e sul fondo di pagina", () => {
        expect(contrasto(p["--inchiostro"], BIANCO)).toBeGreaterThanOrEqual(12);
        expect(contrasto(p["--testo"], p["--sfondo"])).toBeGreaterThanOrEqual(7);
        expect(contrasto(p["--testo-secondario"], BIANCO)).toBeGreaterThanOrEqual(5.2);
        expect(contrasto(p["--testo-secondario"], p["--sfondo"])).toBeGreaterThanOrEqual(4.5);
      });

      it("il testo di accento si legge su bianco e sul fondo tenue", () => {
        expect(contrasto(p["--accento-testo"], BIANCO)).toBeGreaterThanOrEqual(4.5);
        expect(contrasto(p["--accento-testo"], p["--accento-tenue"])).toBeGreaterThanOrEqual(4.49);
      });

      it("il bordo dei campi si vede (3:1 su bianco)", () => {
        expect(contrasto(p["--bordo-campo"], BIANCO)).toBeGreaterThanOrEqual(3);
      });

      it("sui fondi scuri: accento visibile, testi leggibili", () => {
        expect(contrasto(p["--blu-luce"], p["--notte"])).toBeGreaterThanOrEqual(3);
        expect(contrasto(p["--accento-su-notte"], p["--notte"])).toBeGreaterThanOrEqual(6);
        expect(contrasto(p["--su-notte-secondario"], p["--notte"])).toBeGreaterThanOrEqual(7);
        expect(contrasto(p["--su-blu-luce"], p["--blu-luce"])).toBeGreaterThanOrEqual(4.5);
      });

      it("la scala dell'accento va dal più chiaro al più scuro, senza salti", () => {
        const scala = [p["--blu-10"], p["--blu-20"], p["--blu-40"], p["--blu-60"], p["--blu"]].map((c) => contrasto(c, BIANCO));
        for (let i = 1; i < scala.length; i++) expect(scala[i]).toBeGreaterThan(scala[i - 1]);
      });
    });
  }
});

describe("palettaCliente: i colori del cliente restano i suoi", () => {
  it("un primario che regge il testo bianco resta identico", () => {
    const p = palettaCliente("#1C864C", "#B1DB32");
    expect(p["--accento"]).toBe("#1C864C");
    expect(p["--su-accento"]).toBe(BIANCO);
  });

  it("un primario a cui manca poco viene scurito appena, e tiene il testo bianco", () => {
    const p = palettaCliente("#76943C", "#D6DE3F");
    expect(p["--accento"]).not.toBe("#76943C");
    expect(p["--su-accento"]).toBe(BIANCO);
    // Appena: resta più vicino al colore di partenza che al nero.
    expect(contrasto(p["--accento"], "#76943C")).toBeLessThan(1.5);
  });

  it("un primario chiaro resta com'è e prende il testo scuro", () => {
    const p = palettaCliente("#00CCFF", "#000000");
    expect(p["--accento"]).toBe("#00CCFF");
    expect(p["--su-accento"]).toBe("#000000");
  });

  it("lo scuro dei titoli è il secondario quando è lui il più scuro", () => {
    expect(palettaCliente("#006CFF", "#1C1538")["--inchiostro"]).toBe("#1C1538");
    expect(palettaCliente("#00CCFF", "#000000")["--inchiostro"]).toBe("#000000");
  });

  it("gli alias delle classi portano gli stessi colori dei token", () => {
    const p = palettaCliente("#166B85", "#A9C2CD");
    expect(p["--brand-primary"]).toBe(p["--accento"]);
    expect(p["--ink-900"]).toBe(p["--inchiostro"]);
    expect(p["--ink-700"]).toBe(p["--testo"]);
    expect(p["--ink-500"]).toBe(p["--testo-secondario"]);
    expect(p["--surface"]).toBe(p["--sfondo"]);
  });

  it("un colore solo (primario e secondario uguali) dà comunque una tavolozza completa", () => {
    const p = palettaCliente("#166B85", "#166B85");
    expect(contrasto(p["--su-accento"], p["--accento"])).toBeGreaterThanOrEqual(4.5);
    expect(contrasto(p["--blu-luce"], p["--notte"])).toBeGreaterThanOrEqual(3);
  });
});
