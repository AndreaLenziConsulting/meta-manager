"use client";

import { useState } from "react";
import { Tabs } from "@/components/Tabs";
import { KpiDashboard } from "@/components/KpiDashboard";
import { AttivitaTab } from "@/components/AttivitaTab";
import { MeetingTab } from "@/components/MeetingTab";
import { GhlPanel } from "@/components/GhlPanel";

type Props = {
  code?: string;
  clienteId?: string;
  clienteNome?: string;
  clienteEmail?: string;
  tuttiITab: boolean;
  // Fase 1 dell'integrazione GHL/Squadd: tab mostrato solo se almeno una sede del cliente ha una
  // connessione attiva — calcolato lato server in dashboard/cliente/[clienteId]/page.tsx, stesso
  // schema di come tuttiITab arriva dall'alto.
  haConnessioneGhl?: boolean;
};

export function SchedaCliente({ code, clienteId, clienteNome, clienteEmail, tuttiITab, haConnessioneGhl }: Props) {
  const [tabAttivo, setTabAttivo] = useState("kpi");
  // Click su un badge "Meeting" nel tab Attività: passa al tab Meeting e apre proprio quello.
  const [meetingDaEvidenziare, setMeetingDaEvidenziare] = useState<string | null>(null);

  function vaiAMeeting(meetingId: string) {
    setMeetingDaEvidenziare(meetingId);
    setTabAttivo("meeting");
  }

  // Attività è riservata al team: mai visibile sul link cliente pubblico (`code`), a prescindere da
  // mostra_tab_extra — che resta a governare solo Meeting. Il vero cancello è lato API (nessun ramo
  // `code` in /api/attivita), qui è solo la scelta di cosa mostrare.
  const tabs = [
    { id: "kpi", label: "KPI" },
    ...(!code ? [{ id: "attivita", label: "Attività" }] : []),
    ...(tuttiITab ? [{ id: "meeting", label: "Meeting" }] : []),
    // Mai sul link pubblico cliente (stesso motivo di Attività): dato GHL non ancora validato
    // quanto il Funnel, resta un pannello solo per il team finché non lo sarà.
    ...(!code && haConnessioneGhl ? [{ id: "ghl", label: "Vendite (GHL)" }] : []),
  ];

  if (tabs.length === 1) {
    return <KpiDashboard code={code} clienteId={clienteId} />;
  }

  return (
    <div className="space-y-6">
      <Tabs tabs={tabs} attivo={tabAttivo} onChange={setTabAttivo} />

      {tabAttivo === "kpi" && <KpiDashboard code={code} clienteId={clienteId} />}

      {tabAttivo === "attivita" && clienteId && <AttivitaTab clienteId={clienteId} onVaiAMeeting={vaiAMeeting} />}

      {tabAttivo === "meeting" && (
        <MeetingTab
          code={code}
          clienteId={clienteId}
          clienteNome={clienteNome}
          clienteEmail={clienteEmail}
          meetingIdEvidenziato={meetingDaEvidenziare}
        />
      )}

      {tabAttivo === "ghl" && clienteId && <GhlPanel clienteId={clienteId} />}
    </div>
  );
}
