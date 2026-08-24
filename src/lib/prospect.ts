import { createHash } from "node:crypto";

/**
 * Id deterministico del report — stesso pattern di hashMeetingId in src/lib/meeting.ts: stesso
 * prospect + stesso link -> stesso reportId, rende il salvataggio un upsert naturale invece che
 * dover distinguere "nuovo report" da "correzione di un report già estratto" a mano.
 */
export function hashReportId(prospectId: string, rawUrl: string): string {
  const hash = createHash("sha1").update(rawUrl).digest("hex").slice(0, 8);
  return `${prospectId}::${hash}`;
}
