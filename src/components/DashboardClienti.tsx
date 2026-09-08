"use client";

import { useState } from "react";
import { Tabs } from "@/components/Tabs";
import { SaluteClienti } from "@/components/SaluteClienti";
import { ClientiPerConsulente } from "@/components/ClientiPerConsulente";
import type { SaluteClienteItem } from "@/lib/dashboardAdmin";
import type { Consulente } from "@/types/kpi";

type Vista = "priorita" | "consulente";

/**
 * Pagina Clienti unificata (ex Dashboard Amministratore + pagina Clienti, richiesta esplicita
 * dell'utente: "penso che siano inutili da avere entrambe") — dashboard/page.tsx passa qui gli
 * stessi item già scoped (clientiVisibili: tutti per l'admin, solo i propri per il consulente).
 *
 * Il toggle "Per priorità"/"Per consulente" è mostrato solo all'admin (`mostraToggle`): il
 * consulente vede sempre e solo i propri clienti, raggrupparli per consulente non aggiungerebbe
 * nulla — resta sempre sulla vista priorità, senza bisogno di stato per questo caso.
 */
export function DashboardClienti({
  items,
  consulenti,
  mostraToggle,
}: {
  items: SaluteClienteItem[];
  consulenti: Consulente[];
  mostraToggle: boolean;
}) {
  const [vista, setVista] = useState<Vista>("priorita");

  return (
    <div className="space-y-4">
      {mostraToggle && (
        <Tabs
          tabs={[
            { id: "priorita", label: "Per priorità" },
            { id: "consulente", label: "Per consulente" },
          ]}
          attivo={vista}
          onChange={(id) => setVista(id as Vista)}
        />
      )}

      {mostraToggle && vista === "consulente" ? (
        <ClientiPerConsulente items={items} consulenti={consulenti} />
      ) : (
        <SaluteClienti items={items} consulenti={consulenti} />
      )}
    </div>
  );
}
