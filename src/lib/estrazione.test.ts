import { describe, expect, it } from "vitest";
import {
  actionItemsFromTaskLines,
  detectSource,
  isActionItemsSuspicious,
  isAuthWall,
  toActionItems,
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

  it("filtra le voci senza testo e ignora input non-array", () => {
    expect(toActionItems(["", "  "])).toEqual([]);
    expect(toActionItems(null)).toEqual([]);
    expect(toActionItems("non un array")).toEqual([]);
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
