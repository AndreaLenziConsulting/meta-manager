import type { Metadata } from "next";
import { DM_Sans, League_Spartan, Poppins, Roboto } from "next/font/google";
import "./globals.css";

// Immagine coordinata Andrea Lenzi Consulting: titoli in League Spartan Bold, testo in Roboto.
const leagueSpartan = League_Spartan({
  variable: "--font-league-spartan",
  weight: ["700"],
  subsets: ["latin"],
});

const roboto = Roboto({
  variable: "--font-roboto",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

// Font di personalizzazione per-cliente (vedi FONT_CLIENTE_DISPONIBILI in src/lib/temaCliente.ts)
// — caricati sempre qui (next/font/google richiede un import statico per ognuno, non può caricare
// a runtime un nome font arbitrario), attivati solo per il cliente con fontPersonalizzato
// corrispondente via --font-heading/--font-sans sovrascritte a livello di pagina.
const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

// DM Sans su Google Fonts è distribuito solo come font variabile (asse opsz+wght, nessuna
// istanza statica) — a differenza di Poppins/Roboto qui next/font/google lo serve così com'è
// (il browser interpola i pesi via CSS, nessun problema): la stessa cosa non vale per i PDF
// (react-pdf/fontkit userebbe la sola istanza di default), vedi le istanze statiche generate a
// parte per pdfFonts.ts/public/fonts/DMSans-*.ttf.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Meta Manager ALC",
  description: "Dashboard KPI automatizzata da Meta Ads — Andrea Lenzi Consulting",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className={`${leagueSpartan.variable} ${roboto.variable} ${poppins.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
