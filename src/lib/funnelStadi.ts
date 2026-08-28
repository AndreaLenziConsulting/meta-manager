import { divideOrNull } from "@/lib/kpi";

export type StadioFunnel = {
  stadio: "richieste" | "appuntamentiFissati" | "appuntamentiEffettuati" | "vendite";
  etichetta: string;
  conteggio: number;
  costoCumulato: number | null;
  percentualeConversioneAlProssimo: number | null;
  dropOffAssoluto: number | null;
};

/**
 * Costruisce i 4 stadi del funnel verticale (richieste -> fissati -> effettuati -> vendite) a
 * partire dai totali già aggregati (stesso spirito di KpiGroup, ma qui serve solo il sottoinsieme
 * di campi rilevante per il funnel). Sempre 4 elementi, in ordine fisso.
 */
export function costruisciFunnelVerticale(input: {
  investimento: number;
  numeroRichieste: number;
  appuntamentiFissati: number;
  appuntamentiEffettuati: number;
  numeroVendite: number;
}): StadioFunnel[] {
  const stadi: { stadio: StadioFunnel["stadio"]; etichetta: string; conteggio: number }[] = [
    { stadio: "richieste", etichetta: "Richieste", conteggio: input.numeroRichieste },
    { stadio: "appuntamentiFissati", etichetta: "Appuntamenti fissati", conteggio: input.appuntamentiFissati },
    { stadio: "appuntamentiEffettuati", etichetta: "Presentati", conteggio: input.appuntamentiEffettuati },
    { stadio: "vendite", etichetta: "Hanno acquistato", conteggio: input.numeroVendite },
  ];

  return stadi.map((s, i) => {
    const prossimo = stadi[i + 1]; // undefined per l'ultimo stadio (vendite)
    // Un "drop-off" ha senso solo come quantità non negativa: se lo stadio successivo ha PIÙ
    // persone di questo (es. Richieste=0 dal Funnel manuale mai compilato mentre Appuntamenti
    // fissati arriva da GHL — due fonti diverse non davvero comparabili — oppure Vendite conta
    // opportunità vinte indipendentemente da quali appuntamenti GHL segna come "effettuati"),
    // non è un vero calo: è un segnale che i due stadi non sono nello stesso funnel reale, non
    // un "-N non arrivano al passaggio successivo" da mostrare. In quel caso resta null, mai un
    // numero negativo.
    const dropOff = prossimo ? s.conteggio - prossimo.conteggio : null;
    return {
      stadio: s.stadio,
      etichetta: s.etichetta,
      conteggio: s.conteggio,
      // investimento totale diviso per quante persone hanno raggiunto QUESTO stadio, non solo il primo.
      costoCumulato: divideOrNull(input.investimento, s.conteggio),
      percentualeConversioneAlProssimo: prossimo ? divideOrNull(prossimo.conteggio, s.conteggio) : null,
      dropOffAssoluto: dropOff !== null && dropOff < 0 ? null : dropOff,
    };
  });
}

/**
 * Percentuale di ogni stadio rispetto al primo (conteggi[0]) — usata per la barra cumulata del
 * funnel verticale. Se conteggi[0] è 0 il rapporto non ha senso per nessuno stadio: tutti null,
 * incluso il primo stesso (0/0 sarebbe comunque null via divideOrNull).
 */
export function percentualeCumulataSuPrimoStadio(conteggi: number[]): (number | null)[] {
  const primo = conteggi[0];
  return conteggi.map((c) => divideOrNull(c, primo));
}
