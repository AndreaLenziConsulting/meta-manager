"use client";

import { useState } from "react";
import { Tabs } from "@/components/Tabs";
import { NotificheImpostazioni } from "@/components/impostazioni/NotificheImpostazioni";
import { ProdottiImpostazioni } from "@/components/impostazioni/ProdottiImpostazioni";
import { SquadraImpostazioni } from "@/components/impostazioni/SquadraImpostazioni";
import type { PersonaSquadra, ProdottoConModello } from "@/components/impostazioni/tipi";

const SEZIONI = [
  { id: "squadra", label: "Squadra" },
  { id: "prodotti", label: "Prodotti e modelli" },
  { id: "notifiche", label: "Notifiche" },
];

/**
 * Le sezioni della pagina Impostazioni. La sezione aperta sta nell'indirizzo (`?sezione=`), come
 * la scheda cliente fa con `?tab=`: ricaricando la pagina o mandando il link si torna lì.
 */
export function Impostazioni({ squadra, prodotti, sezioneIniziale }: { squadra: PersonaSquadra[]; prodotti: ProdottoConModello[]; sezioneIniziale?: string }) {
  const [sezione, setSezione] = useState(SEZIONI.some((s) => s.id === sezioneIniziale) ? (sezioneIniziale as string) : "squadra");

  function cambiaSezione(id: string) {
    setSezione(id);
    const url = new URL(window.location.href);
    if (id === "squadra") url.searchParams.delete("sezione");
    else url.searchParams.set("sezione", id);
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="space-y-6">
      <Tabs etichetta="Sezioni delle impostazioni" tabs={SEZIONI} attivo={sezione} onChange={cambiaSezione} />
      {sezione === "squadra" ? (
        <SquadraImpostazioni squadra={squadra} />
      ) : sezione === "prodotti" ? (
        <ProdottiImpostazioni prodotti={prodotti} nomiConsulenti={squadra.filter((p) => p.ruolo === "consulente" && p.attivo).map((p) => p.nome)} />
      ) : (
        <NotificheImpostazioni />
      )}
    </div>
  );
}
