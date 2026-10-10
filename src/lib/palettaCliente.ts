import { conContrasto, contrasto, luminanza, mescolaColori, rgba, schiarisci, scurisci, tintaConContrasto } from "@/lib/colore";

const BIANCO = "#ffffff";
const NERO = "#000000";

/**
 * Tutta la tavolozza di una scheda cliente, ricavata dai suoi due colori (richiesta dell'utente,
 * 10/10/2026: "sui clienti con branding personalizzato i loro due colori sovrascrivano tutti i
 * nostri"). Prima il cliente cambiava solo l'accento: titoli, testi, bordi, ombre e sfumature
 * restavano blu ALC.
 *
 * Ogni colore di marca di ALC ha il suo corrispondente:
 * - `blu` (accento: pulsanti, barre, schede attive) → il colore primario del cliente;
 * - `notte` e `inchiostro` (titoli, numeri, sezioni scure) → il più scuro dei due, scurito finché
 *   regge da titolo;
 * - `blu-luce` (accento sui fondi scuri) → il più chiaro dei due;
 * - `accento-tenue` (fondi leggeri) → il più chiaro dei due, schiarito;
 * - grigi di testo, bordi e fondo → tinte dello scuro del cliente, non più grigi azzurri;
 * - ombre, bagliori e sfumature → gli stessi disegni del sistema, coi colori del cliente.
 *
 * Restano di ALC per tutti: i colori di stato (`ok`, `attenzione`, `critico`) e il verde `crea`, che
 * dicono cosa succede e non di chi è la pagina; e le serie dei grafici, scelte per distinguersi.
 *
 * Il contrasto non è lasciato al caso: un colore chiaro come l'azzurro #00CCFF non regge un testo
 * bianco né si legge come testo su bianco. Ogni coppia testo/fondo qui sotto è calcolata per stare
 * sopra 4,5:1 (3:1 per i bordi dei campi), come chiede il Design System.
 *
 * Il risultato sono proprietà CSS da mettere sul contenitore della scheda (vedi temaCliente.ts): i
 * nomi sono quelli di globals.css, alias compresi (`--ink-900`, `--brand-primary`…), perché un alias
 * dichiarato sulla radice non si ricalcola da solo più in basso.
 */
export function palettaCliente(primario: string, secondario: string): Record<string, string> {
  const piuScuro = luminanza(primario) <= luminanza(secondario) ? primario : secondario;
  const piuChiaro = piuScuro === primario ? secondario : primario;

  // Lo scuro di marca: titoli e numeri, e la base delle sezioni scure.
  const inchiostro = conContrasto(piuScuro, BIANCO, 12, NERO);

  // L'accento che riempie i pulsanti. Testo bianco se si legge; se manca poco lo si scurisce appena
  // (resta il suo colore); se è un colore chiaro (azzurro, giallo) resta com'è e il testo va scuro.
  let accento = primario;
  let suAccento = BIANCO;
  if (contrasto(primario, BIANCO) < 4.5) {
    if (contrasto(scurisci(primario, 0.18), BIANCO) >= 4.5) {
      accento = conContrasto(primario, BIANCO, 4.5, NERO);
    } else {
      suAccento = contrasto(primario, inchiostro) >= 4.5 ? inchiostro : NERO;
    }
  }

  // Fondi leggeri e testo di accento, che deve leggersi anche sopra quei fondi.
  const tenue = schiarisci(piuChiaro, 0.85);
  const accentoTesto = conContrasto(primario, tenue, 4.5, NERO);
  const velata = schiarisci(accento, 0.94);

  // L'accento sui fondi scuri.
  const luce = conContrasto(piuChiaro, inchiostro, 3, BIANCO);
  const suLuce = contrasto(luce, inchiostro) >= 4.5 ? inchiostro : NERO;

  // Grigi: tinte dello scuro del cliente.
  const testo = tintaConContrasto(inchiostro, 9.3);
  const testoSecondario = tintaConContrasto(inchiostro, 5.3);
  const bordoCampo = tintaConContrasto(inchiostro, 3.3);
  const linea = schiarisci(inchiostro, 0.87);
  const sfondo = schiarisci(inchiostro, 0.96);
  const grigio = schiarisci(inchiostro, 0.72);

  // Sezioni scure.
  const notteSuperficie = mescolaColori(inchiostro, BIANCO, 0.1);
  const notteFondo = scurisci(inchiostro, 0.3);
  const suNotteSecondario = conContrasto(schiarisci(inchiostro, 0.6), inchiostro, 7, BIANCO);
  const accentoSuNotte = conContrasto(luce, inchiostro, 6, BIANCO);

  return {
    // Colori di marca.
    "--blu": accento,
    "--accento": accento,
    "--accento-testo": accentoTesto,
    "--su-accento": suAccento,
    "--blu-luce": luce,
    "--su-blu-luce": suLuce,
    "--notte": inchiostro,
    "--inchiostro": inchiostro,
    "--accento-tenue": tenue,
    "--superficie-velata": velata,
    "--focus": accentoTesto,
    // Scala dell'accento, dal più chiaro al pieno (funnel e percorsi).
    "--blu-10": schiarisci(accento, 0.9),
    "--blu-20": schiarisci(accento, 0.78),
    "--blu-40": schiarisci(accento, 0.58),
    "--blu-60": schiarisci(accento, 0.32),
    // Grigi.
    "--testo": testo,
    "--testo-secondario": testoSecondario,
    "--bordo-campo": bordoCampo,
    "--linea": linea,
    "--sfondo": sfondo,
    "--grigio": grigio,
    // Sezioni scure.
    "--notte-superficie": notteSuperficie,
    "--notte-fondo": notteFondo,
    "--su-notte-secondario": suNotteSecondario,
    "--accento-su-notte": accentoSuNotte,
    // Bordi, ombre e bagliori.
    "--bordo-card": rgba(inchiostro, 0.07),
    "--bordo-icona": rgba(accento, 0.35),
    "--shadow-card": `0 1px 2px ${rgba(inchiostro, 0.05)}, 0 10px 28px ${rgba(inchiostro, 0.09)}`,
    "--shadow-sollevata": `0 1px 2px ${rgba(inchiostro, 0.05)}, 0 18px 44px ${rgba(inchiostro, 0.14)}`,
    "--shadow-alta": `0 12px 32px ${rgba(inchiostro, 0.16)}`,
    "--glow-blu": `inset 0 1px 0 rgba(255,255,255,0.18), 0 6px 18px ${rgba(accento, 0.32)}`,
    "--glow-blu-alto": `inset 0 1px 0 rgba(255,255,255,0.22), 0 12px 28px ${rgba(accento, 0.32)}`,
    "--glow-luce": `inset 0 1px 0 rgba(255,255,255,0.28), 0 0 0 1px rgba(255,255,255,0.06), 0 10px 30px ${rgba(luce, 0.45)}`,
    "--glow-luce-alto": `inset 0 1px 0 rgba(255,255,255,0.3), 0 0 0 1px rgba(255,255,255,0.08), 0 16px 40px ${rgba(luce, 0.6)}`,
    "--anello-icona": `0 0 0 4px ${rgba(accento, 0.06)}`,
    // Sfumature.
    "--gradiente-pulsante": `linear-gradient(180deg,${schiarisci(accento, 0.12)} 0%,${accento} 100%)`,
    "--gradiente-pulsante-luce": `linear-gradient(180deg,${schiarisci(luce, 0.12)} 0%,${luce} 55%,${scurisci(luce, 0.08)} 100%)`,
    "--gradiente-barra": `linear-gradient(90deg,${accento} 0,${luce} 4px,transparent 4px)`,
    "--gradiente-velo-chiaro": `linear-gradient(180deg,${velata} 0%,#ffffff 38%)`,
    "--gradiente-cerchio-icona": `linear-gradient(180deg,${velata},${tenue})`,
    "--gradiente-notte": `linear-gradient(135deg,${notteSuperficie} 0%,${inchiostro} 42%,${notteFondo} 100%)`,
    "--alone-notte-alto": `radial-gradient(900px 480px at 100% 0%,${rgba(luce, 0.22)},transparent 60%)`,
    "--alone-notte-basso": `radial-gradient(700px 420px at 0% 100%,${rgba(notteSuperficie, 0.9)},transparent 60%)`,
    "--gradiente-testata": `linear-gradient(180deg,${inchiostro} 0%,${notteFondo} 100%)`,
    // Gli stessi colori coi nomi che l'app usa da sempre nelle classi.
    "--brand-primary": accento,
    "--brand-primary-dark": inchiostro,
    "--brand-primary-light": tenue,
    "--ink-900": inchiostro,
    "--ink-700": testo,
    "--ink-500": testoSecondario,
    "--ink-300": linea,
    "--surface": sfondo,
  };
}
