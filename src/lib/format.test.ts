import { describe, expect, it } from "vitest";
import {
  descrizioneScadenza,
  formatDataBreve,
  formatDataRelativa,
  formatDecimale,
  formatEuro,
  formatEuroIntero,
  formatVariazionePercentuale,
  formatMese,
  formatNumero,
  formatPercentuale,
  formatRoas,
  formatSettimana,
  formatStatoAttivita,
  formatStatoCampagna,
  formatMeseEsteso,
} from "./format";

describe("formatEuro", () => {
  it("da mille in su: simbolo davanti, punto per le migliaia, senza centesimi", () => {
    expect(formatEuro(1234.56)).toBe("€1.235");
    expect(formatEuro(10494)).toBe("€10.494");
  });

  it("sotto mille: due decimali con la virgola", () => {
    expect(formatEuro(42.5)).toBe("€42,50");
    expect(formatEuro(0)).toBe("€0,00");
  });

  it("negativo: segno meno davanti al simbolo", () => {
    expect(formatEuro(-120)).toBe("−€120,00");
  });

  it("valore assente o non finito: trattino", () => {
    expect(formatEuro(null)).toBe("—");
    expect(formatEuro(Infinity)).toBe("—");
  });
});

describe("formatNumero", () => {
  it("formatta con separatore delle migliaia, senza decimali", () => {
    expect(formatNumero(12345)).toBe("12.345");
    // Anche le quattro cifre hanno il punto: "it-IT" da solo le lascerebbe senza.
    expect(formatNumero(1017)).toBe("1.017");
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
    expect(formatRoas(3.4567)).toBe("3,46x");
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
    expect(r?.classe).toContain("text-ok");
  });

  it("stato sconosciuto -> fallback leggibile invece di un crash", () => {
    const r = formatStatoCampagna("QUALCHE_STATO_NUOVO");
    expect(r?.label).toBe("Qualche stato nuovo");
    expect(r?.classe).toContain("text-ink-500");
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

describe("formatMeseEsteso", () => {
  it("scrive il mese per esteso con l'anno intero", () => {
    expect(formatMeseEsteso("2026-10")).toBe("Ottobre 2026");
    expect(formatMeseEsteso("2027-01")).toBe("Gennaio 2027");
  });
});

describe("formatEuroIntero", () => {
  it("senza centesimi a qualunque importo: per i tick degli assi dei grafici", () => {
    expect(formatEuroIntero(101)).toBe("€101");
    expect(formatEuroIntero(857.4)).toBe("€857");
    expect(formatEuroIntero(12500)).toBe("€12.500");
    expect(formatEuroIntero(null)).toBe("—");
  });
});

describe("formatDecimale", () => {
  it("decimali fissi con la virgola", () => {
    expect(formatDecimale(3.488)).toBe("3,49");
    expect(formatDecimale(2.5, 1)).toBe("2,5");
    expect(formatDecimale(null)).toBe("—");
  });
});

describe("formatVariazionePercentuale", () => {
  it("segno esplicito e nessun decimale", () => {
    expect(formatVariazionePercentuale(0.123)).toBe("+12%");
    expect(formatVariazionePercentuale(-0.4)).toBe("−40%");
    expect(formatVariazionePercentuale(0)).toBe("0%");
  });

  it("oltre il 999% non scrive la cifra: dichiara solo che è fuori scala", () => {
    expect(formatVariazionePercentuale(9.99)).toBe("+999%");
    expect(formatVariazionePercentuale(38.2)).toBe("oltre +999%");
  });
});
