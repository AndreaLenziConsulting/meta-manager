import { formatEuro, formatNumero, formatPercentuale, formatRoas, formatVariazionePercentuale } from "@/lib/format";
import { calcolaVariazionePeriodo, type DirezioneVariazione } from "@/lib/confrontoPeriodo";
import type { KpiGroup } from "@/types/kpi";
import type { KpiConOverlayGhl } from "@/lib/kpiGhlOverlay";

type Tessera = {
  label: string;
  primario: string;
  primarioValore: number | null;
  precedenteValore: number | null;
  // true solo per Investimento: è una variazione da mostrare, non un giudizio "meglio/peggio" —
  // più spesa non è di per sé un bene o un male, a differenza di lead/appuntamenti/vendite/fatturato.
  metricaNeutra?: boolean;
  secondarioLabel?: string;
  secondario?: string;
};

function coloreVariazione(direzione: DirezioneVariazione, metricaNeutra?: boolean): string {
  if (metricaNeutra || direzione === "invariato") return "text-ink-500";
  return direzione === "aumento" ? "text-green-700" : "text-red-600";
}

function simboloVariazione(direzione: DirezioneVariazione): string {
  if (direzione === "invariato") return "→";
  return direzione === "aumento" ? "▲" : "▼";
}

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
 *
 * Sotto al numero primario, un indicatore di variazione vs il periodo precedente di pari durata
 * (vedi confrontoPeriodo.ts e il calcolo di da/aPrecedente in KpiSection.tsx) — anch'esso
 * overlay-GHL aware: mai confrontare un valore GHL "oggi" con un valore Funnel "ieri", sarebbe
 * un confronto fra fonti diverse spacciato per un trend reale (stessa regola generale già
 * applicata altrove nell'app). `totalePrecedente`/`overlayGhlPrecedente` null finché il fetch
 * del periodo precedente non è arrivato, o se non c'è un periodo precedente comparabile — in
 * quel caso l'indicatore semplicemente non compare, mai un dato inventato.
 */
export function SintesiTessere({
  totale,
  overlayGhl,
  totalePrecedente,
  overlayGhlPrecedente,
}: {
  totale: KpiGroup;
  overlayGhl: KpiConOverlayGhl | null;
  totalePrecedente: KpiGroup | null;
  overlayGhlPrecedente: KpiConOverlayGhl | null;
}) {
  const tessere: Tessera[] = [
    {
      label: "Investimento",
      primario: formatEuro(totale.investimento),
      primarioValore: totale.investimento,
      precedenteValore: totalePrecedente?.investimento ?? null,
      metricaNeutra: true,
    },
    {
      label: "Contatti generati",
      primario: formatNumero(totale.numeroLead),
      primarioValore: totale.numeroLead,
      precedenteValore: totalePrecedente?.numeroLead ?? null,
      secondarioLabel: "CPL",
      secondario: formatEuro(totale.costoPerLead),
    },
    {
      label: "Appuntamenti prenotati",
      primario: formatNumero(overlayGhl?.appuntamentiFissati.valore ?? totale.appuntamentiFissati),
      primarioValore: overlayGhl?.appuntamentiFissati.valore ?? totale.appuntamentiFissati,
      precedenteValore: overlayGhlPrecedente?.appuntamentiFissati.valore ?? totalePrecedente?.appuntamentiFissati ?? null,
      secondarioLabel: "Costo/prenotato",
      secondario: formatEuro(overlayGhl?.costoPerAppuntamentoFissato.valore ?? totale.costoPerAppuntamentoFissato),
    },
    {
      label: "Appuntamenti effettuati",
      primario: formatNumero(overlayGhl?.appuntamentiEffettuati.valore ?? totale.appuntamentiEffettuati),
      primarioValore: overlayGhl?.appuntamentiEffettuati.valore ?? totale.appuntamentiEffettuati,
      precedenteValore: overlayGhlPrecedente?.appuntamentiEffettuati.valore ?? totalePrecedente?.appuntamentiEffettuati ?? null,
      secondarioLabel: "% su fissati",
      secondario: formatPercentuale(overlayGhl?.percentualeEffettuatiSuFissati.valore ?? totale.percentualeEffettuatiSuFissati),
    },
    {
      label: "Vendite",
      primario: formatNumero(overlayGhl?.numeroVendite.valore ?? totale.numeroVendite),
      primarioValore: overlayGhl?.numeroVendite.valore ?? totale.numeroVendite,
      precedenteValore: overlayGhlPrecedente?.numeroVendite.valore ?? totalePrecedente?.numeroVendite ?? null,
      secondarioLabel: "Costo/vendita",
      secondario: formatEuro(overlayGhl?.cpa.valore ?? totale.cpa),
    },
    {
      label: "Fatturato",
      primario: formatEuro(overlayGhl?.fatturato.valore ?? totale.fatturato),
      primarioValore: overlayGhl?.fatturato.valore ?? totale.fatturato,
      precedenteValore: overlayGhlPrecedente?.fatturato.valore ?? totalePrecedente?.fatturato ?? null,
      secondarioLabel: "ROAS",
      secondario: formatRoas(overlayGhl?.roas.valore ?? totale.roas),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tessere.map((t) => {
        const variazione = calcolaVariazionePeriodo(t.primarioValore, t.precedenteValore);
        return (
          <div key={t.label} className="rounded-xl border border-ink-300 bg-surface-card shadow-sm p-4">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-1 h-4 rounded-full bg-brand shrink-0" />
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500 truncate">{t.label}</p>
            </div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-heading font-bold text-2xl text-ink-900 tabular-nums">{t.primario}</p>
                {variazione && (
                  <p className={`mt-1 text-[11px] font-medium tabular-nums ${coloreVariazione(variazione.direzione, t.metricaNeutra)}`}>
                    {simboloVariazione(variazione.direzione)} {formatVariazionePercentuale(variazione.percentuale)}
                    <span className="text-ink-500 font-normal"> vs periodo prec.</span>
                  </p>
                )}
              </div>
              {t.secondario !== undefined && (
                <p className="text-right text-[11px] leading-tight text-ink-500">
                  {t.secondarioLabel}
                  <br />
                  <span className="text-sm font-semibold text-ink-700 tabular-nums">{t.secondario}</span>
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
