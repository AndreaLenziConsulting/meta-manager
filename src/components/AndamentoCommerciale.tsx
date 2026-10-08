"use client";

import { useMemo, useState } from "react";
import { PencilLine } from "lucide-react";
import { AndamentoVenditori } from "@/components/AndamentoVenditori";
import { PacingVenditoriChart } from "@/components/PacingVenditoriChart";
import { RisultatiVenditoriModal } from "@/components/RisultatiVenditoriModal";
import { SelettoreGrafico, type OpzioneGrafico } from "@/components/SelettoreGrafico";
import { Button } from "@/components/ui/Button";
import { costruisciAndamentoVenditori, venditoreDaGhl, type GhlPerVenditori, type RisultatoMensileVenditore } from "@/lib/andamentoVenditori";
import type { Venditore } from "@/types/kpi";

type Vista = "andamento" | "ritmo";

const OPZIONI: OpzioneGrafico<Vista>[] = [
  { id: "andamento", label: "Andamento venditori", descrizione: "Appuntamenti, vendite e fatturato di ogni venditore nel periodo scelto" },
  { id: "ritmo", label: "Ritmo sul target", descrizione: "Mese in corso: ogni venditore rispetto alla sua quota di target" },
];

/**
 * Il riquadro dei venditori in fondo al tab KPI. Dall'08/10/2026 è fatto come quello dei grafici del
 * marketing (BoxGrafici.tsx), su richiesta dell'utente: segue il periodo scelto in alto e ha la
 * stessa tendina per passare da un grafico all'altro. Per ora i grafici sono due:
 *   - "Andamento venditori" (nuovo, quello che si apre): totali e andamento nel periodo scelto, e
 *     per le campagne scelte (il filtro campagne vale anche qui dall'08/10/2026, scelta dell'utente);
 *   - "Ritmo sul target": la vista di prima, che guarda il mese in corso qualunque sia il periodo
 *     scelto in alto. Segue invece il filtro campagne (chiesto dall'utente l'08/10/2026).
 * Un grafico nuovo si aggiunge qui: una voce in OPZIONI e il suo componente sotto.
 *
 * Mai sul link pubblico del cliente: lo decide chi lo monta (KpiSection.tsx).
 */
export function AndamentoCommerciale({
  clienteId,
  sedeId,
  haConnessioneGhl,
  venditori,
  settimane,
  da,
  a,
  ghl,
  mensili,
  filtroCampagneAttivo,
  parametroCampagne,
  onRisultatiSalvati,
}: {
  clienteId: string;
  sedeId: string;
  haConnessioneGhl: boolean;
  /** I venditori attivi della sede, nell'ordine in cui sono configurati. */
  venditori: Venditore[];
  /** I lunedì delle settimane del periodo: la stessa griglia dei grafici del marketing. */
  settimane: string[];
  da: string;
  a: string;
  ghl: GhlPerVenditori;
  /** I risultati inseriti a mano, per i soli mesi interi nel periodo. */
  mensili: RisultatoMensileVenditore[];
  /** Vero se in alto è scelto un sottoinsieme di campagne (anche quello predefinito della sede). */
  filtroCampagneAttivo: boolean;
  /** Il valore di `campagne` che la pagina passa a /api/ghl: null = predefinito della sede. */
  parametroCampagne: string | null;
  onRisultatiSalvati: () => void;
}) {
  const [vista, setVista] = useState<Vista>("andamento");
  const [inserimentoAperto, setInserimentoAperto] = useState(false);
  const andamento = useMemo(
    () => costruisciAndamentoVenditori({ venditori, settimane, da, a, ghl, mensili, filtroCampagneAttivo }),
    [venditori, settimane, da, a, ghl, mensili, filtroCampagneAttivo]
  );
  const attiva = OPZIONI.find((o) => o.id === vista) ?? OPZIONI[0];
  // I risultati si inseriscono a mano solo per chi non arriva da GHL.
  const aMano = venditori.filter((v) => !venditoreDaGhl(v, ghl));

  return (
    <div className="rounded-xl border border-linea bg-surface-card shadow-[var(--shadow-card)] p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="font-heading text-xl leading-[26px] font-bold text-ink-900">{venditori.length === 0 ? "Venditori" : attiva.label}</h3>
        {venditori.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {/* GHL può metterci qualche secondo: oltre ai numeri attenuati, lo si dice anche a parole. */}
            {vista === "andamento" && andamento.inAggiornamento && (
              <span role="status" className="text-xs text-ink-500">
                Aggiornamento…
              </span>
            )}
            {aMano.length > 0 && (
              <Button variant="secondary" size="sm" onClick={() => setInserimentoAperto(true)}>
                <PencilLine size={14} aria-hidden="true" />
                Inserisci risultati
              </Button>
            )}
            <SelettoreGrafico opzioni={OPZIONI} selezionato={vista} onChange={setVista} />
          </div>
        )}
      </div>

      {venditori.length === 0 ? (
        <p className="text-sm text-ink-500">
          Nessun venditore configurato per questa sede. Si aggiungono da &quot;Modifica cliente&quot; (la matita accanto al nome), fra le impostazioni della sede.
        </p>
      ) : vista === "andamento" ? (
        <AndamentoVenditori andamento={andamento} />
      ) : (
        <PacingVenditoriChart
          clienteId={clienteId}
          sedeId={sedeId}
          haConnessioneGhl={haConnessioneGhl}
          parametroCampagne={parametroCampagne}
          filtroCampagneAttivo={filtroCampagneAttivo}
        />
      )}

      {inserimentoAperto && (
        <RisultatiVenditoriModal
          clienteId={clienteId}
          sedeId={sedeId}
          venditoriAMano={aMano.map((v) => ({ venditoreId: v.venditoreId, nome: v.nome }))}
          nomiDaGhl={venditori.filter((v) => venditoreDaGhl(v, ghl)).map((v) => v.nome)}
          onClose={() => setInserimentoAperto(false)}
          onSalvato={onRisultatiSalvati}
        />
      )}
    </div>
  );
}
