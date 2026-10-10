"use client";

import { useState } from "react";
import { Tabs } from "@/components/Tabs";
import type { CommercialiDiSede } from "@/lib/schemaTesto";
import { PROCESSI } from "@/components/processi/elenco";
import { VisualizzatoreSchema } from "@/components/processi/VisualizzatoreSchema";

/**
 * Sezione "Processi" della scheda cliente (richiesta dell'utente, 10/10/2026): gli schemi con cui il
 * consulente spiega al cliente come funziona il lavoro di marketing, da guardare insieme in call —
 * si spostano, si ingrandiscono e ci si può indicare un punto (vedi VisualizzatoreSchema.tsx).
 *
 * Solo per il team, come Attività e Vendita: sul link pubblico del cliente la sezione non esiste
 * (vedi SchedaCliente.tsx). Gli schemi sono gli stessi per ogni cliente e stanno nel codice
 * (processi/elenco.tsx). Del cliente entrano qui solo il nome e i commerciali registrati sulle sue sedi
 * (richieste dell'utente, 10/10/2026): gli schemi li scrivono dove parlano della sua azienda e di chi
 * vende, al posto di una dicitura generica.
 */
export function ProcessiTab({ clienteNome, commerciali }: { clienteNome?: string; commerciali?: CommercialiDiSede[] }) {
  const [scelto, setScelto] = useState(PROCESSI[0].id);
  const processo = PROCESSI.find((p) => p.id === scelto) ?? PROCESSI[0];

  return (
    <div className="space-y-4">
      {/* Con un solo schema non c'è nulla da scegliere. */}
      {PROCESSI.length > 1 && <Tabs tabs={PROCESSI.map((p) => ({ id: p.id, label: p.nome }))} attivo={processo.id} onChange={setScelto} etichetta="Processi" />}
      {/* `key`: cambiando schema il visualizzatore riparte da capo (schema intero, nessun segno). */}
      <VisualizzatoreSchema key={processo.id} titolo={processo.titolo} descrizione={processo.descrizione} larghezza={processo.larghezza} altezza={processo.altezza}>
        {processo.disegna({ nomeCliente: clienteNome, commerciali })}
      </VisualizzatoreSchema>
    </div>
  );
}
