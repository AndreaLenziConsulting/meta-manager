import { describe, expect, it } from "vitest";
import { clienteDaCondividere } from "@/lib/driveAccesso";

describe("clienteDaCondividere", () => {
  it("qualifica un cliente con cartella e consulente con email nota", () => {
    const mappa = new Map([["c1", "andrea@esempio.it"]]);
    expect(clienteDaCondividere({ driveFolderUrl: "https://drive.google.com/drive/folders/abc", consulenteId: "c1" }, mappa)).toEqual({
      emailConsulente: "andrea@esempio.it",
    });
  });

  it("ritorna null senza cartella collegata", () => {
    const mappa = new Map([["c1", "andrea@esempio.it"]]);
    expect(clienteDaCondividere({ driveFolderUrl: "", consulenteId: "c1" }, mappa)).toBeNull();
    expect(clienteDaCondividere({ driveFolderUrl: "   ", consulenteId: "c1" }, mappa)).toBeNull();
  });

  it("ritorna null se il consulente non ha un'email nota", () => {
    const mappa = new Map([["c1", ""]]);
    expect(clienteDaCondividere({ driveFolderUrl: "https://drive.google.com/drive/folders/abc", consulenteId: "c1" }, mappa)).toBeNull();
  });

  it("ritorna null se il consulente non è nella mappa", () => {
    const mappa = new Map<string, string>();
    expect(clienteDaCondividere({ driveFolderUrl: "https://drive.google.com/drive/folders/abc", consulenteId: "sconosciuto" }, mappa)).toBeNull();
  });

  it("elimina spazi superflui nell'email trovata", () => {
    const mappa = new Map([["c1", "  andrea@esempio.it  "]]);
    expect(clienteDaCondividere({ driveFolderUrl: "https://drive.google.com/drive/folders/abc", consulenteId: "c1" }, mappa)).toEqual({
      emailConsulente: "andrea@esempio.it",
    });
  });
});
