import type { KpiResponse } from "@/types/kpi";
import type { KpiConOverlayGhl, CampoConFonte } from "@/lib/kpiGhlOverlay";
import type { GhlRiepilogoResponse } from "@/types/ghl";
import type { MeseSenzaFunnel } from "@/lib/kpiQualita";
import { calcolaTesseraSettimanale, serieCostoPerLead } from "@/lib/kpiSettimanale";
import { costruisciFunnelVerticale } from "@/lib/funnelStadi";
import { formatEuro, formatNumero, formatRoas, formatDataBreve, formatMese } from "@/lib/format";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DatoNonDisponibile } from "@/components/DatoNonDisponibile";
import { TesseraSettimanale } from "@/components/TesseraSettimanale";
import { FunnelVerticale } from "@/components/FunnelVerticale";
import { NoteMetodologiche } from "@/components/NoteMetodologiche";

type TrendSettimanaleItem = { settimana: string; investimento: number; fatturato: number; numeroLead: number; mese: string };

type PerformanceSedeCorrenteProps = {
  dati: KpiResponse;
  trendSettimanale: TrendSettimanaleItem[];
  overlayGhl: KpiConOverlayGhl | null;
  ghlDati: GhlRiepilogoResponse | null;
  /**
   * SCELTA DI DESIGN (delle due opzioni proposte dal task): questo componente riceve direttamente
   * l'esito già calcolato di mesiConSpesaSenzaFunnel (kpiQualita.ts) invece dei tre array grezzi
   * (metaDaily/campagne/funnel). Motivo: PerformanceDashboard.tsx (il chiamante) ha comunque bisogno
   * di quegli array grezzi per altre sezioni della pagina e può calcolare l'array una volta sola lì;
   * questo componente resta così puramente presentazionale/derivato-da-props, senza dover conoscere
   * la forma di MetaDailyRow/Campagna/FunnelRow né duplicare l'attribuzione cliente+sede -> campagne.
   */
  meseSenzaFunnel: MeseSenzaFunnel[];
};

/** Legge un campo dell'overlay GHL solo se la sua fonte è "ghl", altrimenti ricade sul totale Funnel. */
function valoreOverlayOTotale(campo: CampoConFonte<number> | undefined, fallback: number): number {
  return campo && campo.fonte === "ghl" ? campo.valore : fallback;
}

/**
 * Vista "Performance" per la sede/periodo correntemente selezionati nella tab "KPI (nuovo)" —
 * componente di composizione: tutto il calcolo vive già in kpiSettimanale.ts/funnelStadi.ts/
 * kpiQualita.ts, qui si assembla solo l'ordine di lettura per l'utente:
 *
 * 1. Tessere settimanali (Investimento, Lead, Costo/Lead, Fatturato solo se GHL connesso)
 * 2. Riepilogo cumulato "da sempre" (solo se il chiamante ha richiesto ?cumulato=1)
 * 3. Funnel verticale del periodo selezionato
 * 4. Note metodologiche (regole di fallback Funnel/GHL già esistenti, solo documentate qui)
 * 5. Flag di qualità dei dati (solo se ce n'è almeno uno da mostrare)
 */
export function PerformanceSedeCorrente({ dati, trendSettimanale, overlayGhl, ghlDati, meseSenzaFunnel }: PerformanceSedeCorrenteProps) {
  const ghlConnesso = ghlDati !== null && ghlDati.connesso;
  const calendariConfigurati = ghlDati !== null && ghlDati.connesso ? ghlDati.calendariConfigurati : false;
  const calendariFalliti = ghlDati !== null && ghlDati.connesso ? ghlDati.calendariFalliti : 0;

  // --- 1. Tessere settimanali ---
  const tesseraInvestimento = calcolaTesseraSettimanale(
    trendSettimanale.map((t) => ({ settimana: t.settimana, valore: t.investimento }))
  );
  const tesseraLead = calcolaTesseraSettimanale(trendSettimanale.map((t) => ({ settimana: t.settimana, valore: t.numeroLead })));
  const tesseraCostoLead = calcolaTesseraSettimanale(serieCostoPerLead(trendSettimanale));
  // Il Funnel è mensile: un fatturato "settimanale" ricostruito da lì sarebbe lo stesso valore
  // ripetuto su ogni settimana del mese, e il confronto WoW risulterebbe finto. Si mostra questa
  // tessera SOLO quando la sede è connessa a GHL, che invece fornisce un fatturato per settimana
  // reale (vedi applicaOverlayGhlTrend in kpiGhlOverlay.ts) — altrimenti va omessa, non mostrata vuota.
  const tesseraFatturato = ghlConnesso
    ? calcolaTesseraSettimanale(trendSettimanale.map((t) => ({ settimana: t.settimana, valore: t.fatturato })))
    : null;

  // --- 3. Funnel del periodo selezionato ---
  const funnelStadi = costruisciFunnelVerticale({
    // overlayGhl non porta investimento/numeroRichieste (GHL non ha questi concetti): sempre dati.totale.
    investimento: dati.totale.investimento,
    numeroRichieste: dati.totale.numeroRichieste,
    appuntamentiFissati: valoreOverlayOTotale(overlayGhl?.appuntamentiFissati, dati.totale.appuntamentiFissati),
    appuntamentiEffettuati: valoreOverlayOTotale(overlayGhl?.appuntamentiEffettuati, dati.totale.appuntamentiEffettuati),
    numeroVendite: valoreOverlayOTotale(overlayGhl?.numeroVendite, dati.totale.numeroVendite),
  });

  // --- 5. Flag di qualità ---
  // Con GHL connesso un Funnel vuoto è normale (i dati vivono altrove): il flag ha senso solo
  // quando la sede dipende ancora dal Funnel inserito a mano.
  const mostraMesiSenzaFunnel = !ghlConnesso && meseSenzaFunnel.length > 0;
  const mostraCalendariNonConfigurati = ghlConnesso && !calendariConfigurati;
  const ciSonoFlag = mostraMesiSenzaFunnel || calendariFalliti > 0 || mostraCalendariNonConfigurati;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TesseraSettimanale titolo="Investimento" tessera={tesseraInvestimento} formato={formatEuro} coloreVar="--series-1" />
        <TesseraSettimanale titolo="Lead" tessera={tesseraLead} formato={formatNumero} coloreVar="--series-3" />
        <TesseraSettimanale titolo="Costo per lead" tessera={tesseraCostoLead} formato={formatEuro} coloreVar="--series-4" />
        {ghlConnesso && (
          <TesseraSettimanale titolo="Fatturato" tessera={tesseraFatturato} formato={formatEuro} coloreVar="--series-2" />
        )}
      </div>

      {dati.totaleCumulato && (
        <Card>
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-brand" />
            <h3 className="font-heading font-bold text-ink-900 text-[15px]">Il periodo in sintesi — da sempre</h3>
          </div>
          {dati.primaData && <p className="text-xs text-ink-500 pl-3 mt-0.5">dal {formatDataBreve(dati.primaData)}</p>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4 mt-4">
            <Statistica label="Investimento" valore={formatEuro(dati.totaleCumulato.investimento)} />
            <Statistica label="Lead" valore={formatNumero(dati.totaleCumulato.numeroLead)} />
            <Statistica label="Appuntamenti fissati" valore={formatNumero(dati.totaleCumulato.appuntamentiFissati)} />
            <Statistica label="Appuntamenti effettuati" valore={formatNumero(dati.totaleCumulato.appuntamentiEffettuati)} />
            <Statistica label="Vendite" valore={formatNumero(dati.totaleCumulato.numeroVendite)} />
            <Statistica label="Fatturato" valore={formatEuro(dati.totaleCumulato.fatturato)} />
            <Statistica
              label="ROAS"
              valore={dati.totaleCumulato.roas === null ? null : formatRoas(dati.totaleCumulato.roas)}
              motivoNonDisponibile="ROAS non calcolabile: nessun investimento nel periodo da sempre"
            />
          </div>
        </Card>
      )}

      <FunnelVerticale stadi={funnelStadi} />

      <NoteMetodologiche ghlConnesso={ghlConnesso} calendariConfigurati={calendariConfigurati} />

      {ciSonoFlag && (
        <Card padding="md" className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-1 h-5 rounded-full bg-brand" />
            <h3 className="font-heading font-bold text-ink-900 text-[15px]">Da verificare</h3>
          </div>

          <ul className="space-y-2 text-[13px] text-ink-700">
            {mostraMesiSenzaFunnel &&
              meseSenzaFunnel.map((m) => (
                <li key={m.mese} className="flex items-center gap-2">
                  <Badge tono="attenzione">Funnel mancante</Badge>
                  <span>
                    {formatMese(m.mese)}: {formatEuro(m.investimento)} di spesa Meta senza nessuna riga Funnel compilata.
                  </span>
                </li>
              ))}

            {calendariFalliti > 0 && (
              <li className="flex items-center gap-2">
                <Badge tono="attenzione">Dati parziali</Badge>
                <span>
                  {calendariFalliti} {calendariFalliti === 1 ? "calendario" : "calendari"} non raggiungibili: il conteggio
                  appuntamenti è parziale.
                </span>
              </li>
            )}

            {mostraCalendariNonConfigurati && (
              <li className="flex items-center gap-2">
                <Badge tono="attenzione">Da configurare</Badge>
                <span>Sede connessa a GHL ma nessun calendario è ancora stato configurato sulla connessione.</span>
              </li>
            )}
          </ul>
        </Card>
      )}
    </div>
  );
}

function Statistica({
  label,
  valore,
  motivoNonDisponibile,
}: {
  label: string;
  valore: string | null;
  motivoNonDisponibile?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-ink-500">{label}</p>
      <p className="text-lg font-semibold text-ink-900 tabular-nums">
        {valore === null ? <DatoNonDisponibile motivo={motivoNonDisponibile} /> : valore}
      </p>
    </div>
  );
}
