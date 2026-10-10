import { Casella, COLORE, Freccia, FrecciaSpezzata, Rombo, Testo } from "@/components/processi/primitive";

/**
 * Schema "Dalla pubblicità alla vendita del progetto" — quanti lead entrano nel processo commerciale
 * e in quanto tempo diventano vendita. Ridisegnato il 10/10/2026 dallo schema dell'utente del 6
 * ottobre 2026 (su Drive, cartella 70 MQ: `70MQ_Schema_ProcessoCommerciale.png`): stessi elementi,
 * stesse parole e stessi numeri (15–20%, 2–3 settimane), nessun dato del cliente.
 *
 * Colori: nell'originale "non entrano" era rosa e il tempo di incubazione lilla; qui rosso tenue e
 * blu tenue, i toni del sistema ALC.
 */
export const LARGHEZZA_PUBBLICITA_VENDITA = 2000;
export const ALTEZZA_PUBBLICITA_VENDITA = 871;

const Y_ENTRATA = 396;
const Y_PROCESSO = 152;
const Y_FUORI = 714;
const X_BIVIO = 1059;
const X_ESITI = 1148;
const LARGHEZZA_ESITO = 221;
const CENTRO_ESITI = X_ESITI + LARGHEZZA_ESITO / 2;

export function DallaPubblicitaAllaVendita() {
  return (
    <g>
      {/* Dalla pubblicità al lead. */}
      <Freccia da={[348, Y_ENTRATA]} a={[439, Y_ENTRATA]} colore={COLORE.bordo} spessore={2.5} />
      <Freccia da={[644, Y_ENTRATA]} a={[734, Y_ENTRATA]} colore={COLORE.bordo} spessore={2.5} />
      {/* Il bivio: chi entra nel processo commerciale e chi no. */}
      <FrecciaSpezzata punti={[[1000, Y_ENTRATA], [X_BIVIO, Y_ENTRATA], [X_BIVIO, Y_PROCESSO], [X_ESITI, Y_PROCESSO]]} spessore={2.5} misuraPunta={12} />
      <FrecciaSpezzata punti={[[X_BIVIO, Y_ENTRATA], [X_BIVIO, Y_FUORI], [X_ESITI, Y_FUORI]]} spessore={2.5} misuraPunta={12} />
      {/* La quota che entra, fra i due esiti. */}
      <FrecciaSpezzata punti={[[CENTRO_ESITI, 255], [CENTRO_ESITI, 338]]} spessore={2.5} punta={false} />
      <FrecciaSpezzata punti={[[CENTRO_ESITI, 514], [CENTRO_ESITI, 612]]} spessore={2.5} misuraPunta={12} />
      {/* Da chi entra alla vendita. */}
      <Freccia da={[X_ESITI + LARGHEZZA_ESITO, Y_PROCESSO]} a={[1459, Y_PROCESSO]} colore={COLORE.bordo} spessore={2.5} />
      <Freccia da={[1665, Y_PROCESSO]} a={[1716, Y_PROCESSO]} colore={COLORE.bordo} spessore={2.5} />

      <Casella x={84} y={287} larghezza={264} altezza={219} titolo={["Stimolazione", "ADV"]} misuraTitolo={24} raggio={14} />
      <Casella x={439} y={301} larghezza={205} altezza={190} titolo={["Pubblico", "Target"]} titoloSottolineato fondo={COLORE.attenzioneTenue} bordo={COLORE.attenzione} spessoreBordo={1.25} misuraTitolo={26} raggio={6} />
      <Rombo cx={867} cy={Y_ENTRATA} mezzaLarghezza={133} mezzaAltezza={96} righe={["Prospects", "(LEAD)"]} />

      <Casella x={X_ESITI} y={50} larghezza={LARGHEZZA_ESITO} altezza={205} titolo={["Entrano nel", "Processo", "Commerciale"]} fondo={COLORE.okTenue} bordo={COLORE.ok} spessoreBordo={1.25} misuraTitolo={23} raggio={6} />
      <rect x={1156} y={338} width={206} height={176} rx={6} fill={COLORE.attenzione} />
      <Testo x={CENTRO_ESITI} y={439} misura={36} peso={800} colore={COLORE.bianco} ancora="middle">
        15–20%
      </Testo>
      <Casella x={X_ESITI} y={612} larghezza={LARGHEZZA_ESITO} altezza={205} titolo={["NON Entrano", "nel Processo", "Commerciale"]} fondo={COLORE.criticoTenue} bordo={COLORE.critico} spessoreBordo={1.25} misuraTitolo={23} raggio={6} />

      <Casella x={1459} y={64} larghezza={206} altezza={176} titolo={["Tempo", "Incubazione", "2–3", "SETTIMANE"]} fondo={COLORE.bluTenue} bordo={COLORE.blu} spessoreBordo={1.25} misuraTitolo={22} raggio={6} />
      <Rombo cx={1813} cy={Y_PROCESSO} mezzaLarghezza={97} mezzaAltezza={96} righe={["VENDITA"]} misura={19} nota="Progetto" />

      {/* Chiusura del foglio: la barra di ALC. */}
      <rect x={0} y={ALTEZZA_PUBBLICITA_VENDITA - 8} width={LARGHEZZA_PUBBLICITA_VENDITA} height={8} fill={COLORE.blu} />
    </g>
  );
}
