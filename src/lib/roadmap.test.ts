import { describe, expect, it } from "vitest";
import {
  dataFineSettimana,
  dataInizioSettimana,
  generaAttivitaPerCliente,
  prossimoStato,
  raggruppaPerFase,
  rangeProgetto,
} from "./roadmap";
import type { AttivitaClienteRow, TemplateTask } from "@/types/kpi";

describe("dataInizioSettimana / dataFineSettimana", () => {
  const inizio = "2026-08-10"; // lunedì

  it("settimana 1 coincide con la data di inizio progetto", () => {
    expect(dataInizioSettimana(inizio, 1)).toBe("2026-08-10");
    expect(dataFineSettimana(inizio, 1)).toBe("2026-08-16");
  });

  it("settimana 15 (fine GTM) è coerente con 14 settimane dopo l'inizio", () => {
    expect(dataInizioSettimana(inizio, 15)).toBe("2026-11-16");
  });

  it("attraversa correttamente un cambio di mese e di anno", () => {
    const inizioFineAnno = "2026-12-21"; // lunedì
    expect(dataInizioSettimana(inizioFineAnno, 2)).toBe("2026-12-28");
    expect(dataFineSettimana(inizioFineAnno, 2)).toBe("2027-01-03");
  });
});

const TEMPLATE_TEST: TemplateTask[] = [
  {
    prodottoId: "gtm", taskId: "S01", blocco: "setup", fase: "Sett. 1", descrizione: "Kick off",
    responsabile: "PM", tipo: "PM", settimanaInizio: 1, settimanaFine: 1, giorniTesto: "gg 1", nota: "", ordine: 1,
  },
  {
    prodottoId: "gtm", taskId: "S02", blocco: "setup", fase: "Sett. 1", descrizione: "Accessi",
    responsabile: "Cliente", tipo: "CL", settimanaInizio: 1, settimanaFine: 1, giorniTesto: "gg 1-3", nota: "", ordine: 2,
  },
  {
    prodottoId: "gtm", taskId: "G01", blocco: "gestione", fase: "Mese 1", descrizione: "Monitoraggio",
    responsabile: "PM", tipo: "PM", settimanaInizio: 4, settimanaFine: 15, giorniTesto: "", nota: "", ordine: 3,
  },
  {
    prodottoId: "altro-prodotto", taskId: "X01", blocco: "setup", fase: "Sett. 1", descrizione: "Non deve comparire",
    responsabile: "PM", tipo: "PM", settimanaInizio: 1, settimanaFine: 1, giorniTesto: "", nota: "", ordine: 1,
  },
];

describe("generaAttivitaPerCliente", () => {
  it("genera solo le righe del prodotto richiesto, con id deterministico e stato iniziale todo", () => {
    const righe = generaAttivitaPerCliente("alc-07", "gtm", "2026-08-10", TEMPLATE_TEST);
    expect(righe).toHaveLength(3);
    expect(righe.every((r) => r.stato === "todo")).toBe(true);
    expect(righe.every((r) => r.notaTeam === "")).toBe(true);
    const s01 = righe.find((r) => r.taskId === "S01")!;
    expect(s01.attivitaId).toBe("alc-07::S01");
    expect(s01.dataInizio).toBe("2026-08-10");
    expect(s01.dataFine).toBe("2026-08-16");
  });

  it("copia (denormalizza) i campi del template nell'istanza", () => {
    const righe = generaAttivitaPerCliente("alc-07", "gtm", "2026-08-10", TEMPLATE_TEST);
    const s02 = righe.find((r) => r.taskId === "S02")!;
    expect(s02.descrizione).toBe("Accessi");
    expect(s02.responsabile).toBe("Cliente");
    expect(s02.tipo).toBe("CL");
    expect(s02.fase).toBe("Sett. 1");
    expect(s02.ordine).toBe(2);
  });

  it("un task multi-settimana copre l'intero intervallo (data_inizio settimana iniziale, data_fine settimana finale)", () => {
    const righe = generaAttivitaPerCliente("alc-07", "gtm", "2026-08-10", TEMPLATE_TEST);
    const g01 = righe.find((r) => r.taskId === "G01")!;
    expect(g01.dataInizio).toBe(dataInizioSettimana("2026-08-10", 4));
    expect(g01.dataFine).toBe(dataFineSettimana("2026-08-10", 15));
  });

  it("prodotto senza template noto -> nessuna riga generata, non un errore", () => {
    expect(generaAttivitaPerCliente("alc-07", "prodotto-inesistente", "2026-08-10", TEMPLATE_TEST)).toEqual([]);
  });
});

describe("prossimoStato", () => {
  it("cicla todo -> in corso -> fatto -> todo", () => {
    expect(prossimoStato("todo")).toBe("wip");
    expect(prossimoStato("wip")).toBe("done");
    expect(prossimoStato("done")).toBe("todo");
  });

  it("da bloccato torna a todo (si 'sblocca'), non entra nel ciclo normale", () => {
    expect(prossimoStato("blocked")).toBe("todo");
  });
});

function riga(over: Partial<AttivitaClienteRow>): AttivitaClienteRow {
  return {
    attivitaId: "x", clienteId: "alc-07", prodottoId: "gtm", taskId: "T", blocco: "setup",
    fase: "Fase", descrizione: "", responsabile: "", tipo: "", dataInizio: "2026-08-10",
    dataFine: "2026-08-16", stato: "todo", notaTeam: "", ordine: 1, ...over,
  };
}

describe("raggruppaPerFase", () => {
  it("raggruppa per fase preservando l'ordine esplicito, non l'ordine di input", () => {
    const attivita = [
      riga({ taskId: "b", fase: "Fase 2", ordine: 3 }),
      riga({ taskId: "a", fase: "Fase 1", ordine: 1 }),
      riga({ taskId: "c", fase: "Fase 1", ordine: 2 }),
    ];
    const gruppi = raggruppaPerFase(attivita);
    expect(gruppi.map((g) => g.fase)).toEqual(["Fase 1", "Fase 2"]);
    expect(gruppi[0].attivita.map((a) => a.taskId)).toEqual(["a", "c"]);
  });
});

describe("rangeProgetto", () => {
  it("trova data minima e massima tra tutte le attività", () => {
    const attivita = [
      riga({ dataInizio: "2026-08-10", dataFine: "2026-08-16" }),
      riga({ dataInizio: "2026-09-01", dataFine: "2026-09-07" }),
      riga({ dataInizio: "2026-08-03", dataFine: "2026-08-09" }),
    ];
    expect(rangeProgetto(attivita)).toEqual({ minData: "2026-08-03", maxData: "2026-09-07" });
  });

  it("lista vuota -> null", () => {
    expect(rangeProgetto([])).toBeNull();
  });
});
