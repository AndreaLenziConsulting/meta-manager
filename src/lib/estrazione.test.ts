import { describe, expect, it } from "vitest";
import {
  actionItemsFromTaskLines,
  detectSource,
  isActionItemsSuspicious,
  isAuthWall,
  isPaginaConErroreCaricamento,
  toActionItems,
  toStrArray,
} from "./estrazione";

describe("detectSource", () => {
  it("riconosce fathom, circleback e loom dall'url", () => {
    expect(detectSource("https://fathom.video/share/abc")).toBe("fathom");
    expect(detectSource("https://app.circleback.ai/view/abc")).toBe("circleback");
    expect(detectSource("https://www.loom.com/share/abc")).toBe("loom");
  });

  it("ritorna unknown per url non riconosciuti", () => {
    expect(detectSource("https://example.com/meeting")).toBe("unknown");
  });
});

describe("isAuthWall", () => {
  it("riconosce una pagina di login corta con segnali soft", () => {
    expect(isAuthWall("Sign in\nLog in\nContinue with Google")).toBe(true);
  });

  it("riconosce segnali strict anche con contenuto moderato", () => {
    expect(isAuthWall("You need to sign in to view this meeting. " + "x".repeat(200))).toBe(true);
  });

  it("una pagina con contenuto reale non è un auth wall, anche con banner di login", () => {
    const testo =
      "Action Items\nSummary\nParticipants\n" + "Contenuto reale del meeting con molti dettagli. ".repeat(50) + "Sign in";
    expect(isAuthWall(testo)).toBe(false);
  });
});

describe("toActionItems", () => {
  it("converte stringhe 'Nome: azione' in {text, assignee}", () => {
    expect(toActionItems(["Marco: preparare il funnel", "Rivedere landing"])).toEqual([
      { text: "preparare il funnel", assignee: "Marco" },
      { text: "Rivedere landing" },
    ]);
  });

  it("passa oggetti {text, assignee} già validi", () => {
    expect(toActionItems([{ text: "Fare X", assignee: "Giulia" }])).toEqual([{ text: "Fare X", assignee: "Giulia" }]);
  });

  it("filtra le voci senza testo; input non array/stringa -> array vuoto", () => {
    expect(toActionItems(["", "  "])).toEqual([]);
    expect(toActionItems(null)).toEqual([]);
    expect(toActionItems(42)).toEqual([]);
  });

  it("accetta anche una stringa (Groq a volte restituisce \"\" o una stringa multi-riga invece di un array — vedi EXTRACTION_TOOL)", () => {
    expect(toActionItems("Marco: preparare il funnel\nRivedere landing")).toEqual([
      { text: "preparare il funnel", assignee: "Marco" },
      { text: "Rivedere landing" },
    ]);
    expect(toActionItems("")).toEqual([]);
  });
});

describe("toStrArray", () => {
  it("filtra le voci vuote di un array, tenendo solo stringhe", () => {
    expect(toStrArray(["Marco", "", "  ", "Giulia"])).toEqual(["Marco", "Giulia"]);
  });

  it("spezza una stringa su virgole e a-capo (Groq a volte restituisce una stringa invece di un array)", () => {
    expect(toStrArray("Marco, Giulia")).toEqual(["Marco", "Giulia"]);
    expect(toStrArray("Marco\nGiulia")).toEqual(["Marco", "Giulia"]);
  });

  it("stringa vuota o input non riconosciuto -> array vuoto", () => {
    expect(toStrArray("")).toEqual([]);
    expect(toStrArray(null)).toEqual([]);
    expect(toStrArray(42)).toEqual([]);
  });
});

describe("isActionItemsSuspicious", () => {
  it("vuoto -> sempre sospetto", () => {
    expect(isActionItemsSuspicious([], ["Marco", "Giulia"])).toBe(true);
  });

  it("tutte le voci coincidono con i nomi dei partecipanti -> sospetto", () => {
    expect(isActionItemsSuspicious([{ text: "Marco" }, { text: "Giulia" }], ["Marco", "Giulia"])).toBe(true);
  });

  it("case/whitespace insensitive nel confronto", () => {
    expect(isActionItemsSuspicious([{ text: "  marco  " }], ["Marco"])).toBe(true);
  });

  it("almeno un action item reale -> non sospetto", () => {
    expect(isActionItemsSuspicious([{ text: "Marco" }, { text: "Preparare il funnel ADV" }], ["Marco", "Giulia"])).toBe(false);
  });

  it("nessun partecipante noto -> non si può giudicare sospetto solo dal confronto nomi", () => {
    expect(isActionItemsSuspicious([{ text: "Qualcosa" }], [])).toBe(false);
  });
});

describe("isPaginaConErroreCaricamento", () => {
  it("testo troppo corto -> considerato un errore di caricamento (vale la pena ritentare)", () => {
    expect(isPaginaConErroreCaricamento("Fathom")).toBe(true);
    expect(isPaginaConErroreCaricamento("x".repeat(399))).toBe(true);
  });

  it("testo lungo ma con un segnale di errore noto -> true, anche in italiano o inglese", () => {
    const base = "y".repeat(500);
    expect(isPaginaConErroreCaricamento(`${base} Errore di rete durante il caricamento ${base}`)).toBe(true);
    expect(isPaginaConErroreCaricamento(`${base} Something went wrong ${base}`)).toBe(true);
  });

  it("case insensitive", () => {
    expect(isPaginaConErroreCaricamento(`${"z".repeat(500)} ERRORE DI RETE`)).toBe(true);
  });

  it("contenuto reale sufficientemente lungo senza segnali di errore -> false", () => {
    const reale = "Task della settimana\n" + "Marco: preparare il funnel ADV. ".repeat(30);
    expect(reale.length).toBeGreaterThan(400);
    expect(isPaginaConErroreCaricamento(reale)).toBe(false);
  });
});

describe("actionItemsFromTaskLines", () => {
  it("unisce taskSettimana e taskMese, una riga = un action item", () => {
    expect(actionItemsFromTaskLines("Marco: preparare il funnel\nGiulia: rivedere landing", "Obiettivo 5 vendite")).toEqual([
      { text: "preparare il funnel", assignee: "Marco" },
      { text: "rivedere landing", assignee: "Giulia" },
      { text: "Obiettivo 5 vendite" },
    ]);
  });

  it("righe vuote/assenti -> array vuoto, mai un crash", () => {
    expect(actionItemsFromTaskLines("", "")).toEqual([]);
  });
});
