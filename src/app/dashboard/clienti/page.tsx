import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getClienti, getConsulenti, getProdotti, getSedi } from "@/lib/sheets";
import { clientiVisibili } from "@/lib/authz";
import { iniziali } from "@/lib/format";
import type { Cliente, Consulente } from "@/types/kpi";

/**
 * Elenco di tutti i clienti assegnati — mirror strutturale di dashboard/commerciale/page.tsx
 * (l'elenco Prospect) ma per i clienti: prima non esisteva una vista a elenco esplicita, un
 * consulente arrivava dritto sul suo (unico) cliente via redirect da /dashboard, o cambiava
 * cliente dal dropdown nell'header — nessuna delle due dà una vista d'insieme vera.
 *
 * Cliente non ha un campo tipo "tipoBusiness" da usare come sottotitolo — uso il nome del
 * Prodotto collegato (se presente) e il conteggio delle sedi attive, stesso schema a 3 parti
 * (titolo/sottotitolo opzionale/riga meta) della card Prospect.
 *
 * Per l'admin, i clienti sono raggruppati per consulente (su richiesta esplicita dell'utente,
 * con screenshot di riferimento) — prima la griglia era piatta, senza modo di vedere a colpo
 * d'occhio il carico di ciascun consulente. Un consulente non ha nulla da raggruppare (vede solo
 * i propri), quindi per lui la vista resta la griglia piatta di sempre, senza intestazioni.
 */
export default async function ClientiListaPage() {
  const sessione = await getSessione();
  if (!sessione) {
    redirect("/login");
  }
  if (sessione.ruolo === "commerciale") {
    redirect("/dashboard");
  }

  const [clienti, sedi, prodotti, consulenti] = await Promise.all([
    getClienti(),
    getSedi(),
    getProdotti(),
    getConsulenti(),
  ]);
  const visibili = clientiVisibili(sessione, clienti);

  const nomeProdottoPer = new Map(prodotti.map((p) => [p.prodottoId, p.nome]));
  const sediAttivePer = new Map<string, number>();
  for (const s of sedi) {
    if (!s.attivo) continue;
    sediAttivePer.set(s.clienteId, (sediAttivePer.get(s.clienteId) ?? 0) + 1);
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <div>
        <h2 className="font-heading font-bold text-xl text-ink-900">Clienti</h2>
        <p className="text-sm text-ink-500 mt-1">
          {sessione.ruolo === "admin" ? "Tutti i clienti assegnati ai consulenti." : "I tuoi clienti."}
        </p>
      </div>

      {visibili.length === 0 && sessione.ruolo !== "admin" ? (
        <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
          <p className="text-sm text-ink-500">Nessun cliente assegnato.</p>
        </div>
      ) : sessione.ruolo === "admin" ? (
        <GruppiPerConsulente visibili={visibili} consulenti={consulenti} nomeProdottoPer={nomeProdottoPer} sediAttivePer={sediAttivePer} />
      ) : (
        <GrigliaClienti clienti={visibili} nomeProdottoPer={nomeProdottoPer} sediAttivePer={sediAttivePer} />
      )}
    </div>
  );
}

function GruppiPerConsulente({
  visibili,
  consulenti,
  nomeProdottoPer,
  sediAttivePer,
}: {
  visibili: Cliente[];
  consulenti: Consulente[];
  nomeProdottoPer: Map<string, string>;
  sediAttivePer: Map<string, number>;
}) {
  const perConsulente = new Map<string, Cliente[]>();
  for (const c of visibili) {
    const lista = perConsulente.get(c.consulenteId) ?? [];
    lista.push(c);
    perConsulente.set(c.consulenteId, lista);
  }

  // Un consulente attivo compare sempre, anche con 0 clienti ("in arrivo") — un roster completo,
  // non solo chi ha già qualcosa assegnato. Ordinati per carico decrescente (chi ha più clienti
  // prima), a parità di conteggio per nome — stesso criterio del riferimento mostrato dall'utente.
  const gruppi = consulenti
    .filter((c) => c.attivo)
    .map((consulente) => ({ consulente, clienti: perConsulente.get(consulente.consulenteId) ?? [] }))
    .sort((a, b) => b.clienti.length - a.clienti.length || a.consulente.nome.localeCompare(b.consulente.nome));

  // Clienti il cui consulenteId non corrisponde a nessun consulente attivo (dato orfano: consulente
  // disattivato/rimosso senza riassegnare i suoi clienti) — non vanno persi dalla vista, ma in una
  // sezione a parte invece di far sparire silenziosamente dei clienti reali.
  const idConsulentiAttivi = new Set(consulenti.filter((c) => c.attivo).map((c) => c.consulenteId));
  const nonAssegnati = visibili.filter((c) => !idConsulentiAttivi.has(c.consulenteId));

  if (gruppi.every((g) => g.clienti.length === 0) && nonAssegnati.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
        <p className="text-sm text-ink-500">Nessun cliente attivo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {gruppi.map(({ consulente, clienti }) => (
        <div key={consulente.consulenteId}>
          <IntestazioneGruppo nome={consulente.nome} conteggio={clienti.length} />
          {clienti.length > 0 ? (
            <GrigliaClienti clienti={clienti} nomeProdottoPer={nomeProdottoPer} sediAttivePer={sediAttivePer} />
          ) : (
            <p className="text-sm text-ink-500 italic">Nessun cliente assegnato ancora.</p>
          )}
        </div>
      ))}

      {nonAssegnati.length > 0 && (
        <div>
          <IntestazioneGruppo nome="Non assegnato" conteggio={nonAssegnati.length} />
          <GrigliaClienti clienti={nonAssegnati} nomeProdottoPer={nomeProdottoPer} sediAttivePer={sediAttivePer} />
        </div>
      )}
    </div>
  );
}

function IntestazioneGruppo({ nome, conteggio }: { nome: string; conteggio: number }) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <span className="w-7 h-7 rounded-full bg-brand text-white text-xs font-semibold flex items-center justify-center flex-shrink-0">
        {iniziali(nome)}
      </span>
      <span className="font-heading font-bold text-ink-900">{nome}</span>
      <span className="flex-1 border-t border-ink-300/60" aria-hidden="true" />
      <span className="text-[11px] font-semibold text-ink-500 uppercase tracking-wide flex-shrink-0">
        {conteggio > 0 ? `${conteggio} client${conteggio > 1 ? "i" : "e"}` : "In arrivo"}
      </span>
    </div>
  );
}

function GrigliaClienti({
  clienti,
  nomeProdottoPer,
  sediAttivePer,
}: {
  clienti: Cliente[];
  nomeProdottoPer: Map<string, string>;
  sediAttivePer: Map<string, number>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {clienti.map((c) => {
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
  );
}
