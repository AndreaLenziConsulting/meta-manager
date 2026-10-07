import { describe, expect, it } from "vitest";
import { leggiStringaConnessione } from "./postgres";

describe("leggiStringaConnessione", () => {
  it("scompone la stringa del pooler di Supabase", () => {
    expect(leggiStringaConnessione("postgresql://postgres.abc123:segreta@aws-1-eu-central-1.pooler.supabase.com:6543/postgres")).toEqual({
      host: "aws-1-eu-central-1.pooler.supabase.com",
      port: 6543,
      database: "postgres",
      username: "postgres.abc123",
      password: "segreta",
    });
  });

  it("una password incollata così com'è, con un % isolato, vale alla lettera (il lettore standard si romperebbe)", () => {
    expect(leggiStringaConnessione("postgresql://u:ab%cd!ef@host:6543/postgres").password).toBe("ab%cd!ef");
  });

  it("una password codificata come vuole un indirizzo viene decodificata", () => {
    expect(leggiStringaConnessione("postgresql://u:p%40ss%23@host:6543/postgres").password).toBe("p@ss#");
  });

  it("una @ scritta nella password non taglia l'indirizzo: la password finisce all'ultima @", () => {
    const p = leggiStringaConnessione("postgresql://u:pa@ss@host:6543/postgres");
    expect(p.password).toBe("pa@ss");
    expect(p.host).toBe("host");
  });

  it("senza porta vale 5432; i parametri dopo il ? e le virgolette attorno non contano", () => {
    expect(leggiStringaConnessione('"postgres://u:p@host/db?sslmode=require"')).toEqual({ host: "host", port: 5432, database: "db", username: "u", password: "p" });
  });

  it("una stringa che non è un indirizzo Postgres dà un errore che dice la forma attesa", () => {
    expect(() => leggiStringaConnessione("https://esempio.supabase.co")).toThrow("postgresql://utente:password@host:porta/database");
  });
});
