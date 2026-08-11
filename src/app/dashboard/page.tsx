import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getClienti, getMetaDaily } from "@/lib/sheets";
import { clientiVisibili } from "@/lib/authz";
import { computeSpesaLeadPeriodo } from "@/lib/kpi";
import { calcolaSalute } from "@/lib/salute";
import { SaluteClienti, LegendaSalute, type SaluteClienteItem } from "@/components/SaluteClienti";

const ORDINE_STATO: Record<string, number> = {
  interveni: 0,
  mantieni: 1,
  scala: 2,
  "dati-insufficienti": 3,
  "no-target": 4,
};

const GIORNI_FINESTRA = 7;

function formatData(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function DashboardHomePage() {
  const sessione = await getSessione();

  if (!sessione) {
    redirect("/login");
  }

  const clienti = await getClienti();

  if (sessione.ruolo !== "admin") {
    const assegnati = clientiVisibili(sessione, clienti);
    if (assegnati.length === 0) {
      return (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
          <p className="text-sm text-gray-500">Nessun cliente assegnato.</p>
        </div>
      );
    }
    redirect(`/dashboard/cliente/${encodeURIComponent(assegnati[0].clienteId)}`);
  }

  const oggi = new Date();
  const inizio = new Date(oggi);
  inizio.setDate(inizio.getDate() - (GIORNI_FINESTRA - 1));
  const daData = formatData(inizio);
  const aData = formatData(oggi);

  const metaDaily = await getMetaDaily();

  const items: SaluteClienteItem[] = clienti
    .filter((c) => c.attivo)
    .map((cliente) => {
      const { investimento, numeroLead, costoPerLead } = computeSpesaLeadPeriodo(
        cliente.clienteId,
        daData,
        aData,
        metaDaily
      );
      const valutazione = calcolaSalute(
        { investimento, numeroVendite: 0, cpa: null, costoPerLead },
        cliente.targetCpa,
        cliente.targetCpl
      );
      return { cliente, investimento, numeroLead, valutazione };
    })
    .sort((a, b) => ORDINE_STATO[a.valutazione.stato] - ORDINE_STATO[b.valutazione.stato]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Salute clienti</h2>
          <p className="text-sm text-gray-500 mt-1">
            Ultimi 7 giorni ({daData} → {aData}) — costo per lead vs target. Le vendite sono tracciate solo a
            livello mensile, quindi su questa finestra il segnale è sempre il costo per lead, mai il CPA su
            vendita.
          </p>
        </div>
        <a
          href="/dashboard/nuovo-cliente"
          className="flex-shrink-0 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-semibold px-4 py-2.5 transition active:scale-[.98]"
        >
          + Nuovo cliente
        </a>
      </div>
      <LegendaSalute />
      <SaluteClienti items={items} />
    </div>
  );
}
