"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";

/**
 * La striscia che tiene i filtri del tab KPI a portata di mano mentre si scorre (08/10/2026, scelta
 * dall'utente fra tre proposte): in cima alla pagina c'è la riga dei filtri di sempre; quando quella
 * riga è uscita dallo schermo, qui sotto la barra fissa compare una striscia bassa con gli stessi
 * filtri, in forma compatta. Così periodo e campagne si cambiano anche guardando i venditori in
 * fondo, senza tornare su.
 *
 * Come sta ferma: è un elemento "sticky" alto zero, quindi nella pagina non occupa spazio; il suo
 * contenuto sporge sotto di lui. Si ferma all'altezza della barra fissa della pagina, che ogni
 * pagina dichiara nella variabile `--barra-fissa` (DashboardShell.tsx per l'area del team, la pagina
 * del link pubblico per il cliente; senza variabile vale zero). Resta finché il suo contenitore — il
 * tab KPI — è sullo schermo.
 *
 * `rigaPiena` è la riga dei filtri in cima: la striscia compare quando il suo bordo inferiore è
 * salito sopra quell'altezza.
 */
export function StrisciaFiltri({ rigaPiena, children }: { rigaPiena: RefObject<HTMLElement | null>; children: ReactNode }) {
  const ancora = useRef<HTMLDivElement>(null);
  const striscia = useRef<HTMLDivElement>(null);
  const [visibile, setVisibile] = useState(false);

  useEffect(() => {
    let inAttesa = 0;
    function controlla() {
      inAttesa = 0;
      const riga = rigaPiena.current;
      const punto = ancora.current;
      if (!riga || !punto) return;
      const altezzaBarra = parseFloat(getComputedStyle(punto).top) || 0;
      const rigaUscita = riga.getBoundingClientRect().bottom <= altezzaBarra;
      // Con un selettore aperto nella striscia non la si toglie da sotto le mani, anche se scorrendo
      // la riga piena è tornata visibile: sparisce quando il selettore si chiude.
      const selettoreAperto = Boolean(striscia.current?.querySelector('[role="dialog"]'));
      setVisibile((prima) => rigaUscita || (prima && selettoreAperto));
    }
    // Una volta per fotogramma, non a ogni evento di scorrimento.
    function programma() {
      if (!inAttesa) inAttesa = requestAnimationFrame(controlla);
    }
    window.addEventListener("scroll", programma, { passive: true });
    window.addEventListener("resize", programma);
    // Quando un selettore della striscia si chiude non c'è scorrimento che faccia ricontrollare: lo
    // si vede da ciò che cambia dentro la striscia. Senza, tornati in cima con un selettore aperto la
    // striscia restava lì, doppione della riga piena, fino al primo movimento della pagina.
    const osservatore = new MutationObserver(programma);
    if (ancora.current) osservatore.observe(ancora.current, { childList: true, subtree: true });
    programma();
    return () => {
      window.removeEventListener("scroll", programma);
      window.removeEventListener("resize", programma);
      osservatore.disconnect();
      cancelAnimationFrame(inAttesa);
    };
  }, [rigaPiena]);

  return (
    <div ref={ancora} className="sticky z-20 h-0" style={{ top: "var(--barra-fissa, 0px)" }}>
      {visibile && (
        // La fascia di fondo copre ciò che scorre fra la barra fissa e la striscia.
        <div ref={striscia} className="bg-surface py-2">
          {/* `relative`: su telefono i pannelli dei selettori si allineano al bordo della striscia, non al loro pulsante (vedi `compatto` in DateRangePicker e CampagneFilter). */}
          <div role="group" aria-label="Filtri" className="relative flex flex-wrap items-center gap-2 rounded-xl border border-linea bg-surface-card px-2 py-1.5 shadow-[var(--shadow-card)] sm:px-3">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}
