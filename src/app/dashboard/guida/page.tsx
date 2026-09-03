import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { GUIDE } from "@/lib/guide";

/**
 * Indice della macro-sezione "Guida" — tutorial su come usare la piattaforma (non sui clienti,
 * quindi visibile a tutto il team indistintamente, admin/consulente/commerciale — a differenza di
 * "Attività"/"Clienti" che sono per dominio cliente/roadmap). Elenco statico, vedi src/lib/guide.ts.
 */
export default async function GuidaIndicePage() {
  const sessione = await getSessione();
  if (!sessione) {
    redirect("/login");
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <div>
        <h2 className="font-heading font-bold text-xl text-ink-900">Guida</h2>
        <p className="text-sm text-ink-500 mt-1">Tutorial su come usare la piattaforma.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {GUIDE.map((g) => (
          <a
            key={g.slug}
            href={`/dashboard/guida/${g.slug}`}
            className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-5 hover:shadow-md transition"
          >
            <p className="font-heading font-bold text-ink-900 text-base">{g.titolo}</p>
            <p className="text-sm text-ink-500 mt-1.5">{g.descrizione}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
