"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw } from "lucide-react";
import type { Cliente } from "@/types/kpi";
import { Button } from "@/components/ui/Button";
import { ConfermaEliminazioneModal } from "@/components/ui/ConfermaEliminazioneModal";
import { Nota } from "@/components/ui/Nota";

/**
 * Il link pubblico del cliente dentro Modifica cliente (09/10/2026): l'indirizzo della pagina che il
 * cliente apre senza password, da copiare, e — solo per l'amministratore — il pulsante per
 * rigenerarlo. Prima il link compariva una volta sola, quando il cliente veniva creato: dopo non si
 * ritrovava più dall'app, e un codice debole o finito in mani sbagliate si cambiava solo dal database.
 *
 * Rigenerare è irreversibile per chi ha il link di prima: smette di funzionare subito. Per questo
 * passa da una conferma che lo dice.
 */
export function LinkPubblicoCliente({ cliente, ruoloAdmin }: { cliente: Cliente; ruoloAdmin?: boolean }) {
  const router = useRouter();
  // Il codice appena rigenerato da qui: si vede subito, senza aspettare che la pagina rilegga il cliente.
  const [codiceNuovo, setCodiceNuovo] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);
  const [erroreCopia, setErroreCopia] = useState(false);
  const [confermaAperta, setConfermaAperta] = useState(false);

  const codice = codiceNuovo ?? cliente.accessCode;
  const link = codice ? `${typeof window !== "undefined" ? window.location.origin : ""}/report/${codice}` : "";

  async function copia() {
    setErroreCopia(false);
    try {
      await navigator.clipboard.writeText(link);
      setCopiato(true);
      setTimeout(() => setCopiato(false), 2500);
    } catch {
      // Senza permesso agli appunti il link resta selezionabile a mano nella casella qui sopra.
      setErroreCopia(true);
    }
  }

  async function rigenera() {
    const res = await fetch("/api/clienti/link-pubblico", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId: cliente.clienteId }),
    });
    const body = (await res.json().catch(() => ({}))) as { accessCode?: string; error?: string };
    if (!res.ok || !body.accessCode) throw new Error(body.error || "Il link non è stato rigenerato");
    setCodiceNuovo(body.accessCode);
    setCopiato(false);
    setConfermaAperta(false);
    router.refresh();
  }

  return (
    <div className="pt-4 border-t border-linea space-y-3">
      <div>
        <p className="text-base font-bold text-ink-900">Link pubblico</p>
        <p className="text-xs text-ink-500 mt-0.5">
          La pagina che il cliente apre senza password: chiunque abbia questo indirizzo vede i suoi numeri. Mandalo solo al cliente.
        </p>
      </div>

      {link ? (
        <div className="flex flex-wrap items-center gap-2">
          {/* Una casella di sola lettura: il link si può anche selezionare e copiare a mano. */}
          <input
            readOnly
            value={link}
            aria-label="Link pubblico del cliente"
            onFocus={(e) => e.currentTarget.select()}
            // Sta dentro il modulo di Modifica cliente: Invio qui non deve salvare il cliente.
            onKeyDown={(e) => {
              if (e.key === "Enter") e.preventDefault();
            }}
            className="min-h-10 min-w-0 flex-1 basis-64 rounded-lg border border-bordo-campo bg-surface px-3 py-2 font-mono text-xs text-ink-700"
          />
          <Button type="button" size="sm" variant="secondary" onClick={copia}>
            {copiato ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copiato ? "Copiato" : "Copia link"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-ink-700">Questo cliente non ha ancora un link pubblico.</p>
      )}
      {erroreCopia && <p className="text-xs text-critico">Non riesco a copiare negli appunti: seleziona il link e copialo a mano.</p>}

      {codiceNuovo && (
        <Nota tono="ok" etichetta="Link rigenerato" compatta role="status">
          <p>Il link di prima non funziona più. Manda al cliente quello nuovo qui sopra.</p>
        </Nota>
      )}

      {ruoloAdmin && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Button type="button" size="sm" variant={link ? "ghost" : "crea"} onClick={() => setConfermaAperta(true)}>
            <RefreshCw size={14} aria-hidden="true" />
            {link ? "Rigenera link" : "Crea link"}
          </Button>
          {link && <p className="text-xs text-ink-500">Se il link è finito a chi non doveva averlo, o è facile da indovinare.</p>}
        </div>
      )}

      {confermaAperta && (
        <ConfermaEliminazioneModal
          titolo={link ? "Rigenerare il link pubblico?" : "Creare il link pubblico?"}
          messaggio={
            link ? (
              <>
                <strong className="font-semibold text-ink-900">{cliente.nome}</strong> riceve un link nuovo. Quello di adesso smette di funzionare subito: chi lo ha salvato o ricevuto non vedrà più la
                pagina, e dovrai mandare al cliente il link nuovo. Non si può tornare indietro.
              </>
            ) : (
              <>
                Nasce la pagina pubblica di <strong className="font-semibold text-ink-900">{cliente.nome}</strong>: chi riceve il link la apre senza password.
              </>
            )
          }
          labelConferma={link ? "Rigenera il link" : "Crea il link"}
          labelInCorso={link ? "Rigenerazione…" : "Creazione…"}
          onClose={() => setConfermaAperta(false)}
          onConferma={rigenera}
        />
      )}
    </div>
  );
}
