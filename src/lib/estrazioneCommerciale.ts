import Groq from "groq-sdk";
import {
  EstrazioneError,
  detectSource,
  isAuthWall,
  isPaginaConErroreCaricamento,
  renderPage,
  toStrArray,
  type MeetingSource,
  type TroncamentoInfo,
} from "@/lib/estrazione";
import type { ReportCommercialeDataLoose } from "@/types/prospect";

/**
 * Estrazione dati Report Commerciale: stessa meccanica di scraping+estrazione AI di
 * estrazione.ts (Playwright/Chromium per la pagina di condivisione Fathom/Circleback/Loom, poi
 * Groq con tool calling forzato) — riusata as-is (`renderPage`/`detectSource`/`isAuthWall`/
 * `isPaginaConErroreCaricamento`/`toStrArray`), solo prompt e schema del tool cambiano: qui non si
 * estrae un recap di meeting di delivery, ma il racconto di una chiamata di vendita — dati del
 * prospect, quadro emerso (criticità + tentativi già fatti + pain, fusi in un'unica sezione
 * narrativa), obiettivi aziendali, strategia proposta, soluzione, prossimi passi (11/2026:
 * struttura rivista, sostituisce le vecchie sezioni separate Criticità/Tentate Soluzioni/PAIN/
 * Comunicazione Corretta secondo AL — vedi types/prospect.ts). Il Calcolatore Budget NON è tra i
 * campi estratti: è sempre una proiezione compilata a mano dal commerciale sul prospect, vedi
 * src/lib/roiSimulatore.ts.
 */

function sourceLabel(source: MeetingSource): string {
  if (source === "circleback") return "Circleback";
  if (source === "loom") return "Loom";
  return "Fathom";
}

const EXTRACTION_TOOL_COMMERCIALE = {
  type: "function" as const,
  function: {
    name: "save_report_commerciale",
    description: "Salva i dati strutturati del report commerciale estratti da una trascrizione di chiamata di vendita.",
    parameters: {
      type: "object" as const,
      required: [
        "title", "date", "participants", "ragioneSociale", "nomeContatto", "tipoBusiness", "fatturato", "sedi",
        "quadroEmerso", "obiettivi", "strategiaProposta", "soluzioneProposta", "prossimiPassi",
      ],
      properties: {
        title: { type: "string", description: "Titolo della chiamata così come mostrato sulla piattaforma" },
        date: { type: "string", description: "Data della chiamata in formato DD/MM/YYYY" },
        // Stesso trucco di estrazione.ts: type [array, string] non solo array — Groq rifiuta con
        // tool_use_failed se il modello mette "" invece di [] per un campo vuoto (verificato lì,
        // vale identico qui). toStrArray/toStr a valle gestiscono già entrambe le forme.
        participants: { type: ["array", "string"], items: { type: "string" }, description: "Nomi dei partecipanti alla chiamata (commerciale ALC + persone del prospect)" },
        ragioneSociale: { type: "string", description: "Nome/ragione sociale dell'azienda prospect (MAI Andrea Lenzi Consulting)" },
        nomeContatto: { type: "string", description: "Nome e cognome della persona di contatto/referente del prospect (chi parla per l'azienda), se identificabile. Stringa vuota se non chiaro." },
        tipoBusiness: { type: "string", description: "Che tipo di business fa il prospect, in breve (es. 'agenzia immobiliare', 'ristorazione', 'e-commerce moda')" },
        fatturato: { type: "string", description: "Fatturato dichiarato o stimato dal prospect, come menzionato in chiamata (es. '~500k€/anno', 'non specificato'). Stringa vuota se mai discusso." },
        sedi: { type: "string", description: "Quante sedi/punti vendita ha il prospect e dove, se menzionato. Stringa vuota se non discusso." },
        quadroEmerso: {
          type: ["array", "string"],
          items: { type: "string" },
          description:
            "Il quadro della situazione emerso in chiamata: cosa non funziona oggi nel marketing/nelle vendite del prospect, cosa ha già provato per risolverlo e perché non ha funzionato, e l'impatto reale/emotivo che questo ha su di lui (il PAIN — non solo il problema tecnico, ma cosa comporta davvero: clienti persi, stress, fatturato bloccato). Un racconto unico, non 3 liste separate: ogni voce è un piccolo paragrafo argomentato (1-3 frasi) scritto nel linguaggio/vissuto del prospect (le sue parole, cosa lo preoccupa davvero), non in gergo tecnico. Una voce per riga.",
        },
        obiettivi: {
          type: ["array", "string"],
          items: { type: "string" },
          description: "Gli obiettivi aziendali del prospect — cosa vuole ottenere (es. 'raddoppiare i lead in 6 mesi', 'aprire una seconda sede'). Con numeri/orizzonti temporali se menzionati, argomentato in 1-3 frasi per voce.",
        },
        strategiaProposta: {
          type: ["array", "string"],
          items: { type: "string" },
          description:
            "La strategia/il ragionamento che il commerciale ALC ha proposto in risposta al quadro emerso e agli obiettivi — il COME e il PERCHÉ di quell'approccio, prima del dettaglio del servizio (che va in soluzioneProposta sotto). Argomentato in 1-3 frasi per voce, linguaggio semplice.",
        },
        soluzioneProposta: {
          type: ["array", "string"],
          items: { type: "string" },
          description:
            "Il dettaglio concreto del servizio/offerta proposta — cosa è incluso, come funziona in pratica (diverso da strategiaProposta sopra, che è il ragionamento generale, non il dettaglio operativo). Argomentato in 1-3 frasi per voce, linguaggio semplice.",
        },
        prossimiPassi: {
          type: ["array", "string"],
          items: { type: "string" },
          description: "I prossimi passi concordati a fine chiamata (es. 'invio proposta scritta entro venerdì', 'follow-up call martedì prossimo'). Una voce per riga.",
        },
      },
    },
  },
};

const SYSTEM_PROMPT_COMMERCIALE = `Sei un assistente che estrae dati strutturati da chiamate commerciali (chiamate di vendita con un potenziale cliente, "prospect") per "Andrea Lenzi Consulting", agenzia di consulenza marketing.

Riceverai il contenuto testuale reso dal browser di una pagina di condivisione Fathom, Circleback o Loom (registrazione/trascrizione della chiamata). Se il testo è organizzato in sezioni marcate "=== TRANSCRIPT ===", "=== SUMMARY ===", "=== ACTION ITEMS ===", "=== CHAPTERS ===" (tipico di Loom), la trascrizione è la fonte più completa e autorevole — usa summary/action items come contesto aggiuntivo, non come sostituto.

Nella chiamata parlano tipicamente due parti: il **commerciale** di Andrea Lenzi Consulting (chi conduce la vendita, presenta l'offerta) e il **prospect** (l'azienda potenziale cliente, che racconta la propria situazione). Devi ricostruire, in italiano, il report in questa struttura:

1. **Dati del prospect**: ragione sociale, nome e cognome della persona di contatto (se identificabile), che tipo di business fa, fatturato (se menzionato, anche solo come stima), quante sedi/punti vendita ha.
2. **Quadro emerso**: il racconto UNICO di cosa non funziona oggi nel marketing/nelle vendite del prospect, cosa ha già provato per risolverlo e perché non ha funzionato, e l'impatto reale — non solo il problema tecnico, ma cosa comporta davvero per lui (clienti persi, stress, fatturato bloccato, crescita ferma). Scrivi questa sezione nel linguaggio/vissuto del prospect stesso (le sue parole, cosa lo preoccupa davvero la notte), non in gergo tecnico o di prodotto — è il suo punto di vista, non quello dell'agenzia.
3. **Obiettivi aziendali**: cosa vuole ottenere il prospect, con numeri/orizzonti temporali se menzionati.
4. **Strategia proposta**: il ragionamento/approccio che il commerciale ha proposto in risposta al quadro emerso — il COME e il PERCHÉ, prima del dettaglio operativo.
5. **Soluzione**: il dettaglio concreto del servizio/offerta discussa — cosa è incluso, come funziona in pratica (diverso dalla strategia sopra, che è il ragionamento generale).
6. **Prossimi passi**: cosa è stato concordato per il seguito (invio proposta, prossima call, ecc.).

Linee guida:
- Rispondi sempre in italiano, anche se la chiamata è in un'altra lingua.
- Se un'informazione non è presente, metti stringa vuota (campi string) o array vuoto (campi lista) — non inventare mai dati non supportati dal contenuto.
- Per i campi lista (quadro emerso, obiettivi aziendali, strategia proposta, soluzione, prossimi passi): una voce per riga, ma ogni voce è un piccolo paragrafo argomentato (1-3 frasi), non un titolo telegrafico — spiega il PERCHÉ/il contesto dietro il punto usando quello che è stato detto in chiamata, non solo il fatto nudo. Esempio: non "Poca visibilità online" ma "Il prospect fatica a farsi trovare online: chi cerca il suo servizio nella zona trova prima i concorrenti, e questo si traduce in clienti persi senza nemmeno saperlo". Argomenta con sostanza reale dalla chiamata, mai per allungare a vuoto. Per "quadro emerso" in particolare, le voci devono leggersi come un racconto che si tiene insieme (criticità → cosa già provato → l'impatto vero), non 3 liste indipendenti mescolate a caso.
- Linguaggio SEMPRE semplice, come lo spiegheresti a chi non lavora nel marketing: mai gergo tecnico non spiegato (non "CTR basso" ma "poche persone che vedono l'annuncio ci cliccano sopra"; non "funnel" ma "il percorso che un cliente fa da quando ti scopre a quando compra"). Se in chiamata è stato usato un termine tecnico, traducilo in parole semplici invece di ricopiarlo.
- La data in formato DD/MM/YYYY.
- Chiama SEMPRE il tool "save_report_commerciale" con i dati estratti, anche se alcuni campi restano vuoti.`;

/**
 * Estrae i dati strutturati di un report commerciale da un link di condivisione pubblico
 * (Fathom/Circleback/Loom). Lancia `EstrazioneError` con lo status HTTP appropriato su ogni
 * fallimento gestito (pagina protetta, contenuto vuoto, modello che rifiuta) — stessa semantica di
 * estraiMeetingData in estrazione.ts.
 */
export async function estraiReportCommerciale(
  url: string
): Promise<{ dati: ReportCommercialeDataLoose; troncamento: TroncamentoInfo | null }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new EstrazioneError("GROQ_API_KEY non configurata", 500);
  }

  const source = detectSource(url);
  const sourceName = sourceLabel(source);

  // Scraping con retry — stesso motivo/stessa logica di estrazione.ts (errore transitorio del
  // provider, non del link): isPaginaConErroreCaricamento è pura/importata, il retry I/O resta qui.
  // 3 tentativi (non 2 come in estrazione.ts, file separato quindi a rischio zero per i meeting):
  // osservato in pratica che anche un secondo tentativo può cadere sullo stesso errore transitorio.
  let pageContent: { text: string; html: string } | null = null;
  let ultimoErrore: unknown = null;
  for (let tentativo = 1; tentativo <= 3; tentativo++) {
    try {
      const risultato = await renderPage(url);
      if (!isPaginaConErroreCaricamento(risultato.text)) {
        pageContent = risultato;
        break;
      }
      ultimoErrore = null;
    } catch (err) {
      ultimoErrore = err;
      if (err instanceof EstrazioneError) break;
    }
  }

  if (!pageContent) {
    if (ultimoErrore instanceof EstrazioneError) throw ultimoErrore;
    if (ultimoErrore) {
      const msg = ultimoErrore instanceof Error ? ultimoErrore.message : String(ultimoErrore);
      throw new EstrazioneError(`Impossibile aprire la pagina ${sourceName}: ${msg}`, 502);
    }
    throw new EstrazioneError(
      `La pagina ${sourceName} ha restituito un errore di caricamento anche dopo più tentativi — riprova tra qualche secondo.`,
      502
    );
  }

  const visible = pageContent.text.trim();

  if (isAuthWall(visible)) {
    throw new EstrazioneError(
      source === "circleback"
        ? "Il link Circleback richiede l'accesso. Verifica nelle impostazioni del meeting Circleback che la condivisione sia impostata come pubblica (link accessibile senza login)."
        : `La pagina ${sourceName} richiede l'accesso. Serve un link di condivisione pubblico.`,
      403
    );
  }

  // Stesso vincolo di estrazione.ts (piano Groq free, 8K TPM) ma con margine più ampio: il
  // budget precedente (10-11K caratteri) è arrivato a sforare in produzione su una chiamata
  // reale ("Request too large ... Limit 8000, Requested 8062" — sforato di appena 62 token,
  // segno che il margine non era sufficiente). Il conteggio esatto caratteri→token varia con la
  // lingua/punteggiatura del testo reso dal browser, quindi qui il margine è tenuto largo invece
  // di ritoccare il numero al minimo che avrebbe fatto passare solo quel caso specifico.
  const charLimit = source === "loom" ? 9_000 : 8_000;
  const trimmed = visible.slice(0, charLimit);
  const troncamento: TroncamentoInfo | null =
    visible.length > charLimit ? { caratteriTotali: visible.length, caratteriElaborati: charLimit } : null;
  if (troncamento) {
    console.warn(
      `[estrazioneCommerciale] Testo troncato per ${sourceName} (${url}): elaborati ${troncamento.caratteriElaborati} di ${troncamento.caratteriTotali} caratteri.`
    );
  }
  const buildUserContent = (testo: string) => `URL: ${url}
Fonte: ${source}

--- TESTO RESO DAL BROWSER ---
${testo}
`;

  const client = new Groq({ apiKey });

  // Anche con il margine sopra, un testo insolitamente denso di token (poca punteggiatura, molti
  // termini tecnici) può ancora sforare il limite — invece di arrenderci subito, un tentativo in
  // più riducendo drasticamente il contenuto: un'estrazione da un estratto più corto è comunque
  // meglio di un errore secco per chi sta usando l'app in una chiamata di vendita vera.
  let contenutoAttuale = trimmed;
  let completion: Awaited<ReturnType<typeof client.chat.completions.create>> | null = null;
  let ultimoErroreGroq: unknown = null;
  const TENTATIVI_GROQ = 3;
  for (let tentativo = 1; tentativo <= TENTATIVI_GROQ; tentativo++) {
    try {
      completion = await client.chat.completions.create({
        model: "openai/gpt-oss-120b",
        max_tokens: 4096,
        temperature: 0.1,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: SYSTEM_PROMPT_COMMERCIALE },
          { role: "user", content: buildUserContent(contenutoAttuale) },
        ],
        tools: [EXTRACTION_TOOL_COMMERCIALE],
        tool_choice: { type: "function", function: { name: "save_report_commerciale" } },
      });
      break;
    } catch (err) {
      ultimoErroreGroq = err;
      const msg = err instanceof Error ? err.message : String(err);
      const troppoGrande = /rate_limit_exceeded|request too large|too large for model/i.test(msg);
      if (troppoGrande && tentativo < TENTATIVI_GROQ) {
        contenutoAttuale = contenutoAttuale.slice(0, Math.floor(contenutoAttuale.length * 0.6));
        continue;
      }
      if (!/tool_use_failed/i.test(msg)) break;
    }
  }

  if (!completion) {
    const msg = ultimoErroreGroq instanceof Error ? ultimoErroreGroq.message : String(ultimoErroreGroq);
    if (/tool_use_failed/i.test(msg)) {
      throw new EstrazioneError(
        `Impossibile estrarre il contenuto dal link ${sourceName} anche dopo un secondo tentativo. Verifica che il link sia un link di condivisione pubblico e che la chiamata sia stata elaborata, oppure riprova tra qualche secondo.`,
        422
      );
    }
    if (/rate_limit_exceeded|request too large|too large for model/i.test(msg)) {
      throw new EstrazioneError(
        `La trascrizione di questa chiamata è troppo densa per essere elaborata in un colpo solo, anche dopo aver ridotto il contenuto. Riprova tra qualche minuto (il limite si libera nel tempo), oppure segnalalo per alzare il limite dell'account Groq.`,
        502
      );
    }
    throw new EstrazioneError(`Errore dal modello: ${msg}`, 502);
  }

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function?.name !== "save_report_commerciale") {
    throw new EstrazioneError("Estrazione fallita: il modello non ha restituito dati strutturati", 500);
  }

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
  } catch (parseErr) {
    throw new EstrazioneError(
      `Errore parsing JSON dal modello: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`,
      500
    );
  }

  const toStr = (v: unknown): string => (Array.isArray(v) ? v.filter(Boolean).join("\n") : typeof v === "string" ? v : "");

  return {
    dati: {
      titolo: typeof raw.title === "string" ? raw.title : "",
      data: typeof raw.date === "string" ? raw.date : "",
      partecipanti: toStrArray(raw.participants),
      rawUrl: url,
      ragioneSociale: typeof raw.ragioneSociale === "string" ? raw.ragioneSociale : "",
      nomeContatto: typeof raw.nomeContatto === "string" ? raw.nomeContatto : "",
      tipoBusiness: typeof raw.tipoBusiness === "string" ? raw.tipoBusiness : "",
      fatturato: typeof raw.fatturato === "string" ? raw.fatturato : "",
      sedi: typeof raw.sedi === "string" ? raw.sedi : "",
      quadroEmerso: toStr(raw.quadroEmerso),
      obiettivi: toStr(raw.obiettivi),
      strategiaProposta: toStr(raw.strategiaProposta),
      soluzioneProposta: toStr(raw.soluzioneProposta),
      prossimiPassi: toStr(raw.prossimiPassi),
    },
    troncamento,
  };
}
