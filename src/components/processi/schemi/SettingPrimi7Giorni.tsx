import { dividiInDue, nomeNelloSchema } from "@/lib/schemaTesto";
import { ALTEZZA_RIQUADRO, ALTEZZA_RIQUADRO_CON_ESEMPIO, Anello, COLORE, Freccia, FrecciaCircolare, Riquadro, Scheda, Testo, TONO, type TonoRiquadro } from "@/components/processi/primitive";

/**
 * Schema "Appointment setting: i primi 7 giorni" — cosa fa il commerciale da quando entra il lead.
 * Ridisegnato il 10/10/2026 dallo schema dell'utente del 7 ottobre 2026: stessi contenuti e stessa
 * disposizione, in vettoriale (ingrandito resta nitido) e coi colori del Design System ALC.
 *
 * Nel vocale d'esempio del giorno 1 («Ciao, sono X di Y…») al posto di "Y" c'è il nome del cliente
 * della scheda in cui lo schema è aperto (richiesta dell'utente, 10/10/2026: il nome dell'azienda
 * dove ha senso). "X" resta: chi chiama può essere un setter che l'app non conosce.
 *
 * Senza logo, titolo e descrizione in testa al foglio (tolti su richiesta dell'utente il 10/10/2026:
 * "sono ridondanti"): il titolo e la descrizione stanno già nella barra del visualizzatore, anche a
 * schermo intero. Vale per ogni schema: il foglio comincia dal contenuto. Lo stesso giorno ha fatto
 * togliere anche il piè di pagina ("Andrea Lenzi Consulting" e "Aggiornato al 7 ottobre 2026").
 *
 * I numeri del riepilogo in fondo ("5 chiamate · 2 messaggi WhatsApp · 4 email") sono la somma dei
 * passi dei tre giorni qui sotto: se cambia un passo, va cambiato anche il riepilogo.
 */
export const LARGHEZZA_SETTING = 1600;
export const ALTEZZA_SETTING = 705;

type Passo = {
  tono: TonoRiquadro;
  titolo: string;
  esempio?: string[];
  /** Le stesse parole d'esempio, col nome dell'azienda del cliente al posto del segnaposto. */
  esempioCon?: (azienda: string) => string;
};
type Giorno = { x: number; titolo: string; sotto: string; passi: Passo[]; conto: string };

const GIORNI: Giorno[] = [
  {
    x: 54,
    titolo: "GIORNO 1",
    sotto: "Ore 0–24 · da fare subito",
    passi: [
      { tono: "chiamata", titolo: "1ª chiamata" },
      {
        tono: "whatsapp",
        titolo: "Vocale su WhatsApp",
        esempio: ["«Ciao, sono X di Y, ti sto contattando", "perché hai richiesto Z…»"],
        esempioCon: (azienda) => `«Ciao, sono X di ${azienda}, ti sto contattando perché hai richiesto Z…»`,
      },
      { tono: "chiamata", titolo: "2ª chiamata" },
      { tono: "emailAutomatica", titolo: "Email automatica" },
    ],
    conto: "2 chiamate · 1 vocale · 1 email",
  },
  {
    x: 327,
    titolo: "GIORNO 2",
    sotto: "Ore 24–48 · follow-up",
    passi: [
      { tono: "chiamata", titolo: "3ª chiamata" },
      { tono: "whatsapp", titolo: "WhatsApp di follow-up", esempio: ["«Ciao, ti ho inviato un vocale ieri,", "quando possiamo sentirci?»"] },
      { tono: "emailAutomatica", titolo: "Email automatica" },
      { tono: "chiamata", titolo: "4ª chiamata" },
    ],
    conto: "2 chiamate · 1 WhatsApp · 1 email",
  },
  {
    x: 600,
    titolo: "GIORNO 3",
    sotto: "Ore 48–72 · ultimo giro",
    passi: [
      { tono: "chiamata", titolo: "5ª chiamata" },
      { tono: "emailAutomatica", titolo: "Email automatica" },
      { tono: "emailManuale", titolo: "Email manuale" },
    ],
    conto: "1 chiamata · 2 email",
  },
];

// Linea del tempo e schede.
const Y_LINEA = 80;
const Y_SCHEDE = 121;
const ALTEZZA_SCHEDE = 390;
const LARGHEZZA_GIORNO = 248;
const MARGINE_SCHEDA = 19;
const Y_PRIMO_PASSO = 201;
const SPAZIO_FRA_PASSI = 27;

// "Giorni 4–7": la scheda larga, senza passi fissi.
const X_RIPETI = 873;
const LARGHEZZA_RIPETI = 319;
const CENTRO_RIPETI = X_RIPETI + LARGHEZZA_RIPETI / 2;

// Giorno 7 e i tre esiti.
const X_GIORNO_7 = 1226;
const RAGGIO_GIORNO_7 = 9.5;
const X_ESITI = 1288;
const LARGHEZZA_ESITO = 258;
const ALTEZZA_ESITO = 99;

const ESITI = [
  { y: 120, titolo: "Risponde", sotto: "si fissa l'appuntamento", fondo: COLORE.okTenue, bordo: COLORE.ok, coloreTitolo: COLORE.ok, freccia: COLORE.ok },
  { y: 245, titolo: "Non risponde proprio", sotto: "silenzio totale, chiuso", fondo: COLORE.sfondo, bordo: COLORE.secondario, coloreTitolo: COLORE.testo, freccia: COLORE.secondario },
  { y: 369, titolo: "Non mi interessa", sotto: "risposta chiara, chiuso", fondo: COLORE.criticoTenue, bordo: COLORE.critico, coloreTitolo: COLORE.critico, freccia: COLORE.critico },
];

const LEGENDA = [
  { x: 59, colore: TONO.chiamata.bordo, testo: "Chiamata" },
  { x: 251, colore: TONO.whatsapp.bordo, testo: "Messaggio WhatsApp" },
  { x: 481, colore: TONO.emailAutomatica.bordo, testo: "Email automatica (parte da sola)" },
  { x: 787, colore: TONO.emailManuale.bordo, testo: "Email manuale (scritta dal commerciale)" },
];

/** I passi di un giorno, uno sotto l'altro: ognuno con la quota a cui comincia. */
function disponiPassi(passi: Passo[]): { passo: Passo; y: number }[] {
  const disposti: { passo: Passo; y: number }[] = [];
  let y = Y_PRIMO_PASSO;
  for (const passo of passi) {
    disposti.push({ passo, y });
    y += (passo.esempio ? ALTEZZA_RIQUADRO_CON_ESEMPIO : ALTEZZA_RIQUADRO) + SPAZIO_FRA_PASSI;
  }
  return disposti;
}

// Nel messaggio d'esempio il nome dell'azienda ha poco posto: oltre questa misura si accorcia.
const NOME_NEL_MESSAGGIO = 34;

/** Le parole d'esempio di un passo: con l'azienda del cliente, se la scheda ne ha una e il passo la nomina. */
function esempioDi(passo: Passo, azienda: string | null): string[] | undefined {
  if (azienda && passo.esempioCon) return dividiInDue(passo.esempioCon(azienda));
  return passo.esempio;
}

function SchedaGiorno({ giorno, azienda }: { giorno: Giorno; azienda: string | null }) {
  const xPassi = giorno.x + MARGINE_SCHEDA;
  const larghezzaPassi = LARGHEZZA_GIORNO - MARGINE_SCHEDA * 2;
  const fondoScheda = Y_SCHEDE + ALTEZZA_SCHEDE;
  const passi = disponiPassi(giorno.passi);
  return (
    <Scheda x={giorno.x} y={Y_SCHEDE} larghezza={LARGHEZZA_GIORNO} altezza={ALTEZZA_SCHEDE}>
      <Testo x={xPassi} y={Y_SCHEDE + 37} misura={20} peso={800} colore={COLORE.inchiostro}>
        {giorno.titolo}
      </Testo>
      <Testo x={xPassi} y={Y_SCHEDE + 57} misura={12} peso={600} colore={COLORE.blu}>
        {giorno.sotto}
      </Testo>
      {passi.map(({ passo, y: yPasso }) => (
        <Riquadro key={passo.titolo} x={xPassi} y={yPasso} larghezza={larghezzaPassi} tono={passo.tono} titolo={passo.titolo} esempio={esempioDi(passo, azienda)} />
      ))}
      <line x1={xPassi} y1={fondoScheda - 36} x2={xPassi + larghezzaPassi} y2={fondoScheda - 36} stroke={COLORE.linea} strokeWidth={1} />
      <Testo x={xPassi} y={fondoScheda - 16} misura={11.5} colore={COLORE.secondario}>
        {giorno.conto}
      </Testo>
    </Scheda>
  );
}

export function SettingPrimi7Giorni({ nomeCliente }: { nomeCliente?: string }) {
  const azienda = nomeNelloSchema(nomeCliente, NOME_NEL_MESSAGGIO);
  return (
    <g>
      {/* Linea del tempo: dal lead che entra al giorno 7. */}
      <Testo x={54} y={Y_LINEA - 22} misura={11} peso={700} colore={COLORE.inchiostro} spaziata>
        ENTRA IL LEAD
      </Testo>
      <Testo x={X_GIORNO_7} y={Y_LINEA - 22} misura={11} peso={700} colore={COLORE.inchiostro} ancora="middle" spaziata>
        GIORNO 7
      </Testo>
      <line x1={63} y1={Y_LINEA} x2={X_GIORNO_7} y2={Y_LINEA} stroke={COLORE.blu} strokeWidth={2} />
      {GIORNI.map((g) => (
        <line key={g.titolo} x1={g.x + LARGHEZZA_GIORNO / 2} y1={Y_LINEA} x2={g.x + LARGHEZZA_GIORNO / 2} y2={Y_SCHEDE} stroke={COLORE.blu} strokeWidth={2} />
      ))}
      <line x1={CENTRO_RIPETI} y1={Y_LINEA} x2={CENTRO_RIPETI} y2={Y_SCHEDE} stroke={COLORE.inchiostro} strokeWidth={2} />

      {/* Dal giorno 7 ai tre esiti: prima delle schede e dei pallini, che ci stanno sopra. */}
      {ESITI.map((esito) => {
        const arrivo: [number, number] = [X_ESITI, esito.y + ALTEZZA_ESITO / 2];
        const dx = arrivo[0] - X_GIORNO_7;
        const dy = arrivo[1] - Y_LINEA;
        const lunga = Math.hypot(dx, dy);
        // Parte dal bordo del pallino, non dal suo centro.
        const partenza: [number, number] = [X_GIORNO_7 + (dx / lunga) * (RAGGIO_GIORNO_7 + 2), Y_LINEA + (dy / lunga) * (RAGGIO_GIORNO_7 + 2)];
        return <Freccia key={esito.titolo} da={partenza} a={arrivo} colore={esito.freccia} />;
      })}

      <circle cx={63} cy={Y_LINEA} r={7} fill={COLORE.inchiostro} />
      {GIORNI.map((g) => (
        <circle key={g.titolo} cx={g.x + LARGHEZZA_GIORNO / 2} cy={Y_LINEA} r={6.5} fill={COLORE.blu} stroke={COLORE.superficie} strokeWidth={2} />
      ))}
      <circle cx={CENTRO_RIPETI} cy={Y_LINEA} r={6.5} fill={COLORE.inchiostro} stroke={COLORE.superficie} strokeWidth={2} />
      <circle cx={X_GIORNO_7} cy={Y_LINEA} r={RAGGIO_GIORNO_7} fill={COLORE.inchiostro} />

      {GIORNI.map((g) => (
        <SchedaGiorno key={g.titolo} giorno={g} azienda={azienda} />
      ))}

      {/* Giorni 4–7: il giro si ripete, senza passi fissi. */}
      <Scheda x={X_RIPETI} y={Y_SCHEDE} larghezza={LARGHEZZA_RIPETI} altezza={ALTEZZA_SCHEDE} colore={COLORE.inchiostro} tratteggiata>
        <Testo x={X_RIPETI + MARGINE_SCHEDA} y={Y_SCHEDE + 37} misura={20} peso={800} colore={COLORE.inchiostro}>
          GIORNI 4–7
        </Testo>
        <Testo x={X_RIPETI + MARGINE_SCHEDA} y={Y_SCHEDE + 57} misura={12} peso={600} colore={COLORE.inchiostro}>
          Se non risponde, il giro si ripete
        </Testo>
        <FrecciaCircolare cx={CENTRO_RIPETI} cy={254}>
          ripeti
        </FrecciaCircolare>
        {[
          { y: 327, colore: COLORE.ok, testo: "Aggiungi una comunicazione" },
          { y: 356, colore: COLORE.critico, testo: "Togli una comunicazione" },
          { y: 385, colore: COLORE.blu, testo: "Fino al giorno 7" },
        ].map((voce) => (
          <g key={voce.testo}>
            <circle cx={X_RIPETI + 26} cy={voce.y - 4.5} r={5.5} fill={voce.colore} />
            <Testo x={X_RIPETI + 42} y={voce.y} misura={13.5} peso={600} colore={COLORE.inchiostro}>
              {voce.testo}
            </Testo>
          </g>
        ))}
        <rect x={X_RIPETI + 18} y={417} width={LARGHEZZA_RIPETI - 36} height={77} rx={6} fill={COLORE.bluTenue} stroke={COLORE.blu} strokeWidth={1.5} />
        {["I messaggi sono i più invasivi,", "ma sono anche quelli che", "rispondono di più."].map((riga, i) => (
          <Testo key={riga} x={CENTRO_RIPETI} y={442 + i * 18} misura={13} peso={600} colore={COLORE.inchiostro} ancora="middle">
            {riga}
          </Testo>
        ))}
      </Scheda>

      {/* I tre esiti. */}
      <Testo x={X_ESITI} y={103} misura={10.5} peso={700} colore={COLORE.secondario} spaziata>
        ENTRO 7 GIORNI, UNA DI TRE
      </Testo>
      {ESITI.map((esito) => (
        <g key={esito.titolo}>
          <rect x={X_ESITI} y={esito.y} width={LARGHEZZA_ESITO} height={ALTEZZA_ESITO} rx={8} fill={esito.fondo} stroke={esito.bordo} strokeWidth={1.5} />
          <Testo x={X_ESITI + 20} y={esito.y + 46} misura={19} peso={800} colore={esito.coloreTitolo}>
            {esito.titolo}
          </Testo>
          <Testo x={X_ESITI + 20} y={esito.y + 69} misura={12.5} colore={COLORE.secondario}>
            {esito.sotto}
          </Testo>
        </g>
      ))}

      {/* Legenda. */}
      {LEGENDA.map((voce) => (
        <g key={voce.testo}>
          <Anello x={voce.x} y={549} colore={voce.colore} />
          <Testo x={voce.x + 15} y={553.5} misura={13} peso={600} colore={COLORE.inchiostro}>
            {voce.testo}
          </Testo>
        </g>
      ))}

      {/* Riepilogo. */}
      <rect x={54} y={580} width={1492} height={71} rx={8} fill={COLORE.bluTenue} stroke={COLORE.blu20} strokeWidth={1.25} />
      <Testo x={78} y={611} misura={14} peso={700} colore={COLORE.blu}>
        Prime 72 ore: 5 chiamate · 2 messaggi WhatsApp · 4 email (3 automatiche, 1 manuale)
      </Testo>
      <Testo x={78} y={631} misura={14} peso={700} colore={COLORE.inchiostro}>
        Obiettivo: entro 7 giorni il contatto risponde, dice di no o tace. Poi ci si ferma.
      </Testo>

      {/* Chiusura del foglio: la barra di ALC. */}
      <rect x={0} y={ALTEZZA_SETTING - 8} width={LARGHEZZA_SETTING} height={8} fill={COLORE.blu} />
    </g>
  );
}
