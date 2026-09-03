import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LogoONomeCliente } from "@/components/LogoONomeCliente";

/**
 * Prima cosa visibile sulla scheda di un cliente: il nome (o il suo logo, se personalizzato — vedi
 * temaCliente.ts) e la via per tornare al menù di selezione clienti. Usa le prop passate da
 * page.tsx (risolte lato server, note subito) — non aspetta la risposta di /api/kpi come faceva
 * `dati.cliente.nome` in precedenza, così compare prima di qualunque fetch. Mai sul link pubblico
 * (`code`): quella pagina (src/app/report/[code]/page.tsx) ha già il proprio header col nome/logo
 * del cliente sopra SchedaCliente — qui comparirebbe raddoppiato.
 */
export function ClienteHeader({ clienteNome, clienteLogoUrl }: { clienteNome: string; clienteLogoUrl?: string }) {
  return (
    <div className="flex items-center gap-3">
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
    </div>
  );
}
