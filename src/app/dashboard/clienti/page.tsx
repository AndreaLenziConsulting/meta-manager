import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getClienti, getConsulenti, getProdotti, getSedi } from "@/lib/sheets";
import { clientiVisibili } from "@/lib/authz";
import { iniziali } from "@/lib/format";
import { ClientiGrid } from "@/components/ClientiGrid";
import type { Cliente, Consulente, Sede } from "@/types/kpi";

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
  const isAdmin = sessione.ruolo === "admin";

  return (
    <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading font-bold text-xl text-ink-900">Clienti</h2>
          <p className="text-sm text-ink-500 mt-1">
            {isAdmin ? "Tutti i clienti assegnati ai consulenti." : "I tuoi clienti."}
          </p>
        </div>
        {isAdmin && (
          <a
            href="/dashboard/nuovo-cliente"
            className="flex-shrink-0 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-semibold px-4 py-2.5 transition active:scale-[.98]"
          >
            + Nuovo cliente
          </a>
        )}
      </div>

      {visibili.length === 0 && !isAdmin ? (
        <div className="rounded-2xl border-2 border-dashed border-ink-300 bg-surface-card p-8 text-center">
          <p className="text-sm text-ink-500">Nessun cliente assegnato.</p>
        </div>
      ) : isAdmin ? (
        <GruppiPerConsulente visibili={visibili} consulenti={consulenti} sedi={sedi} nomeProdottoPer={nomeProdottoPer} isAdmin={isAdmin} />
      ) : (
        <ClientiGrid clienti={visibili} sedi={sedi} consulenti={consulenti} nomeProdottoPer={nomeProdottoPer} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function GruppiPerConsulente({
  visibili,
  consulenti,
  sedi,
  nomeProdottoPer,
  isAdmin,
}: {
  visibili: Cliente[];
  consulenti: Consulente[];
  sedi: Sede[];
  nomeProdottoPer: Map<string, string>;
  isAdmin: boolean;
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
            <ClientiGrid clienti={clienti} sedi={sedi} consulenti={consulenti} nomeProdottoPer={nomeProdottoPer} isAdmin={isAdmin} />
          ) : (
            <p className="text-sm text-ink-500 italic">Nessun cliente assegnato ancora.</p>
          )}
        </div>
      ))}

      {nonAssegnati.length > 0 && (
        <div>
          <IntestazioneGruppo nome="Non assegnato" conteggio={nonAssegnati.length} />
          <ClientiGrid clienti={nonAssegnati} sedi={sedi} consulenti={consulenti} nomeProdottoPer={nomeProdottoPer} isAdmin={isAdmin} />
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
