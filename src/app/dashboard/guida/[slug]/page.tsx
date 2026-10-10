import type { ReactNode } from "react";
import type { Metadata } from "next";
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: trovaGuida(slug)?.titolo ?? "Guida" };
}

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
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/guida"
          aria-label="Torna alla guida"
          title="Torna alla guida"
          className="-ml-2 flex items-center justify-center w-10 h-10 rounded-full text-ink-700 hover:bg-surface-card hover:text-accento-testo transition shrink-0"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </Link>
        <h1 className="font-heading text-[28px] leading-[34px] font-extrabold text-ink-900 text-balance">{meta.titolo}</h1>
      </div>

      <article className="rounded-xl border border-bordo-card bg-surface-card shadow-[var(--shadow-card)] p-6 sm:p-8 max-w-3xl">
        <Contenuto />
      </article>
    </div>
  );
}
