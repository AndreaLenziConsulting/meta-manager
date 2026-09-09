import { describe, expect, it } from "vitest";
import {
  descrizioneScadenza,
  formatDataBreve,
  formatDataRelativa,
  formatEuro,
  formatMese,
  formatNumero,
  formatPercentuale,
  formatRoas,
  formatSettimana,
  formatStatoAttivita,
  formatStatoCampagna,
} from "./format";

// Intl.NumberFormat('it-IT', {style:'currency'}) separa numero e simbolo con uno spazio
// unificatore (NBSP, U+00A0), non uno spazio normale — verificato con il codepoint esatto.
const NBSP = " ";

describe("formatEuro", () => {
  it("valori >= 1000 arrotondati senza decimali", () => {
    // Il separatore delle migliaia dipende dai dati ICU disponibili nell'ambiente Node (qui assente
    // — confermato anche fuori da Vitest, non è un bug dell'app: il browser ha sempre ICU completo).
    // Si verifica solo la proprietà che conta per questa funzione: niente decimali da 1000 in su.
    expect(formatEuro(1234.56)).toMatch(new RegExp(`^1\\.?235${NBSP}€$`));
    expect(formatEuro(1234.56)).not.toContain(",");
  });

  it("valori sotto 1000 con due decimali", () => {
    expect(formatEuro(42.5)).toBe(`42,50${NBSP}€`);
  });

  it("null o non finito -> trattino, non un crash", () => {
    expect(formatEuro(null)).toBe("—");
    expect(formatEuro(Infinity)).toBe("—");
  });
});

describe("formatNumero", () => {
  it("formatta con separatore delle migliaia, senza decimali", () => {
    expect(formatNumero(12345)).toBe("12.345");
  });

  it("null -> trattino", () => {
    expect(formatNumero(null)).toBe("—");
  });
});

describe("formatPercentuale", () => {
  it("converte una frazione in percentuale con un decimale", () => {
    expect(formatPercentuale(0.256)).toBe("25,6%");
  });

  it("null -> trattino", () => {
    expect(formatPercentuale(null)).toBe("—");
  });
});

describe("formatRoas", () => {
  it("due decimali seguiti da 'x'", () => {
    expect(formatRoas(3.4567)).toBe("3.46x");
  });

  it("null -> trattino", () => {
    expect(formatRoas(null)).toBe("—");
  });
});

describe("formatMese", () => {
  it("converte YYYY-MM in 'Mmm AA'", () => {
    expect(formatMese("2026-08")).toBe("Ago 26");
    expect(formatMese("2026-01")).toBe("Gen 26");
  });
});

describe("formatSettimana", () => {
  it("converte YYYY-MM-DD (lunedì di inizio settimana) in 'D Mmm'", () => {
    expect(formatSettimana("2026-08-17")).toBe("17 Ago");
  });
});

describe("formatDataBreve", () => {
  it("converte YYYY-MM-DD in 'd mmm YYYY' minuscolo", () => {
    expect(formatDataBreve("2026-08-05")).toBe("5 ago 2026");
  });

  it("ignora un eventuale orario oltre i primi 10 caratteri", () => {
    expect(formatDataBreve("2026-08-05T14:30:00Z")).toBe("5 ago 2026");
  });
});

describe("formatStatoCampagna", () => {
  it("stringa vuota -> null (non ancora sincronizzato)", () => {
    expect(formatStatoCampagna("")).toBeNull();
  });

  it("stato noto -> etichetta e classi coerenti", () => {
    const r = formatStatoCampagna("ACTIVE");
    expect(r?.label).toBe("Attiva");
    expect(r?.classe).toContain("green");
  });

  it("stato sconosciuto -> fallback leggibile invece di un crash", () => {
    const r = formatStatoCampagna("QUALCHE_STATO_NUOVO");
    expect(r?.label).toBe("Qualche stato nuovo");
    expect(r?.classe).toContain("gray");
  });
});

describe("formatStatoAttivita", () => {
  it("ogni stato noto ha un'etichetta italiana", () => {
    expect(formatStatoAttivita("todo").label).toBe("Da fare");
    expect(formatStatoAttivita("wip").label).toBe("In corso");
    expect(formatStatoAttivita("done").label).toBe("Fatto");
    expect(formatStatoAttivita("blocked").label).toBe("Bloccato");
  });

  it("stato sconosciuto -> fallback a 'todo', non un crash", () => {
    expect(formatStatoAttivita("qualcosa-di-strano")).toEqual(formatStatoAttivita("todo"));
  });
});

describe("formatDataRelativa", () => {
  const OGGI = "2026-09-08"; // martedì

  it("stessa data -> 'oggi'", () => {
    expect(formatDataRelativa("2026-09-08", OGGI)).toBe("oggi");
  });

  it("un giorno dopo -> 'domani'", () => {
    expect(formatDataRelativa("2026-09-09", OGGI)).toBe("domani");
  });

  it("un giorno prima -> 'ieri'", () => {
    expect(formatDataRelativa("2026-09-07", OGGI)).toBe("ieri");
  });

  it("entro una settimana nel futuro -> giorno settimana breve + giorno + mese breve", () => {
    expect(formatDataRelativa("2026-09-11", OGGI)).toBe("ven 11 set"); // +3 giorni, venerdì
    expect(formatDataRelativa("2026-09-14", OGGI)).toBe("lun 14 set"); // +6 giorni, bordo incluso
  });

  it("entro una settimana nel passato -> stesso formato giorno settimana breve", () => {
    expect(formatDataRelativa("2026-09-02", OGGI)).toBe("mer 2 set"); // -6 giorni, bordo incluso
  });

  it("oltre una settimana, stesso anno di oggi -> giorno+mese senza anno", () => {
    expect(formatDataRelativa("2026-09-15", OGGI)).toBe("15 set"); // +7 giorni, appena fuori dal raggio settimanale
  });

  it("anno diverso da oggi -> anno sempre esplicito, mai ambiguo", () => {
    expect(formatDataRelativa("2027-01-05", OGGI)).toBe("5 gen 2027");
    expect(formatDataRelativa("2025-12-25", OGGI)).toBe("25 dic 2025");
  });
});

describe("descrizioneScadenza", () => {
  const OGGI = "2026-09-08";

  it("non scaduta (data futura) -> formatDataRelativa, scaduta:false", () => {
    expect(descrizioneScadenza("2026-09-09", "todo", OGGI)).toEqual({ testo: "domani", scaduta: false });
  });

  it("scadenza di oggi stesso NON è scaduta (confronto stretto)", () => {
    expect(descrizioneScadenza("2026-09-08", "todo", OGGI)).toEqual({ testo: "oggi", scaduta: false });
  });

  it("scaduta ieri -> 'Scaduta ieri', mai 'Scaduta da 1 giorni'", () => {
    expect(descrizioneScadenza("2026-09-07", "todo", OGGI)).toEqual({ testo: "Scaduta ieri", scaduta: true });
  });

  it("scaduta da più giorni -> 'Scaduta da N giorni'", () => {
    expect(descrizioneScadenza("2026-09-01", "wip", OGGI)).toEqual({ testo: "Scaduta da 7 giorni", scaduta: true });
  });

  it("bloccata e scaduta è comunque scaduta (stesso criterio di attivitaInRitardo: un blocco resta un problema)", () => {
    expect(descrizioneScadenza("2026-09-01", "blocked", OGGI).scaduta).toBe(true);
  });

  it("done con scadenza passata NON è scaduta (il lavoro è comunque concluso)", () => {
    expect(descrizioneScadenza("2026-09-01", "done", OGGI)).toEqual({ testo: "1 set", scaduta: false });
  });
});
