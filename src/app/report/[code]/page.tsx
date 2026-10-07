import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClienteByAccessCode } from "@/lib/archivio";
import { AppHeader } from "@/components/AppHeader";
import { SchedaCliente } from "@/components/SchedaCliente";
import { LogoONomeCliente } from "@/components/LogoONomeCliente";
import { styleTemaCliente } from "@/lib/temaCliente";

// Il link è personale: nella scheda del browser il cliente vede il proprio nome, non quello dell'app.
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const cliente = await getClienteByAccessCode(code);
  if (!cliente || !cliente.attivo) return {};
  return { title: { absolute: `${cliente.nome} · Report` } };
}

export default async function ReportPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cliente = await getClienteByAccessCode(code);

  if (!cliente || !cliente.attivo) {
    notFound();
  }

  return (
    // font-sans qui, non solo nello style: font-family è dichiarato sul <body> (fuori da questo
    // wrapper) e le proprietà ereditate si "congelano" al valore già calcolato lì — vedi lo stesso
    // commento in dashboard/cliente/[clienteId]/page.tsx.
    <div className="min-h-screen bg-surface font-sans" style={styleTemaCliente(cliente)}>
      <AppHeader subtitle={cliente.nome} />
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <h1>
          <LogoONomeCliente
            nome={cliente.nome}
            logoUrl={cliente.logoUrl}
            className={cliente.logoUrl ? "h-10 w-auto object-contain" : "font-heading text-[28px] leading-[34px] font-extrabold text-ink-900"}
          />
        </h1>
        <SchedaCliente code={code} tuttiITab={cliente.mostraTabExtra} />
      </main>
    </div>
  );
}
