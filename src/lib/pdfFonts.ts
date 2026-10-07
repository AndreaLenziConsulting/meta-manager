import path from "path";
import { Font } from "@react-pdf/renderer";
import { isHexValido, schiarisci } from "@/lib/colore";
import { isFontClienteValido, type CampiTema } from "@/lib/temaCliente";

/**
 * Font dei PDF generati: Montserrat, l'unica famiglia del Design System ALC (vedi globals.css e
 * layout.tsx), in quattro pesi — 400 testo, 500 etichette, 700 grassetto, 800 titoli. Fino al
 * 07/10/2026 erano League Spartan (titoli), Oswald (micro-etichette in maiuscolo) e Roboto (testo).
 *
 * File .ttf statici in public/fonts/ (letti da `process.cwd()` a runtime, nessuna chiamata di rete
 * durante la generazione del PDF: più affidabile di un fetch remoto in una funzione serverless).
 * react-pdf/fontkit non supporta i font variabili: i quattro file sono istanze statiche generate dal
 * font variabile di Google Fonts con `fonttools varLib.instancer`, ridotte ai caratteri latini
 * (lettere accentate italiane ed € compresi — verificato) e SENZA le legature (liga/calt/dlig/hlig).
 * Motivo delle legature tolte: react-pdf le applica di default e non permette di disattivarle; con
 * "liga" attiva "fi"/"fl" diventavano un unico glifo col mapping ToUnicode incompleto, e la "i"/"l"
 * sparivano dal testo copiato o estratto dal PDF (bug osservato: "infissi" → "infssi"). Un report
 * inviato a un prospect deve restare corretto anche quando il testo viene copiato altrove.
 */

// Tre nomi per tre ruoli (titoli, micro-etichette, testo): oggi sono la stessa famiglia, cambia il
// peso con cui i PDF la usano. I nomi restano distinti perché gli stili dei PDF li usano così.
export const FONT_HEADING = "Montserrat";
export const FONT_LABEL = "Montserrat";
export const FONT_BODY = "Montserrat";

// Font cliente personalizzato (vedi FONT_CLIENTE_DISPONIBILI in temaCliente.ts) — stesso
// trattamento .ttf statico subsettato del font ALC sopra (fonttools subset
// --layout-features-=liga,calt,dlig,hlig, scaricato da raw.githubusercontent.com/google/fonts,
// verificato coi caratteri accentati italiani e l'€ ancora presenti). Registrato sempre, anche
// per i PDF che di fatto non lo useranno mai: costa solo una registrazione in più, non un font in
// meno se un domani FONT_CLIENTE_DISPONIBILI cresce.
const FONT_POPPINS = "Poppins";
// DM Sans è distribuito da Google Fonts solo come font variabile (asse opsz+wght) — a differenza
// di Poppins qui i due .ttf non sono scaricati direttamente ma generati a parte con
// `fonttools varLib.instancer` (istanze statiche opsz=14/wght=400 e opsz=14/wght=700, gli stessi
// valori delle istanze nominate "Regular"/"Bold" del font sorgente) prima dello stesso subset
// --layout-features-=liga,calt,dlig,hlig di cui sopra — react-pdf/fontkit non supporta gli assi
// variabili, userebbe solo l'istanza di default (wght=400) anche per il testo in grassetto.
const FONT_DM_SANS = "DM Sans";
export const FONT_CLIENTE_PDF: Record<string, string> = { poppins: FONT_POPPINS, "dm-sans": FONT_DM_SANS };

let registrata = false;

function fontPath(file: string): string {
  return path.join(process.cwd(), "public", "fonts", file);
}

export function registraFontPdf(): void {
  if (registrata) return;
  registrata = true;

  // Nessuna sillabazione automatica: react-pdf spezza le parole con le regole dell'inglese, e nei
  // riquadri stretti venivano fuori "Giu-lia" e "men-sile". Una parola che non entra va a capo intera.
  Font.registerHyphenationCallback((parola) => [parola]);

  Font.register({
    family: FONT_BODY,
    fonts: [
      { src: fontPath("Montserrat-Regular.ttf"), fontWeight: 400 },
      { src: fontPath("Montserrat-Medium.ttf"), fontWeight: 500 },
      { src: fontPath("Montserrat-Bold.ttf"), fontWeight: 700 },
      { src: fontPath("Montserrat-ExtraBold.ttf"), fontWeight: 800 },
    ],
  });
  Font.register({
    family: FONT_POPPINS,
    fonts: [
      { src: fontPath("Poppins-Regular.ttf"), fontWeight: 400 },
      { src: fontPath("Poppins-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: FONT_DM_SANS,
    fonts: [
      { src: fontPath("DMSans-Regular.ttf"), fontWeight: 400 },
      { src: fontPath("DMSans-Bold.ttf"), fontWeight: 700 },
    ],
  });
}

export type TemaPdfCliente = {
  colore: string;
  coloreChiaro: string;
  coloreMedio: string;
  fontHeading: string;
  fontBody: string;
};

/**
 * Risolve i colori/font di un PDF legato a un cliente — oggi solo MeetingReportPdf.tsx (il Report
 * Commerciale resta sempre ai colori/font ALC di default: il prospect non ha ancora un cliente, e
 * i colori diversi per sezione lì sono voluti, non un brand da personalizzare). Stessa derivazione
 * di styleTemaCliente in temaCliente.ts (2 colori forniti -> le stesse varianti) ma valori hex
 * letterali invece di CSS custom properties, che react-pdf non può leggere. Ogni campo del cliente
 * (colorePrimario/coloreSecondario/fontPersonalizzato) è indipendente dagli altri, esattamente come
 * lì: un cliente può avere solo il colore o solo il font personalizzato, mai un tutto-o-niente.
 * `fallback` sono i colori ALC di default già cablati nel PDF chiamante (BRAND_COLOR/BRAND_SOFT/
 * BRAND_LIGHT) — passati dal chiamante invece che duplicati qui, un solo posto dove cambiare il
 * brand ALC di default. Il font personalizzato, quando valido, sostituisce SIA l'heading SIA il
 * body (stesso comportamento di styleTemaCliente: un font cliente si applica uniforme a titoli e
 * testo) — mai le micro-etichette (FONT_LABEL), tipografia strutturale del PDF e non un token di
 * brand del cliente.
 */
export function temaPdfCliente(cliente: CampiTema, fallback: Omit<TemaPdfCliente, "fontHeading" | "fontBody">): TemaPdfCliente {
  const fontClienteValido = isFontClienteValido(cliente.fontPersonalizzato);
  const fontCliente = fontClienteValido ? FONT_CLIENTE_PDF[cliente.fontPersonalizzato] : null;

  return {
    colore: isHexValido(cliente.colorePrimario) ? cliente.colorePrimario : fallback.colore,
    coloreChiaro: isHexValido(cliente.coloreSecondario) ? schiarisci(cliente.coloreSecondario, 0.85) : fallback.coloreChiaro,
    coloreMedio: isHexValido(cliente.coloreSecondario) ? schiarisci(cliente.coloreSecondario, 0.65) : fallback.coloreMedio,
    fontHeading: fontCliente ?? FONT_HEADING,
    fontBody: fontCliente ?? FONT_BODY,
  };
}
