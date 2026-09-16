export type StatoPacing = "successo" | "attenzione" | "critico";

export type MetricaPacing = {
  chiave: "budget" | "fatturato" | "lead" | "appuntamenti";
  etichetta: string;
  unita: "euro" | "numero";
  attuale: number;
  targetMensile: number;
  // Dove si dovrebbe essere arrivati oggi con un ritmo lineare — targetMensile * (giorno del
  // mese / giorni nel mese). Il marker condiviso nel grafico (PacingTargetChart.tsx) è sempre alla
  // STESSA posizione percentuale su ogni riga (stessa frazione di mese trascorsa), solo il valore
  // assoluto cambia da riga a riga: per questo il chiamante non ha bisogno di ripeterlo per riga,
  // ma lo teniamo qui comunque per il calcolo dello stato e per un'eventuale etichetta di dettaglio.
  attesoOggi: number;
  stato: StatoPacing;
};

/**
 * Soglie 80%/100% — stesse identiche già in uso in SaluteClienti.tsx ("ads tra 80% e 120% del
 * target" per lo stato "mantieni") e nello spirito di targetCommerciali.ts: non un numero
 * inventato per questo grafico, lo stesso linguaggio "quanto sei vicino al target" già noto al
 * team. ≥100% del ritmo atteso = in linea o avanti; 80-99% = leggermente indietro ma recuperabile;
 * <80% = indietro. `attesoOggi<=0` capita solo a inizio mese con un target validissimo (giorno 0
 * teoricamente impossibile ma per sicurezza): mai un "critico" fuorviante lì, l'attuale è comunque
 * la miglior informazione disponibile.
 */
function calcolaStato(attuale: number, attesoOggi: number): StatoPacing {
  if (attesoOggi <= 0) return attuale > 0 ? "successo" : "attenzione";
  const rapporto = attuale / attesoOggi;
  if (rapporto >= 1) return "successo";
  if (rapporto >= 0.8) return "attenzione";
  return "critico";
}

export type InputPacingMensile = {
  investimentoMese: number;
  fatturatoMese: number;
  leadMese: number;
  appuntamentiMese: number;
  targetBudgetMensile: number | null;
  targetFatturatoMensile: number | null;
  // Target SETTIMANALI (Sede.targetLeadSettimana/targetAppuntamentiSettimana) — convertiti qui a
  // equivalente mensile (× giorniNelMese/7), non prima: il chiamante passa gli stessi target grezzi
  // già letti da Sede, un solo posto che sa come si passa da settimanale a mensile.
  targetLeadSettimana: number | null;
  targetAppuntamentiSettimana: number | null;
  giornoDelMese: number; // 1-based (new Date().getDate())
  giorniNelMese: number; // 28-31
};

/**
 * Le 4 metriche di pacing del mese in corso rispetto a oggi (richiesta utente, 11/2026: "a che
 * punto ci si trova sui vari target mensili rispetto al giorno attuale"). Una voce per metrica CON
 * un target impostato — un target null/0 non genera una riga (mai una barra a 0/0 priva di
 * significato): il chiamante mostra uno stato vuoto se l'array torna vuoto del tutto.
 */
export function calcolaPacingMensile(input: InputPacingMensile): MetricaPacing[] {
  const frazioneMese = input.giorniNelMese > 0 ? Math.min(input.giornoDelMese / input.giorniNelMese, 1) : 0;
  const risultato: MetricaPacing[] = [];

  function aggiungi(chiave: MetricaPacing["chiave"], etichetta: string, unita: MetricaPacing["unita"], attuale: number, targetMensile: number | null) {
    if (targetMensile === null || targetMensile <= 0) return;
    const attesoOggi = targetMensile * frazioneMese;
    risultato.push({ chiave, etichetta, unita, attuale, targetMensile, attesoOggi, stato: calcolaStato(attuale, attesoOggi) });
  }

  aggiungi("budget", "Budget mensile", "euro", input.investimentoMese, input.targetBudgetMensile);
  aggiungi("fatturato", "Fatturato mensile", "euro", input.fatturatoMese, input.targetFatturatoMensile);
  aggiungi(
    "lead",
    "Lead",
    "numero",
    input.leadMese,
    input.targetLeadSettimana !== null ? input.targetLeadSettimana * (input.giorniNelMese / 7) : null
  );
  aggiungi(
    "appuntamenti",
    "Appuntamenti fissati",
    "numero",
    input.appuntamentiMese,
    input.targetAppuntamentiSettimana !== null ? input.targetAppuntamentiSettimana * (input.giorniNelMese / 7) : null
  );

  return risultato;
}
