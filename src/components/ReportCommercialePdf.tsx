import { Document, Page, Text, View, StyleSheet, Link, Image as PDFImage } from "@react-pdf/renderer";
import React from "react";
import { calcolaScenarioRoi } from "@/lib/roiSimulatore";
import { formatEuro, formatRoas } from "@/lib/format";
import type { ReportCommercialeDataLoose } from "@/types/prospect";

/**
 * Componente PDF del Report Commerciale — stessa shell/stile di MeetingReportPdf.tsx (stessi
 * colori/regole wrap:false, stesso motivo: react-pdf ripagina i blocchi "atomici" a metà senza),
 * ma con le 9 sezioni del report di vendita + la tabella comparativa della Simulazione ROI al
 * posto delle sezioni di recap meeting.
 */

const BRAND_COLOR = "#1a74bc";
const BRAND_SOFT = "#e8f1f9"; // = --brand-primary-light in globals.css
const COMPANY_NAME = "Andrea Lenzi Consulting";

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", backgroundColor: "#ffffff", paddingTop: 28, paddingHorizontal: 36, paddingBottom: 50 },

  header: { paddingBottom: 18, borderBottomWidth: 2, borderBottomColor: BRAND_COLOR, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { flex: 1, marginRight: 16 },
  headerLabel: { fontSize: 7, color: BRAND_COLOR, letterSpacing: 2, marginBottom: 6 },
  headerTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#111827", lineHeight: 1.25 },
  headerMeta: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  headerMetaItem: { fontSize: 9, color: "#6b7280" },
  headerLogo: { width: 110, height: 44, objectFit: "contain" },

  infoRow: { flexDirection: "row", gap: 10, paddingTop: 12 },
  infoBox: { flex: 1, backgroundColor: BRAND_SOFT, borderRadius: 5, paddingVertical: 8, paddingHorizontal: 10 },
  infoLabel: { fontSize: 7, color: BRAND_COLOR, letterSpacing: 1.5, fontFamily: "Helvetica-Bold" },
  infoValue: { fontSize: 10, color: "#111827", fontFamily: "Helvetica-Bold", marginTop: 3 },

  content: { paddingTop: 16 },
  section: { marginBottom: 14 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6, wrap: false },
  sectionBar: { width: 3, height: 13, backgroundColor: BRAND_COLOR, borderRadius: 2, marginRight: 7 },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#111827" },

  bulletItem: { flexDirection: "row", marginBottom: 4, alignItems: "flex-start", wrap: false },
  bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: BRAND_COLOR, marginTop: 4, marginRight: 7, flexShrink: 0 },
  bulletText: { fontSize: 9, color: "#374151", lineHeight: 1.5, flex: 1 },

  kpiGrid: { flexDirection: "row", flexWrap: "wrap" },
  kpiCell: { width: "50%", paddingRight: 5, paddingBottom: 5, wrap: false },
  kpiInner: { borderWidth: 0.75, borderColor: "#e5e7eb", borderRadius: 4, padding: 8, minHeight: 60 },
  kpiLabel: { fontSize: 7, letterSpacing: 1.5, color: BRAND_COLOR, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  kpiValue: { fontSize: 8.5, color: "#374151", lineHeight: 1.5 },

  roiTable: { borderWidth: 0.75, borderColor: "#e5e7eb", borderRadius: 4, overflow: "hidden" },
  roiHeaderRow: { flexDirection: "row", backgroundColor: BRAND_SOFT, wrap: false },
  roiRow: { flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#e5e7eb", wrap: false },
  roiCellLabel: { flex: 1.2, fontSize: 8, color: "#374151", padding: 6 },
  roiCellHeader: { flex: 1, fontSize: 7.5, fontFamily: "Helvetica-Bold", color: BRAND_COLOR, padding: 6, textAlign: "right" },
  roiCellValue: { flex: 1, fontSize: 8.5, color: "#111827", padding: 6, textAlign: "right" },

  footer: { position: "absolute", bottom: 18, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 0.5, borderTopColor: "#e5e7eb", paddingTop: 8 },
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
  return h(View, { style: styles.kpiCell }, h(View, { style: styles.kpiInner }, h(Text, { style: styles.kpiLabel }, label.toUpperCase()), h(Text, { style: styles.kpiValue }, value || "—")));
}

export function ReportCommercialePdf({ report, logoBuf }: { report: ReportCommercialeDataLoose; logoBuf: Buffer | null }) {
  const partecipanti = report.partecipanti ?? [];
  const metaParts = [report.data, partecipanti.length > 0 ? `  |  ${partecipanti.length} partecipanti` : null].filter(Boolean).join("");

  const nomeA = report.scenarioA?.nome || "Scenario A";
  const nomeB = report.scenarioB?.nome || "Scenario B";
  const outA = report.scenarioA ? calcolaScenarioRoi(report.scenarioA) : null;
  const outB = report.scenarioB ? calcolaScenarioRoi(report.scenarioB) : null;
  const haRoi = !!(report.scenarioA || report.scenarioB);
  const roiRighe: Array<[string, string, string]> = [
    ["CPL", formatEuro(report.scenarioA?.cpl ?? null), formatEuro(report.scenarioB?.cpl ?? null)],
    ["CPA", formatEuro(outA?.cpa ?? null), formatEuro(outB?.cpa ?? null)],
    ["ROAS", formatRoas(outA?.roas ?? null), formatRoas(outB?.roas ?? null)],
    ["Fatturato atteso", formatEuro(outA?.fatturatoAtteso ?? null), formatEuro(outB?.fatturatoAtteso ?? null)],
  ];

  return h(
    Document,
    { title: `Report commerciale — ${report.ragioneSociale ?? report.titolo ?? ""}`, author: COMPANY_NAME },
    h(
      Page,
      { size: "A4", style: styles.page },

      h(
        View,
        { style: styles.header },
        h(
          View,
          { style: styles.headerLeft },
          h(Text, { style: styles.headerLabel }, "REPORT COMMERCIALE"),
          h(Text, { style: styles.headerTitle }, report.titolo ?? report.ragioneSociale ?? ""),
          h(View, { style: styles.headerMeta }, h(Text, { style: styles.headerMetaItem }, metaParts))
        ),
        logoBuf
          ? h(PDFImage, { src: logoBuf, style: styles.headerLogo })
          : h(Text, { style: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND_COLOR } }, COMPANY_NAME)
      ),

      h(
        View,
        { style: styles.infoRow },
        h(View, { style: styles.infoBox }, h(Text, { style: styles.infoLabel }, "RAGIONE SOCIALE"), h(Text, { style: styles.infoValue }, report.ragioneSociale || "—")),
        h(View, { style: styles.infoBox }, h(Text, { style: styles.infoLabel }, "TIPO BUSINESS"), h(Text, { style: styles.infoValue }, report.tipoBusiness || "—"))
      ),
      h(
        View,
        { style: styles.infoRow },
        h(View, { style: styles.infoBox }, h(Text, { style: styles.infoLabel }, "FATTURATO"), h(Text, { style: styles.infoValue }, report.fatturato || "—")),
        h(View, { style: styles.infoBox }, h(Text, { style: styles.infoLabel }, "SEDI"), h(Text, { style: styles.infoValue }, report.sedi || "—"))
      ),

      h(
        View,
        { style: styles.content },

        h(BulletSection, { title: "Criticità", text: report.criticita ?? "" }),
        h(BulletSection, { title: "Tentate soluzioni", text: report.tentateSoluzioni ?? "" }),
        h(BulletSection, { title: "PAIN", text: report.pain ?? "" }),
        h(BulletSection, { title: "Obiettivi", text: report.obiettivi ?? "" }),
        h(BulletSection, { title: "Soluzione proposta", text: report.soluzioneProposta ?? "" }),

        report.livelloProblema || report.livelloProdotto
          ? h(
              View,
              { style: styles.section },
              h(SectionHeader, { title: "Comunicazione corretta secondo AL" }),
              h(View, { style: styles.kpiGrid }, h(KpiCell, { label: "Livello Problema", value: report.livelloProblema ?? "" }), h(KpiCell, { label: "Livello Prodotto", value: report.livelloProdotto ?? "" }))
            )
          : null,

        haRoi
          ? h(
              View,
              { style: styles.section },
              h(SectionHeader, { title: "Simulazione ROI" }),
              h(
                View,
                { style: styles.roiTable },
                h(
                  View,
                  { style: styles.roiHeaderRow },
                  h(Text, { style: styles.roiCellLabel }, ""),
                  h(Text, { style: styles.roiCellHeader }, nomeA),
                  h(Text, { style: styles.roiCellHeader }, nomeB)
                ),
                ...roiRighe.map(([label, va, vb], i) =>
                  h(View, { key: i, style: styles.roiRow }, h(Text, { style: styles.roiCellLabel }, label), h(Text, { style: styles.roiCellValue }, va), h(Text, { style: styles.roiCellValue }, vb))
                )
              )
            )
          : null,

        h(BulletSection, { title: "Prossimi passi", text: report.prossimiPassi ?? "" })
      ),

      h(
        View,
        { style: styles.footer },
        h(Text, { style: styles.footerLeft }, `${COMPANY_NAME} — Generato con Meta Manager ALC`),
        report.rawUrl ? h(Link, { src: report.rawUrl, style: styles.footerLink }, "Visualizza chiamata completa") : null
      )
    )
  );
}
