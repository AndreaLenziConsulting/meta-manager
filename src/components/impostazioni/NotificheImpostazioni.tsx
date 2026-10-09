"use client";

import { useEffect, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Nota } from "@/components/ui/Nota";

/** Come torna GET /api/impostazioni/riepilogo. */
type Anteprima = { oggetto: string; html: string; clientiDaGuardare: number; destinatari: string[] };
type Esito = { tipo: "ok"; testo: string } | { tipo: "errore"; testo: string };

/**
 * Sezione "Notifiche" delle Impostazioni (09/10/2026): il riepilogo via email per l'amministrazione,
 * ultima voce della Fase 1 della roadmap. Dice quando parte e a chi, mostra l'email com'è in questo
 * momento e permette di mandarla subito — il modo più semplice per vedere com'è fatta e per
 * accorgersi se l'invio non funziona, senza aspettare il lunedì.
 */
export function NotificheImpostazioni() {
  const [anteprima, setAnteprima] = useState<Anteprima | null>(null);
  const [erroreLettura, setErroreLettura] = useState<string | null>(null);
  const [inviando, setInviando] = useState(false);
  const [esito, setEsito] = useState<Esito | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/impostazioni/riepilogo", { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Non riesco a comporre il riepilogo");
        setAnteprima(body as Anteprima);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErroreLettura(err instanceof Error ? err.message : "Errore sconosciuto");
      });
    return () => controller.abort();
  }, []);

  async function mandaOra() {
    setEsito(null);
    setInviando(true);
    try {
      const res = await fetch("/api/impostazioni/riepilogo", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { destinatari?: number; error?: string };
      if (!res.ok) throw new Error(body.error || "L'email non è partita");
      setEsito({ tipo: "ok", testo: body.destinatari === 1 ? "Email mandata. Controlla la casella." : `Email mandata a ${body.destinatari} indirizzi.` });
    } catch (err) {
      setEsito({ tipo: "errore", testo: err instanceof Error ? err.message : "Errore sconosciuto" });
    } finally {
      setInviando(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card padding="lg" className="space-y-4">
        <div>
          <h2 className="font-heading text-xl leading-[26px] font-bold text-ink-900">Riepilogo per l&apos;amministrazione</h2>
          <p className="mt-1 text-sm leading-[22px] text-ink-500">
            Un&apos;email con i clienti che richiedono attenzione, senza aprire l&apos;app: costo per lead oltre il target, attività in ritardo, clima degli incontri negativo, dati Meta fermi. È lo
            stesso quadro della pagina Clienti. Arriva anche quando non c&apos;è nulla da segnalare, e lo dice.
          </p>
        </div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-500">Quando</dt>
          <dd className="font-semibold text-ink-900">Ogni lunedì mattina</dd>
          <dt className="text-ink-500">A chi</dt>
          <dd className="font-semibold text-ink-900 break-all">{anteprima ? anteprima.destinatari.join(", ") : "…"}</dd>
        </dl>

        {esito && (
          <Nota tono={esito.tipo === "ok" ? "ok" : "critico"} etichetta={esito.tipo === "ok" ? "Mandata" : "Non mandata"} compatta role={esito.tipo === "ok" ? "status" : "alert"}>
            <p>{esito.testo}</p>
          </Nota>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-linea">
          <Button onClick={mandaOra} disabled={inviando || !anteprima}>
            <Send size={16} aria-hidden="true" />
            {inviando ? "Invio…" : "Manda ora"}
          </Button>
          <p className="text-xs text-ink-500">Manda subito l&apos;email qui sotto agli indirizzi indicati, senza aspettare lunedì.</p>
        </div>
      </Card>

      <Card padding="lg" className="space-y-3">
        <h2 className="font-heading text-xl leading-[26px] font-bold text-ink-900">Com&apos;è adesso</h2>
        {erroreLettura ? (
          <Nota tono="critico" etichetta="Riepilogo non composto" compatta role="alert">
            <p>{erroreLettura}</p>
          </Nota>
        ) : !anteprima ? (
          <p role="status" className="text-sm text-ink-500">
            Composizione del riepilogo…
          </p>
        ) : (
          <>
            <p className="text-sm text-ink-700">
              <span className="text-ink-500">Oggetto:</span> <strong className="font-semibold text-ink-900">{anteprima.oggetto}</strong>
            </p>
            {/* In una cornice a sé, senza script: si vede com'è nella posta, e gli stili dell'app non la toccano. */}
            <iframe title="Anteprima dell'email di riepilogo" sandbox="" srcDoc={anteprima.html} className="h-[520px] w-full rounded-lg border border-linea bg-white" />
            <p className="text-xs text-ink-500">Nell&apos;anteprima i link non si aprono: nell&apos;email portano alla scheda del cliente.</p>
          </>
        )}
      </Card>
    </div>
  );
}
