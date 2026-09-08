import { describe, expect, it } from "vitest";
import { trovaInserzioniOutlier, SOGLIA_OUTLIER_CPL, type InserzioneConStato } from "./inserzioniOutlier";

function inserzione(over: Partial<InserzioneConStato>): InserzioneConStato {
  return { adId: "ad1", adName: "Inserzione 1", campaignId: "c1", nomeCampagna: "Campagna 1", spesa: 100, lead: 10, stato: "ACTIVE", ...over };
}

describe("trovaInserzioniOutlier", () => {
  it("nessun target impostato -> nessun outlier, non un errore", () => {
    expect(trovaInserzioniOutlier([inserzione({ spesa: 1000, lead: 1 })], null)).toEqual([]);
    expect(trovaInserzioniOutlier([inserzione({ spesa: 1000, lead: 1 })], 0)).toEqual([]);
  });

  it("CPL entro la soglia -> non outlier", () => {
    // target 10, CPL 10 (100/10) = 1x -> sotto soglia 2.5x
    expect(trovaInserzioniOutlier([inserzione({ spesa: 100, lead: 10 })], 10)).toEqual([]);
  });

  it(`CPL esattamente a ${SOGLIA_OUTLIER_CPL}x il target -> non outlier (confronto stretto, solo oltre scatta)`, () => {
    // target 10, CPL 25 (250/10) = 2.5x esatto
    expect(trovaInserzioniOutlier([inserzione({ spesa: 250, lead: 10 })], 10)).toEqual([]);
  });

  it("CPL oltre la soglia -> outlier, con costoPerLead e rapportoTarget corretti", () => {
    // target 10, CPL 30 (300/10) = 3x -> oltre 2.5x
    const risultato = trovaInserzioniOutlier([inserzione({ spesa: 300, lead: 10 })], 10);
    expect(risultato).toHaveLength(1);
    expect(risultato[0].costoPerLead).toBe(30);
    expect(risultato[0].rapportoTarget).toBe(3);
  });

  it("spesa > 0 e 0 lead -> costoPerLead Infinity, sempre outlier (budget bruciato senza risultati)", () => {
    const risultato = trovaInserzioniOutlier([inserzione({ spesa: 50, lead: 0 })], 10);
    expect(risultato).toHaveLength(1);
    expect(risultato[0].costoPerLead).toBe(Infinity);
  });

  it("inserzione non ACTIVE -> mai outlier, anche con CPL pessimo (già spenta, non azionabile ora)", () => {
    expect(trovaInserzioniOutlier([inserzione({ spesa: 1000, lead: 1, stato: "PAUSED" })], 10)).toEqual([]);
  });

  it("nessuna spesa -> mai outlier (nessuna base di giudizio)", () => {
    expect(trovaInserzioniOutlier([inserzione({ spesa: 0, lead: 0 })], 10)).toEqual([]);
  });

  it("ordina dal rapporto peggiore al migliore", () => {
    const risultato = trovaInserzioniOutlier(
      [
        inserzione({ adId: "medio", spesa: 300, lead: 10 }), // 3x
        inserzione({ adId: "peggiore", spesa: 500, lead: 10 }), // 5x
        inserzione({ adId: "lieve", spesa: 260, lead: 10 }), // 2.6x
      ],
      10
    );
    expect(risultato.map((i) => i.adId)).toEqual(["peggiore", "medio", "lieve"]);
  });

  it("array vuoto -> array vuoto", () => {
    expect(trovaInserzioniOutlier([], 10)).toEqual([]);
  });
});
