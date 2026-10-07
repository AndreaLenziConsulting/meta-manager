import { readdirSync, readFileSync } from "fs";
import path from "path";
import type { Database } from "@/lib/db/tipi";

export type Migrazione = { versione: string; nome: string; sql: string };

/** I file `<14 cifre>_<nome>.sql` di una cartella, in ordine di versione. */
export function elencoMigrazioni(cartella: string): Migrazione[] {
  return readdirSync(cartella)
    .map((file) => ({ file, m: file.match(/^(\d{14})_(.+)\.sql$/) }))
    .filter((x): x is { file: string; m: RegExpMatchArray } => x.m !== null)
    .map(({ file, m }) => ({ versione: m[1], nome: m[2], sql: readFileSync(path.join(cartella, file), "utf-8") }))
    .sort((a, b) => a.versione.localeCompare(b.versione));
}

/**
 * Applica al database le migrazioni non ancora applicate, in ordine, ognuna nella sua transazione
 * (o entra tutta, o non entra).
 *
 * Il registro di ciò che è già applicato è `supabase_migrations.schema_migrations`, la stessa
 * tabella che usano gli strumenti di Supabase (CLI e collegamento con GitHub): una migrazione
 * applicata da qui risulta applicata anche per loro, e non viene rieseguita una seconda volta.
 */
export async function applicaMigrazioni(db: Database, migrazioni: Migrazione[]): Promise<Migrazione[]> {
  await db.script(`
    create schema if not exists supabase_migrations;
    create table if not exists supabase_migrations.schema_migrations (version text not null primary key);
    alter table supabase_migrations.schema_migrations add column if not exists statements text[];
    alter table supabase_migrations.schema_migrations add column if not exists name text;
  `);
  const giaApplicate = new Set((await db.esegui<{ version: string }>("select version from supabase_migrations.schema_migrations")).map((r) => r.version));

  const applicate: Migrazione[] = [];
  for (const m of migrazioni) {
    if (giaApplicate.has(m.versione)) continue;
    await db.transazione(async (tx) => {
      await tx.script(m.sql);
      await tx.esegui("insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, array[$3])", [m.versione, m.nome, m.sql]);
    });
    applicate.push(m);
  }
  return applicate;
}
