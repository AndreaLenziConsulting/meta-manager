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
 * `isPaginaConErroreCaricamento`/`toStrArray`), solo prompt e schema del tool cambiano: qui non
 * si estrae un recap di meeting di delivery, ma le 9 sezioni di un report di vendita (dati del
 * prospect, criticità/pain/obiettivi, soluzione proposta, prossimi passi). La Simulazione ROI
 * NON è tra i campi estratti: è sempre una proiezione compilata a mano dal commerciale, vedi
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
        "title", "date", "participants", "ragioneSociale", "tipoBusiness", "fatturato", "sedi",
        "criticita", "tentateSoluzioni", "pain", "obiettivi", "soluzioneProposta",
        "livelloProblema", "livelloProdotto", "prossimiPassi",
      ],
      properties: {
        title: { type: "string", description: "Titolo della chiamata così come mostrato sulla piattaforma" },
        date: { type: "string", description: "Data della chiamata in formato DD/MM/YYYY" },
        // Stesso trucco di estrazione.ts: type [array, string] non solo array — Groq rifiuta con
        // tool_use_failed se il modello mette "" invece di [] per un campo vuoto (verificato lì,
        // vale identico qui). toStrArray/toStr a valle gestiscono già entrambe le forme.
        participants: { type: ["array", "string"], items: { type: "string" }, description: "Nomi dei partecipanti alla chiamata (commerciale ALC + persone del prospect)" },
        ragioneSociale: { type: "string", description: "Nome/ragione sociale dell'azienda prospect (MAI Andrea Lenzi Consulting)" },
        tipoBusiness: { type: "string", description: "Che tipo di business fa il prospect, in breve (es. 'agenzia immobiliare', 'ristorazione', 'e-commerce moda')" },
        fatturato: { type: "string", description: "Fatturato dichiarato o stimato dal prospect, come menzionato in chiamata (es. '~500k€/anno', 'non specificato'). Stringa vuota se mai discusso." },
        sedi: { type: "string", description: "Quante sedi/punti vendita ha il prospect e dove, se menzionato. Stringa vuota se non discusso." },
        criticita: {
          type: ["array", "string"],
          items: { type: "string" },
          description: "Le criticità del prospect emerse in chiamata — cosa non funziona oggi nel suo marketing/vendite. Una voce concreta per riga.",
        },
        tentateSoluzioni: {
          type: ["array", "string"],
          items: { type: "string" },
          description: "Cosa il prospect ha già provato per risolvere le sue criticità (altre agenzie, tool, tentativi interni) e perché non ha funzionato, se detto.",
        },
        pain: {
          type: ["array", "string"],
          items: { type: "string" },
          description: "Il PAIN reale del prospect — l'impatto concreto/emotivo delle criticità (es. 'perde clienti a favore della concorrenza', 'non riesce a scalare oltre un certo fatturato'), non solo la criticità tecnica in sé.",
        },
        obiettivi: {
          type: ["array", "string"],
          items: { type: "string" },
          description: "Cosa vuole ottenere il prospect (es. 'raddoppiare i lead in 6 mesi', 'aprire una seconda sede'). Con numeri/orizzonti temporali se menzionati.",
        },
        soluzioneProposta: {
          type: ["array", "string"],
          items: { type: "string" },
          description: "Cosa il commerciale ALC ha proposto in risposta a criticità/pain/obiettivi del prospect — l'offerta discussa in chiamata.",
        },
        livelloProblema: {
          type: "string",
          description: "Come il commerciale ha inquadrato/dovrebbe inquadrare il PROBLEMA del prospect nella comunicazione (il linguaggio del cliente: cosa lo tiene sveglio la notte), secondo il metodo di comunicazione di Andrea Lenzi Consulting (Livello Problema vs Livello Prodotto). Stringa vuota se non ricavabile dalla chiamata.",
        },
        livelloProdotto: {
          type: "string",
          description: "Come il commerciale ha inquadrato/dovrebbe inquadrare la SOLUZIONE/il prodotto ALC in risposta (il linguaggio tecnico/di prodotto), in contrasto col Livello Problema sopra. Stringa vuota se non ricavabile dalla chiamata.",
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

Nella chiamata parlano tipicamente due parti: il **commerciale** di Andrea Lenzi Consulting (chi conduce la vendita, presenta l'offerta) e il **prospect** (l'azienda potenziale cliente, che racconta la propria situazione). Devi ricostruire, in italiano:

1. **Dati del prospect**: ragione sociale, che tipo di business fa, fatturato (se menzionato, anche solo come stima), quante sedi/punti vendita ha.
2. **Criticità**: cosa non funziona oggi nel marketing/nelle vendite del prospect, dal suo punto di vista.
3. **Tentate soluzioni**: cosa ha già provato (altre agenzie, tool, tentativi interni) e perché non ha funzionato, se emerso.
4. **PAIN**: l'impatto reale/emotivo delle criticità — non la criticità tecnica in sé, ma cosa comporta per il prospect (perdita di clienti, stress, fatturato bloccato, ecc.).
5. **Obiettivi**: cosa vuole ottenere il prospect, con numeri/orizzonti temporali se menzionati.
6. **Soluzione proposta**: cosa il commerciale ha proposto in risposta.
7. **Comunicazione a due livelli** (metodo Andrea Lenzi Consulting): "Livello Problema" è come inquadrare la situazione nel linguaggio/vissuto del prospect (l'emozione, cosa lo preoccupa); "Livello Prodotto" è come si inquadra la soluzione/il prodotto ALC in risposta, in modo tecnico. Ricostruiscili dal tono e dal contenuto della chiamata, anche se non sono etichettati esplicitamente così nel testo.
8. **Prossimi passi**: cosa è stato concordato per il seguito (invio proposta, prossima call, ecc.).

Linee guida:
- Rispondi sempre in italiano, anche se la chiamata è in un'altra lingua.
- Se un'informazione non è presente, metti stringa vuota (campi string) o array vuoto (campi lista) — non inventare mai dati non supportati dal contenuto.
- Per i campi lista (criticità, tentate soluzioni, PAIN, obiettivi, soluzione proposta, prossimi passi) una voce concreta per riga, non un unico paragrafo generico.
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

  // Stesso budget caratteri/token di estrazione.ts — vincolo reale del piano Groq free (8K TPM),
  // non una precauzione. Vedi commento lì per la matematica completa.
  const charLimit = source === "loom" ? 11_000 : 10_000;
  const trimmed = visible.slice(0, charLimit);
  const troncamento: TroncamentoInfo | null =
    visible.length > charLimit ? { caratteriTotali: visible.length, caratteriElaborati: charLimit } : null;
  if (troncamento) {
    console.warn(
      `[estrazioneCommerciale] Testo troncato per ${sourceName} (${url}): elaborati ${troncamento.caratteriElaborati} di ${troncamento.caratteriTotali} caratteri.`
    );
  }
  const userContent = `URL: ${url}
Fonte: ${source}

--- TESTO RESO DAL BROWSER ---
${trimmed}
`;

  const client = new Groq({ apiKey });

  let completion: Awaited<ReturnType<typeof client.chat.completions.create>> | null = null;
  let ultimoErroreGroq: unknown = null;
  for (let tentativo = 1; tentativo <= 2; tentativo++) {
    try {
      completion = await client.chat.completions.create({
        model: "openai/gpt-oss-120b",
        max_tokens: 4096,
        temperature: 0.1,
        reasoning_effort: "low",
        messages: [
          { role: "system", content: SYSTEM_PROMPT_COMMERCIALE },
          { role: "user", content: userContent },
        ],
        tools: [EXTRACTION_TOOL_COMMERCIALE],
        tool_choice: { type: "function", function: { name: "save_report_commerciale" } },
      });
      break;
    } catch (err) {
      ultimoErroreGroq = err;
      const msg = err instanceof Error ? err.message : String(err);
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
      tipoBusiness: typeof raw.tipoBusiness === "string" ? raw.tipoBusiness : "",
      fatturato: typeof raw.fatturato === "string" ? raw.fatturato : "",
      sedi: typeof raw.sedi === "string" ? raw.sedi : "",
      criticita: toStr(raw.criticita),
      tentateSoluzioni: toStr(raw.tentateSoluzioni),
      pain: toStr(raw.pain),
      obiettivi: toStr(raw.obiettivi),
      soluzioneProposta: toStr(raw.soluzioneProposta),
      livelloProblema: typeof raw.livelloProblema === "string" ? raw.livelloProblema : "",
      livelloProdotto: typeof raw.livelloProdotto === "string" ? raw.livelloProdotto : "",
      prossimiPassi: toStr(raw.prossimiPassi),
    },
    troncamento,
  };
}
