import path from "path";
import { Font } from "@react-pdf/renderer";
import { isHexValido, schiarisci } from "@/lib/colore";
import { isFontClienteValido, type CampiTema } from "@/lib/temaCliente";

/**
 * Registrazione dei font dell'immagine coordinata ALC (vedi globals.css/layout.tsx: League
 * Spartan Bold per i titoli, Roboto per i testi) nei PDF generati — prima erano su Helvetica (il
 * font di sistema di react-pdf, mai brandizzato). Aggiunto anche Oswald come alternativa per le
 * micro-etichette in maiuscolo (eyebrow, intestazioni di tabella, badge numerati): condensato,
 * pensato apposta per il testo in maiuscolo a corpo piccolo dove League Spartan (più largo/tondo)
 * risulterebbe meno leggibile.
 *
 * File .ttf statici (non i font variabili pubblicati da Google Fonts, che react-pdf/fontkit
 * renderizzerebbero alla sola istanza di default, spesso troppo leggera) scaricati una tantum da
 * fonts.gstatic.com e committati in public/fonts/ — stesso pattern di public/lenzi.webp (letti da
 * `process.cwd()` a runtime, nessuna chiamata di rete durante la generazione del PDF: più
 * affidabile di un fetch remoto in una funzione serverless, stesso principio già seguito per lo
 * scraping Playwright, vedi next.config.ts).
 *
 * I file sono stati ripuliti con `fonttools subset --layout-features-=liga,calt,dlig,hlig` prima
 * di essere committati (nessun glifo rimosso, solo le feature OpenType elencate — verificato: i
 * caratteri accentati italiani e l'€ restano tutti presenti). Motivo: react-pdf/fontkit applica le
 * legature standard di default e non espone alcuna opzione per disattivarle via style — con
 * "liga" attiva, "fi"/"fl"/"ffi"/"ffl" venivano sostituite con un unico glifo legatura il cui
 * mapping ToUnicode risultava incompleto, facendo sparire la "i"/"l" da testo copiato o estratto
 * dal PDF (bug osservato: "infissi" → "infssi", "qualificate" → "qualifcate"). Visivamente
 * innocuo (il glifo legatura è comunque disegnato correttamente), ma un report commerciale inviato
 * a un prospect deve restare corretto anche se il testo viene copiato altrove.
 */

export const FONT_HEADING = "League Spartan";
export const FONT_LABEL = "Oswald";
export const FONT_BODY = "Roboto";

// Font cliente personalizzato (oggi solo "poppins", vedi FONT_CLIENTE_DISPONIBILI in
// temaCliente.ts) — stesso trattamento .ttf statico subsettato dei font ALC sopra (fonttools
// subset --layout-features-=liga,calt,dlig,hlig, scaricato da
// raw.githubusercontent.com/google/fonts, verificato coi caratteri accentati italiani e l'€
// ancora presenti). Registrato sempre, anche per i PDF che di fatto non lo useranno mai (stesso
// principio già seguito per Oswald, usato solo da alcuni stili): costa solo una registrazione in
// più, non un font in meno se un domani FONT_CLIENTE_DISPONIBILI cresce.
const FONT_POPPINS = "Poppins";
export const FONT_CLIENTE_PDF: Record<string, string> = { poppins: FONT_POPPINS };

let registrata = false;

function fontPath(file: string): string {
  return path.join(process.cwd(), "public", "fonts", file);
}

export function registraFontPdf(): void {
  if (registrata) return;
  registrata = true;

  Font.register({
    family: FONT_HEADING,
    fonts: [{ src: fontPath("LeagueSpartan-Bold.ttf"), fontWeight: 700 }],
  });
  Font.register({
    family: FONT_LABEL,
    fonts: [
      { src: fontPath("Oswald-Medium.ttf"), fontWeight: 500 },
      { src: fontPath("Oswald-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: FONT_BODY,
    fonts: [
      { src: fontPath("Roboto-Regular.ttf"), fontWeight: 400 },
      { src: fontPath("Roboto-Medium.ttf"), fontWeight: 500 },
      { src: fontPath("Roboto-Bold.ttf"), fontWeight: 700 },
    ],
  });
  Font.register({
    family: FONT_POPPINS,
    fonts: [
      { src: fontPath("Poppins-Regular.ttf"), fontWeight: 400 },
      { src: fontPath("Poppins-Bold.ttf"), fontWeight: 700 },
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
 * testo, a differenza della coppia ALC League Spartan/Roboto) — mai FONT_LABEL/Oswald, micro-
 * tipografia strutturale del PDF, non un token di brand del cliente.
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
