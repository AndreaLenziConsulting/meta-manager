import { formatEuro, formatNumero, formatPercentuale, formatRoas } from "@/lib/format";
import type { KpiGroup } from "@/types/kpi";
import type { KpiConOverlayGhl } from "@/lib/kpiGhlOverlay";

type Tessera = { label: string; primario: string; secondarioLabel?: string; secondario?: string };

/**
 * Blocco 5 del redesign KPI: sei tessere in una riga, ognuna con un valore primario e uno
 * secondario più piccolo sotto — sostituisce l'hero "Fatturato" + griglia di 10 metriche del
 * vecchio KpiDashboard.tsx. Tutti i valori sono relativi al periodo selezionato (`totale`),
 * overlay-GHL aware come le vecchie tessere: quando `overlayGhl` è presente, i campi che GHL può
 * sostituire (appuntamenti, vendite, fatturato e derivati) vengono da lì — mai un'etichetta "GHL"
 * in vista (tolta su richiesta esplicita in un giro precedente), la fonte resta distinguibile
 * solo internamente leggendo `fonte` su ogni campo dell'overlay.
 */
export function SintesiTessere({ totale, overlayGhl }: { totale: KpiGroup; overlayGhl: KpiConOverlayGhl | null }) {
  const tessere: Tessera[] = [
    { label: "Investimento", primario: formatEuro(totale.investimento) },
    {
      label: "Contatti generati",
      primario: formatNumero(totale.numeroLead),
      secondarioLabel: "CPL",
      secondario: formatEuro(totale.costoPerLead),
    },
    {
      label: "Appuntamenti prenotati",
      primario: formatNumero(overlayGhl?.appuntamentiFissati.valore ?? totale.appuntamentiFissati),
      secondarioLabel: "Costo/prenotato",
      secondario: formatEuro(overlayGhl?.costoPerAppuntamentoFissato.valore ?? totale.costoPerAppuntamentoFissato),
    },
    {
      label: "Appuntamenti effettuati",
      primario: formatNumero(overlayGhl?.appuntamentiEffettuati.valore ?? totale.appuntamentiEffettuati),
      secondarioLabel: "% su fissati",
      secondario: formatPercentuale(overlayGhl?.percentualeEffettuatiSuFissati.valore ?? totale.percentualeEffettuatiSuFissati),
    },
    {
      label: "Vendite",
      primario: formatNumero(overlayGhl?.numeroVendite.valore ?? totale.numeroVendite),
      secondarioLabel: "Costo/vendita",
      secondario: formatEuro(overlayGhl?.cpa.valore ?? totale.cpa),
    },
    {
      label: "Fatturato",
      primario: formatEuro(overlayGhl?.fatturato.valore ?? totale.fatturato),
      secondarioLabel: "ROAS",
      secondario: formatRoas(overlayGhl?.roas.valore ?? totale.roas),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-x-6 gap-y-6">
      {tessere.map((t) => (
        <div key={t.label}>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">{t.label}</p>
          <p className="font-heading font-bold text-2xl text-ink-900 mt-1 tabular-nums">{t.primario}</p>
          {t.secondario !== undefined && (
            <p className="text-xs text-ink-500 mt-1">
              {t.secondarioLabel}: <span className="font-semibold text-ink-700 tabular-nums">{t.secondario}</span>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
