import { redirect } from "next/navigation";
import { getSessione } from "@/lib/auth";
import { getAttivitaCliente, getCampagne, getClienti, getConsulenti, getMetaDaily, getSedi } from "@/lib/sheets";
import { clientiVisibili } from "@/lib/authz";
import { computeSpesaLeadPeriodo } from "@/lib/kpi";
import { aggregaValutazioniSedi, calcolaSalute } from "@/lib/salute";
import { attivitaInRitardo, raggruppaAttivitaPerCliente } from "@/lib/roadmap";
import {
  calcolaRiepilogo,
  ordinaPerPriorita,
  type SaluteClienteItem,
  type SaluteSedeValutazione,
} from "@/lib/dashboardAdmin";
import { SaluteClienti } from "@/components/SaluteClienti";
import { RiepilogoAllarmiAdmin } from "@/components/RiepilogoAllarmiAdmin";

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
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8">
          <p className="text-sm text-ink-500">Nessun cliente assegnato.</p>
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

  const [metaDaily, campagne, attivitaTutte, consulenti, sedi] = await Promise.all([
    getMetaDaily(),
    getCampagne(),
    getAttivitaCliente(),
    getConsulenti(),
    getSedi(),
  ]);
  const attivitaPerCliente = raggruppaAttivitaPerCliente(attivitaTutte);

  const items: SaluteClienteItem[] = clienti
    .filter((c) => c.attivo)
    .map((cliente) => {
      const sediValutate: SaluteSedeValutazione[] = sedi
        .filter((s) => s.clienteId === cliente.clienteId && s.attivo)
        .map((sede) => {
          const { investimento, numeroLead, costoPerLead } = computeSpesaLeadPeriodo(
            cliente.clienteId,
            sede.sedeId,
            daData,
            aData,
            metaDaily,
            campagne
          );
          const valutazione = calcolaSalute(
            { investimento, numeroVendite: 0, cpa: null, costoPerLead },
            sede.targetCpa,
            sede.targetCpl
          );
          return { sede, investimento, numeroLead, valutazione };
        });
      // "Il peggio vince" tra le sedi decide lo stato della card — vedi aggregaValutazioniSedi.
      // Un cliente senza nessuna sede attiva (caso limite, es. subito dopo la creazione) non ha
      // nulla da aggregare: resta "no-target" come farebbe calcolaSalute senza target impostato.
      const valutazione =
        sediValutate.length > 0
          ? aggregaValutazioniSedi(sediValutate.map((s) => s.valutazione))
          : { stato: "no-target" as const, metricaUsata: null, valoreAttuale: null, targetUsato: null };
      return {
        cliente,
        sedi: sediValutate,
        valutazione,
        investimento: sediValutate.reduce((somma, s) => somma + s.investimento, 0),
        numeroLead: sediValutate.reduce((somma, s) => somma + s.numeroLead, 0),
        attivitaInRitardo: attivitaInRitardo(attivitaPerCliente.get(cliente.clienteId) ?? []),
      };
    });
  const itemsOrdinati = ordinaPerPriorita(items);
  const riepilogo = calcolaRiepilogo(itemsOrdinati);

  return (
    <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-heading font-bold text-xl text-ink-900">Dashboard Amministratore</h2>
          <p className="text-sm text-ink-500 mt-1">
            Salute ads (ultimi 7 giorni, {daData} → {aData} — costo per lead vs target: le vendite sono
            tracciate solo a livello mensile, quindi su questa finestra il segnale è sempre il costo per lead)
            e stato dei lavori, cliente per cliente.
          </p>
        </div>
        <a
          href="/dashboard/nuovo-cliente"
          className="flex-shrink-0 rounded-xl bg-cta hover:bg-cta-dark text-white text-sm font-semibold px-4 py-2.5 transition active:scale-[.98]"
        >
          + Nuovo cliente
        </a>
      </div>
      <RiepilogoAllarmiAdmin riepilogo={riepilogo} />
      <SaluteClienti items={itemsOrdinati} consulenti={consulenti} />
    </div>
  );
}
