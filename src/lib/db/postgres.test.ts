import { describe, expect, it } from "vitest";
import { collegamentoLocale, leggiStringaConnessione, limitatore } from "./postgres";

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

describe("collegamentoLocale", () => {
  it("solo un indirizzo di questa macchina è il database di prova; il pooler di Supabase no", () => {
    expect(collegamentoLocale(leggiStringaConnessione("postgresql://prova:prova@127.0.0.1:54329/postgres").host)).toBe(true);
    expect(collegamentoLocale("localhost")).toBe(true);
    expect(collegamentoLocale("aws-1-eu-central-1.pooler.supabase.com")).toBe(false);
    expect(collegamentoLocale("localhost.esempio.it")).toBe(false);
  });
});

describe("limitatore", () => {
  const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

  it("mai più lavori insieme del massimo, e tutti arrivano in fondo", async () => {
    const conLimite = limitatore(3);
    let inCorso = 0;
    let picco = 0;
    const esiti = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        conLimite(async () => {
          inCorso++;
          picco = Math.max(picco, inCorso);
          await pausa(5);
          inCorso--;
          return i;
        })
      )
    );
    expect(picco).toBe(3);
    expect(esiti).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });

  it("chi aspetta parte nell'ordine in cui è arrivato", async () => {
    const conLimite = limitatore(1);
    const partenze: number[] = [];
    await Promise.all(
      [0, 1, 2, 3].map((i) =>
        conLimite(async () => {
          partenze.push(i);
          await pausa(3);
        })
      )
    );
    expect(partenze).toEqual([0, 1, 2, 3]);
  });

  it("un lavoro che fallisce libera il suo posto: gli altri non restano appesi", async () => {
    const conLimite = limitatore(1);
    const rotto = conLimite(async () => {
      throw new Error("rotto");
    });
    const dopo = conLimite(async () => "ok");
    await expect(rotto).rejects.toThrow("rotto");
    await expect(dopo).resolves.toBe("ok");
  });
});
