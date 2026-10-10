"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

const FOCUSABILI =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shell di un modale — overlay + pannello. Il montaggio/smontaggio resta a carico del chiamante
 * (`{condizione && <Modal>...</Modal>}`), qui non c'è una prop `open`.
 *
 * Comportamento da finestra di dialogo (audit UX del 06/10/2026: prima Esc non chiudeva, il focus
 * restava sul pulsante dietro e la pagina sotto continuava a scorrere):
 * - Esc chiude;
 * - all'apertura il focus entra nel pannello, Tab resta dentro, alla chiusura torna dov'era;
 * - la pagina sotto non scorre finché il modale è aperto.
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
  const pannello = useRef<HTMLDivElement>(null);
  // In un ref, così l'effetto sotto non riparte (rubando il focus) a ogni render del chiamante.
  const chiudi = useRef(onClose);
  useEffect(() => {
    chiudi.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const precedente = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    pannello.current?.focus();
    const overflowPrecedente = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function suTasto(e: KeyboardEvent) {
      const p = pannello.current;
      if (!p) return;
      // Solo il modale in cima reagisce: una conferma aperta sopra questo modale gestisce i suoi tasti.
      const dialoghi = document.querySelectorAll('[role="dialog"]');
      if (dialoghi[dialoghi.length - 1] !== p) return;
      if (e.key === "Escape") {
        e.stopPropagation();
        chiudi.current();
        return;
      }
      if (e.key !== "Tab") return;
      const focusabili = Array.from(p.querySelectorAll<HTMLElement>(FOCUSABILI)).filter((el) => el.offsetParent !== null);
      if (focusabili.length === 0) {
        e.preventDefault();
        return;
      }
      const primo = focusabili[0];
      const ultimo = focusabili[focusabili.length - 1];
      const attivo = document.activeElement;
      if (e.shiftKey && (attivo === primo || attivo === p)) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && attivo === ultimo) {
        e.preventDefault();
        primo.focus();
      } else if (!p.contains(attivo)) {
        e.preventDefault();
        primo.focus();
      }
    }
    document.addEventListener("keydown", suTasto);
    return () => {
      document.removeEventListener("keydown", suTasto);
      document.body.style.overflow = overflowPrecedente;
      precedente?.focus();
    };
  }, []);

  return (
    // Overlay: chiude sul click fuori dal pannello. onMouseDown (non onClick) sul pannello ferma la
    // propagazione così un drag-select che parte dentro il form e finisce sopra l'overlay non chiude
    // accidentalmente il modale a metà modifica.
    //
    // Niente `items-center` qui: centrare verticalmente con align-items su un contenitore
    // overflow-y-auto è il classico bug "flexbox centering + scroll" — quando il pannello eccede
    // l'altezza della viewport, la parte che sporge SOPRA il punto di centraggio smette di essere
    // raggiungibile scrollando. Il pannello si centra invece con `my-auto` sotto.
    <div role="presentation" onClick={onClose} className="fixed inset-0 z-50 bg-notte/50 flex justify-center p-4 overflow-y-auto">
      <div
        ref={pannello}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className={cn("w-full rounded-xl border border-bordo-card bg-surface-card shadow-[var(--shadow-alta)] p-6 space-y-4 my-auto outline-none", maxWidth)}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-heading text-xl leading-[26px] font-bold text-ink-900">{title}</h3>
            {subtitle && <p className="text-xs text-ink-500 mt-0.5 font-mono">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="-mr-2 -mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-ink-500 hover:bg-surface hover:text-ink-900 cursor-pointer transition-colors"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
