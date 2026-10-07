import path from "path";
import { describe, expect, it } from "vitest";
import { apriDatabaseInMemoria } from "./inMemoria";
import { applicaMigrazioni, elencoMigrazioni } from "./migrazioni";

const CARTELLA = path.join(process.cwd(), "supabase", "migrations");

describe("migrazioni", () => {
  it("i file della cartella sono in ordine di versione e hanno versione e nome", () => {
    const elenco = elencoMigrazioni(CARTELLA);
    expect(elenco.length).toBeGreaterThan(0);
    expect(elenco[0]).toMatchObject({ versione: "20261007160000", nome: "schema_iniziale" });
    expect(elenco.map((m) => m.versione)).toEqual([...elenco.map((m) => m.versione)].sort());
  });

  it("una migrazione applicata finisce nel registro di Supabase e non viene rieseguita", async () => {
    // apriDatabaseInMemoria le ha già applicate tutte una volta.
    const db = await apriDatabaseInMemoria();
    try {
      const registro = await db.esegui<{ version: string; name: string }>("select version, name from supabase_migrations.schema_migrations order by version");
      expect(registro[0]).toEqual({ version: "20261007160000", name: "schema_iniziale" });
      // Rilanciare non fa nulla (rieseguire lo schema darebbe "relation already exists").
      expect(await applicaMigrazioni(db, elencoMigrazioni(CARTELLA))).toEqual([]);
    } finally {
      await db.chiudi();
    }
  }, 60_000);

  it("se una migrazione fallisce a metà non lascia nulla: né tabelle né riga nel registro", async () => {
    const db = await apriDatabaseInMemoria();
    try {
      const rotta = { versione: "29990101000000", nome: "rotta", sql: "create table public.mezza (id int); select * from tabella_che_non_esiste;" };
      await expect(applicaMigrazioni(db, [rotta])).rejects.toThrow();
      const tabelle = await db.esegui<{ n: number }>("select count(*)::int as n from information_schema.tables where table_schema = 'public' and table_name = 'mezza'");
      expect(tabelle[0].n).toBe(0);
      const registro = await db.esegui<{ n: number }>("select count(*)::int as n from supabase_migrations.schema_migrations where version = '29990101000000'");
      expect(registro[0].n).toBe(0);
    } finally {
      await db.chiudi();
    }
  }, 60_000);
});
