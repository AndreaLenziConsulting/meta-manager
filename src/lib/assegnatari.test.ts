import { describe, expect, it } from "vitest";
import { classificaAssegnatario, normalizzaAssegnatari, taskOrfana } from "./assegnatari";

describe("classificaAssegnatario", () => {
  it("i due ruoli interni (unico set verificato su TemplateAttivita) -> ruolo", () => {
    expect(classificaAssegnatario("Project Manager")).toBe("ruolo");
    expect(classificaAssegnatario("Consulente Senior")).toBe("ruolo");
  });

  it("'Cliente' -> cliente, non un ruolo generico (il cliente è comunque un responsabile reale)", () => {
    expect(classificaAssegnatario("Cliente")).toBe("cliente");
  });

  it("'Da assegnare' e stringa vuota -> non-assegnato", () => {
    expect(classificaAssegnatario("Da assegnare")).toBe("non-assegnato");
    expect(classificaAssegnatario("")).toBe("non-assegnato");
    expect(classificaAssegnatario("   ")).toBe("non-assegnato");
  });

  it("qualunque altro nome (persona reale, ALC o lato cliente) -> persona", () => {
    expect(classificaAssegnatario("Andrea")).toBe("persona");
    expect(classificaAssegnatario("Francesco Crosa")).toBe("persona");
    expect(classificaAssegnatario("Sherdil")).toBe("persona");
  });
});

describe("taskOrfana", () => {
  it("solo ruoli/non-assegnato -> orfana", () => {
    expect(taskOrfana(["Project Manager"])).toBe(true);
    expect(taskOrfana(["Da assegnare"])).toBe(true);
    expect(taskOrfana(["Project Manager", "Consulente Senior"])).toBe(true);
  });

  it("il cliente da solo NON è orfana: è comunque un responsabile reale", () => {
    expect(taskOrfana(["Cliente"])).toBe(false);
  });

  it("un ruolo insieme al cliente NON è orfana (basta un responsabile reale su più)", () => {
    expect(taskOrfana(["Consulente Senior", "Cliente"])).toBe(false);
  });

  it("una persona reale NON è orfana", () => {
    expect(taskOrfana(["Andrea"])).toBe(false);
    expect(taskOrfana(["Project Manager", "Andrea"])).toBe(false);
  });

  it("array vuoto -> orfana (comportamento onesto, anche se normalizzaAssegnatari non lo produce mai)", () => {
    expect(taskOrfana([])).toBe(true);
  });
});

describe("normalizzaAssegnatari — casi presi dai valori reali osservati sul foglio", () => {
  it("un solo nome, nessun delimitatore", () => {
    expect(normalizzaAssegnatari("Andrea")).toEqual(["Andrea"]);
  });

  it("stringa vuota o solo spazi -> ['Da assegnare']", () => {
    expect(normalizzaAssegnatari("")).toEqual(["Da assegnare"]);
    expect(normalizzaAssegnatari("   ")).toEqual(["Da assegnare"]);
  });

  it("delimitatore ' + ' (TemplateAttivita: 'Consulente Senior + Cliente')", () => {
    expect(normalizzaAssegnatari("Consulente Senior + Cliente")).toEqual(["Consulente Senior", "Cliente"]);
  });

  it("delimitatore ' & ' ('Andrea & Sherdil')", () => {
    expect(normalizzaAssegnatari("Andrea & Sherdil")).toEqual(["Andrea", "Sherdil"]);
  });

  it("delimitatore ' e ' come parola intera ('Orlando e Alessandro')", () => {
    expect(normalizzaAssegnatari("Orlando e Alessandro")).toEqual(["Orlando", "Alessandro"]);
  });

  it("' e ' non spacca un nome che contiene la lettera 'e' senza essere la parola isolata", () => {
    expect(normalizzaAssegnatari("Federico")).toEqual(["Federico"]);
  });

  it("delimitatore '/' ('Stefano/Federico')", () => {
    expect(normalizzaAssegnatari("Stefano/Federico")).toEqual(["Stefano", "Federico"]);
  });

  it("dedup: lo stesso nome ripetuto due volte resta una sola voce", () => {
    expect(normalizzaAssegnatari("Andrea & Andrea")).toEqual(["Andrea"]);
  });

  it("trim di spazi superflui attorno ai delimitatori", () => {
    expect(normalizzaAssegnatari("Andrea   &   Sherdil")).toEqual(["Andrea", "Sherdil"]);
  });

  it("già in forma comma-separated canonica (post-migrazione) -> passa invariata", () => {
    expect(normalizzaAssegnatari("Andrea, Sherdil")).toEqual(["Andrea", "Sherdil"]);
  });
});
