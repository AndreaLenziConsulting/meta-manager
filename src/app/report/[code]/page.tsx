import { notFound } from "next/navigation";
import { getClienteByAccessCode } from "@/lib/sheets";
import { AppHeader } from "@/components/AppHeader";
import { SchedaCliente } from "@/components/SchedaCliente";
import { LogoONomeCliente } from "@/components/LogoONomeCliente";
import { styleTemaCliente } from "@/lib/temaCliente";

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
    <div className="min-h-screen bg-gray-50 font-sans" style={styleTemaCliente(cliente)}>
      <AppHeader subtitle={cliente.nome} />
      <div className="max-w-6xl mx-auto px-6 sm:px-8 py-8 space-y-6">
        <h2>
          <LogoONomeCliente
            nome={cliente.nome}
            logoUrl={cliente.logoUrl}
            className={cliente.logoUrl ? "h-10 w-auto object-contain" : "text-xl font-bold text-gray-900"}
          />
        </h2>
        <SchedaCliente code={code} tuttiITab={cliente.mostraTabExtra} />
      </div>
    </div>
  );
}
