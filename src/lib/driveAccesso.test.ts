import { describe, expect, it } from "vitest";
import { clienteDaCondividere, prospectDaCondividere } from "@/lib/driveAccesso";

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

describe("prospectDaCondividere", () => {
  it("qualifica un prospect con cartella e commerciale con email nota", () => {
    const mappa = new Map([["stefano", "stefano@andrealenziconsulting.com"]]);
    expect(prospectDaCondividere({ driveFolderUrl: "https://drive.google.com/drive/folders/abc", commercialeId: "stefano" }, mappa)).toEqual({
      emailCommerciale: "stefano@andrealenziconsulting.com",
    });
  });

  it("ritorna null senza cartella collegata", () => {
    const mappa = new Map([["stefano", "stefano@andrealenziconsulting.com"]]);
    expect(prospectDaCondividere({ driveFolderUrl: "", commercialeId: "stefano" }, mappa)).toBeNull();
  });

  it("ritorna null se il commerciale non ha un'email nota o non è nella mappa", () => {
    const mappa = new Map([["stefano", ""]]);
    expect(prospectDaCondividere({ driveFolderUrl: "https://drive.google.com/drive/folders/abc", commercialeId: "stefano" }, mappa)).toBeNull();
    expect(prospectDaCondividere({ driveFolderUrl: "https://drive.google.com/drive/folders/abc", commercialeId: "sconosciuto" }, mappa)).toBeNull();
  });
});
