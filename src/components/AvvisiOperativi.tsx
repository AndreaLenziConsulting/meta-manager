"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { AvvisoOperativo, TonoAvviso } from "@/lib/avvisiOperativi";
import type { LivelloStato } from "@/lib/statusStyles";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Nota, type TonoNota } from "@/components/ui/Nota";
import { CLASSE_TITOLO_SEZIONE } from "@/components/ui/Intestazione";

const TONO_A_LIVELLO: Record<TonoAvviso, LivelloStato> = { attenzione: "attenzione", "da-sistemare": "critico", "da-sapere": "info" };
const TONO_A_NOTA: Record<TonoAvviso, TonoNota> = { attenzione: "attenzione", "da-sistemare": "critico", "da-sapere": "accento" };
const ETICHETTA_TONO: Record<TonoAvviso, string> = { attenzione: "attenzione", "da-sistemare": "da sistemare", "da-sapere": "da sapere" };
// Prima ciò che va sistemato, poi ciò che merita attenzione, in fondo le cose solo da sapere.
const ORDINE_TONO: TonoAvviso[] = ["da-sistemare", "attenzione", "da-sapere"];

/**
 * Avvisi operativi automatici del tab KPI. Il chiamante (KpiSection.tsx) li mostra solo al team
 * (`clienteId`): mai sul link pubblico `code`, mai per un ruolo commerciale.
 *
 * Stanno SOTTO le sei tessere dei numeri, non sopra (audit UX del 06/10/2026: quattro avvisi
 * spingevano i numeri fuori dalla prima schermata). Il riepilogo in testata è sempre visibile; il
 * pannello si apre da solo soltanto quando c'è qualcosa "da sistemare" — il resto si legge con un
 * clic. Una volta che la persona lo apre o lo chiude, resta come l'ha lasciato.
 */
export function AvvisiOperativi({ avvisi }: { avvisi: AvvisoOperativo[] }) {
  const [scelta, setScelta] = useState<boolean | null>(null);
  const idElenco = useId();
  const aperto = scelta ?? avvisi.some((a) => a.tono === "da-sistemare");

  const conteggi = ORDINE_TONO.map((tono) => ({ tono, count: avvisi.filter((a) => a.tono === tono).length })).filter(
    (c) => c.count > 0
  );
  const ordinati = ORDINE_TONO.flatMap((tono) => avvisi.filter((a) => a.tono === tono));

  if (avvisi.length === 0) {
    return (
      <Card className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h3 className={CLASSE_TITOLO_SEZIONE}>Avvisi operativi</h3>
        <p className="text-sm text-ink-500">Nessun avviso al momento.</p>
      </Card>
    );
  }

  return (
    <Card>
      <button
        type="button"
        onClick={() => setScelta(!aperto)}
        aria-expanded={aperto}
        aria-controls={idElenco}
        className="-m-2 flex w-[calc(100%+1rem)] min-h-11 items-center justify-between gap-3 rounded-lg p-2 text-left cursor-pointer hover:bg-surface transition-colors"
      >
        <span className="flex flex-wrap items-center gap-x-3 gap-y-2 min-w-0">
          <span className={CLASSE_TITOLO_SEZIONE}>Avvisi operativi</span>
          {conteggi.map((c) => (
            <Badge key={c.tono} tono={TONO_A_LIVELLO[c.tono]}>
              {c.count} {ETICHETTA_TONO[c.tono]}
            </Badge>
          ))}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-ink-500">
          {aperto ? "Nascondi" : "Mostra"}
          <ChevronDown size={18} aria-hidden="true" className={`transition-transform ${aperto ? "rotate-180" : ""}`} />
        </span>
      </button>

      {aperto && (
        <ul id={idElenco} className="mt-4 space-y-2.5">
          {ordinati.map((a) => (
            <li key={a.id}>
              <Nota tono={TONO_A_NOTA[a.tono]} etichetta={ETICHETTA_TONO[a.tono]} compatta>
                <p>
                  <strong className="font-bold text-ink-900">{a.titolo.replace(/[.:]$/, "")}.</strong> {a.messaggio}
                </p>
              </Nota>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
