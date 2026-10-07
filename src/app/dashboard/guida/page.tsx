import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { GUIDE } from "@/lib/guide";
import { Intestazione, CLASSE_TITOLO_SEZIONE } from "@/components/ui/Intestazione";

export const metadata: Metadata = { title: "Guida" };

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
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <Intestazione titolo="Guida." sottotitolo="Come si usa la piattaforma, un passaggio alla volta." />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {GUIDE.map((g) => (
          <a
            key={g.slug}
            href={`/dashboard/guida/${g.slug}`}
            className="rounded-xl border border-linea bg-surface-card shadow-[var(--shadow-card)] p-5 hover:shadow-[var(--shadow-alta)] transition"
          >
            <p className={CLASSE_TITOLO_SEZIONE}>{g.titolo}</p>
            <p className="text-sm leading-[22px] text-ink-500 mt-1.5">{g.descrizione}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
