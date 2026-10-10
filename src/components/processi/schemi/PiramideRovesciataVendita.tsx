import { quantiCommerciali, rigaCommerciali, type CommercialiDiSede } from "@/lib/schemaTesto";
import { COLORE, FrecciaSpezzata, Testo } from "@/components/processi/primitive";

/**
 * Schema "La piramide rovesciata della vendita" — il metodo di vendita di ALC: sei fasi in sequenza,
 * divise su due appuntamenti; la stimolazione è quella che trasforma una vendita tecnica in una
 * decisione. Ridisegnato il 10/10/2026 dallo schema dell'utente del 21 settembre 2026 (su Drive,
 * cartella Serveco: `ALC_Schema_PiramideRovesciataVendita.png`): stesse fasi e stesse parole.
 *
 * Se sulle sedi del cliente ci sono commerciali registrati, il riquadro in fondo dice chi conduce i
 * due appuntamenti (richiesta dell'utente, 10/10/2026). Senza commerciali resta com'era.
 */
export const LARGHEZZA_PIRAMIDE = 2000;
export const ALTEZZA_PIRAMIDE = 982;

// La piramide: base in alto, punta in basso, sei fasce.
const X_SINISTRA = 88;
const X_DESTRA = 1170;
const X_PUNTA = (X_SINISTRA + X_DESTRA) / 2;
const Y_BASE = 50;
const Y_PUNTA = 793;
const TAGLI = [50, 173, 296, 422, 545, 669, 793];

// Le schede delle fasi, a destra.
const X_SCHEDE = 1251;
const LARGHEZZA_SCHEDA = 447;
const ALTEZZA_SCHEDA = 98;
const Y_SCHEDE = [63, 187, 311, 435, 559, 682];
const X_GRAFFA = 1742;

type Fase = { nome: string[]; misura: number; righe: [string, string]; evidenza?: boolean };

const FASI: Fase[] = [
  { nome: ["Approccio"], misura: 34, righe: ["Entrare in relazione: il cliente deve", "sentirsi a suo agio prima delle domande"] },
  { nome: ["Indagine"], misura: 34, righe: ["Tutte le domande per capire esigenza,", "contesto e chi decide"] },
  { nome: ["Stimolazione"], misura: 34, righe: ["Far vivere il risultato: cosa cambia per lui,", "anche sul piano emotivo"], evidenza: true },
  { nome: ["Presentazione", "della soluzione"], misura: 26, righe: ["Su misura, costruita su quanto emerso:", "mai preconfezionata"] },
  { nome: ["Gestione", "delle obiezioni"], misura: 23, righe: ["Rispondere ai dubbi prima della", "decisione"] },
  { nome: ["Chiusura"], misura: 20, righe: ["La decisione, oppure un follow-up con", "una data precisa"] },
];

/** I due lati della piramide a una certa quota. */
function lati(y: number): { sinistra: number; destra: number } {
  const t = (y - Y_BASE) / (Y_PUNTA - Y_BASE);
  return { sinistra: X_SINISTRA + (X_PUNTA - X_SINISTRA) * t, destra: X_DESTRA - (X_DESTRA - X_PUNTA) * t };
}

function Graffa({ da, a, titolo, righe }: { da: number; a: number; titolo: string; righe: [string, string] }) {
  const centro = (da + a) / 2;
  return (
    <g>
      <FrecciaSpezzata punti={[[X_GRAFFA - 15, da], [X_GRAFFA, da], [X_GRAFFA, a], [X_GRAFFA - 15, a]]} colore={COLORE.inchiostro} punta={false} />
      <Testo x={X_GRAFFA + 16} y={centro - 16} misura={24} peso={800} colore={COLORE.inchiostro}>
        {titolo}
      </Testo>
      {righe.map((riga, i) => (
        <Testo key={riga} x={X_GRAFFA + 16} y={centro + 10 + i * 23} misura={16.5} colore={COLORE.secondario}>
          {riga}
        </Testo>
      ))}
    </g>
  );
}

export function PiramideRovesciataVendita({ commerciali }: { commerciali?: CommercialiDiSede[] }) {
  const chiVende = rigaCommerciali(commerciali);
  const conduce = quantiCommerciali(commerciali) === 1 ? "Conduce" : "Conducono";
  return (
    <g>
      {FASI.map((fase, i) => {
        const sopra = TAGLI[i];
        const sotto = TAGLI[i + 1];
        const a = lati(sopra);
        const b = lati(sotto);
        const mezzo = (sopra + sotto) / 2;
        const bordoDestro = lati(mezzo).destra;
        const ySche = Y_SCHEDE[i];
        const passo = fase.misura * 1.24;
        // L'ultima fascia è la punta: il nome sta in alto, dove c'è posto.
        const cimaNome = i === FASI.length - 1 ? sopra + 18 : mezzo - (fase.nome.length * passo) / 2;
        return (
          <g key={fase.nome.join(" ")}>
            <polygon
              points={`${a.sinistra},${sopra} ${a.destra},${sopra} ${b.destra},${sotto} ${b.sinistra},${sotto}`}
              fill={fase.evidenza ? COLORE.blu : COLORE.bluTenue}
              stroke={COLORE.blu}
              strokeWidth={2.5}
              strokeLinejoin="round"
            />
            {fase.nome.map((riga, r) => (
              <Testo key={riga} x={X_PUNTA} y={cimaNome + r * passo + fase.misura * 0.84} misura={fase.misura} peso={700} colore={fase.evidenza ? COLORE.suPieno : COLORE.inchiostro} ancora="middle">
                {riga}
              </Testo>
            ))}

            {/* Dalla fascia alla sua scheda. */}
            <line x1={bordoDestro + 24} y1={mezzo} x2={X_SCHEDE - 16} y2={mezzo} stroke={COLORE.bordo} strokeWidth={1.5} strokeDasharray="3 6" />
            <circle cx={bordoDestro + 14} cy={mezzo} r={4.5} fill={COLORE.blu} />

            <rect
              x={X_SCHEDE}
              y={ySche}
              width={LARGHEZZA_SCHEDA}
              height={ALTEZZA_SCHEDA}
              rx={12}
              fill={fase.evidenza ? COLORE.bluTenue : COLORE.superficie}
              stroke={fase.evidenza ? COLORE.blu : COLORE.linea}
              strokeWidth={fase.evidenza ? 2 : 1.5}
            />
            <Testo x={X_SCHEDE + 23} y={ySche + 27} misura={13} peso={700} colore={COLORE.blu} spaziata>
              {`FASE ${i + 1}`}
            </Testo>
            {fase.righe.map((riga, r) => (
              <Testo key={riga} x={X_SCHEDE + 23} y={ySche + 52 + r * 26} misura={17.5} colore={COLORE.testo}>
                {riga}
              </Testo>
            ))}
          </g>
        );
      })}

      {/* Le sei fasi su due appuntamenti. */}
      <Graffa da={Y_SCHEDE[0]} a={Y_SCHEDE[2] + ALTEZZA_SCHEDA} titolo="App 1" righe={["capire e", "stimolare"]} />
      <Graffa da={Y_SCHEDE[3]} a={Y_SCHEDE[5] + ALTEZZA_SCHEDA} titolo="App 2" righe={["proporre e", "chiudere"]} />

      {/* Quanto dura. */}
      <rect x={88} y={838} width={1823} height={90} rx={12} fill={COLORE.bluTenue} stroke={COLORE.blu20} strokeWidth={1.5} />
      {/* Con i commerciali le righe a sinistra sono due: la durata sale per far posto ai nomi. */}
      <Testo x={129} y={chiVende ? 876 : 890} misura={20} peso={700} colore={COLORE.blu}>
        Durata totale dell&apos;appuntamento: 75–90 minuti
      </Testo>
      {chiVende && (
        <Testo x={129} y={905} misura={17.5} peso={600} colore={COLORE.inchiostro} larghezzaMassima={1100}>
          {`${conduce} App 1 e App 2: ${chiVende}`}
        </Testo>
      )}
      <Testo x={1870} y={890} misura={17.5} colore={COLORE.testo} ancora="end">
        con un&apos;offerta su misura, le fasi si dividono su due appuntamenti
      </Testo>

      {/* Chiusura del foglio: la barra di ALC. */}
      <rect x={0} y={ALTEZZA_PIRAMIDE - 8} width={LARGHEZZA_PIRAMIDE} height={8} fill={COLORE.blu} />
    </g>
  );
}
