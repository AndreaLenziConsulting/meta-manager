import { notFound } from "next/navigation";
import { getClienteByAccessCode } from "@/lib/sheets";
import { AppHeader } from "@/components/AppHeader";
import { SchedaCliente } from "@/components/SchedaCliente";

export default async function ReportPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cliente = await getClienteByAccessCode(code);

  if (!cliente || !cliente.attivo) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader subtitle={cliente.nome} />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <h2 className="text-xl font-bold text-gray-900">{cliente.nome}</h2>
        <SchedaCliente code={code} tuttiITab={cliente.mostraTabExtra} />
      </div>
    </div>
  );
}
