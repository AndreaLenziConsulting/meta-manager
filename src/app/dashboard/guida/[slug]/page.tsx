import type { ReactNode } from "react";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessione } from "@/lib/auth";
import { trovaGuida } from "@/lib/guide";
import { GuidaCollegareGhl } from "@/components/guide/GuidaCollegareGhl";

// Mappa slug -> componente contenuto. Aggiungere una guida: nuova voce qui + nuova riga in
// src/lib/guide.ts (i due elenchi devono restare in sincrono, nessuna delle due "guida" da sola).
const CONTENUTO: Record<string, () => ReactNode> = {
  "collegare-ghl": GuidaCollegareGhl,
};

export default async function GuidaDettaglioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sessione = await getSessione();
  if (!sessione) {
    redirect("/login");
  }

  const meta = trovaGuida(slug);
  const Contenuto = CONTENUTO[slug];
  if (!meta || !Contenuto) {
    notFound();
  }

  return (
    <div className="max-w-screen-2xl mx-auto px-6 sm:px-8 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/guida"
          aria-label="Torna alla guida"
          title="Torna alla guida"
          className="flex items-center justify-center w-9 h-9 rounded-xl border border-ink-300 bg-surface-card text-ink-500 hover:text-ink-900 hover:border-ink-400 transition shrink-0"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="font-heading font-bold text-2xl text-ink-900">{meta.titolo}</h1>
      </div>

      <article className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm p-6 sm:p-8 max-w-3xl">
        <Contenuto />
      </article>
    </div>
  );
}
