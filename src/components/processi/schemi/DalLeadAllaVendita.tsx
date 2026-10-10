import { nomeNelloSchema, rigaCommerciali, type CommercialiDiSede } from "@/lib/schemaTesto";
import { Casella, COLORE, Freccia, FrecciaSpezzata, Pillola, Testo } from "@/components/processi/primitive";

/**
 * Schema "Dal lead alla vendita" — il marketing genera e qualifica, il setting fissa e prepara, il
 * commerciale chiude e fa follow-up. Ridisegnato il 10/10/2026 dallo schema dell'utente del 21
 * settembre 2026 (su Drive, cartella Serveco: `ALC_Schema_DalLeadAllaVendita.png`): stessi passaggi
 * e stesse parole.
 *
 * Nella fascia "COMMERCIALE" compare il nome del cliente della scheda in cui lo schema è aperto
 * (richiesta dell'utente, 10/10/2026: il nome dell'azienda dove ha senso): discovery, offerta,
 * chiusura e follow-up li fa la sua squadra. La fascia "MARKETING" resta senza nome: dentro c'è anche
 * la prima chiamata, che non sempre fa ALC. Se sulle sedi del cliente ci sono commerciali registrati,
 * la fascia "COMMERCIALE" li cita per nome (richiesta dell'utente, 10/10/2026).
 *
 * Colori: nell'originale marketing e commerciale erano viola e rosso; qui sono blu e grigio, perché
 * il sistema ALC tiene il rosso per ciò che va male ("Non compra") e non ha un viola.
 */
export const LARGHEZZA_LEAD_VENDITA = 2000;
export const ALTEZZA_LEAD_VENDITA = 592;

// La fila dei passaggi.
const Y_FILA = 181;
const ALTEZZA_FILA = 98;
const Y_CENTRO = Y_FILA + ALTEZZA_FILA / 2;

// Gli esiti dopo "App 2", e ciò che segue il follow-up.
const X_ESITI = 1517;
const LARGHEZZA_ESITO = 156;
const X_DOPO = 1727;
const LARGHEZZA_DOPO = 199;
const Y_SOPRA = 76;
const Y_SOTTO = 285;

// I due numeri da capire: richiami tratteggiati sotto la fila.
const Y_RICHIAMO = 308;
const Y_KPI = 330;
const ALTEZZA_KPI = 95;

function Kpi({ x, larghezza, numero, domanda, formula }: { x: number; larghezza: number; numero: number; domanda: string; formula: string }) {
  return (
    <g>
      <rect x={x} y={Y_KPI} width={larghezza} height={ALTEZZA_KPI} rx={12} fill={COLORE.attenzioneTenue} stroke={COLORE.attenzione} strokeWidth={1.5} strokeDasharray="6 4" />
      <circle cx={x + 38} cy={Y_KPI + ALTEZZA_KPI / 2} r={19} fill={COLORE.attenzione} />
      <Testo x={x + 38} y={Y_KPI + ALTEZZA_KPI / 2 + 8} misura={22} peso={800} colore={COLORE.suPieno} ancora="middle">
        ?
      </Testo>
      <Testo x={x + 73} y={Y_KPI + 29} misura={12.5} peso={700} colore={COLORE.attenzione} spaziata>
        {`DA CAPIRE · KPI ${numero}`}
      </Testo>
      <Testo x={x + 73} y={Y_KPI + 53} misura={18} peso={700} colore={COLORE.inchiostro}>
        {domanda}
      </Testo>
      <Testo x={x + 73} y={Y_KPI + 76} misura={14.5} colore={COLORE.testo}>
        {formula}
      </Testo>
    </g>
  );
}

export function DalLeadAllaVendita({ nomeCliente, commerciali }: { nomeCliente?: string; commerciali?: CommercialiDiSede[] }) {
  const azienda = nomeNelloSchema(nomeCliente, 60);
  const chiVende = rigaCommerciali(commerciali);
  const compiti = "discovery, offerta, chiusura e follow-up";
  return (
    <g>
      {/* Il setting: dalla prima chiamata alla discovery. */}
      <rect x={567} y={50} width={234} height={44} rx={22} fill={COLORE.inchiostro} />
      <Testo x={684} y={78} misura={16} peso={700} colore={COLORE.suPieno} ancora="middle" spaziata>
        SETTING
      </Testo>
      <FrecciaSpezzata punti={[[684, 94], [684, 121]]} colore={COLORE.inchiostro} punta={false} />
      <FrecciaSpezzata punti={[[289, 136], [289, 121], [1079, 121], [1079, 136]]} colore={COLORE.inchiostro} punta={false} />
      <Testo x={684} y={157} misura={14.5} colore={COLORE.testo} ancora="middle">
        dalla prima chiamata fino alla discovery: fissa e prepara l&apos;appuntamento
      </Testo>

      {/* Collegamenti della fila: sotto le caselle. */}
      {[
        [255, 288],
        [430, 448],
        [588, 606],
        [762, 779],
        [907, 925],
        [1080, 1098],
        [1213, 1230],
      ].map(([da, a]) => (
        <Freccia key={da} da={[da, Y_CENTRO]} a={[a, Y_CENTRO]} colore={COLORE.bordo} />
      ))}

      {/* Da "App 2" ai tre esiti, e dal follow-up a ciò che segue. */}
      <FrecciaSpezzata punti={[[1464, Y_CENTRO], [1491, Y_CENTRO], [1491, Y_SOPRA + ALTEZZA_FILA / 2], [X_ESITI, Y_SOPRA + ALTEZZA_FILA / 2]]} />
      <FrecciaSpezzata punti={[[1491, Y_CENTRO], [X_ESITI, Y_CENTRO]]} />
      <FrecciaSpezzata punti={[[1491, Y_CENTRO], [1491, Y_SOTTO + ALTEZZA_FILA / 2], [X_ESITI, Y_SOTTO + ALTEZZA_FILA / 2]]} />
      <FrecciaSpezzata punti={[[X_ESITI + LARGHEZZA_ESITO, Y_CENTRO], [1700, Y_CENTRO], [1700, Y_SOPRA + ALTEZZA_FILA / 2], [X_DOPO, Y_SOPRA + ALTEZZA_FILA / 2]]} />
      <FrecciaSpezzata punti={[[1700, Y_CENTRO], [1700, Y_SOTTO + ALTEZZA_FILA / 2], [X_DOPO, Y_SOTTO + ALTEZZA_FILA / 2]]} />

      {/* I richiami dei due numeri da capire. */}
      <FrecciaSpezzata punti={[[359, Y_FILA + ALTEZZA_FILA], [359, Y_RICHIAMO], [997, Y_RICHIAMO], [997, Y_FILA + ALTEZZA_FILA]]} colore={COLORE.attenzione} spessore={1.75} tratteggiata punta={false} />
      <FrecciaSpezzata punti={[[677, Y_RICHIAMO], [677, Y_KPI]]} colore={COLORE.attenzione} spessore={1.75} tratteggiata punta={false} />
      <FrecciaSpezzata punti={[[1008, Y_FILA + ALTEZZA_FILA], [1008, Y_RICHIAMO], [1347, Y_RICHIAMO], [1347, Y_FILA + ALTEZZA_FILA]]} colore={COLORE.attenzione} spessore={1.75} tratteggiata punta={false} />
      <FrecciaSpezzata punti={[[1177, Y_RICHIAMO], [1177, Y_KPI]]} colore={COLORE.attenzione} spessore={1.75} tratteggiata punta={false} />

      {/* La fila: dalla pubblicità al secondo appuntamento. */}
      <Casella x={74} y={Y_FILA} larghezza={181} altezza={ALTEZZA_FILA} titolo="ADV" righe={["media budget", "mensile"]} fondo={COLORE.bluTenue} bordo={COLORE.blu20} barra={COLORE.blu} />
      <Casella x={288} y={Y_FILA} larghezza={142} altezza={ALTEZZA_FILA} titolo="Lead" righe={["contatto", "entrato"]} />
      <Pillola x={448} y={Y_FILA + 13} larghezza={140} altezza={72} righe={["Prima", "chiamata"]} nota="setting" />
      <Casella x={606} y={Y_FILA} larghezza={156} altezza={ALTEZZA_FILA} titolo="Qualificato" righe={["in target, con", "esigenza"]} />
      <Pillola x={779} y={Y_FILA + 18} larghezza={128} altezza={62} righe={["% di scarto"]} />
      <Casella x={925} y={Y_FILA} larghezza={155} altezza={ALTEZZA_FILA} titolo="App 1" righe={["Discovery"]} bordo={COLORE.blu} spessoreBordo={2} />
      <Pillola x={1098} y={Y_FILA + 18} larghezza={115} altezza={62} righe={["Closing"]} />
      <Casella
        x={1230}
        y={Y_FILA}
        larghezza={234}
        altezza={ALTEZZA_FILA}
        titolo="App 2"
        righe={["Chiudere la trattativa e", "presentare l'offerta"]}
        fondo={COLORE.blu}
        bordo={COLORE.blu}
        coloreTitolo={COLORE.suPieno}
        coloreRighe={COLORE.suPieno}
      />

      {/* I tre esiti. */}
      <Casella x={X_ESITI} y={Y_SOPRA} larghezza={LARGHEZZA_ESITO} altezza={ALTEZZA_FILA} titolo="Compra" fondo={COLORE.ok} bordo={COLORE.ok} coloreTitolo={COLORE.suPieno} pesoTitolo={800} />
      <Casella x={X_ESITI} y={Y_FILA} larghezza={LARGHEZZA_ESITO} altezza={ALTEZZA_FILA} titolo="Follow up" righe={["non ha ancora", "deciso"]} fondo={COLORE.attenzioneTenue} bordo={COLORE.attenzioneTenue} barra={COLORE.attenzione} />
      <Casella x={X_ESITI} y={Y_SOTTO} larghezza={LARGHEZZA_ESITO} altezza={ALTEZZA_FILA} titolo={["Non", "compra"]} fondo={COLORE.critico} bordo={COLORE.critico} coloreTitolo={COLORE.suPieno} pesoTitolo={800} />

      {/* Dopo il follow-up. */}
      <Casella x={X_DOPO} y={Y_SOPRA} larghezza={LARGHEZZA_DOPO} altezza={ALTEZZA_FILA} titolo="Breve termine" righe={["Call 3 · chiusura del", "deal"]} fondo={COLORE.okTenue} bordo={COLORE.okTenue} barra={COLORE.ok} misuraTitolo={18} misuraRighe={14.5} />
      <Casella x={X_DOPO} y={Y_SOTTO} larghezza={LARGHEZZA_DOPO} altezza={ALTEZZA_FILA} titolo={["Compro più", "avanti"]} righe={["resta nel sistema, si", "risente"]} fondo={COLORE.sfondo} bordo={COLORE.linea} barra={COLORE.secondario} misuraTitolo={18} misuraRighe={14.5} />

      <Kpi x={483} larghezza={389} numero={1} domanda="Quanti lead arrivano in App 1?" formula="App 1 fissati ÷ lead generati" />
      <Kpi x={957} larghezza={441} numero={2} domanda="Quanti App 1 diventano trattative?" formula="App 2 con offerta ÷ App 1 svolti" />

      {/* Chi fa cosa. */}
      <rect x={74} y={466} width={688} height={71} rx={12} fill={COLORE.bluTenue} stroke={COLORE.blu20} strokeWidth={1.5} />
      <Testo x={418} y={496} misura={17} peso={800} colore={COLORE.blu} ancora="middle">
        MARKETING
      </Testo>
      <Testo x={418} y={519} misura={15} colore={COLORE.testo} ancora="middle">
        genera i contatti e li qualifica
      </Testo>
      <Testo x={843} y={500} misura={14} peso={700} colore={COLORE.inchiostro} ancora="middle">
        scarto
      </Testo>
      <Testo x={843} y={518} misura={14} colore={COLORE.testo} ancora="middle">
        fisiologico
      </Testo>
      <rect x={925} y={466} width={1001} height={71} rx={12} fill={COLORE.sfondo} stroke={COLORE.grigio} strokeWidth={1.5} />
      <Testo x={1425.5} y={496} misura={17} peso={800} colore={COLORE.inchiostro} ancora="middle">
        {azienda ? `COMMERCIALE · ${azienda}` : "COMMERCIALE"}
      </Testo>
      <Testo x={1425.5} y={519} misura={15} colore={COLORE.testo} ancora="middle" larghezzaMassima={960}>
        {chiVende ? `${chiVende}: ${compiti}` : compiti}
      </Testo>

      {/* Chiusura del foglio: la barra di ALC. */}
      <rect x={0} y={ALTEZZA_LEAD_VENDITA - 8} width={LARGHEZZA_LEAD_VENDITA} height={8} fill={COLORE.blu} />
    </g>
  );
}
