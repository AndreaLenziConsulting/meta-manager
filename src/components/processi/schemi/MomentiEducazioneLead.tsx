import { COLORE, FrecciaSpezzata, Rombo, Testo } from "@/components/processi/primitive";

/**
 * Schema "I momenti di educazione del lead" — dove si educa il cliente: prima l'attrazione (campagna
 * video e pre-sell), poi il processo di vendita, che è abilità consulenziale. Ridisegnato il
 * 10/10/2026 dallo schema dell'utente del 6 ottobre 2026 (su Drive, cartella 70 MQ:
 * `70MQ_Schema_MomentiEducazione.png`): stessi elementi e stesse parole, nessun dato del cliente.
 *
 * Colori: nell'originale le due fasi erano arancio e giallo; qui l'attrazione è ambra e l'abilità
 * consulenziale blu, i due toni che il sistema ALC ha per distinguerle.
 */
export const LARGHEZZA_EDUCAZIONE = 2000;
export const ALTEZZA_EDUCAZIONE = 984;

const Y_SNODO = 229;

export function MomentiEducazioneLead() {
  return (
    <g>
      <rect x={101} y={50} width={1797} height={81} rx={10} fill={COLORE.okTenue} stroke={COLORE.ok} strokeWidth={1.25} />
      <Testo x={1000} y={100} misura={28} peso={700} colore={COLORE.inchiostro} ancora="middle">
        Momenti di Educazione del LEAD
      </Testo>

      {/* Verso l'attrazione: campagna video e pre-sell. */}
      <FrecciaSpezzata punti={[[946, 131], [946, Y_SNODO], [334, Y_SNODO], [334, 302]]} spessore={2.5} misuraPunta={13} />
      <FrecciaSpezzata punti={[[748, Y_SNODO], [748, 464]]} spessore={2.5} misuraPunta={13} />
      {/* Verso il processo di vendita, e da lì all'abilità consulenziale. */}
      <FrecciaSpezzata punti={[[982, 131], [982, Y_SNODO], [1486, Y_SNODO], [1486, 320]]} spessore={2.5} misuraPunta={13} />
      <FrecciaSpezzata punti={[[1486, 679], [1486, 724], [1396, 724], [1396, 770]]} spessore={2.5} misuraPunta={13} />

      <Rombo cx={334} cy={428} mezzaLarghezza={180} mezzaAltezza={126} righe={["CAMPAGNA VIDEO", "ADS"]} />
      <Rombo cx={748} cy={590} mezzaLarghezza={162} mezzaAltezza={126} righe={["PRE-SELL"]} />
      <Rombo cx={1486} cy={499} mezzaLarghezza={252} mezzaAltezza={180} righe={["PROCESSO DI VENDITA"]} misura={31} />

      <rect x={101} y={788} width={808} height={142} rx={10} fill={COLORE.attenzioneTenue} stroke={COLORE.attenzione} strokeWidth={1.25} />
      <Testo x={505} y={871} misura={32} peso={800} colore={COLORE.inchiostro} ancora="middle">
        FASE dell&apos;ATTRAZIONE
      </Testo>

      <rect x={1073} y={770} width={717} height={142} rx={10} fill={COLORE.bluTenue} stroke={COLORE.blu} strokeWidth={1.25} />
      <text x={1431.5} y={853} fontSize={32} fontWeight={800} fill={COLORE.inchiostro} textAnchor="middle">
        ABILITÀ <tspan textDecoration="underline">CONSULENZIALE</tspan>
      </text>

      {/* Chiusura del foglio: la barra di ALC. */}
      <rect x={0} y={ALTEZZA_EDUCAZIONE - 8} width={LARGHEZZA_EDUCAZIONE} height={8} fill={COLORE.blu} />
    </g>
  );
}
