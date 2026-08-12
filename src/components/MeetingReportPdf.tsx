import { Document, Page, Text, View, StyleSheet, Link, Image as PDFImage } from "@react-pdf/renderer";
import React from "react";
import type { MeetingDataLoose } from "@/types/meeting";

/**
 * Componente PDF del report meeting — porting fedele di `ReportPDF` in Fast Report
 * (`generate-pdf/route.ts`), stesso stile/sezioni. Scritto con `React.createElement` (niente JSX
 * diretto) per lo stesso motivo di Fast Report: evita rogne di JSX transform dentro una route API.
 *
 * Differenze dal porting originale, imposte da `MeetingDataLoose` (tutti i campi opzionali):
 * - accesso sempre difensivo (`?? ""` / `?? []`) — Fast Report assumeva i campi sempre presenti;
 * - `clienteNome` è una prop separata, risolta server-side da `clienteId` — mai `meeting.cliente`
 *   (testo libero dedotto dall'LLM, sempre ignorato, vedi types/meeting.ts).
 */

const BRAND_COLOR = "#1b75bb";
const BRAND_LIGHT = "#dbeafe";
const BRAND_SOFT = "#eaf3fb";
const COMPANY_NAME = "Andrea Lenzi Consulting";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", backgroundColor: "#ffffff", paddingBottom: 50 },

  header: {
    paddingHorizontal: 36,
    paddingTop: 28,
    paddingBottom: 18,
    borderBottomWidth: 2,
    borderBottomColor: BRAND_COLOR,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: { flex: 1, marginRight: 16 },
  headerLabel: { fontSize: 7, color: BRAND_COLOR, letterSpacing: 2, marginBottom: 6 },
  headerTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#111827", lineHeight: 1.25 },
  headerMeta: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  headerMetaItem: { fontSize: 9, color: "#6b7280" },
  headerLogo: { width: 110, height: 44, objectFit: "contain" },

  infoRow: { flexDirection: "row", gap: 10, paddingHorizontal: 36, paddingTop: 16 },
  infoBox: { flex: 1, backgroundColor: BRAND_SOFT, borderRadius: 5, paddingVertical: 8, paddingHorizontal: 10 },
  infoLabel: { fontSize: 7, color: BRAND_COLOR, letterSpacing: 1.5, fontFamily: "Helvetica-Bold" },
  infoValue: { fontSize: 11, color: "#111827", fontFamily: "Helvetica-Bold", marginTop: 3 },

  content: { paddingHorizontal: 36, paddingTop: 16 },
  section: { marginBottom: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  sectionBar: { width: 3, height: 13, backgroundColor: BRAND_COLOR, borderRadius: 2, marginRight: 7 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#111827" },
  bodyText: { fontSize: 9, color: "#374151", lineHeight: 1.6 },

  participantRow: { flexDirection: "row", flexWrap: "wrap" },
  participantBadge: {
    backgroundColor: BRAND_COLOR,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 5,
    marginBottom: 5,
  },
  participantText: { fontSize: 8, color: "#ffffff", fontFamily: "Helvetica-Bold" },

  bulletItem: { flexDirection: "row", marginBottom: 4, alignItems: "flex-start" },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: BRAND_COLOR, marginTop: 4, marginRight: 7, flexShrink: 0 },
  bulletText: { fontSize: 9, color: "#374151", lineHeight: 1.5, flex: 1 },

  actionItem: {
    flexDirection: "row",
    marginBottom: 4,
    backgroundColor: BRAND_LIGHT,
    borderRadius: 4,
    minHeight: 24,
    overflow: "hidden",
  },
  actionNumberBox: {
    width: 24,
    backgroundColor: BRAND_COLOR,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
    paddingVertical: 6,
  },
  actionNumberText: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  actionBody: { flex: 1, paddingHorizontal: 8, paddingVertical: 5 },
  actionText: { fontSize: 8.5, color: "#1e3a5f", lineHeight: 1.4 },
  actionAssignee: { fontSize: 7.5, color: BRAND_COLOR, fontFamily: "Helvetica-Bold", marginTop: 2 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap" },
  kpiCell: { width: "50%", paddingRight: 5, paddingBottom: 5 },
  kpiInner: { borderWidth: 0.75, borderColor: "#e5e7eb", borderRadius: 4, padding: 8, minHeight: 70 },
  kpiLabel: { fontSize: 7, letterSpacing: 1.5, color: BRAND_COLOR, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  kpiValue: { fontSize: 8.5, color: "#374151", lineHeight: 1.5 },

  footer: {
    position: "absolute",
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    paddingTop: 8,
  },
  footerLeft: { fontSize: 7, color: "#9ca3af" },
  footerLink: { fontSize: 7, color: BRAND_COLOR },
});

function splitLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

const h = React.createElement;

function SectionHeader({ title }: { title: string }) {
  return h(View, { style: styles.sectionHeader }, h(View, { style: styles.sectionBar }), h(Text, { style: styles.sectionTitle }, title));
}

function BulletSection({ title, text }: { title: string; text: string }) {
  const lines = splitLines(text);
  if (lines.length === 0) return null;
  return h(
    View,
    { style: styles.section },
    h(SectionHeader, { title }),
    ...lines.map((line, i) => h(View, { key: i, style: styles.bulletItem }, h(View, { style: styles.bullet }), h(Text, { style: styles.bulletText }, line)))
  );
}

function KpiCell({ label, value }: { label: string; value: string }) {
  return h(
    View,
    { style: styles.kpiCell },
    h(View, { style: styles.kpiInner }, h(Text, { style: styles.kpiLabel }, label.toUpperCase()), h(Text, { style: styles.kpiValue }, value))
  );
}

export function MeetingReportPdf({
  meeting,
  clienteNome,
  logoBuf,
}: {
  meeting: MeetingDataLoose;
  clienteNome: string;
  logoBuf: Buffer | null;
}) {
  const participants = meeting.participants ?? [];
  const highlights = meeting.highlights ?? [];
  const actionItems = meeting.actionItems ?? [];
  const dataConsulenza = meeting.dataConsulenza || meeting.date || "";

  const metaParts = [dataConsulenza, meeting.duration ? `  |  ${meeting.duration}` : null, participants.length > 0 ? `  |  ${participants.length} partecipanti` : null]
    .filter(Boolean)
    .join("");

  const kpis: Array<[string, string]> = (
    [
      ["KPI reali", meeting.kpiReali ?? ""],
      ["KPI storico", meeting.kpiStorico ?? ""],
      ["Target marketing", meeting.kpiTargetMarketing ?? ""],
      ["Target commerciali", meeting.kpiTargetCommerciali ?? ""],
    ] as Array<[string, string]>
  ).filter(([, v]) => v.trim());

  return h(
    Document,
    { title: `Report — ${meeting.title ?? "Meeting"}`, author: COMPANY_NAME },
    h(
      Page,
      { size: "A4", style: styles.page },

      // Header
      h(
        View,
        { style: styles.header },
        h(
          View,
          { style: styles.headerLeft },
          h(Text, { style: styles.headerLabel }, "MEETING REPORT"),
          h(Text, { style: styles.headerTitle }, meeting.title ?? ""),
          h(View, { style: styles.headerMeta }, h(Text, { style: styles.headerMetaItem }, metaParts))
        ),
        logoBuf
          ? h(PDFImage, { src: logoBuf, style: styles.headerLogo })
          : h(Text, { style: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND_COLOR } }, COMPANY_NAME)
      ),

      // Cliente / Referente
      h(
        View,
        { style: styles.infoRow },
        h(View, { style: styles.infoBox }, h(Text, { style: styles.infoLabel }, "CLIENTE"), h(Text, { style: styles.infoValue }, clienteNome)),
        meeting.referente
          ? h(View, { style: styles.infoBox }, h(Text, { style: styles.infoLabel }, "REFERENTE"), h(Text, { style: styles.infoValue }, meeting.referente))
          : null
      ),

      // Content
      h(
        View,
        { style: styles.content },

        participants.length > 0
          ? h(
              View,
              { style: styles.section },
              h(SectionHeader, { title: "Partecipanti" }),
              h(View, { style: styles.participantRow }, ...participants.map((p, i) => h(View, { key: i, style: styles.participantBadge }, h(Text, { style: styles.participantText }, p))))
            )
          : null,

        meeting.summary ? h(View, { style: styles.section }, h(SectionHeader, { title: "Sommario" }), h(Text, { style: styles.bodyText }, meeting.summary)) : null,

        highlights.length > 0
          ? h(
              View,
              { style: styles.section },
              h(SectionHeader, { title: "Punti salienti" }),
              ...highlights.map((hl, i) => h(View, { key: i, style: styles.bulletItem }, h(View, { style: styles.bullet }), h(Text, { style: styles.bulletText }, hl)))
            )
          : null,

        h(BulletSection, { title: "Task della settimana", text: meeting.taskSettimana ?? "" }),
        h(BulletSection, { title: "Task del mese", text: meeting.taskMese ?? "" }),
        h(BulletSection, { title: "Programma del trimestre", text: meeting.programmaTrimestre ?? "" }),

        actionItems.length > 0
          ? h(
              View,
              { style: styles.section },
              h(SectionHeader, { title: "Action items" }),
              ...actionItems.map((item, i) =>
                h(
                  View,
                  { key: i, style: styles.actionItem },
                  h(View, { style: styles.actionNumberBox }, h(Text, { style: styles.actionNumberText }, String(i + 1))),
                  h(
                    View,
                    { style: styles.actionBody },
                    h(Text, { style: styles.actionText }, item.text),
                    item.assignee ? h(Text, { style: styles.actionAssignee }, item.assignee) : null
                  )
                )
              )
            )
          : null,

        kpis.length > 0
          ? h(
              View,
              { style: styles.section },
              h(SectionHeader, { title: "KPI" }),
              h(View, { style: styles.kpiGrid }, ...kpis.map(([label, value]) => h(KpiCell, { key: label, label, value })))
            )
          : null
      ),

      // Footer
      h(
        View,
        { style: styles.footer },
        h(Text, { style: styles.footerLeft }, `${COMPANY_NAME} — Generato con Meta Manager ALC`),
        meeting.rawUrl ? h(Link, { src: meeting.rawUrl, style: styles.footerLink }, "Visualizza meeting completo") : null
      )
    )
  );
}
