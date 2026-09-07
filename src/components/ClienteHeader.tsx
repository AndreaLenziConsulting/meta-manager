import Link from "next/link";
import { ArrowLeft, Folder, ExternalLink } from "lucide-react";
import { LogoONomeCliente } from "@/components/LogoONomeCliente";

/**
 * Prima cosa visibile sulla scheda di un cliente: il nome (o il suo logo, se personalizzato — vedi
 * temaCliente.ts) e la via per tornare al menù di selezione clienti. Usa le prop passate da
 * page.tsx (risolte lato server, note subito) — non aspetta la risposta di /api/kpi come faceva
 * `dati.cliente.nome` in precedenza, così compare prima di qualunque fetch. Mai sul link pubblico
 * (`code`): quella pagina (src/app/report/[code]/page.tsx) ha già il proprio header col nome/logo
 * del cliente sopra SchedaCliente — qui comparirebbe raddoppiato.
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
  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Link
        href="/dashboard/clienti"
        aria-label="Torna ai clienti"
        title="Torna ai clienti"
        className="flex items-center justify-center w-9 h-9 rounded-xl border border-ink-300 bg-surface-card text-ink-500 hover:text-ink-900 hover:border-ink-400 transition shrink-0"
      >
        <ArrowLeft size={18} />
      </Link>
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
