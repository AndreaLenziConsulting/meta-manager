import { Casella, COLORE, Freccia, Testo } from "@/components/processi/primitive";

/**
 * Schema "Il sistema di acquisizione" — dalla pubblicità al fatturato: le fasi, i tempi, gli scarti
 * fisiologici e i numeri da misurare. Ridisegnato il 10/10/2026 dallo schema dell'utente del 17
 * settembre 2026 (su Drive, cartella Metra: `METRA_Schema1_SistemaAcquisizione.png`).
 *
 * Versione generale, chiesta dall'utente: stessi passaggi, stessi tempi e stessi numeri (€10–15 a
 * contatto, 15–20% in appuntamento, 20–30% in vendita), senza il nome del cliente. Dove l'originale
 * diceva "METRA" qui c'è "La tua azienda". Le parole restano quelle del settore arredo ("nel punto
 * vendita", "progetto e preventivo"), come nell'originale.
 *
 * Colori: nell'originale tempi e misure avevano magenta e viola; qui i toni del sistema ALC.
 */
export const LARGHEZZA_ACQUISIZIONE = 2000;
export const ALTEZZA_ACQUISIZIONE = 837;

// Tre file: i tempi, le fasi, i numeri da misurare.
const Y_TEMPI = 50;
const ALTEZZA_TEMPO = 55;
const Y_FASI = 200;
const ALTEZZA_FASE = 129;
const Y_PASSAGGI = 353;
const ALTEZZA_PASSAGGIO = 102;
const Y_MISURE = 500;
const ALTEZZA_MISURA = 127;
const Y_CENTRO_FASI = Y_FASI + ALTEZZA_FASE / 2;

type Colonna = {
  x: number;
  larghezza: number;
  tempo: { testo: string; colore: string };
  fase: { titolo: string; righe: string[]; piena?: string };
  misura: { titolo: string | string[]; riga: string; barra: string; fondo: string };
};

const COLONNE: Colonna[] = [
  {
    x: 368,
    larghezza: 257,
    tempo: { testo: "Day 1", colore: COLORE.secondario },
    fase: { titolo: "Contatti", righe: ["potenziali clienti"] },
    misura: { titolo: "Costo per contatto", riga: "€10–15 a regime", barra: COLORE.ok, fondo: COLORE.okTenue },
  },
  {
    x: 806,
    larghezza: 273,
    tempo: { testo: "Entro day 7", colore: COLORE.blu },
    fase: { titolo: "Appuntamenti", righe: ["nel punto vendita"] },
    misura: { titolo: ["Costo per", "appuntamento"], riga: "spesa ÷ appuntamenti", barra: COLORE.attenzione, fondo: COLORE.attenzioneTenue },
  },
  {
    x: 1260,
    larghezza: 257,
    tempo: { testo: "Entro day 14", colore: COLORE.secondario },
    fase: { titolo: "Trattative", righe: ["progetto e", "preventivo"] },
    misura: { titolo: "Valore preventivi", riga: "le offerte generate", barra: COLORE.blu, fondo: COLORE.bluTenue },
  },
  {
    x: 1698,
    larghezza: 210,
    tempo: { testo: "Entro day 28", colore: COLORE.inchiostro },
    fase: { titolo: "Vendite", righe: ["contratti firmati"], piena: COLORE.ok },
    misura: { titolo: "Fatturato", riga: "il risultato finale", barra: COLORE.inchiostro, fondo: COLORE.sfondo },
  },
];

/** Quanti passano da una fase alla successiva: fra le colonne, sotto le frecce. */
const PASSAGGI = [
  { centro: 715, titolo: "15–20%", righe: ["diventa", "appuntamento"] },
  { centro: 1170, titolo: "Scarto", righe: ["non tutti in", "trattativa"] },
  { centro: 1608, titolo: "20–30%", righe: ["chiude la", "vendita"] },
];

const X_PUBBLICITA = 91;
const LARGHEZZA_PUBBLICITA = 227;
const LARGHEZZA_PASSAGGIO = 170;
const LARGHEZZA_PILLOLA_TEMPO = 200;

export function SistemaAcquisizione() {
  return (
    <g>
      {/* I tempi, in fila, e la discesa di ognuno sulla sua fase. */}
      {COLONNE.map((c, i) => {
        const centro = c.x + c.larghezza / 2;
        const dopo = COLONNE[i + 1];
        return (
          <g key={c.tempo.testo}>
            {dopo && (
              <Freccia
                da={[centro + LARGHEZZA_PILLOLA_TEMPO / 2, Y_TEMPI + ALTEZZA_TEMPO / 2]}
                a={[dopo.x + dopo.larghezza / 2 - LARGHEZZA_PILLOLA_TEMPO / 2, Y_TEMPI + ALTEZZA_TEMPO / 2]}
                colore={COLORE.bordo}
                spessore={2}
              />
            )}
            <Freccia da={[centro, Y_TEMPI + ALTEZZA_TEMPO]} a={[centro, Y_FASI]} colore={COLORE.bordo} spessore={2} />
            <Freccia da={[centro, Y_FASI + ALTEZZA_FASE]} a={[centro, Y_MISURE]} colore={COLORE.bordo} spessore={2} />
            <rect x={centro - LARGHEZZA_PILLOLA_TEMPO / 2} y={Y_TEMPI} width={LARGHEZZA_PILLOLA_TEMPO} height={ALTEZZA_TEMPO} rx={ALTEZZA_TEMPO / 2} fill={c.tempo.colore} />
            <Testo x={centro} y={Y_TEMPI + 35} misura={20} peso={600} colore={COLORE.suPieno} ancora="middle">
              {c.tempo.testo}
            </Testo>
          </g>
        );
      })}

      {/* Da una fase alla successiva. */}
      <Freccia da={[X_PUBBLICITA + LARGHEZZA_PUBBLICITA, Y_CENTRO_FASI]} a={[COLONNE[0].x, Y_CENTRO_FASI]} colore={COLORE.bordo} spessore={2} />
      {COLONNE.slice(0, -1).map((c, i) => (
        <Freccia key={c.fase.titolo} da={[c.x + c.larghezza, Y_CENTRO_FASI]} a={[COLONNE[i + 1].x, Y_CENTRO_FASI]} colore={COLORE.bordo} spessore={2} />
      ))}

      {/* Le fasi. */}
      <Casella
        x={X_PUBBLICITA}
        y={Y_FASI}
        larghezza={LARGHEZZA_PUBBLICITA}
        altezza={ALTEZZA_FASE}
        titolo="Pubblicità"
        righe={["online su Meta"]}
        fondo={COLORE.blu}
        bordo={COLORE.blu}
        coloreTitolo={COLORE.suPieno}
        coloreRighe={COLORE.suPieno}
        misuraTitolo={26}
        misuraRighe={19.5}
      />
      {COLONNE.map((c) => (
        <Casella
          key={c.fase.titolo}
          x={c.x}
          y={Y_FASI}
          larghezza={c.larghezza}
          altezza={ALTEZZA_FASE}
          titolo={c.fase.titolo}
          righe={c.fase.righe}
          fondo={c.fase.piena ?? COLORE.superficie}
          bordo={c.fase.piena ?? COLORE.linea}
          coloreTitolo={c.fase.piena ? COLORE.suPieno : COLORE.inchiostro}
          coloreRighe={c.fase.piena ? COLORE.suPieno : COLORE.testo}
          misuraTitolo={26}
          misuraRighe={19.5}
        />
      ))}

      {/* Quanti passano. */}
      {PASSAGGI.map((p) => (
        <Casella
          key={p.titolo}
          x={p.centro - LARGHEZZA_PASSAGGIO / 2}
          y={Y_PASSAGGI}
          larghezza={LARGHEZZA_PASSAGGIO}
          altezza={ALTEZZA_PASSAGGIO}
          titolo={p.titolo}
          righe={p.righe}
          fondo={COLORE.sfondo}
          misuraTitolo={25}
          misuraRighe={19}
        />
      ))}

      {/* I numeri da misurare. */}
      {COLONNE.map((c) => (
        <Casella
          key={c.misura.riga}
          x={c.x}
          y={Y_MISURE}
          larghezza={c.larghezza}
          altezza={ALTEZZA_MISURA}
          titolo={c.misura.titolo}
          righe={[c.misura.riga]}
          fondo={c.misura.fondo}
          bordo={c.misura.fondo}
          barra={c.misura.barra}
          misuraTitolo={22}
          misuraRighe={19}
        />
      ))}

      {/* Chi fa cosa. */}
      <rect x={91} y={685} width={534} height={98} rx={12} fill={COLORE.bluTenue} stroke={COLORE.blu20} strokeWidth={1.5} />
      <Testo x={358} y={729} misura={22} peso={700} colore={COLORE.blu} ancora="middle">
        ALC Consulting
      </Testo>
      <Testo x={358} y={757} misura={19} colore={COLORE.testo} ancora="middle">
        pubblicità e contatti
      </Testo>
      <Testo x={715} y={731} misura={18} peso={700} colore={COLORE.inchiostro} ancora="middle">
        passaggio
      </Testo>
      <Testo x={715} y={754} misura={18} colore={COLORE.testo} ancora="middle">
        del contatto
      </Testo>
      <rect x={806} y={685} width={1102} height={98} rx={12} fill={COLORE.sfondo} stroke={COLORE.grigio} strokeWidth={1.5} />
      <Testo x={1357} y={729} misura={22} peso={700} colore={COLORE.inchiostro} ancora="middle">
        La tua azienda
      </Testo>
      <Testo x={1357} y={757} misura={19} colore={COLORE.testo} ancora="middle">
        appuntamenti, trattative e vendite · con il coaching ALC del lunedì sera
      </Testo>

      {/* Chiusura del foglio: la barra di ALC. */}
      <rect x={0} y={ALTEZZA_ACQUISIZIONE - 8} width={LARGHEZZA_ACQUISIZIONE} height={8} fill={COLORE.blu} />
    </g>
  );
}
