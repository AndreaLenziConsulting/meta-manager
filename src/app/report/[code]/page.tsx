import { notFound } from "next/navigation";
import { getClienteByAccessCode } from "@/lib/sheets";
import { KpiDashboard } from "@/components/KpiDashboard";

export default async function ReportPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const cliente = await getClienteByAccessCode(code);

  if (!cliente || !cliente.attivo) {
    notFound();
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      <h1 className="text-lg font-semibold">{cliente.nome}</h1>
      <KpiDashboard code={code} />
    </div>
  );
}
