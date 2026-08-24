import path from "path";
import { Font } from "@react-pdf/renderer";

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
}
