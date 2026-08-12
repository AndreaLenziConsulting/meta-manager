import type { MeetingDataLoose } from "@/types/meeting";

/**
 * Riga per il foglio esterno "Report Operatività Clienti | CLIENTI ANDREA LENZI CONSULTING" —
 * porting di `save-to-sheet/route.ts` + `apps-script/Code.gs` di Fast Report. Stesse 12 colonne,
 * stesso ordine: il resto del team che già usa quel foglio non deve vedere alcuna differenza.
 *
 * Logica pura, nessun I/O — la scrittura vera è in `appendReportOperativita` (src/lib/sheets.ts).
 */

export function nowTimestamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`;
}

export function buildReportOperativitaRow(
  clienteNome: string,
  meeting: MeetingDataLoose,
  timestamp: string = nowTimestamp()
): (string | number)[] {
  return [
    timestamp,
    clienteNome, // MAI meeting.cliente — è testo libero da Fast Report, sempre ignorato (vedi types/meeting.ts)
    meeting.referente ?? "",
    meeting.dataConsulenza || meeting.date || "",
    meeting.taskSettimana ?? "",
    meeting.taskMese ?? "",
    meeting.programmaTrimestre ?? "",
    meeting.sentiment ?? "",
    meeting.kpiReali ?? "",
    meeting.kpiStorico ?? "",
    meeting.kpiTargetMarketing ?? "",
    meeting.kpiTargetCommerciali ?? "",
  ];
}
