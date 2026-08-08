"use client";

import { useState } from "react";
import { Tabs } from "@/components/Tabs";
import { PlaceholderTab } from "@/components/PlaceholderTab";
import { KpiDashboard } from "@/components/KpiDashboard";

const TABS = [
  { id: "kpi", label: "KPI" },
  { id: "attivita", label: "Attività" },
  { id: "meeting", label: "Meeting" },
];

type Props = { code?: string; clienteId?: string; tuttiITab: boolean };

export function SchedaCliente({ code, clienteId, tuttiITab }: Props) {
  const [tabAttivo, setTabAttivo] = useState("kpi");

  if (!tuttiITab) {
    return <KpiDashboard code={code} clienteId={clienteId} />;
  }

  return (
    <div className="space-y-6">
      <Tabs tabs={TABS} attivo={tabAttivo} onChange={setTabAttivo} />

      {tabAttivo === "kpi" && <KpiDashboard code={code} clienteId={clienteId} />}

      {tabAttivo === "attivita" && (
        <PlaceholderTab
          titolo="Attività in arrivo"
          descrizione="Le attività da fare per questo cliente arriveranno qui."
        />
      )}

      {tabAttivo === "meeting" && (
        <PlaceholderTab
          titolo="Meeting in arrivo"
          descrizione="I meeting di questo cliente, integrati da Fast Report, arriveranno qui."
        />
      )}
    </div>
  );
}
