"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Shell di un modale — overlay + pannello, estratta da ModificaClienteModal.tsx (l'unico modale
 * dell'app finora). Il montaggio/smontaggio resta a carico del chiamante (stesso pattern già in
 * uso: `{condizione && <Modal>...</Modal>}`), qui non c'è una prop `open`.
 */
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = "max-w-lg",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: string;
}) {
  return (
    // Overlay: chiude sul click fuori dal pannello. onMouseDown (non onClick) sul pannello ferma la
    // propagazione così un drag-select che parte dentro il form e finisce sopra l'overlay non chiude
    // accidentalmente il modale a metà modifica.
    //
    // Niente `items-center` qui: centrare verticalmente con align-items su un contenitore
    // overflow-y-auto è il classico bug "flexbox centering + scroll" — quando il pannello (es.
    // Modifica cliente con più sedi) eccede l'altezza della viewport, la parte che sporge SOPRA il
    // punto di centraggio smette di essere raggiungibile scrollando (il calcolo dell'area scrollabile
    // resta ancorato al centro, non al vero contenuto). Il pannello si centra invece con `my-auto`
    // sotto — stesso risultato visivo quando il contenuto è corto, ma senza clipping quando eccede.
    <div role="presentation" onClick={onClose} className="fixed inset-0 z-50 bg-black/40 flex justify-center p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={cn("w-full rounded-2xl border border-ink-300 bg-surface-card shadow-lg p-6 space-y-4 my-auto", maxWidth)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading font-bold text-ink-900">{title}</h3>
            {subtitle && <p className="text-xs text-ink-500 mt-0.5 font-mono">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-ink-500 hover:text-ink-900 text-xl leading-none cursor-pointer" aria-label="Chiudi">
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
