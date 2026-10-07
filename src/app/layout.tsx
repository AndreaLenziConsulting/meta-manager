import type { Metadata } from "next";
import { DM_Sans, Montserrat, Poppins } from "next/font/google";
import "./globals.css";

// Design System ALC: una sola famiglia, Montserrat, per titoli (extra-bold 800), testo e numeri.
// Font variabile: tutti i pesi da 100 a 900 in un solo file, più il corsivo (serve solo al
// sottotitolo delle intestazioni, l'unico corsivo ammesso dal sistema). Prima erano League Spartan
// per i titoli e Roboto per i testi.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

// Font di personalizzazione per-cliente (vedi FONT_CLIENTE_DISPONIBILI in src/lib/temaCliente.ts)
// — caricati sempre qui (next/font/google richiede un import statico per ognuno, non può caricare
// a runtime un nome font arbitrario), attivati solo per il cliente con fontPersonalizzato
// corrispondente via --font-montserrat sovrascritta a livello di pagina (vedi temaCliente.ts).
const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

// DM Sans su Google Fonts è distribuito solo come font variabile (asse opsz+wght, nessuna
// istanza statica) — a differenza di Poppins qui next/font/google lo serve così com'è
// (il browser interpola i pesi via CSS, nessun problema): la stessa cosa non vale per i PDF
// (react-pdf/fontkit userebbe la sola istanza di default), vedi le istanze statiche generate a
// parte per pdfFonts.ts/public/fonts/DMSans-*.ttf.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Ogni pagina dichiara il suo titolo ("Clienti", "Attività", il nome del cliente...): nella
  // scheda del browser diventa "Clienti · Meta Manager ALC". Prima era uguale su tutte le pagine.
  title: { default: "Meta Manager ALC", template: "%s · Meta Manager ALC" },
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
      className={`${montserrat.variable} ${poppins.variable} ${dmSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
