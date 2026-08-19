import type { Metadata } from "next";
import { League_Spartan, Roboto } from "next/font/google";
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
      className={`${leagueSpartan.variable} ${roboto.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
