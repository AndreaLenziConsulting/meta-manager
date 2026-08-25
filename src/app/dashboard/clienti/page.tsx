import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getClienti, getProdotti, getSedi } from "@/lib/sheets";
import { clientiVisibili } from "@/lib/authz";

/**
 * Elenco di tutti i clienti assegnati — mirror strutturale di dashboard/commerciale/page.tsx
 * (l'elenco Prospect) ma per i clienti: prima non esisteva una vista a elenco esplicita, un
 * consulente arrivava dritto sul suo (unico) cliente via redirect da /dashboard, o cambiava
 * cliente dal dropdown nell'header — nessuna delle due dà una vista d'insieme vera.
 *
 * Cliente non ha un campo tipo "tipoBusiness" da usare come sottotitolo — uso il nome del
 * Prodotto collegato (se presente) e il conteggio delle sedi attive, stesso schema a 3 parti
 * (titolo/sottotitolo opzionale/riga meta) della card Prospect.
 */
export default async function ClientiListaPage() {
  const sessione = await getSessione();
  if (!sessione) {
    redirect("/login");
  }
  if (sessione.ruolo === "commerciale") {
    redirect("/dashboard");
  }

  const [clienti, sedi, prodotti] = await Promise.all([getClienti(), getSedi(), getProdotti()]);
  const visibili = clientiVisibili(sessione, clienti);

  const nomeProdottoPer = new Map(prodotti.map((p) => [p.prodottoId, p.nome]));
  const sediAttivePer = new Map<string, number>();
  for (const s of sedi) {
    if (!s.attivo) continue;
    sediAttivePer.set(s.clienteId, (sediAttivePer.get(s.clienteId) ?? 0) + 1);
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div>
        <h2 className="font-heading font-bold text-xl text-ink-900">Clienti</h2>
        <p className="text-sm text-ink-500 mt-1">
          {sessione.ruolo === "admin" ? "Tutti i clienti assegnati ai consulenti." : "I tuoi clienti."}
        </p>
      </div>

      {visibili.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
          <p className="text-sm text-ink-500">Nessun cliente assegnato.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {visibili.map((c) => {
            const nSedi = sediAttivePer.get(c.clienteId) ?? 0;
            const nomeProdotto = c.prodottoId ? nomeProdottoPer.get(c.prodottoId) : null;
            return (
              <a
                key={c.clienteId}
                href={`/dashboard/cliente/${encodeURIComponent(c.clienteId)}`}
                className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5 hover:shadow-md transition"
              >
                <p className="font-heading font-bold text-ink-900 text-base truncate">{c.nome}</p>
                {nomeProdotto && <p className="text-xs text-ink-500 mt-0.5">{nomeProdotto}</p>}
                <p className="text-[11px] text-ink-500 mt-2.5 pt-2.5 border-t border-ink-300/60">
                  {nSedi > 0 ? `${nSedi} sed${nSedi > 1 ? "i attive" : "e attiva"}` : "Nessuna sede attiva"}
                </p>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
