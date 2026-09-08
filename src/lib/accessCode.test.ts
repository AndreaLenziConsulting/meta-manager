import { describe, expect, it } from "vitest";
import { generaAccessCode, generaClienteId, generaTaskIdManuale } from "./accessCode";

describe("generaClienteId", () => {
  it("crea uno slug minuscolo con trattini dal nome", () => {
    expect(generaClienteId("Mobilieri Bianchi Srl", new Set())).toBe("mobilieri-bianchi-srl");
  });

  it("rimuove accenti/diacritici", () => {
    expect(generaClienteId("Àrredamenti è Design", new Set())).toBe("arredamenti-e-design");
  });

  it("rimuove punteggiatura e collassa spazi/simboli multipli in un solo trattino", () => {
    expect(generaClienteId("Bianchi & Figli S.r.l.  (Officina)", new Set())).toBe("bianchi-figli-s-r-l-officina");
  });

  it("aggiunge un suffisso numerico su collisione, incrementale finché libero", () => {
    const esistenti = new Set(["mobilieri-bianchi-srl", "mobilieri-bianchi-srl-2"]);
    expect(generaClienteId("Mobilieri Bianchi Srl", esistenti)).toBe("mobilieri-bianchi-srl-3");
  });

  it("nessuna collisione -> nessun suffisso", () => {
    expect(generaClienteId("Nuovo Cliente", new Set(["altro-cliente"]))).toBe("nuovo-cliente");
  });

  it("nome senza caratteri alfanumerici ripiega su 'cliente'", () => {
    expect(generaClienteId("!!!", new Set())).toBe("cliente");
  });
});

describe("generaTaskIdManuale", () => {
  it("crea uno slug dalla descrizione", () => {
    expect(generaTaskIdManuale("Richiamare il cliente venerdì", new Set())).toBe("richiamare-il-cliente-venerdi");
  });

  it("tronca a 40 caratteri senza lasciare un trattino residuo al taglio", () => {
    const id = generaTaskIdManuale("Preparare la presentazione per il meeting trimestrale con il cliente", new Set());
    expect(id.length).toBeLessThanOrEqual(40);
    expect(id.endsWith("-")).toBe(false);
  });

  it("aggiunge un suffisso numerico su collisione", () => {
    expect(generaTaskIdManuale("Follow up", new Set(["follow-up"]))).toBe("follow-up-2");
  });

  it("descrizione senza caratteri alfanumerici ripiega su 'attivita'", () => {
    expect(generaTaskIdManuale("!!!", new Set())).toBe("attivita");
  });
});

describe("generaAccessCode", () => {
  it("genera una stringa esadecimale di 10 caratteri", () => {
    const code = generaAccessCode();
    expect(code).toMatch(/^[0-9a-f]{10}$/);
  });

  it("due chiamate producono codici diversi", () => {
    expect(generaAccessCode()).not.toBe(generaAccessCode());
  });
});
