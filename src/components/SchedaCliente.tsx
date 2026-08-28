"use client";

import { useState } from "react";
import { ClienteHeader } from "@/components/ClienteHeader";
import { Accordion, type AccordionItemDef } from "@/components/Accordion";
import { KpiSection } from "@/components/KpiSection";
import { AttivitaTab } from "@/components/AttivitaTab";
import { MeetingTab } from "@/components/MeetingTab";

type Props = {
  code?: string;
  clienteId?: string;
  clienteNome?: string;
  clienteEmail?: string;
  tuttiITab: boolean;
  // Se almeno una sede del cliente ha una connessione GHL/Squadd attiva — calcolato lato server in
  // dashboard/cliente/[clienteId]/page.tsx, stesso schema di come tuttiITab arriva dall'alto. Non
  // governa più un tab a parte (rimosso: l'utente lo trovava ridondante col tab KPI, che ora
  // mostra questi numeri direttamente — vedi kpiGhlOverlay.ts) ma dice a KpiSection se tentare
  // il fetch GHL per sostituire le sue tessere.
  haConnessioneGhl?: boolean;
  // Solo l'admin può collegare un ad account dal tab KPI (stesso gate di /api/sedi PATCH) — mai
  // sul link pubblico cliente (code), mai per un consulente che vede il cliente ma non può
  // modificarlo. Calcolato lato server in dashboard/cliente/[clienteId]/page.tsx.
  ruoloAdmin?: boolean;
};

export function SchedaCliente({ code, clienteId, clienteNome, clienteEmail, tuttiITab, haConnessioneGhl, ruoloAdmin }: Props) {
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
  const items: AccordionItemDef[] = [
    {
      id: "kpi",
      label: "KPI",
      content: <KpiSection code={code} clienteId={clienteId} haConnessioneGhl={haConnessioneGhl} ruoloAdmin={ruoloAdmin} />,
    },
    ...(!code
      ? [
          {
            id: "attivita",
            label: "Attività",
            content: clienteId ? <AttivitaTab clienteId={clienteId} onVaiAMeeting={vaiAMeeting} /> : null,
          },
        ]
      : []),
    ...(tuttiITab
      ? [
          {
            id: "meeting",
            label: "Meeting",
            content: (
              <MeetingTab
                code={code}
                clienteId={clienteId}
                clienteNome={clienteNome}
                clienteEmail={clienteEmail}
                meetingIdEvidenziato={meetingDaEvidenziare}
              />
            ),
          },
        ]
      : []),
  ];

  if (items.length === 1) {
    return <KpiSection code={code} clienteId={clienteId} haConnessioneGhl={haConnessioneGhl} ruoloAdmin={ruoloAdmin} />;
  }

  return (
    <div className="space-y-6">
      {/* Mai sul link pubblico (code): quella pagina ha già il proprio <h2> col nome cliente sopra
          SchedaCliente (src/app/report/[code]/page.tsx) — qui comparirebbe raddoppiato. */}
      {clienteId && clienteNome && <ClienteHeader clienteNome={clienteNome} />}

      <Accordion items={items} aperto={tabAttivo} onChange={setTabAttivo} />
    </div>
  );
}
