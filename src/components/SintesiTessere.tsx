import { formatEuro, formatNumero, formatPercentuale, formatRoas } from "@/lib/format";
import type { KpiGroup } from "@/types/kpi";
import type { KpiConOverlayGhl } from "@/lib/kpiGhlOverlay";

type Tessera = { label: string; primario: string; secondarioLabel?: string; secondario?: string };

/**
 * Blocco 5 del redesign KPI: sei tessere, tre per riga — non sei affiancate sulla stessa riga
 * (con etichette lunghe come "Appuntamenti prenotati" andavano a capo e disallineavano le
 * tessere fra loro). Ogni tessera è un box vero (bordo/ombra, stesso trattamento delle altre
 * card dell'app) con una barra d'accento del colore di brand accanto all'etichetta — stesso
 * idioma già usato nelle intestazioni di "Dettaglio"/"Investimento vs Fatturato" — invece di
 * testo semplice non delimitato. Primario e secondario stanno sulla stessa riga (non impilati)
 * per sfruttare la larghezza in più e restare compatti in altezza. Tutti i valori sono relativi
 * al periodo selezionato (`totale`), overlay-GHL aware come prima: quando `overlayGhl` è
 * presente, i campi che GHL può sostituire (appuntamenti, vendite, fatturato e derivati) vengono
 * da lì — mai un'etichetta "GHL" in vista, la fonte resta distinguibile solo internamente.
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
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tessere.map((t) => (
        <div key={t.label} className="rounded-xl border border-ink-300 bg-surface-card shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1 h-4 rounded-full bg-brand shrink-0" />
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 truncate">{t.label}</p>
          </div>
          <div className="flex items-end justify-between gap-3">
            <p className="font-heading font-bold text-2xl text-ink-900 tabular-nums">{t.primario}</p>
            {t.secondario !== undefined && (
              <p className="text-right text-[11px] leading-tight text-ink-500">
                {t.secondarioLabel}
                <br />
                <span className="text-sm font-semibold text-ink-700 tabular-nums">{t.secondario}</span>
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
