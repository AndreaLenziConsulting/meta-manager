"use client";

import { useState } from "react";
import { ClienteHeader } from "@/components/ClienteHeader";
import { Accordion, type AccordionItemDef } from "@/components/Accordion";
import { KpiSection } from "@/components/KpiSection";
import { AttivitaTab } from "@/components/AttivitaTab";
import { MeetingTab } from "@/components/MeetingTab";
import { ProcessiTab } from "@/components/ProcessiTab";
import { ReportVenditaTab } from "@/components/ReportVenditaTab";
import type { Cliente, Consulente, Sede } from "@/types/kpi";
import type { CommercialiDiSede } from "@/lib/schemaTesto";

type Props = {
  code?: string;
  clienteId?: string;
  clienteNome?: string;
  clienteEmail?: string;
  clienteLogoUrl?: string;
  // Contesto anagrafico mostrato in ClienteHeader — calcolati/letti lato server in
  // dashboard/cliente/[clienteId]/page.tsx, mai sul link pubblico (code), stesso motivo del resto.
  settimanaProgetto?: number | null;
  driveFolderUrl?: string;
  // File di compilazione appuntamenti (get-or-create automatico, vedi ClienteHeader.tsx) — arriva
  // già letto da Cliente.appuntamentiFileUrl, stesso schema di driveFolderUrl sopra.
  appuntamentiFileUrl?: string;
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
  // Oggetto completo + sedi del cliente — servono solo al pennino "Modifica cliente" nell'header
  // (vedi ClienteHeader.tsx), assenti sul link pubblico (code) dove quel pennino non compare mai.
  cliente?: Cliente;
  sedi?: Sede[];
  // Elenco completo consulenti: alimenta sia l'autocomplete assegnatari del tab Attività (che usa
  // solo consulenteId/nome) sia il select "Consulente di riferimento" del pennino sopra (che usa
  // anche attivo) — un solo prop invece di due liste separate con la stessa fonte.
  consulenti?: Consulente[];
  // Nome del consulente della sessione corrente, per il quick-filter "Le mie task" del tab
  // Attività — vedi lo stesso prop in AttivitaTab.tsx.
  nomeConsulenteCorrente?: string;
  // Sezione da aprire, letta dall'indirizzo (`?tab=attivita`) lato server in
  // dashboard/cliente/[clienteId]/page.tsx. Assente = KPI.
  tabIniziale?: string;
  // I commerciali registrati sulle sedi del cliente (solo nomi), calcolati lato server: li citano
  // gli schemi della sezione Processi. Assenti sul link pubblico, dove quella sezione non c'è.
  commerciali?: CommercialiDiSede[];
};

export function SchedaCliente({
  code,
  clienteId,
  clienteNome,
  clienteEmail,
  clienteLogoUrl,
  settimanaProgetto,
  driveFolderUrl,
  appuntamentiFileUrl,
  tuttiITab,
  haConnessioneGhl,
  ruoloAdmin,
  cliente,
  sedi = [],
  consulenti = [],
  nomeConsulenteCorrente,
  tabIniziale,
  commerciali,
}: Props) {
  const [tabScelto, setTabScelto] = useState(tabIniziale ?? "kpi");
  // Click su un badge "Meeting" nel tab Attività: passa al tab Meeting e apre proprio quello.
  const [meetingDaEvidenziare, setMeetingDaEvidenziare] = useState<string | null>(null);

  // La sezione aperta sta anche nell'indirizzo (audit UX del 06/10/2026: ricaricando la pagina o
  // mandando il link a un collega si tornava sempre su KPI). `replaceState` e non `pushState`: il
  // tasto "indietro" continua a riportare all'elenco clienti, non alla sezione di prima. Solo
  // nell'area team: sul link pubblico `code` l'indirizzo resta quello consegnato al cliente.
  function apriTab(id: string) {
    setTabScelto(id);
    if (code) return;
    const url = new URL(window.location.href);
    if (id === "kpi") url.searchParams.delete("tab");
    else url.searchParams.set("tab", id);
    window.history.replaceState(null, "", url);
  }

  function vaiAMeeting(meetingId: string) {
    setMeetingDaEvidenziare(meetingId);
    apriTab("meeting");
  }

  // Attività è riservata al team: mai visibile sul link cliente pubblico (`code`), a prescindere da
  // mostra_tab_extra — che resta a governare solo Meeting. Il vero cancello è lato API (nessun ramo
  // `code` in /api/attivita), qui è solo la scelta di cosa mostrare.
  const items: AccordionItemDef[] = [
    {
      id: "kpi",
      label: "KPI",
      // Per KpiSection "ha una fonte commerciale da leggere" vale sia una connessione GHL sia un file
      // contatti collegato (01/10/2026, vedi lib/foglioContatti.ts): in entrambi i casi chiama
      // /api/ghl, che decide sede per sede quale delle due usare. ClienteHeader sotto riceve invece
      // il solo haConnessioneGhl: lì serve proprio sapere se c'è GHL, per mostrare o no il link al file.
      content: (
        <KpiSection
          code={code}
          clienteId={clienteId}
          haConnessioneGhl={Boolean(haConnessioneGhl) || Boolean(appuntamentiFileUrl)}
          ruoloAdmin={ruoloAdmin}
        />
      ),
    },
    ...(!code
      ? [
          {
            id: "attivita",
            label: "Attività",
            content: clienteId ? (
              <AttivitaTab
                // Assegnato un prodotto da "Modifica cliente", la scheda riparte e rilegge le attività: la roadmap appena nata compare subito.
                key={`${cliente?.prodottoId ?? ""}|${cliente?.dataInizioProgetto ?? ""}`}
                clienteId={clienteId}
                onVaiAMeeting={vaiAMeeting}
                consulenti={consulenti}
                nomeConsulenteCorrente={nomeConsulenteCorrente}
              />
            ) : null,
          },
          {
            id: "vendita",
            label: "Vendita",
            // Sola lettura, mai sul link pubblico — stesso gate `!code` di Attività sopra. Il
            // Calcolatore Budget compilato dal commerciale prima della vendita, altrimenti
            // irraggiungibile per il consulente: vedi ReportVenditaTab.tsx.
            content: clienteId ? <ReportVenditaTab clienteId={clienteId} /> : null,
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
                ruoloAdmin={ruoloAdmin}
              />
            ),
          },
        ]
      : []),
    // Processi: gli schemi con cui il consulente spiega il lavoro al cliente in call (10/10/2026).
    // Solo per il team, stesso cancello `!code` di Attività e Vendita; in fondo perché è materiale
    // di consultazione, non lavoro sul cliente. Del cliente usa solo il nome e i nomi dei suoi
    // commerciali: vedi ProcessiTab.tsx.
    ...(!code ? [{ id: "processi", label: "Processi", content: <ProcessiTab clienteNome={clienteNome} commerciali={commerciali} /> }] : []),
  ];

  // Un `?tab=` che non corrisponde a nessuna sezione visibile (scritto a mano, o di un ruolo che
  // quella sezione non la vede) vale KPI.
  const tabAttivo = items.some((i) => i.id === tabScelto) ? tabScelto : "kpi";

  if (items.length === 1) {
    return <KpiSection code={code} clienteId={clienteId} haConnessioneGhl={haConnessioneGhl} ruoloAdmin={ruoloAdmin} />;
  }

  // Mai sul link pubblico (code): quella pagina ha già il proprio <h2> col nome cliente sopra
  // SchedaCliente (src/app/report/[code]/page.tsx) — qui comparirebbe raddoppiato.
  const header =
    clienteId && clienteNome ? (
      <ClienteHeader
        clienteId={clienteId}
        clienteNome={clienteNome}
        clienteLogoUrl={clienteLogoUrl}
        settimanaProgetto={settimanaProgetto}
        driveFolderUrl={driveFolderUrl}
        appuntamentiFileUrl={appuntamentiFileUrl}
        haConnessioneGhl={haConnessioneGhl}
        ruoloAdmin={ruoloAdmin}
        cliente={cliente}
        sedi={sedi}
        consulenti={consulenti}
      />
    ) : null;

  return (
    <div className="space-y-6">
      {/* ClienteHeader porta torna-indietro + nome cliente nella barra sticky (via TopbarPortal) e
          restituisce anche la riga "Settimana N" + link rapidi — passata qui come `trailing` così
          finisce sulla STESSA riga delle tab sotto, allineata a destra (richiesta utente, 09/2026),
          invece che in una riga tutta sua sopra. */}
      <Accordion items={items} aperto={tabAttivo} onChange={apriTab} trailing={header} etichetta="Sezioni del cliente" />
    </div>
  );
}
