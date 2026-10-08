import { describe, expect, it } from "vitest";
import { controllaTaskModello, erroreAnagraficaPersona, errorePasswordNuova, erroreProdotto, ordineConNuova, stessiElementi } from "./impostazioni";

describe("persone della squadra", () => {
  it("il nome è obbligatorio quando viene indicato; l'email può mancare ma non essere sbagliata", () => {
    expect(erroreAnagraficaPersona({ nome: "Mario Rossi", email: "mario@esempio.it" })).toBeNull();
    expect(erroreAnagraficaPersona({ nome: "Mario Rossi", email: "" })).toBeNull();
    expect(erroreAnagraficaPersona({ email: " mario@esempio.it " })).toBeNull();
    expect(erroreAnagraficaPersona({ nome: "  " })).toBe("Il nome è obbligatorio");
    expect(erroreAnagraficaPersona({ nome: "Mario", email: "mario@esempio" })).toBe("L'email non sembra un indirizzo valido");
    expect(erroreAnagraficaPersona({ nome: "Mario", email: "mario rossi@esempio.it" })).toBe("L'email non sembra un indirizzo valido");
  });

  it("password nuova: almeno dieci caratteri, senza spazi ai bordi", () => {
    expect(errorePasswordNuova("Dieci-Car1")).toBeNull();
    expect(errorePasswordNuova("frase con spazi dentro")).toBeNull();
    expect(errorePasswordNuova("corta")).toBe("La password deve avere almeno 10 caratteri");
    expect(errorePasswordNuova(" spazio-davanti")).toBe("La password non può cominciare o finire con uno spazio");
    expect(errorePasswordNuova("x".repeat(201))).toContain("troppo lunga");
  });
});

describe("prodotti", () => {
  it("nome obbligatorio e durata in settimane intere", () => {
    expect(erroreProdotto({ nome: "Go To Market", durataSettimane: 15 })).toBeNull();
    expect(erroreProdotto({ durataSettimane: 1 })).toBeNull();
    expect(erroreProdotto({ nome: "" })).toBe("Il nome del prodotto è obbligatorio");
    expect(erroreProdotto({ nome: "X", durataSettimane: 0 })).toContain("da 1 a");
    expect(erroreProdotto({ nome: "X", durataSettimane: 12.5 })).toContain("numero intero");
  });
});

describe("attività di un modello", () => {
  const buona = { blocco: "setup", fase: " Sett. 1 ", descrizione: " Kick-off ", assegnatari: ["Project Manager", " Cliente ", "", "Cliente"], tipo: "PM", settimanaInizio: 1, settimanaFine: 2, giorniTesto: "gg 1-3", nota: "" };

  it("ripulisce gli spazi e toglie gli assegnatari vuoti o doppi", () => {
    expect(controllaTaskModello(buona)).toEqual({
      ok: true,
      dati: { blocco: "setup", fase: "Sett. 1", descrizione: "Kick-off", assegnatari: ["Project Manager", "Cliente"], tipo: "PM", settimanaInizio: 1, settimanaFine: 2, giorniTesto: "gg 1-3", nota: "" },
    });
  });

  it("senza assegnatari resta \"Da assegnare\", mai un elenco vuoto", () => {
    const esito = controllaTaskModello({ ...buona, assegnatari: [] });
    expect(esito.ok && esito.dati.assegnatari).toEqual(["Da assegnare"]);
    const senzaCampo = controllaTaskModello({ ...buona, assegnatari: undefined });
    expect(senzaCampo.ok && senzaCampo.dati.assegnatari).toEqual(["Da assegnare"]);
  });

  it("descrizione mancante, settimane non intere o in ordine sbagliato: errore", () => {
    expect(controllaTaskModello({ ...buona, descrizione: " " })).toEqual({ ok: false, errore: "La descrizione dell'attività è obbligatoria" });
    expect(controllaTaskModello({ ...buona, settimanaInizio: 0 })).toMatchObject({ ok: false });
    expect(controllaTaskModello({ ...buona, settimanaFine: 2.5 })).toMatchObject({ ok: false });
    expect(controllaTaskModello({ ...buona, settimanaInizio: "1" })).toMatchObject({ ok: false });
    expect(controllaTaskModello({ ...buona, settimanaInizio: 3, settimanaFine: 2 })).toEqual({ ok: false, errore: "La settimana di fine non può venire prima di quella di inizio" });
  });
});

describe("ordine delle attività", () => {
  it("una nuova va in fondo, oppure subito dopo quella indicata", () => {
    expect(ordineConNuova(["a", "b", "c"], "n")).toEqual(["a", "b", "c", "n"]);
    expect(ordineConNuova(["a", "b", "c"], "n", "a")).toEqual(["a", "n", "b", "c"]);
    expect(ordineConNuova(["a", "b", "c"], "n", "c")).toEqual(["a", "b", "c", "n"]);
    expect(ordineConNuova(["a", "b", "c"], "n", "non-esiste")).toEqual(["a", "b", "c", "n"]);
    expect(ordineConNuova(["a", "n", "b"], "n", "b")).toEqual(["a", "b", "n"]);
  });

  it("un riordino è valido solo se sono gli stessi elementi, ognuno una volta", () => {
    expect(stessiElementi(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
    expect(stessiElementi(["a", "b", "c"], ["a", "b"])).toBe(false);
    expect(stessiElementi(["a", "b", "c"], ["a", "b", "b"])).toBe(false);
    expect(stessiElementi(["a", "b", "c"], ["a", "b", "d"])).toBe(false);
    expect(stessiElementi([], [])).toBe(true);
  });
});
