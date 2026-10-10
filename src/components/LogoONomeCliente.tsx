"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

const MISURA = {
  // Barra in alto della scheda cliente (alta 56px): riquadro di 44px, nome in `titolo-3`.
  barra: {
    riquadro: "h-11 min-w-11 max-w-[9.5rem] rounded-[10px] p-1",
    nome: "font-heading text-xl leading-[26px] font-extrabold text-ink-900",
  },
  // Testata del link pubblico del cliente: riquadro di 88px, nome in `titolo-2`.
  pagina: {
    riquadro: "h-[5.5rem] min-w-[5.5rem] max-w-[15rem] rounded-xl p-1.5",
    nome: "font-heading text-[28px] leading-[34px] font-extrabold text-ink-900",
  },
} as const;

/**
 * Identità del cliente in testa alle sue schermate: il logo, se c'è, e il nome.
 *
 * Il logo sta in un riquadro bianco pensato per un logo QUADRATO (richiesta dell'utente, 10/10/2026:
 * "molti lo sono"): prima era una striscia alta 32-40px, dove un logo quadrato diventava un
 * francobollo. Ora un quadrato riempie il riquadro; un logo largo lo allarga fino a un massimo e
 * resta alto uguale, così i due pesano allo stesso modo. Fondo bianco e bordo leggero: i loghi
 * nascono per un fondo chiaro, e quelli senza trasparenza ci si confondono invece di fare un
 * rettangolo a sé.
 *
 * Il nome resta sempre scritto accanto: un logo quadrato è spesso un simbolo, che da solo non dice
 * di chi è la pagina. Per questo l'immagine è decorativa (`alt` vuoto): il nome lo legge il testo.
 *
 * `logoUrl` qui è l'indirizzo di `/api/logo` (vedi indirizzoLogo in src/lib/logoCliente.ts), che
 * restituisce il logo già rifilato dai margini vuoti: un quadrato col disegno piccolo al centro
 * riempie il riquadro invece di restarci sperduto. Se il rifilo non riesce, quell'indirizzo rimanda
 * all'originale. Un <img> normale, non next/image: non c'è nulla da ottimizzare oltre.
 *
 * Se il logo non si carica (l'indirizzo salvato non esiste più: capita quando il cliente rifà il
 * sito) il riquadro sparisce e resta il nome, invece di un riquadro vuoto.
 */
export function LogoONomeCliente({ nome, logoUrl, misura = "barra" }: { nome: string; logoUrl?: string; misura?: keyof typeof MISURA }) {
  const stile = MISURA[misura];
  // L'indirizzo che non si è caricato: se poi il logo cambia, il nuovo viene riprovato.
  const [nonCaricato, setNonCaricato] = useState<string | null>(null);
  return (
    <span className="flex min-w-0 items-center gap-3">
      {logoUrl && nonCaricato !== logoUrl && (
        <span className={cn("flex shrink-0 items-center justify-center overflow-hidden border border-bordo-card bg-white shadow-sm", stile.riquadro)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- indirizzo esterno qualunque, dai dati: vedi il commento sopra */}
          <img src={logoUrl} alt="" onError={() => setNonCaricato(logoUrl)} className="block h-full w-auto max-w-full object-contain" />
        </span>
      )}
      <span className={cn("min-w-0 truncate", stile.nome)}>{nome}</span>
    </span>
  );
}
