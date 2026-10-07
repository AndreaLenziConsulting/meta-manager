import { formatEuro, formatNumero, formatPercentuale, formatRoas, formatVariazionePercentuale } from "@/lib/format";
import { calcolaVariazionePeriodo, type DirezioneVariazione } from "@/lib/confrontoPeriodo";
import { Kpi } from "@/components/ui/Kpi";
import type { KpiGroup } from "@/types/kpi";
import type { CampoConFonte, KpiConOverlayGhl } from "@/lib/kpiGhlOverlay";

/**
 * Da dove può arrivare un numero commerciale (appuntamenti, vendite, fatturato) e in che stato è
 * quella fonte — serve a non scrivere mai uno zero che non è un dato:
 * - `manualePresente`: esistono righe di RisultatiCommerciali inserite a mano per il periodo;
 * - `ghlInArrivo`: la sede legge da GHL (o dal file contatti) e la risposta non è ancora arrivata;
 * - `ghlErrore`: quella lettura è fallita.
 */
export type StatoFontiCommerciali = { manualePresente: boolean; ghlInArrivo: boolean; ghlErrore: boolean };

type Disponibilita = "ok" | "caricamento" | "non-compilato" | "non-disponibile";

const TESTO_ASSENZA: Record<Exclude<Disponibilita, "ok">, { valore: string; nota: string }> = {
  caricamento: { valore: "…", nota: "Lettura in corso" },
  "non-compilato": { valore: "Non compilato", nota: "Nessun risultato inserito per questo periodo" },
  "non-disponibile": { valore: "Non disponibile", nota: "La fonte dei dati non ha risposto" },
};
// Sul link pubblico legge il cliente: "non compilato" è una parola del team (parla di chi deve
// inserire i dati), a lui basta sapere che il numero per quel periodo non c'è ancora.
const TESTO_ASSENZA_CLIENTE = { valore: "Non disponibile", nota: "Dato non ancora disponibile per questo periodo" };

type Tessera = {
  label: string;
  disponibilita: Disponibilita;
  primario: string;
  primarioValore: number | null;
  precedenteValore: number | null;
  // true solo per Investimento: è una variazione da mostrare, non un giudizio "meglio/peggio" —
  // più spesa non è di per sé un bene o un male, a differenza di lead/appuntamenti/vendite/fatturato.
  metricaNeutra?: boolean;
  secondarioLabel?: string;
  secondario?: string;
  // La tessera su fondo blu notte: il numero che conta di più, una sola per vista.
  notte?: boolean;
};

function coloreVariazione(direzione: DirezioneVariazione, metricaNeutra: boolean | undefined, notte: boolean): string {
  // Su blu notte verde e rosso non si leggono: lì parlano la freccia e il segno.
  if (notte) return "text-su-notte";
  if (metricaNeutra || direzione === "invariato") return "text-ink-500";
  return direzione === "aumento" ? "text-ok" : "text-critico";
}

function simboloVariazione(direzione: DirezioneVariazione): string {
  if (direzione === "invariato") return "→";
  return direzione === "aumento" ? "▲" : "▼";
}

/**
 * Le sei tessere di sintesi del tab KPI, tre per riga, nella forma "Kpi" del Design System ALC: barra
 * di accento a sinistra, prima il valore, sotto l'etichetta; in fondo la variazione sul periodo
 * precedente e la metrica derivata (CPL, costo per appuntamento, ROAS). Fatturato sta su blu notte
 * quando c'è: è il numero a cui tutto il resto porta. Tutti i valori sono relativi al periodo
 * selezionato (`totale`); quando `overlayGhl` è presente, i campi che GHL può sostituire
 * (appuntamenti, vendite, fatturato e derivati) vengono da lì.
 *
 * Mai un falso zero (07/10/2026): un numero commerciale che non arriva da GHL e per cui nessuno ha
 * inserito risultati a mano non vale 0, vale "Non compilato" — vedi `StatoFontiCommerciali`. Prima
 * un cliente senza risultati inseriti mostrava "0 appuntamenti, ROAS 0,00x".
 *
 * La variazione vs il periodo precedente compare solo quando è un confronto onesto: stesso tipo di
 * fonte nei due periodi (mai un valore GHL "oggi" contro uno inserito a mano "ieri") e dato
 * presente in entrambi. Altrimenti non compare, mai un dato inventato.
 */
export function SintesiTessere({
  totale,
  overlayGhl,
  totalePrecedente,
  overlayGhlPrecedente,
  fonti,
  manualePresentePrecedente,
  vistaCliente = false,
  etichettaConfronto = "vs periodo prec.",
}: {
  totale: KpiGroup;
  overlayGhl: KpiConOverlayGhl | null;
  totalePrecedente: KpiGroup | null;
  overlayGhlPrecedente: KpiConOverlayGhl | null;
  fonti: StatoFontiCommerciali;
  /** Come `fonti.manualePresente`, ma per il periodo di confronto. */
  manualePresentePrecedente: boolean;
  /** true sul link pubblico `code`: cambia solo le parole con cui si dice che un dato manca. */
  vistaCliente?: boolean;
  // Testo accanto alla variazione — "vs periodo prec." per il confronto automatico, le date del
  // periodo scelto a mano nel selettore (es. "vs 1 lug 2026 – 31 lug 2026") quando c'è, così chi
  // legge sa con cosa sta confrontando (selettore periodo in stile Meta, 26/09/2026).
  etichettaConfronto?: string;
}) {
  function disponibilita(campo: CampoConFonte<number | null> | undefined): Disponibilita {
    if (fonti.ghlInArrivo) return "caricamento";
    if (campo?.fonte === "ghl" || fonti.manualePresente) return "ok";
    return fonti.ghlErrore ? "non-disponibile" : "non-compilato";
  }

  // Valore del periodo precedente, solo se confrontabile con quello attuale: stessa fonte, e — se
  // la fonte è l'inserimento a mano — righe presenti anche nel periodo precedente.
  function precedente(attuale: CampoConFonte<number> | undefined, prima: CampoConFonte<number> | undefined): number | null {
    if (!attuale || !prima || attuale.fonte !== prima.fonte) return null;
    if (prima.fonte === "manuale" && !manualePresentePrecedente) return null;
    return prima.valore;
  }

  function commerciale(
    label: string,
    campo: CampoConFonte<number> | undefined,
    campoPrecedente: CampoConFonte<number> | undefined,
    formato: (v: number | null) => string,
    secondarioLabel: string,
    secondario: string,
    notte = false
  ): Tessera {
    const stato = disponibilita(campo);
    if (stato !== "ok" || !campo) {
      return { label, disponibilita: stato === "ok" ? "non-compilato" : stato, primario: "", primarioValore: null, precedenteValore: null };
    }
    return {
      label,
      disponibilita: "ok",
      primario: formato(campo.valore),
      primarioValore: campo.valore,
      precedenteValore: precedente(campo, campoPrecedente),
      secondarioLabel,
      secondario,
      notte,
    };
  }

  const tessere: Tessera[] = [
    {
      label: "Investimento",
      disponibilita: "ok",
      primario: formatEuro(totale.investimento),
      primarioValore: totale.investimento,
      precedenteValore: totalePrecedente?.investimento ?? null,
      metricaNeutra: true,
    },
    {
      label: "Contatti generati",
      disponibilita: "ok",
      primario: formatNumero(totale.numeroLead),
      primarioValore: totale.numeroLead,
      precedenteValore: totalePrecedente?.numeroLead ?? null,
      secondarioLabel: "CPL",
      secondario: formatEuro(totale.costoPerLead),
    },
    commerciale(
      "Appuntamenti prenotati",
      overlayGhl?.appuntamentiFissati,
      overlayGhlPrecedente?.appuntamentiFissati,
      formatNumero,
      "Costo/prenotato",
      formatEuro(overlayGhl?.costoPerAppuntamentoFissato.valore ?? null)
    ),
    commerciale(
      "Appuntamenti effettuati",
      overlayGhl?.appuntamentiEffettuati,
      overlayGhlPrecedente?.appuntamentiEffettuati,
      formatNumero,
      "% su fissati",
      formatPercentuale(overlayGhl?.percentualeEffettuatiSuFissati.valore ?? null)
    ),
    commerciale(
      "Vendite",
      overlayGhl?.numeroVendite,
      overlayGhlPrecedente?.numeroVendite,
      formatNumero,
      "Costo/vendita",
      formatEuro(overlayGhl?.cpa.valore ?? null)
    ),
    commerciale(
      "Fatturato",
      overlayGhl?.fatturato,
      overlayGhlPrecedente?.fatturato,
      formatEuro,
      "ROAS",
      formatRoas(overlayGhl?.roas.valore ?? null),
      true
    ),
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tessere.map((t) => {
        if (t.disponibilita !== "ok") {
          const assenza = vistaCliente && t.disponibilita !== "caricamento" ? TESTO_ASSENZA_CLIENTE : TESTO_ASSENZA[t.disponibilita];
          return (
            <Kpi key={t.label} valore={assenza.valore} etichetta={t.label} attenuato>
              <p className="mt-2 text-xs leading-4 text-ink-500">{assenza.nota}</p>
            </Kpi>
          );
        }
        const variazione = calcolaVariazionePeriodo(t.primarioValore, t.precedenteValore);
        const notte = Boolean(t.notte);
        const secondarioClasse = notte ? "text-su-notte-secondario" : "text-ink-500";
        return (
          <Kpi key={t.label} valore={t.primario} etichetta={t.label} variante={notte ? "notte" : "accento"}>
            {(variazione || t.secondario !== undefined) && (
              <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs leading-4">
                {variazione ? (
                  <p className={`font-semibold tabular-nums ${coloreVariazione(variazione.direzione, t.metricaNeutra, notte)}`}>
                    <span aria-hidden="true">{simboloVariazione(variazione.direzione)} </span>
                    {formatVariazionePercentuale(variazione.percentuale)}
                    <span className={`font-normal ${secondarioClasse}`}> {etichettaConfronto}</span>
                  </p>
                ) : (
                  <span />
                )}
                {t.secondario !== undefined && (
                  <p className={secondarioClasse}>
                    {t.secondarioLabel}{" "}
                    <span className={`font-bold tabular-nums ${notte ? "text-su-notte" : "text-ink-900"}`}>{t.secondario}</span>
                  </p>
                )}
              </div>
            )}
          </Kpi>
        );
      })}
    </div>
  );
}
