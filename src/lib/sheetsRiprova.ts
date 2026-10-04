// Riprove delle chiamate a Google Sheets (04/10/2026, errore segnalato dall'utente: "Quota exceeded
// for quota metric 'Read requests' and limit 'Read requests per minute per user'").
//
// Google Sheets accetta 60 letture al minuto per utente, e l'app usa UN solo utente Google per
// tutto (l'account del team): è il limite dell'intera app, condiviso da tutte le persone collegate e
// dal cron. Superato, Google risponde 429 finché il minuto non si libera. Il client Google riprovava
// già da solo, ma con la configurazione predefinita: 3 riprove in circa 5 secondi, troppo poco per
// un limite al minuto — la pagina mostrava errore. Qui le riprove coprono circa 50 secondi.
//
// Cosa si riprova, e perché solo questo:
// - 429 (quota superata), con QUALSIASI metodo: Google non ha eseguito la richiesta, ripeterla è
//   sicuro anche per una scrittura;
// - 5xx o nessuna risposta, SOLO per le letture (GET): una scrittura che ha ricevuto un errore del
//   server potrebbe essere già stata applicata, e ripeterla duplicherebbe righe (un'aggiunta in
//   MetaDaily ripetuta = spesa contata due volte).

/** Forma minima dell'errore del client Google (GaxiosError) che serve alla decisione. */
export type ErroreGoogle = {
  name?: string;
  config?: { method?: string; retryConfig?: { currentRetryAttempt?: number; retry?: number } };
  response?: { status?: number };
};

const RIPROVE_MASSIME = 7;
const RIPROVE_SENZA_RISPOSTA = 2;

export function deveRiprovareSheets(err: ErroreGoogle): boolean {
  if (err.name === "AbortError") return false;
  const tentativiFatti = err.config?.retryConfig?.currentRetryAttempt ?? 0;
  const tentativiMassimi = err.config?.retryConfig?.retry ?? RIPROVE_MASSIME;
  if (tentativiFatti >= tentativiMassimi) return false;

  const stato = err.response?.status;
  if (stato === 429) return true;

  const lettura = (err.config?.method ?? "GET").toUpperCase() === "GET";
  if (!lettura) return false;
  if (stato === undefined) return tentativiFatti < RIPROVE_SENZA_RISPOSTA;
  return stato >= 500;
}

/**
 * Configurazione delle riprove per il client Google Sheets. Attese (formula del client Google:
 * prima attesa = `attesaIniziale`, poi (2^n - 1) / 2 secondi, al massimo 20): 2 / 0,5 / 1,5 / 3,5 /
 * 7,5 / 15,5 / 20 secondi, circa 50 in tutto — abbastanza perché il minuto della quota si liberi.
 * `attesaIniziale` è iniettabile per i test.
 */
export function configRiprovaSheets(attesaIniziale = 2000) {
  return {
    retry: RIPROVE_MASSIME,
    retryDelay: attesaIniziale,
    retryDelayMultiplier: 2,
    maxRetryDelay: 20_000,
    httpMethodsToRetry: ["GET", "POST", "PUT", "DELETE"],
    shouldRetry: deveRiprovareSheets,
  };
}
