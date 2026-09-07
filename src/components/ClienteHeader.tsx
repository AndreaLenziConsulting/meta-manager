"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Folder, ExternalLink } from "lucide-react";
import { LogoONomeCliente } from "@/components/LogoONomeCliente";

/**
 * Prima cosa visibile sulla scheda di un cliente: il nome (o il suo logo, se personalizzato — vedi
 * temaCliente.ts) e la via per tornare indietro. Usa le prop passate da page.tsx (risolte lato
 * server, note subito) — non aspetta la risposta di /api/kpi come faceva `dati.cliente.nome` in
 * precedenza, così compare prima di qualunque fetch. Mai sul link pubblico (`code`): quella pagina
 * (src/app/report/[code]/page.tsx) ha già il proprio header col nome/logo del cliente sopra
 * SchedaCliente — qui comparirebbe raddoppiato.
 *
 * "Torna indietro" usa router.back() (cronologia del browser), non più un link fisso a
 * /dashboard/clienti: si arriva a una scheda cliente sia dalla pagina Clienti sia dalla Dashboard
 * Amministratore (le card di SaluteClienti.tsx), e "indietro" deve tornare a quella di partenza,
 * non sempre alla stessa. Fallback a /dashboard/clienti solo se non c'è cronologia (arrivo diretto
 * via URL, link pubblico incluso raro ma possibile).
 *
 * `settimanaProgetto`/`driveFolderUrl`/`landingPageUrl` sono le stesse aggiunte "anagrafiche" del
 * cliente (mai sul link pubblico, stesso motivo del resto dell'header) — link rapidi e contesto
 * temporale che il consulente vuole avere sotto mano senza aprire "Modifica cliente".
 */
export function ClienteHeader({
  clienteNome,
  clienteLogoUrl,
  settimanaProgetto,
  driveFolderUrl,
  landingPageUrl,
}: {
  clienteNome: string;
  clienteLogoUrl?: string;
  settimanaProgetto?: number | null;
  driveFolderUrl?: string;
  landingPageUrl?: string;
}) {
  const router = useRouter();

  function tornaIndietro() {
    // history.length === 1 -> questa scheda era la prima voce di cronologia della sessione (arrivo
    // diretto via URL/bookmark): router.back() non avrebbe nessun posto dove tornare.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard/clienti");
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={tornaIndietro}
        aria-label="Torna indietro"
        title="Torna indietro"
        className="flex items-center justify-center w-9 h-9 rounded-xl border border-ink-300 bg-surface-card text-ink-500 hover:text-ink-900 hover:border-ink-400 transition shrink-0 cursor-pointer"
      >
        <ArrowLeft size={18} />
      </button>
      <h1>
        <LogoONomeCliente
          nome={clienteNome}
          logoUrl={clienteLogoUrl}
          className={clienteLogoUrl ? "h-9 w-auto object-contain" : "font-heading font-bold text-2xl text-ink-900"}
        />
      </h1>

      {Boolean(settimanaProgetto) && (
        <span className="text-xs font-semibold text-ink-500 bg-surface-card border border-ink-300 rounded-full px-3 py-1">
          Settimana {settimanaProgetto}
        </span>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {driveFolderUrl && (
          <a
            href={driveFolderUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Apri la cartella Drive del cliente"
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-700 bg-surface-card border border-ink-300 rounded-full px-3 py-1.5 hover:border-brand hover:text-brand transition"
          >
            <Folder size={14} /> Drive
          </a>
        )}
        {landingPageUrl && (
          <a
            href={landingPageUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Apri la landing page del cliente"
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-700 bg-surface-card border border-ink-300 rounded-full px-3 py-1.5 hover:border-brand hover:text-brand transition"
          >
            <ExternalLink size={14} /> Landing page
          </a>
        )}
      </div>
    </div>
  );
}
