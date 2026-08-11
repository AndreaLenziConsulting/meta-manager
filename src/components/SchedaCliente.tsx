"use client";

import { useState } from "react";
import { Tabs } from "@/components/Tabs";
import { PlaceholderTab } from "@/components/PlaceholderTab";
import { KpiDashboard } from "@/components/KpiDashboard";
import { AttivitaTab } from "@/components/AttivitaTab";

type Props = { code?: string; clienteId?: string; tuttiITab: boolean };

export function SchedaCliente({ code, clienteId, tuttiITab }: Props) {
  const [tabAttivo, setTabAttivo] = useState("kpi");

  // Attività è riservata al team: mai visibile sul link cliente pubblico (`code`), a prescindere da
  // mostra_tab_extra — che resta a governare solo Meeting. Il vero cancello è lato API (nessun ramo
  // `code` in /api/attivita), qui è solo la scelta di cosa mostrare.
  const tabs = [
    { id: "kpi", label: "KPI" },
    ...(!code ? [{ id: "attivita", label: "Attività" }] : []),
    ...(tuttiITab ? [{ id: "meeting", label: "Meeting" }] : []),
  ];

  if (tabs.length === 1) {
    return <KpiDashboard code={code} clienteId={clienteId} />;
  }

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} attivo={tabAttivo} onChange={setTabAttivo} />

      {tabAttivo === "kpi" && <KpiDashboard code={code} clienteId={clienteId} />}

      {tabAttivo === "attivita" && clienteId && <AttivitaTab clienteId={clienteId} />}

      {tabAttivo === "meeting" && (
        <PlaceholderTab
          titolo="Meeting in arrivo"
          descrizione="I meeting di questo cliente, integrati da Fast Report, arriveranno qui."
        />
      )}
    </div>
  );
}
