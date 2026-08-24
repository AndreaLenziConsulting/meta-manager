import Groq from "groq-sdk";
import type { ActionItem, MeetingDataLoose } from "@/types/meeting";

/**
 * Estrazione dati meeting: scraping (Playwright/Chromium) di una pagina di condivisione
 * Fathom/Circleback/Loom + strutturazione via Groq (tool calling forzato).
 *
 * Porting da Fast Report (repo separato, che diventerà desueto) — logica invariata, incluso
 * il provider LLM (Groq): stesso schema tool, stesso `tool_choice` forzato e parsing di
 * `tool_calls[0].function.arguments` (stringa JSON, va fatto `JSON.parse` a mano — a differenza
 * di Claude, dove l'input arriva già come oggetto).
 *
 * Modello `openai/gpt-oss-120b` (non più `llama-3.3-70b-versatile`, deprecato da Groq il
 * 16/08/2026 — console.groq.com/docs/deprecations). Piano free più stretto di prima: 8K TPM
 * (non più 12K), 30 RPM, 200K TPD — quest'ultimo è un tetto reale di circa 25-40 estrazioni al
 * giorno con questo account, non solo un limite per singola chiamata.
 */

export class EstrazioneError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const CHROMIUM_PACK_URL_DEFAULT =
  "https://github.com/Sparticuz/chromium/releases/download/v147.0.0/chromium-v147.0.0-pack.x64.tar";

// ─── Individuazione fonte ────────────────────────────────────────────────────
export type MeetingSource = "fathom" | "circleback" | "loom" | "unknown";

export function detectSource(url: string): MeetingSource {
  if (/fathom\.video/i.test(url)) return "fathom";
  if (/circleback\.ai/i.test(url)) return "circleback";
  if (/loom\.com/i.test(url)) return "loom";
  return "unknown";
}

function sourceLabel(source: MeetingSource): string {
  if (source === "circleback") return "Circleback";
  if (source === "loom") return "Loom";
  return "Fathom";
}

// ─── Rilevamento pagina di login ─────────────────────────────────────────────
// True se il testo visibile della pagina sembra una schermata di login/autenticazione
// piuttosto che contenuto reale del meeting — per fallire presto con un messaggio chiaro
// prima di bruciare una chiamata al modello.
//
// Nota: le pagine di condivisione pubbliche Circleback includono un banner marketing
// ("Try Circleback for free — Log in or create an account"), quindi le sole parole chiave di
// auth non bastano. Serve SIA l'assenza di segnali di contenuto SIA una pagina piccola.
export function isAuthWall(text: string): boolean {
  const t = text.toLowerCase();
  const length = t.length;

  const meetingSignals = [
    "action items", "summary", "overview", "panoramica", "transcript", "trascrizione",
    "notes", "appunti", "key points", "next steps", "follow-up", "follow up", "agenda",
    "participants", "partecipanti", "attendees", "topics discussed", "argomenti trattati",
    "punti chiave", "decisions", "decisioni",
  ];
  const meetingHits = meetingSignals.filter((s) => t.includes(s)).length;

  if (meetingHits >= 2) return false;
  if (length > 2000 && meetingHits >= 1) return false;

  const strictAuthSignals = [
    "you need to sign in", "devi accedere per", "private meeting", "meeting privato",
    "not authorized", "access denied", "accesso negato", "sign in to view",
    "accedi per vedere", "sign in to continue", "accedi per continuare",
  ];
  const strictHits = strictAuthSignals.filter((s) => t.includes(s)).length;

  const softAuthSignals = [
    "sign in", "log in", "accedi", "continue with google", "continue with email",
    "create an account", "crea un account",
  ];
  const softHits = softAuthSignals.filter((s) => t.includes(s)).length;

  if (strictHits >= 1 && length < 1500) return true;
  if (length < 500 && softHits >= 1) return true;

  return false;
}

// ─── Tool di estrazione (schema OpenAI/Groq function-calling, condiviso tra le fonti) ────
const EXTRACTION_TOOL = {
  type: "function" as const,
  function: {
    name: "save_meeting_data",
    description: "Salva i dati strutturati del meeting di consulenza estratti da una pagina di condivisione.",
    parameters: {
      type: "object" as const,
      required: [
        "title", "date", "participants", "summary", "highlights", "actionItems",
        "cliente", "referente", "dataConsulenza", "taskSettimana", "taskMese",
        "programmaTrimestre", "sentiment", "kpiReali", "kpiStorico",
        "kpiTargetMarketing", "kpiTargetCommerciali",
      ],
      properties: {
        title: { type: "string", description: "Titolo del meeting così come mostrato sulla piattaforma" },
        date: { type: "string", description: "Data del meeting in formato DD/MM/YYYY" },
        duration: { type: "string", description: "Durata del meeting, es. '45 min'. Stringa vuota se non disponibile." },
        // NOTA su tutti i campi "array" qui sotto: type è [array, string] (non solo array).
        // Motivo, verificato empiricamente: Groq valida rigidamente lo schema PRIMA di restituire
        // la risposta e la rifiuta con tool_use_failed se il modello mette "" invece di [] quando
        // non c'è dato (es. "kpiReali": "" invece di "kpiReali": []) — riprodotto in modo
        // deterministico (5/5), non un caso raro. Il codice a valle (toStr/toActionItems e i
        // fallback Array.isArray(...) ? ... : []) gestisce già entrambe le forme, quindi
        // allargare lo schema qui è sicuro e risolve il rifiuto alla fonte senza perdere dati.
        participants: { type: ["array", "string"], items: { type: "string" }, description: "Elenco dei nomi dei partecipanti" },
        summary: { type: "string", description: "Riepilogo generale di 2-4 frasi del meeting, in italiano" },
        highlights: { type: ["array", "string"], items: { type: "string" }, description: "3-6 punti chiave concreti, in italiano, una frase ciascuno" },
        actionItems: {
          type: ["array", "string"],
          items: { type: "string" },
          description:
            "TUTTI gli action item concreti assegnati a una persona specifica (tipicamente 5-15). Array di stringhe, formato '<Assegnatario>: <azione>' — l'assegnatario è SEMPRE noto qui, es. 'Marco Rebuzzi: caricare materiali'. Fonte: sezione 'Action Items'/'Next Steps' se presente, altrimenti 'Task della settimana' (quasi sempre organizzata per persona, es. 'Marco: ...'). NON includere qui 'Task del mese' o 'Programma del trimestre': sono obiettivi generali/strategici, non task assegnati a una persona — vanno SOLO nei campi taskMese/programmaTrimestre, mai duplicati qui.",
        },
        cliente: { type: "string", description: "Nome dell'azienda cliente (il cliente della consulenza, MAI Andrea Lenzi Consulting)" },
        referente: {
          type: "string",
          description:
            "Nome completo del consulente di Andrea Lenzi Consulting che ha condotto il meeting. Identificalo dal contesto: è chi assegna a sé stesso task di delivery, guida la riunione o è esplicitamente indicato come PM/responsabile. NON usare mai 'Andrea Lenzi' di default se non chiaramente indicato — potrebbe essere chiunque nel team ALC.",
        },
        dataConsulenza: { type: "string", description: "Data della consulenza in formato DD/MM/YYYY" },
        taskSettimana: { type: ["array", "string"], items: { type: "string" }, description: "Task della settimana. Una stringa per task, formato '<Nome>: <task>'. In italiano." },
        taskMese: { type: ["array", "string"], items: { type: "string" }, description: "Obiettivi del mese. Una stringa per obiettivo. In italiano. Array vuoto se non discusso." },
        programmaTrimestre: { type: ["array", "string"], items: { type: "string" }, description: "Programma del trimestre / direzione strategica. Una stringa per punto. In italiano. Array vuoto se non discusso." },
        sentiment: { type: "string", description: "Sentiment generale del cliente con una breve giustificazione. In italiano." },
        kpiReali: { type: ["array", "string"], items: { type: "string" }, description: "KPI reali / numeri di performance attuali. Array di stringhe. In italiano." },
        kpiStorico: { type: ["array", "string"], items: { type: "string" }, description: "KPI storici per confronto. Array di stringhe. In italiano." },
        kpiTargetMarketing: { type: ["array", "string"], items: { type: "string" }, description: "KPI target marketing. Array di stringhe. In italiano." },
        kpiTargetCommerciali: { type: ["array", "string"], items: { type: "string" }, description: "KPI target commerciali. Array di stringhe. In italiano." },
      },
    },
  },
};

const SYSTEM_PROMPT_FATHOM = `Sei un assistente che estrae dati strutturati da meeting di consulenza marketing registrati su Fathom per "Andrea Lenzi Consulting".

Riceverai il contenuto testuale reso dal browser della pagina di condivisione Fathom (titolo, summary generato da Fathom, action items, e potenzialmente la trascrizione). Devi identificare:
- Il **cliente** (l'azienda che riceve la consulenza, NON Andrea Lenzi Consulting)
- Il **referente**: il consulente di Andrea Lenzi Consulting che conduce il meeting. Identificalo dai segnali nel testo: è chi si occupa di marketing/funnel/ads/landing/automazioni/setup tecnico per il cliente, chi guida la riunione e assegna a sé stesso task di delivery (es. "Marco: preparo il funnel"). Il cliente, al contrario, è chi riceve la consulenza e tipicamente parla del proprio business/azienda. Esempi di consulenti del team ALC che potresti incontrare: Andrea Lenzi, Francesco Crosa, Marco Rebuzzi, Eliano. NON mettere mai il cliente come referente.
- Task operative della settimana (con responsabile quando possibile)
- Obiettivi del mese
- Programma del trimestre / direzione strategica
- Sentiment del cliente (positivo/neutro/negativo + breve giustificazione)
- KPI reali attuali
- KPI storici (per confronto)
- KPI target marketing
- KPI target commerciali

Linee guida:
- Rispondi sempre in italiano.
- Se un'informazione non è presente, metti stringa vuota (per i campi string) o array vuoto.
- Non inventare dati. Estrai solo ciò che è supportato dal contenuto.
- Per taskSettimana/Mese/etc. usa una task per riga, formato "<Nome>: <azione>" quando possibile.
- La data in DD/MM/YYYY.
- Chiama SEMPRE il tool "save_meeting_data" con i dati estratti.

CRITICO — Esaustività (leggi TUTTO il testo prima di rispondere):
- **actionItems**: estrai OGNI task ASSEGNATA A UNA PERSONA. Cerca "Action Items", "Next Steps", "TODO", e righe con format "<Nome>: <azione>" — tipicamente questo vuol dire la sezione "Task della settimana" (quasi sempre organizzata per persona). NON includere qui "Task del mese" o "Programma del trimestre": sono obiettivi generali, non assegnati a una persona specifica — vanno SOLO in taskMese/programmaTrimestre. Includi anche i mini-task amministrativi (es. "inviare invito calendar", "caricare file su Drive", "creare cartella"). NON raggruppare task multiple in una sola voce.
- **highlights**: 4-7 punti CONCRETI con numeri/date/decisioni specifiche (es. "Lancio campagne ADV il 4 maggio", "CPL target tra 2,50€ e 9,00€", "Obiettivo 5 vendite/mese entro 60 giorni"). MAI titoli di sezione generici tipo "Definizione delle attività".
- **summary**: 3-5 frasi di sostanza con cosa è stato deciso, non descrizioni meta.

CRITICO — Anti-pattern da evitare ASSOLUTAMENTE:
1. NON restituire mai in actionItems il semplice elenco dei nomi dei partecipanti — non è mai un
   action item valido, è un errore grave. Fathom spesso NON ha una sezione "Action Items"
   esplicita: se non la trovi, DEVI costruire actionItems trasformando OGNI riga di "Task della
   settimana" in un action item nello stesso formato "<Nome>: <azione>". Esempio: se il testo
   contiene "Task della settimana: Marco: preparare il funnel ADV, Giulia: rivedere la landing
   page", allora actionItems deve contenere ESATTAMENTE ["Marco: preparare il funnel ADV",
   "Giulia: rivedere la landing page"] — mai lasciarlo vuoto, mai limitarlo ai soli nomi.
2. NON mettere in actionItems le voci di "Task del mese" o "Programma del trimestre" — sono
   obiettivi generali senza una persona assegnata (es. "Mantenere attive le campagne ad agosto"),
   diversi dalle task individuali di "Task della settimana". Metterle in actionItems produce righe
   senza assegnatario che sembrano dati mancanti: vanno SOLO nei rispettivi campi taskMese/
   programmaTrimestre, mai duplicate in actionItems.`;

const SYSTEM_PROMPT_CIRCLEBACK = `Sei un assistente che estrae dati strutturati da meeting di consulenza marketing registrati su Circleback per "Andrea Lenzi Consulting".

Riceverai il contenuto testuale reso dal browser della pagina di condivisione Circleback. La pagina Circleback mostra tipicamente: titolo del meeting, data/ora, partecipanti, un summary generato dall'AI, action items con responsabile, key topics/highlights, e la trascrizione. Devi identificare:
- Il **cliente** (l'azienda che riceve la consulenza, NON Andrea Lenzi Consulting)
- Il **referente**: il consulente di Andrea Lenzi Consulting che conduce il meeting. Identificalo dai segnali nel testo: è chi si occupa di marketing/funnel/ads/landing/automazioni/setup tecnico per il cliente, chi guida la riunione e assegna a sé stesso task di delivery (es. "Marco: preparo il funnel"). Il cliente, al contrario, è chi riceve la consulenza e tipicamente parla del proprio business/azienda. Esempi di consulenti del team ALC che potresti incontrare: Andrea Lenzi, Francesco Crosa, Marco Rebuzzi, Eliano. NON mettere mai il cliente come referente.
- Task operative della settimana (con responsabile quando possibile)
- Obiettivi del mese
- Programma del trimestre / direzione strategica
- Sentiment del cliente (positivo/neutro/negativo + breve giustificazione)
- KPI reali attuali
- KPI storici (per confronto)
- KPI target marketing
- KPI target commerciali

Linee guida per Circleback:
- La sezione "Action Items" di Circleback contiene già gli action items strutturati — usala come fonte primaria per taskSettimana.
- La sezione "Summary" o "Meeting Summary" contiene il riassunto generale — usala per il campo summary.
- La sezione "Key Topics" o "Highlights" mappa bene sul campo highlights.
- Se Circleback mostra una sezione "Next Steps", includila in taskSettimana/taskMese.
- Rispondi sempre in italiano.
- Se un'informazione non è presente, metti stringa vuota (per i campi string) o array vuoto.
- Non inventare dati. Estrai solo ciò che è supportato dal contenuto.
- Per taskSettimana/Mese/etc. usa una task per riga, formato "<Nome>: <azione>" quando possibile.
- La data in DD/MM/YYYY.
- Chiama SEMPRE il tool "save_meeting_data" con i dati estratti.

CRITICO — Esaustività (leggi TUTTO il testo prima di rispondere):
- **actionItems**: estrai OGNI task ASSEGNATA A UNA PERSONA. Cerca "Action Items", "Next Steps", "TODO", e righe con format "<Nome>: <azione>" — tipicamente questo vuol dire la sezione "Task della settimana". NON includere qui "Task del mese" o "Programma del trimestre": sono obiettivi generali, non assegnati a una persona specifica — vanno SOLO in taskMese/programmaTrimestre. Includi anche i mini-task amministrativi (es. "inviare invito calendar", "caricare file su Drive", "creare cartella"). NON raggruppare task multiple in una sola voce.
- **highlights**: 4-7 punti CONCRETI con numeri/date/decisioni specifiche (es. "Lancio campagne ADV il 4 maggio", "CPL target tra 2,50€ e 9,00€", "Obiettivo 5 vendite/mese entro 60 giorni"). MAI titoli di sezione generici tipo "Definizione delle attività".
- **summary**: 3-5 frasi di sostanza con cosa è stato deciso, non descrizioni meta.`;

const SYSTEM_PROMPT_LOOM = `Sei un assistente che estrae dati strutturati da video meeting registrati su Loom per "Andrea Lenzi Consulting".

Riceverai il contenuto testuale reso dal browser della pagina di condivisione Loom. Una pagina Loom condivisa mostra tipicamente: titolo del video, data, durata, nome del creator (chi ha registrato), un summary AI-generato (se Loom AI è attivo), capitoli/chapters con timestamp, action items (se Loom AI è attivo), e la trascrizione completa. Devi identificare:
- Il **cliente** (l'azienda o persona che riceve la consulenza/per cui il video è destinato, NON Andrea Lenzi Consulting). Spesso il cliente non è esplicitamente nominato sulla pagina Loom: deducilo dal contesto (es. nome di un brand citato nel titolo o nei capitoli, "per Maffeis", "loom per cliente X").
- Il **referente**: il consulente di Andrea Lenzi Consulting che conduce il meeting. Identificalo dai segnali nel testo: è chi si occupa di marketing/funnel/ads/landing/automazioni/setup tecnico per il cliente, chi guida la riunione e assegna a sé stesso task di delivery (es. "Marco: preparo il funnel"). Il cliente, al contrario, è chi riceve la consulenza e tipicamente parla del proprio business/azienda. Esempi di consulenti del team ALC che potresti incontrare: Andrea Lenzi, Francesco Crosa, Marco Rebuzzi, Eliano. NON mettere mai il cliente come referente. Per Loom: il referente è quasi sempre il creator del video (chi ha registrato).
- Task operative della settimana (con responsabile quando possibile)
- Obiettivi del mese
- Programma del trimestre / direzione strategica
- Sentiment del cliente (positivo/neutro/negativo + breve giustificazione)
- KPI reali attuali
- KPI storici (per confronto)
- KPI target marketing
- KPI target commerciali

Struttura input Loom:
Il testo che ricevi è strutturato in sezioni marcate da "=== HEADER ===", "=== TRANSCRIPT ===", "=== SUMMARY ===", "=== ACTION ITEMS ===", "=== CHAPTERS ===". Ognuna può essere presente o assente.

Linee guida — fonte primaria per Loom è la TRASCRIZIONE:
- **TRANSCRIPT** è la fonte AUTORITARIA e più completa. Il Summary AI di Loom è spesso povero o assente. Devi ESTRARRE tutto il valore analizzando la trascrizione completa: chi parla, di cosa, decisioni prese, task assegnate (esplicitamente "farò X", "puoi mandarmi Y", "prossima settimana Z"), numeri/date menzionati, punti chiave discussi.
- SUMMARY (se presente): usalo come contesto aggiuntivo, ma NON limitarti a ricopiarlo — arricchisci sempre con dettagli estratti dalla trascrizione.
- ACTION ITEMS di Loom AI (se presenti): includili + AGGIUNGI quelli che trovi nella trascrizione ma che Loom AI ha perso.
- CHAPTERS di Loom AI (se presenti): usali come guida per gli highlights, ma sostituisci titoli generici con punti concreti dalla trascrizione.
- HEADER: titolo del video, creator, data — mappa su title/referente/dataConsulenza.

Deduzione cliente/referente da Loom:
- Il **referente** è quasi sempre il creator del video (chi ha registrato). Su un walkthrough Loom parla praticamente solo il consulente.
- Il **cliente** spesso è nel titolo (es. "Report settimanale Moby") o menzionato nella trascrizione ("per Moby ho fatto X"). Se non menzionato esplicitamente, deducilo dal contesto business/brand citato.

Estrazione durata Loom:
- La **durata** compare nella barra del player del video, formato "MM:SS" o "H:MM:SS", dopo lo slash "/". Esempio: "0:10 / 37:31" significa durata totale = 37 minuti 31 secondi → scrivi "37 min".
- Se vedi "1h 12m", "2 hours", "42 mins" → normalizza in "1h 12min" / "2h" / "42 min".
- L'ultimo timestamp visibile nei "Chapters" (es. "34:52") NON è la durata totale del video — è solo l'ultimo capitolo. La durata totale è nel player.

Note operative:
- Rispondi sempre in italiano.
- Se un'informazione non è presente, metti stringa vuota o array vuoto.
- Non inventare dati. Estrai solo ciò che è supportato dal contenuto.
- Per taskSettimana/Mese/etc. usa una task per riga, formato "<Nome>: <azione>" quando possibile.
- La data in DD/MM/YYYY.
- Chiama SEMPRE il tool "save_meeting_data" con i dati estratti.

CRITICO — Esaustività (analizza TUTTA la trascrizione, non solo i primi minuti):
- **actionItems**: enumera OGNI task/impegno/prossimo passo menzionato lungo TUTTA la trascrizione. Un video di 30-60 min ha tipicamente 5-15 action items, un video di 2h+ ne ha 15-30. Cerca frasi come "farò", "manderò", "controllerò", "prossima settimana", "poi vediamo", "ti aggiorno su", "devi", "puoi". Includi anche task minori (inviare file, prenotare call, aggiornare CRM). NON riassumere, enumera.
- **highlights**: 5-8 punti CONCRETI con numeri/date/decisioni specifiche presi dall'intero video. MAI titoli di sezione generici.
- **summary**: 4-6 frasi di sostanza che coprono l'INTERO video, non solo l'inizio. Menziona i temi discussi con concretezza.
- **taskSettimana / taskMese**: se nella trascrizione emergono impegni con orizzonte temporale ("questa settimana", "entro fine mese"), popolali. Altrimenti lascia vuoti — non inventare orizzonti.`;

function getSystemPrompt(source: MeetingSource): string {
  if (source === "circleback") return SYSTEM_PROMPT_CIRCLEBACK;
  if (source === "loom") return SYSTEM_PROMPT_LOOM;
  return SYSTEM_PROMPT_FATHOM; // fathom + unknown fallback
}

// ─── Scraping della pagina (Playwright, invariato da Fast Report — provider-agnostico) ──
// Esportata (oltre che usata qui sotto) perché src/lib/estrazioneCommerciale.ts la riusa as-is:
// stessa meccanica di scraping, dominio di estrazione diverso — nessun'altra riga di questo file
// tocca il dominio commerciale.
export async function renderPage(url: string): Promise<{ text: string; html: string }> {
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

  const playwright = (await import("playwright-core")).default;

  let executablePath: string;
  let launchArgs: string[] = [];

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium-min")).default;
    const tarball = process.env.CHROMIUM_PACK_URL || CHROMIUM_PACK_URL_DEFAULT;
    executablePath = await chromium.executablePath(tarball);
    launchArgs = chromium.args;
  } else {
    executablePath = process.env.CHROME_EXECUTABLE_PATH || "";
    if (!executablePath) {
      throw new EstrazioneError(
        "CHROME_EXECUTABLE_PATH non configurato per lo sviluppo locale",
        500
      );
    }
  }

  const memSavingArgs = isServerless
    ? [
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--disable-audio-output",
      ]
    : [];

  const browser = await playwright.chromium.launch({
    executablePath,
    args: [...launchArgs, ...memSavingArgs],
    headless: true,
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      viewport: isServerless ? { width: 800, height: 600 } : { width: 1280, height: 900 },
      locale: "it-IT",
    });
    const page = await context.newPage();

    if (isServerless) {
      await page.route("**/*", (route) => {
        const t = route.request().resourceType();
        if (t === "image" || t === "media" || t === "font") return route.abort();
        return route.continue();
      });
    }

    const isCircleback = /circleback\.ai/i.test(url);
    const isLoom = /loom\.com/i.test(url);

    let targetUrl = url;
    if (isCircleback) {
      try {
        const u = new URL(url);
        u.searchParams.delete("tab");
        targetUrl = u.toString();
      } catch {
        // URL malformato ma già validato a monte con il regex http(s) — ignora e usa l'originale
      }
    }

    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
    try {
      await page.waitForLoadState("networkidle", { timeout: 8_000 });
    } catch {
      // ignora — alcune SPA tengono aperte connessioni long-poll
    }
    const isHeavy = isCircleback || isLoom;
    await page.waitForTimeout(isHeavy ? 2500 : 1000);

    if (isCircleback) {
      await page.evaluate(() => {
        const candidates = Array.from(document.querySelectorAll("button, a, [role='tab']"));
        for (const el of candidates) {
          const t = (el.textContent || "").trim().toLowerCase();
          if (t === "notes" || t === "appunti" || t === "summary" || t === "sommario") {
            try {
              (el as HTMLElement).click();
              return;
            } catch {
              // elemento non cliccabile, prova il prossimo candidato
            }
          }
        }
      });
      await page.waitForTimeout(2000);
    }

    await page.evaluate(() => {
      const triggers = Array.from(document.querySelectorAll("button, a"));
      for (const el of triggers) {
        const t = (el.textContent || "").toLowerCase();
        if (
          /show more|mostra (di )?più|view all|vedi tutto|leggi tutto|espandi|read more|view as guest|continua come ospite|skip|salta/.test(
            t
          )
        ) {
          try {
            (el as HTMLElement).click();
          } catch {
            // elemento non cliccabile, prosegui
          }
        }
      }
    });
    await page.waitForTimeout(isHeavy ? 1500 : 500);

    if (isLoom) {
      const tabOrder = [
        { label: "TRANSCRIPT", patterns: ["transcript", "trascrizione"] },
        { label: "SUMMARY", patterns: ["summary", "riassunto", "riepilogo"] },
        { label: "ACTION ITEMS", patterns: ["action items", "next steps", "highlights"] },
        { label: "CHAPTERS", patterns: ["chapters", "capitoli"] },
      ];
      const parts: string[] = [];

      const header = await page.evaluate(() => {
        const h1 = document.querySelector("h1")?.textContent?.trim() || "";
        const meta = Array.from(document.querySelectorAll("header, [class*='header'], [class*='meta']"))
          .map((el) => (el as HTMLElement).innerText?.trim() || "")
          .filter(Boolean)
          .slice(0, 3)
          .join("\n");
        return `${h1}\n${meta}`.trim();
      });
      if (header) parts.push(`=== HEADER ===\n${header}`);

      const baselineText = await page.evaluate(() => document.body?.innerText || "");

      for (const tab of tabOrder) {
        const clicked = await page.evaluate((patterns: string[]) => {
          const candidates = Array.from(document.querySelectorAll("button, a, [role='tab']"));
          for (const el of candidates) {
            const t = (el.textContent || "").trim().toLowerCase();
            if (patterns.some((p) => t.includes(p))) {
              try {
                (el as HTMLElement).click();
                return true;
              } catch {
                // elemento non cliccabile, prova il prossimo
              }
            }
          }
          return false;
        }, tab.patterns);

        if (!clicked) continue;
        await page.waitForTimeout(800);

        await page.evaluate(() => {
          const triggers = Array.from(document.querySelectorAll("button, a"));
          for (const el of triggers) {
            const t = (el.textContent || "").toLowerCase();
            if (/show more|mostra (di )?più|read more|leggi tutto|espandi/.test(t)) {
              try {
                (el as HTMLElement).click();
              } catch {
                // elemento non cliccabile, prosegui
              }
            }
          }
        });
        await page.waitForTimeout(400);

        const tabText = await page.evaluate(() => document.body?.innerText || "");
        if (tabText && tabText.length > 100) {
          parts.push(`=== ${tab.label} ===\n${tabText.trim()}`);
        }
      }

      const navPrefixRe = /^(Loom\s*\n(?:.*\n){0,10}?Get Loom free\s*\n)/;
      let cleaned = baselineText.replace(navPrefixRe, "");

      const cookieIdx = cleaned.indexOf("utilizzo dei cookie");
      if (cookieIdx > 500) cleaned = cleaned.slice(0, cookieIdx);
      const cookieIdxEn = cleaned.indexOf("use of cookies");
      if (cookieIdxEn > 500) cleaned = cleaned.slice(0, cookieIdxEn);

      const tabsCombined = parts.join("\n\n---\n\n");
      const combined =
        tabsCombined.length > 200
          ? `${tabsCombined}\n\n---\n\n=== FULL PAGE ===\n${cleaned}`
          : `=== FULL PAGE ===\n${cleaned}`;

      const html = await page.content();
      return { text: combined, html };
    }

    const text = await page.evaluate(() => document.body?.innerText || "");
    const html = await page.content();
    return { text, html };
  } finally {
    await browser.close().catch(() => {});
  }
}

// ─── Coercion (invariata da Fast Report, salvo toStrArray/toActionItems — vedi nota schema sopra) ──
function toStr(v: unknown): string {
  return Array.isArray(v) ? v.filter(Boolean).join("\n") : typeof v === "string" ? v : "";
}

// Per participants/highlights: lo schema ora accetta anche una stringa al posto dell'array (vedi
// EXTRACTION_TOOL). Se capita, la spezziamo su virgole/a-capo invece di scartarla silenziosamente.
export function toStrArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string" && x.trim() !== "");
  if (typeof v === "string") {
    return v
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function toActionItems(v: unknown): ActionItem[] {
  const items = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [];
  return items
    .map((item) => {
      if (typeof item === "string") {
        const m = item.trim().match(/^([^:\-—]+)\s*[:\-—]\s*(.+)$/);
        if (m) return { text: m[2].trim(), assignee: m[1].trim() };
        return { text: item.trim() };
      }
      if (item && typeof item === "object") {
        const o = item as { text?: unknown; assignee?: unknown };
        return {
          text: typeof o.text === "string" ? o.text : "",
          assignee: typeof o.assignee === "string" && o.assignee ? o.assignee : undefined,
        };
      }
      return { text: "" };
    })
    .filter((x) => x.text);
}

// ─── Rilevamento pagina con errore di caricamento transitorio (non un auth wall: la pagina esiste
// ed è pubblica, ma il provider ha mostrato un proprio errore invece del contenuto — osservato su
// Fathom in produzione, quasi sempre risolto da un secondo tentativo di navigazione).
export function isPaginaConErroreCaricamento(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (t.length < 400) return true;
  const segnaliErrore = [
    "errore di rete", "network error", "something went wrong", "an error occurred",
    "please try again", "please refresh", "riprova più tardi", "impossibile caricare",
  ];
  return segnaliErrore.some((s) => t.includes(s));
}

// ─── Fallback anti-pattern Fathom: la pagina spesso non ha una sezione "Action Items" esplicita
// e il modello (Groq, più debole di Claude su questo) a volte restituisce solo i nomi dei
// partecipanti invece di ripescare i task da "Task della settimana" come richiesto dal prompt.
// Queste due funzioni pure sono il fallback lato codice — vedi wiring in estraiMeetingData, solo
// per source === "fathom". SOLO taskSettimana, MAI taskMese/programmaTrimestre: quelle sezioni
// sono obiettivi generali senza una persona assegnata, non task individuali — mischiarle in
// actionItems produce righe senza assegnatario che sembrano dati mancanti (bug segnalato
// dall'utente, corretto qui e nello stesso senso nei prompt/schema sopra).
export function isActionItemsSuspicious(items: ActionItem[], participants: string[]): boolean {
  if (items.length === 0) return true;

  // Un vero action item ha quasi sempre più di una parola (verbo + oggetto, es. "Ricontattare il
  // lead"). Se OGNI voce è una sola parola, è quasi certamente solo un nome (es. "Mirko") — non
  // conta se combacia esattamente con l'elenco participants: il modello a volte usa il nome
  // corto in actionItems ma quello completo in participants ("Mirko" vs "Mirko Danelon"), caso
  // che il solo confronto esatto sotto non intercetta (bug osservato: falso negativo, il
  // fallback non scattava). Controllo indipendente dal confronto coi nomi, quindi robusto anche
  // a questo scarto.
  const soloUnaParola = (s: string) => !/\s/.test(s.trim());
  if (items.every((item) => soloUnaParola(item.text))) return true;

  if (participants.length === 0) return false;
  const norm = (s: string) => s.trim().toLowerCase();
  const nomi = new Set(participants.map(norm));
  return items.every((item) => nomi.has(norm(item.text)));
}

export function actionItemsFromTaskLines(taskSettimana: string): ActionItem[] {
  const righe = taskSettimana
    .split("\n")
    .map((r) => r.trim())
    .filter(Boolean);
  return toActionItems(righe);
}

// ─── Orchestrazione ───────────────────────────────────────────────────────────

/**
 * Estrae i dati strutturati di un meeting da un link di condivisione pubblico
 * (Fathom/Circleback/Loom). Lancia `EstrazioneError` con lo status HTTP appropriato
 * su ogni fallimento gestito (pagina protetta, contenuto vuoto, modello che rifiuta).
 */
export async function estraiMeetingData(url: string): Promise<MeetingDataLoose> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new EstrazioneError("GROQ_API_KEY non configurata", 500);
  }

  const source = detectSource(url);
  const sourceName = sourceLabel(source);

  // Scraping con retry: in produzione (serverless) è stato osservato Fathom mostrare
  // occasionalmente un proprio errore di rete transitorio invece del contenuto reale (pagina
  // caricata ma con un banner tipo "Errore di rete durante il caricamento del contenuto della
  // riunione" al posto del meeting) — non riproducibile in locale, quindi non un problema del
  // link. Un secondo tentativo di navigazione quasi sempre risolve. isPaginaConErroreCaricamento
  // è pura/testabile; il retry vero e proprio (I/O) resta qui, non testato in Vitest.
  let pageContent: { text: string; html: string } | null = null;
  let ultimoErrore: unknown = null;
  for (let tentativo = 1; tentativo <= 2; tentativo++) {
    try {
      const risultato = await renderPage(url);
      if (!isPaginaConErroreCaricamento(risultato.text)) {
        pageContent = risultato;
        break;
      }
      ultimoErrore = null; // contenuto "vuoto/errore", non un'eccezione — riprova comunque
    } catch (err) {
      ultimoErrore = err;
      if (err instanceof EstrazioneError) break; // errori espliciti (es. CHROME_EXECUTABLE_PATH mancante) non vanno ritentati
    }
  }

  if (!pageContent) {
    if (ultimoErrore instanceof EstrazioneError) throw ultimoErrore;
    if (ultimoErrore) {
      const msg = ultimoErrore instanceof Error ? ultimoErrore.message : String(ultimoErrore);
      throw new EstrazioneError(`Impossibile aprire la pagina ${sourceName}: ${msg}`, 502);
    }
    throw new EstrazioneError(
      `La pagina ${sourceName} ha restituito un errore di caricamento anche dopo un secondo tentativo — riprova tra qualche secondo.`,
      502
    );
  }

  const visible = pageContent.text.trim();

  // Nessun controllo di lunghezza minima qui: isPaginaConErroreCaricamento sopra già garantisce
  // che pageContent, se accettato dal retry, abbia almeno 400 caratteri.
  if (isAuthWall(visible)) {
    throw new EstrazioneError(
      source === "circleback"
        ? "Il link Circleback richiede l'accesso. Verifica nelle impostazioni del meeting Circleback che la condivisione sia impostata come pubblica (link accessibile senza login)."
        : `La pagina ${sourceName} richiede l'accesso. Serve un link di condivisione pubblico.`,
      403
    );
  }

  // Budget tarato sul rate limit reale di Groq (openai/gpt-oss-120b, piano free: 8K TPM
  // input+output — più stretto dei 12K del vecchio llama-3.3-70b-versatile). Non è una
  // precauzione — è un vincolo hard: system prompt (~1000 token) + schema tool (~1000 token) +
  // max_tokens completion (2048) lasciano ~4000 token per il contenuto utente, ~3.3
  // caratteri/token in italiano → margine di sicurezza tenuto sotto questa soglia. Non alzare
  // senza verificare il piano/rate limit attuale dell'account Groq.
  const charLimit = source === "loom" ? 11_000 : 10_000;
  const trimmed = visible.slice(0, charLimit);
  const userContent = `URL: ${url}
Fonte: ${source}

--- TESTO RESO DAL BROWSER ---
${trimmed}
`;

  const client = new Groq({ apiKey });

  // Retry anche qui: osservato empiricamente che Groq a volte risponde tool_use_failed anche
  // su contenuto scrapato buono (verificato: la stessa identica chiamata, ripetuta subito dopo
  // con lo stesso testo, può riuscire) — non è un problema del link/contenuto, è flakiness del
  // provider sul function-calling forzato. Un secondo tentativo quasi sempre risolve.
  let completion: Awaited<ReturnType<typeof client.chat.completions.create>> | null = null;
  let ultimoErroreGroq: unknown = null;
  for (let tentativo = 1; tentativo <= 2; tentativo++) {
    try {
      completion = await client.chat.completions.create({
        model: "openai/gpt-oss-120b",
        max_tokens: 4096,
        temperature: 0.1,
        // openai/gpt-oss-120b è un "reasoning model": senza questo, spende migliaia di
        // completion_tokens in ragionamento interno invisibile prima di rispondere (misurato:
        // 2422 reasoning_tokens su un totale di 4064 completion_tokens per una singola
        // estrazione) — rischia da solo di sforare l'8K TPM del piano free. Il task è
        // estrazione/riformattazione di testo già presente, non richiede ragionamento profondo:
        // con "low" i reasoning_tokens scendono a ~13 senza perdita di qualità osservabile
        // (stessa estrazione, stesso numero di action item, stessa qualità dei campi).
        reasoning_effort: "low",
        messages: [
          { role: "system", content: getSystemPrompt(source) },
          { role: "user", content: userContent },
        ],
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "function", function: { name: "save_meeting_data" } },
      });
      break;
    } catch (err) {
      ultimoErroreGroq = err;
      const msg = err instanceof Error ? err.message : String(err);
      // Un errore diverso da tool_use_failed (es. rate limit, chiave non valida) non va ritentato
      if (!/tool_use_failed/i.test(msg)) break;
    }
  }

  if (!completion) {
    const msg = ultimoErroreGroq instanceof Error ? ultimoErroreGroq.message : String(ultimoErroreGroq);
    // Groq risponde con tool_use_failed quando il modello rifiuta di chiamare il tool —
    // tipicamente perché non ha trovato contenuto utilizzabile (login wall, pagina vuota, ecc.)
    if (/tool_use_failed/i.test(msg)) {
      throw new EstrazioneError(
        source === "circleback"
          ? "Impossibile estrarre il contenuto dal link Circleback. La pagina potrebbe richiedere l'accesso o non contenere ancora il summary del meeting. Verifica che il link sia pubblico e che il meeting sia stato elaborato da Circleback."
          : `Impossibile estrarre il contenuto dal link ${sourceName} anche dopo un secondo tentativo. Verifica che il link sia un link di condivisione pubblico e che il meeting sia stato elaborato, oppure riprova tra qualche secondo.`,
        422
      );
    }
    throw new EstrazioneError(`Errore dal modello: ${msg}`, 502);
  }

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0];
  if (!toolCall || toolCall.function?.name !== "save_meeting_data") {
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

  let duration = typeof raw.duration === "string" ? raw.duration : "";
  if (!duration && source === "loom") {
    const m = visible.match(/\d+:\d{2}(?::\d{2})?\s*\/\s*(\d+(?::\d{2}){1,2})/);
    if (m) {
      const parts = m[1].split(":").map(Number);
      if (parts.length === 2) {
        const mins = parts[0] + (parts[1] >= 30 ? 1 : 0);
        duration = `${mins} min`;
      } else if (parts.length === 3) {
        duration = `${parts[0]}h ${parts[1]}min`;
      }
    }
  }

  const participants = toStrArray(raw.participants);
  const taskSettimana = toStr(raw.taskSettimana);
  const taskMese = toStr(raw.taskMese);
  let actionItems = toActionItems(raw.actionItems);

  // Fallback Fathom: la pagina spesso non ha una sezione "Action Items" esplicita e il modello
  // a volte restituisce solo i nomi dei partecipanti invece di ripescare i task da "Task della
  // settimana" come richiesto dal prompt (vedi isActionItemsSuspicious sopra). Solo taskSettimana:
  // taskMese/programmaTrimestre sono obiettivi generali senza assegnatario, non vanno qui.
  if (source === "fathom" && isActionItemsSuspicious(actionItems, participants)) {
    const fallback = actionItemsFromTaskLines(taskSettimana);
    if (fallback.length > 0) actionItems = fallback;
  }

  return {
    title: typeof raw.title === "string" ? raw.title : "",
    date: typeof raw.date === "string" ? raw.date : "",
    duration,
    participants,
    summary: typeof raw.summary === "string" ? raw.summary : "",
    highlights: toStrArray(raw.highlights),
    actionItems,
    rawUrl: url,
    cliente: typeof raw.cliente === "string" ? raw.cliente : "",
    referente: typeof raw.referente === "string" ? raw.referente : "",
    dataConsulenza: typeof raw.dataConsulenza === "string" ? raw.dataConsulenza : "",
    taskSettimana,
    taskMese,
    programmaTrimestre: toStr(raw.programmaTrimestre),
    sentiment: typeof raw.sentiment === "string" ? raw.sentiment : "",
    kpiReali: toStr(raw.kpiReali),
    kpiStorico: toStr(raw.kpiStorico),
    kpiTargetMarketing: toStr(raw.kpiTargetMarketing),
    kpiTargetCommerciali: toStr(raw.kpiTargetCommerciali),
  };
}
