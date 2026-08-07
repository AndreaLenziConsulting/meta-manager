import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/auth";
import { getCampagne, getClienti, getFunnel, getMetaDaily } from "@/lib/sheets";
import { computeKpi } from "@/lib/kpi";
import { calcolaSalute } from "@/lib/salute";
import { AppHeader } from "@/components/AppHeader";
import { SaluteClienti, type SaluteClienteItem } from "@/components/SaluteClienti";

const ORDINE_STATO: Record<string, number> = {
  interveni: 0,
  mantieni: 1,
  scala: 2,
  "dati-insufficienti": 3,
  "no-target": 4,
};

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

export default async function SalutePage() {
  const cookieStore = await cookies();
  const sessione = parseSessionCookieValue(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!sessione) {
    redirect("/login");
  }
  if (sessione.ruolo !== "admin") {
    redirect("/dashboard");
  }

  const mese = meseCorrente();
  const [clienti, metaDaily, campagne, funnel] = await Promise.all([
    getClienti(),
    getMetaDaily(),
    getCampagne(),
    getFunnel(),
  ]);

  const items: SaluteClienteItem[] = clienti
    .filter((c) => c.attivo)
    .map((cliente) => {
      const { totale } = computeKpi(cliente.clienteId, mese, mese, metaDaily, campagne, funnel);
      const valutazione = calcolaSalute(totale, cliente.targetCpa, cliente.targetCpl);
      return { cliente, totale, valutazione };
    })
    .sort((a, b) => ORDINE_STATO[a.valutazione.stato] - ORDINE_STATO[b.valutazione.stato]);

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader subtitle="Salute clienti" />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Salute clienti</h2>
          <p className="text-sm text-gray-500 mt-1">
            Mese corrente — CPA su vendita se disponibile, altrimenti costo per lead come proxy. Sotto la
            spesa minima (2,5× il target) il cliente resta &ldquo;dati insufficienti&rdquo;.
          </p>
        </div>
        <SaluteClienti items={items} />
      </div>
    </div>
  );
}
