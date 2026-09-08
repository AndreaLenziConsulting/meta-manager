export type PuntoSaldoNetto = {
  settimana: string;
  investimentoCumulato: number;
  contrattualizzatoCumulato: number;
  saldoNetto: number; // contrattualizzatoCumulato - investimentoCumulato
};

/**
 * Blocco 6c del redesign KPI — una singola linea (contrattualizzato cumulato − investimento
 * cumulato, settimana su settimana) invece delle due linee separate di TrendChart.tsx: risponde a
 * "abbiamo mai recuperato tutto l'investimento storico?", non "come si confrontano le due grandezze
 * questa settimana" (quella domanda resta di TrendChart.tsx, non toccato da questo redesign). La
 * linea parte tipicamente sotto zero (si investe prima di incassare) e attraversa lo zero nel
 * momento in cui il contrattualizzato cumulato supera l'investimento cumulato — quel punto è il
 * vero pareggio, non leggibile da due linee separate senza fare il conto a mente.
 *
 * Deliberatamente "contrattualizzato", non "fatturato": qui conta il valore dei contratti firmati,
 * non l'incassato — stessa cifra del campo `fatturato` condiviso a monte (vedi trendSettimanale in
 * kpi.ts, alimentato da RisultatiCommerciali), ma il nome giusto per come la usa questo grafico. Il parametro
 * `serie` in ingresso mantiene comunque la chiave `fatturato` finché arriva così dal chiamante
 * (SaldoNettoCumulatoChart.tsx la rimappa subito) — qui, da questo punto in poi, è sempre e solo
 * "contrattualizzato".
 *
 * `serie` è attesa ordinata per settimana crescente e, a differenza degli altri grafici del blocco
 * 6, copre l'intera storia della sede da `primaData` (vedi il fetch dedicato con `cumulato=1` in
 * KpiSection.tsx) — non il periodo scelto nel filtro blocco 3: filtrare per periodo azzererebbe
 * quasi sempre il grafico a un pareggio falso, la domanda che risponde è "da sempre", non "in
 * questo periodo". Un contrattualizzato null (mese senza dato RisultatiCommerciali per quella settimana, vedi
 * trendSettimanale in kpi.ts) vale 0 nel cumulo: non c'è un valore migliore da sommare, e trattarlo
 * come 0 lascia la linea continua invece di un buco senza senso in un cumulativo.
 */
export function calcolaSaldoNettoCumulato(serie: { settimana: string; investimento: number; contrattualizzato: number | null }[]): PuntoSaldoNetto[] {
  let investimentoCumulato = 0;
  let contrattualizzatoCumulato = 0;
  return serie.map((s) => {
    investimentoCumulato += s.investimento;
    contrattualizzatoCumulato += s.contrattualizzato ?? 0;
    return {
      settimana: s.settimana,
      investimentoCumulato,
      contrattualizzatoCumulato,
      saldoNetto: contrattualizzatoCumulato - investimentoCumulato,
    };
  });
}
