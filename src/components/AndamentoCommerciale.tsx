import { PacingVenditoriChart } from "@/components/PacingVenditoriChart";

/**
 * Blocco 8 del redesign KPI — era solo un segnaposto ("questa sezione arriverà più avanti", vedi
 * PlaceholderTab.tsx) finché non è esistito nulla da metterci. Riempito con "Performance venditori"
 * (Fase 2/4, 11/2026) su richiesta esplicita dell'utente (20/09/2026): prima viveva come quarta
 * opzione nella tendina grafici di BoxGrafici.tsx, spostato qui perché concettualmente è "andamento
 * commerciale" (persone, non spesa/lead/appuntamenti pubblicitari) — un blocco a sé, non un'opzione
 * in più tra i grafici ads. Stesso stile di intestazione (barretta + titolo) di BoxGrafici.tsx,
 * senza tendina: qui c'è un solo contenuto, non più scelte tra cui passare.
 *
 * Il contenuto vero (fetch, stati vuoti, override GHL) resta tutto in PacingVenditoriChart.tsx,
 * invariato — questo è solo il guscio della card. Stesso gate `clienteId` del chiamante (mai sul
 * link pubblico `code`): i venditori/target non sono mai esposti lì, vedi KpiSection.tsx.
 */
export function AndamentoCommerciale({
  clienteId,
  sedeId,
  haConnessioneGhl,
}: {
  clienteId: string;
  sedeId: string;
  haConnessioneGhl: boolean;
}) {
  return (
    <div className="rounded-[20px] border border-[var(--glass-border-soft)] bg-surface-card shadow-[var(--shadow-panel),inset_0_1px_0_var(--glass-highlight)] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1 h-5 rounded-full bg-brand" />
        <h3 className="font-heading font-bold text-ink-900 text-[15px]">Andamento commerciale</h3>
      </div>
      <PacingVenditoriChart clienteId={clienteId} sedeId={sedeId} haConnessioneGhl={haConnessioneGhl} />
    </div>
  );
}
