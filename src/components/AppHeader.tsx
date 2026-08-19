import Image from "next/image";
import type { ReactNode } from "react";

/**
 * Il logo porta già il nome del brand (Andrea Lenzi Consulting) — niente "Meta Manager ALC" +
 * sottotitolo generico ridichiarati qui accanto (era il testo della primissima iterazione
 * dell'header, mai più rivisto). `subtitle` resta per i punti dove serve davvero un contesto
 * specifico (login: "Accesso team interno"; link pubblico cliente: il nome del cliente) — nessun
 * fallback: se non viene passato, semplicemente non compare nulla al posto suo.
 */
export function AppHeader({ subtitle, children }: { subtitle?: string; children?: ReactNode }) {
  return (
    <header className="bg-surface-card border-b border-ink-300/60 sticky top-0 z-10 backdrop-blur supports-[backdrop-filter]:bg-surface-card/85">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <Image
            src="/lenzi.webp"
            alt="Andrea Lenzi Consulting"
            width={132}
            height={44}
            priority
            className="object-contain h-9 w-auto flex-shrink-0"
          />
          {subtitle && (
            <>
              <div className="hidden sm:block w-px h-6 bg-ink-300/60 flex-shrink-0" />
              <p className="hidden sm:block text-sm font-semibold text-ink-700 truncate">{subtitle}</p>
            </>
          )}
        </div>
        {children && <div className="flex items-center gap-3 flex-shrink-0">{children}</div>}
      </div>
    </header>
  );
}
