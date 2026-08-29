import { describe, expect, it } from "vitest";
import { valutaCampagna } from "./valutazioneCampagna";

describe("valutaCampagna — dimensione Costo per Lead", () => {
  it("CPL uguale al target (1,0x) -> successo", () => {
    const r = valutaCampagna({ costoPerLead: 10, frequenza: 1, targetCpl: 10 });
    expect(r.livello).toBe("successo");
  });

  it("CPL sotto il target -> successo", () => {
    const r = valutaCampagna({ costoPerLead: 8, frequenza: 1, targetCpl: 10 });
    expect(r.livello).toBe("successo");
  });

  it("CPL a 1,25x il target (esattamente al limite) -> attenzione, non critico", () => {
    const r = valutaCampagna({ costoPerLead: 12.5, frequenza: 1, targetCpl: 10 });
    expect(r.livello).toBe("attenzione");
    expect(r.motivo).toContain("25%");
  });

  it("CPL appena sopra 1,25x il target -> critico", () => {
    const r = valutaCampagna({ costoPerLead: 12.51, frequenza: 1, targetCpl: 10 });
    expect(r.livello).toBe("critico");
  });

  it("nessun target CPL impostato -> non-valutabile (frequenza tenuta anch'essa non-valutabile, per isolare il caso)", () => {
    const r = valutaCampagna({ costoPerLead: 8, frequenza: null, targetCpl: null });
    expect(r.livello).toBe("non-valutabile");
  });

  it("CPL assente (nessun lead) -> non-valutabile (frequenza tenuta anch'essa non-valutabile, per isolare il caso)", () => {
    const r = valutaCampagna({ costoPerLead: null, frequenza: null, targetCpl: 10 });
    expect(r.livello).toBe("non-valutabile");
  });

  it("nessun target CPL, ma la frequenza dà un verdetto reale -> il verdetto reale vince comunque (non-valutabile perde sempre da solo)", () => {
    const r = valutaCampagna({ costoPerLead: 8, frequenza: 1, targetCpl: null });
    expect(r.livello).toBe("successo");
  });
});

describe("valutaCampagna — dimensione Frequenza", () => {
  it("frequenza sopra 2,5 -> attenzione, mai critico da sola", () => {
    const r = valutaCampagna({ costoPerLead: null, frequenza: 2.6, targetCpl: null });
    expect(r.livello).toBe("attenzione");
  });

  it("frequenza esattamente 2,5 -> successo (soglia esclusiva, serve superarla non raggiungerla)", () => {
    // CPL tenuto a un valore noto di "successo" (5 <= target 10) per isolare il comportamento della
    // sola frequenza nel risultato combinato.
    const r = valutaCampagna({ costoPerLead: 5, frequenza: 2.5, targetCpl: 10 });
    expect(r.livello).toBe("successo");
  });

  it("frequenza assente -> non-valutabile su quella dimensione", () => {
    const r = valutaCampagna({ costoPerLead: 8, targetCpl: 10, frequenza: null });
    // CPL è successo (8 <= 10), frequenza è non-valutabile -> il verdetto reale (successo) vince
    expect(r.livello).toBe("successo");
  });
});

describe("valutaCampagna — combinazione, il peggio vince", () => {
  it("CPL attenzione + frequenza successo -> vince attenzione (il peggio)", () => {
    const r = valutaCampagna({ costoPerLead: 11, frequenza: 1, targetCpl: 10 });
    expect(r.livello).toBe("attenzione");
  });

  it("CPL successo + frequenza attenzione -> vince attenzione (il peggio)", () => {
    const r = valutaCampagna({ costoPerLead: 8, frequenza: 3, targetCpl: 10 });
    expect(r.livello).toBe("attenzione");
  });

  it("CPL critico + frequenza attenzione -> vince critico (il peggio), motivo cita solo il CPL", () => {
    const r = valutaCampagna({ costoPerLead: 20, frequenza: 3, targetCpl: 10 });
    expect(r.livello).toBe("critico");
    expect(r.motivo).toContain("Costo per Lead");
    expect(r.motivo).not.toContain("Frequenza");
  });

  it("entrambe le dimensioni ad attenzione contemporaneamente -> il motivo cita entrambe le ragioni, non solo una", () => {
    const r = valutaCampagna({ costoPerLead: 11, frequenza: 3, targetCpl: 10 });
    expect(r.livello).toBe("attenzione");
    expect(r.motivo).toContain("Costo per Lead");
    expect(r.motivo).toContain("Frequenza");
  });

  it("entrambe le dimensioni non-valutabili -> non-valutabile vince solo in questo caso", () => {
    const r = valutaCampagna({ costoPerLead: null, frequenza: null, targetCpl: null });
    expect(r.livello).toBe("non-valutabile");
    expect(r.motivo).toContain("target");
    expect(r.motivo).toContain("Frequenza");
  });

  it("un verdetto reale su una sola dimensione vince sempre contro non-valutabile sull'altra", () => {
    const soloCpl = valutaCampagna({ costoPerLead: 20, frequenza: null, targetCpl: 10 });
    expect(soloCpl.livello).toBe("critico");
    const soloFrequenza = valutaCampagna({ costoPerLead: null, frequenza: 3, targetCpl: null });
    expect(soloFrequenza.livello).toBe("attenzione");
  });
});
