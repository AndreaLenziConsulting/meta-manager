import { Document, Page, Text, View, StyleSheet, Link, Image as PDFImage, Svg, Path, Rect, Circle, Line, Polygon } from "@react-pdf/renderer";
import React from "react";
import { calcolaScenarioRoi } from "@/lib/roiSimulatore";
import { formatEuro, formatNumero, formatPercentuale, formatRoas } from "@/lib/format";
import type { ReportCommercialeDataLoose } from "@/types/prospect";

/**
 * Componente PDF del Report Commerciale — v2, riscritta su richiesta dell'utente dopo il primo
 * test reale ("mi aspetto una cosa più elaborata"), con in allegato 4 esempi di recap commerciali
 * ALC già in uso (documento a sezioni numerate, box colorati per tono, tabelle a righe zebrate,
 * icone). Stessa shell di base di MeetingReportPdf.tsx (margini, regole wrap:false sui blocchi
 * atomici — react-pdf ripagina un blocco a metà senza) ma sezioni numerate 1-9, box colorati per
 * tono (Criticità/PAIN in ambra/rosso, Obiettivi in verde, Soluzione Proposta/Prossimi Passi nel
 * blu del brand), tabella comparativa Livello Prodotto/Livello Problema in stile ✗/✓, tabella ROI
 * estesa con header brand pieno e righe zebrate, footer con numero di pagina ripetuto.
 *
 * Le icone sono forme vettoriali (Svg/Path/Rect/Circle) invece di emoji: i font PDF core
 * (Helvetica, senza font embedding) non hanno glifi emoji — renderebbero caselle vuote — mentre
 * le forme vettoriali funzionano in ogni lettore PDF senza dover incorporare un font a colori.
 */

const BRAND_COLOR = "#1a74bc";
const BRAND_SOFT = "#e8f1f9"; // = --brand-primary-light in globals.css
const BRAND_MED = "#cfe6f6";
const BRAND_TEXT = "#0f4d7d";
const COMPANY_NAME = "Andrea Lenzi Consulting";

const INK_900 = "#111827";
const INK_700 = "#374151";
const INK_500 = "#6b7280";
const INK_400 = "#9ca3af";
const INK_300 = "#e5e7eb";
const INK_100 = "#f6f7f9";

type Tone = "brand" | "warning" | "danger" | "success" | "neutral";

const TONES: Record<Tone, { text: string; accent: string; bg: string; border: string }> = {
  brand: { text: BRAND_TEXT, accent: BRAND_COLOR, bg: BRAND_SOFT, border: "#bcdcf1" },
  warning: { text: "#92400e", accent: "#d97706", bg: "#fef8ec", border: "#f2d8a0" },
  danger: { text: "#991b1b", accent: "#dc2626", bg: "#fdf1f1", border: "#f1c2c2" },
  success: { text: "#166534", accent: "#16a34a", bg: "#eefbf3", border: "#b9e6c9" },
  neutral: { text: INK_700, accent: "#4b5563", bg: INK_100, border: INK_300 },
};

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", backgroundColor: "#ffffff", paddingTop: 28, paddingHorizontal: 36, paddingBottom: 46 },

  header: { paddingBottom: 14, borderBottomWidth: 2, borderBottomColor: BRAND_COLOR, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  headerLeft: { flex: 1, marginRight: 16 },
  headerLabel: { fontSize: 7, color: BRAND_COLOR, letterSpacing: 0.6, marginBottom: 6, fontFamily: "Helvetica-Bold" },
  headerTitle: { fontSize: 19, fontFamily: "Helvetica-Bold", color: INK_900, lineHeight: 1.2 },
  headerSubtitle: { fontSize: 10, color: INK_500, marginTop: 3 },
  headerLogo: { width: 120, height: 48, objectFit: "contain" },

  metaStrip: { flexDirection: "row", gap: 8, paddingTop: 14, wrap: false },
  metaChip: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: BRAND_SOFT, borderRadius: 5, paddingVertical: 7, paddingHorizontal: 9 },
  metaIconCircle: { width: 18, height: 18, borderRadius: 9, backgroundColor: BRAND_MED, alignItems: "center", justifyContent: "center", marginRight: 7, flexShrink: 0 },
  metaTextWrap: { flex: 1 },
  metaLabel: { fontSize: 6.5, color: BRAND_COLOR, letterSpacing: 0.4, fontFamily: "Helvetica-Bold" },
  metaValue: { fontSize: 8.5, color: INK_900, fontFamily: "Helvetica-Bold", marginTop: 1 },

  content: { paddingTop: 18 },
  section: { marginBottom: 15 },

  sectionHeading: { flexDirection: "row", alignItems: "center", marginBottom: 7, wrap: false },
  sectionBadge: { width: 17, height: 17, borderRadius: 9, alignItems: "center", justifyContent: "center", marginRight: 8, flexShrink: 0 },
  sectionBadgeText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff" },
  sectionTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: INK_900 },

  // Tabella "Dati del cliente" — righe etichetta/valore con icona, non più box affiancati: più
  // vicina alla tabella definizioni degli esempi allegati (label a sinistra, valore in grassetto).
  defTable: { borderWidth: 0.75, borderColor: INK_300, borderRadius: 5, overflow: "hidden" },
  defRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, paddingHorizontal: 10, wrap: false },
  defIconCircle: { width: 16, height: 16, borderRadius: 8, backgroundColor: BRAND_MED, alignItems: "center", justifyContent: "center", marginRight: 8, flexShrink: 0 },
  defLabel: { width: 92, fontSize: 8, color: INK_500, fontFamily: "Helvetica-Bold" },
  defValue: { flex: 1, fontSize: 9, color: INK_900, fontFamily: "Helvetica-Bold" },

  callout: { borderWidth: 0.75, borderRadius: 5, paddingVertical: 8, paddingHorizontal: 10 },
  bulletItem: { flexDirection: "row", marginBottom: 4, alignItems: "flex-start", wrap: false },
  bulletDot: { width: 5, height: 5, borderRadius: 3, marginTop: 4, marginRight: 7, flexShrink: 0 },
  bulletText: { fontSize: 9, color: INK_700, lineHeight: 1.5, flex: 1 },

  // Tabella comparativa "Comunicazione corretta secondo AL" — colonna Livello Prodotto (✗, da
  // evitare) contro Livello Problema (✓, corretto), stesso schema rosso/verde degli esempi allegati.
  compareTable: { flexDirection: "row", gap: 8, wrap: false },
  compareCol: { flex: 1, borderWidth: 0.75, borderRadius: 5, overflow: "hidden" },
  compareHead: { flexDirection: "row", alignItems: "center", paddingVertical: 6, paddingHorizontal: 9 },
  compareHeadIcon: { marginRight: 6 },
  compareHeadText: { fontSize: 8.5, fontFamily: "Helvetica-Bold" },
  compareBody: { paddingVertical: 8, paddingHorizontal: 9 },
  compareBodyText: { fontSize: 8.5, color: INK_700, lineHeight: 1.5 },

  // Tabella Simulazione ROI — header pieno brand (testo bianco) + righe zebrate, invece del
  // semplice header tinta chiara di prima: stesso registro visivo della "Simulazione Economica"
  // degli esempi allegati.
  roiTable: { borderWidth: 0.75, borderColor: INK_300, borderRadius: 5, overflow: "hidden" },
  roiHeaderRow: { flexDirection: "row", backgroundColor: BRAND_COLOR, wrap: false },
  roiRow: { flexDirection: "row", wrap: false },
  roiCellLabel: { flex: 1.3, fontSize: 8, color: INK_700, padding: 6 },
  roiCellHeaderLabel: { flex: 1.3, fontSize: 7, padding: 6 },
  roiCellHeader: { flex: 1, fontSize: 8, fontFamily: "Helvetica-Bold", color: "#ffffff", padding: 6, textAlign: "right" },
  roiCellValue: { flex: 1, fontSize: 8.5, color: INK_900, padding: 6, textAlign: "right" },
  roiCellValueStrong: { flex: 1, fontSize: 8.5, fontFamily: "Helvetica-Bold", color: BRAND_TEXT, padding: 6, textAlign: "right" },

  footer: { position: "absolute", bottom: 18, left: 36, right: 36, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 0.5, borderTopColor: INK_300, paddingTop: 8 },
  footerLeft: { fontSize: 7, color: INK_400 },
  footerLink: { fontSize: 7, color: BRAND_COLOR },
});

function splitLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

const h = React.createElement;

// ─── Icone vettoriali (path Feather Icons, MIT) ──────────────────────────────
type IconName = "calendar" | "users" | "link" | "briefcase" | "grid" | "dollar" | "pin" | "alert" | "retry" | "target" | "zap" | "check" | "x" | "bars" | "checkSquare";

function Icon({ name, color, size = 10 }: { name: IconName; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const svg = (...children: React.ReactNode[]) => h(Svg, { viewBox: "0 0 24 24", width: size, height: size }, ...children);

  switch (name) {
    case "calendar":
      return svg(
        h(Rect, { x: 3, y: 4, width: 18, height: 18, rx: 2, ry: 2, ...p }),
        h(Line, { x1: 16, y1: 2, x2: 16, y2: 6, ...p }),
        h(Line, { x1: 8, y1: 2, x2: 8, y2: 6, ...p }),
        h(Line, { x1: 3, y1: 10, x2: 21, y2: 10, ...p })
      );
    case "users":
      return svg(
        h(Path, { d: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", ...p }),
        h(Circle, { cx: 9, cy: 7, r: 4, ...p }),
        h(Path, { d: "M23 21v-2a4 4 0 0 0-3-3.87", ...p }),
        h(Path, { d: "M16 3.13a4 4 0 0 1 0 7.75", ...p })
      );
    case "link":
      return svg(
        h(Path, { d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71", ...p }),
        h(Path, { d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71", ...p })
      );
    case "briefcase":
      return svg(h(Rect, { x: 2, y: 7, width: 20, height: 14, rx: 2, ry: 2, ...p }), h(Path, { d: "M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16", ...p }));
    case "grid":
      return svg(
        h(Rect, { x: 3, y: 3, width: 7, height: 7, ...p }),
        h(Rect, { x: 14, y: 3, width: 7, height: 7, ...p }),
        h(Rect, { x: 14, y: 14, width: 7, height: 7, ...p }),
        h(Rect, { x: 3, y: 14, width: 7, height: 7, ...p })
      );
    case "dollar":
      return svg(h(Line, { x1: 12, y1: 1, x2: 12, y2: 23, ...p }), h(Path, { d: "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6", ...p }));
    case "pin":
      return svg(h(Path, { d: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z", ...p }), h(Circle, { cx: 12, cy: 10, r: 3, ...p }));
    case "alert":
      return svg(
        h(Path, { d: "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", ...p }),
        h(Line, { x1: 12, y1: 9, x2: 12, y2: 13, ...p }),
        h(Line, { x1: 12, y1: 17, x2: 12.01, y2: 17, ...p })
      );
    case "retry":
      return svg(h(Path, { d: "M15 14l5-5-5-5", ...p }), h(Path, { d: "M4 20v-7a4 4 0 0 1 4-4h12", ...p }));
    case "target":
      return svg(h(Circle, { cx: 12, cy: 12, r: 9, ...p }), h(Circle, { cx: 12, cy: 12, r: 5, ...p }), h(Circle, { cx: 12, cy: 12, r: 1.2, fill: color, stroke: "none" }));
    case "zap":
      return svg(h(Polygon, { points: "13 2 3 14 12 14 11 22 21 10 12 10 13 2", ...p }));
    case "check":
      return svg(h(Path, { d: "M22 11.08V12a10 10 0 1 1-5.93-9.14", ...p }), h(Path, { d: "M22 4L12 14.01 9 11.01", ...p }));
    case "x":
      return svg(h(Circle, { cx: 12, cy: 12, r: 9, ...p }), h(Line, { x1: 15, y1: 9, x2: 9, y2: 15, ...p }), h(Line, { x1: 9, y1: 9, x2: 15, y2: 15, ...p }));
    case "bars":
      return svg(h(Rect, { x: 3, y: 12, width: 4.5, height: 9, fill: color, stroke: "none" }), h(Rect, { x: 9.75, y: 6, width: 4.5, height: 15, fill: color, stroke: "none" }), h(Rect, { x: 16.5, y: 9, width: 4.5, height: 12, fill: color, stroke: "none" }));
    case "checkSquare":
      return svg(h(Path, { d: "M9 11l3 3 10-10", ...p }), h(Path, { d: "M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11", ...p }));
    default:
      return null;
  }
}

function MetaChip({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return h(
    View,
    { style: styles.metaChip },
    h(View, { style: styles.metaIconCircle }, h(Icon, { name: icon, color: BRAND_COLOR, size: 9 })),
    h(View, { style: styles.metaTextWrap }, h(Text, { style: styles.metaLabel }, label.toUpperCase()), h(Text, { style: styles.metaValue }, value || "—"))
  );
}

function SectionHeading({ number, title, tone = "brand" }: { number: number; title: string; tone?: Tone }) {
  const t = TONES[tone];
  return h(
    View,
    { style: styles.sectionHeading },
    h(View, { style: [styles.sectionBadge, { backgroundColor: t.accent }] }, h(Text, { style: styles.sectionBadgeText }, String(number))),
    h(Text, { style: styles.sectionTitle }, title)
  );
}

function DefRow({ icon, label, value, last }: { icon: IconName; label: string; value: string; last: boolean }) {
  return h(
    View,
    { style: [styles.defRow, !last ? { borderBottomWidth: 0.5, borderBottomColor: INK_300 } : undefined] },
    h(View, { style: styles.defIconCircle }, h(Icon, { name: icon, color: BRAND_COLOR, size: 8 })),
    h(Text, { style: styles.defLabel }, label),
    h(Text, { style: styles.defValue }, value || "—")
  );
}

function CalloutSection({ number, title, tone, text }: { number: number; title: string; tone: Tone; text: string }) {
  const lines = splitLines(text);
  if (lines.length === 0) return null;
  const t = TONES[tone];
  return h(
    View,
    { style: styles.section },
    h(SectionHeading, { number, title, tone }),
    h(
      View,
      { style: [styles.callout, { backgroundColor: t.bg, borderColor: t.border }] },
      ...lines.map((line, i) =>
        h(View, { key: i, style: styles.bulletItem }, h(View, { style: [styles.bulletDot, { backgroundColor: t.accent }] }), h(Text, { style: styles.bulletText }, line))
      )
    )
  );
}

function sourceLabel(url: string | undefined): string {
  if (!url) return "—";
  if (/fathom\.video/i.test(url)) return "Fathom — link disponibile";
  if (/circleback\.ai/i.test(url)) return "Circleback — link disponibile";
  if (/loom\.com/i.test(url)) return "Loom — link disponibile";
  return "Link disponibile";
}

export function ReportCommercialePdf({ report, logoBuf }: { report: ReportCommercialeDataLoose; logoBuf: Buffer | null }) {
  const partecipanti = report.partecipanti ?? [];
  const titolo = report.ragioneSociale || report.titolo || "Report commerciale";
  const sottotitolo = report.titolo && report.titolo !== titolo ? report.titolo : "";

  const defRows: Array<[IconName, string, string]> = [
    ["briefcase", "Ragione sociale", report.ragioneSociale ?? ""],
    ["grid", "Tipo business", report.tipoBusiness ?? ""],
    ["dollar", "Fatturato", report.fatturato ?? ""],
    ["pin", "Sedi", report.sedi ?? ""],
  ];
  const haDefRows = defRows.some(([, , v]) => v.trim());

  const nomeA = report.scenarioA?.nome || "Scenario A";
  const nomeB = report.scenarioB?.nome || "Scenario B";
  const outA = report.scenarioA ? calcolaScenarioRoi(report.scenarioA) : null;
  const outB = report.scenarioB ? calcolaScenarioRoi(report.scenarioB) : null;
  const haRoi = !!(report.scenarioA || report.scenarioB);
  // I tassi sono salvati come 0-100 (percentuale "umana"), formatPercentuale si aspetta 0-1.
  const formatTasso = (v: number | null | undefined) => formatPercentuale(v == null ? null : v / 100);
  const roiRighe: Array<[string, string, string]> = [
    ["Budget mensile", formatEuro(report.scenarioA?.budgetMensile ?? null), formatEuro(report.scenarioB?.budgetMensile ?? null)],
    ["Costo per lead (CPL)", formatEuro(report.scenarioA?.cpl ?? null), formatEuro(report.scenarioB?.cpl ?? null)],
    ["Lead generati / mese", formatNumero(outA?.numeroLead ?? null), formatNumero(outB?.numeroLead ?? null)],
    ["Tasso lead / appuntamento", formatTasso(report.scenarioA?.tassoAppuntamento), formatTasso(report.scenarioB?.tassoAppuntamento)],
    ["Appuntamenti fissati", formatNumero(outA?.numeroAppuntamenti ?? null), formatNumero(outB?.numeroAppuntamenti ?? null)],
    ["Tasso di chiusura", formatTasso(report.scenarioA?.tassoChiusura), formatTasso(report.scenarioB?.tassoChiusura)],
    ["Vendite generate", formatNumero(outA?.numeroVendite ?? null), formatNumero(outB?.numeroVendite ?? null)],
    ["Costo per acquisizione (CPA)", formatEuro(outA?.cpa ?? null), formatEuro(outB?.cpa ?? null)],
  ];
  const roiRigheFinali: Array<[string, string, string]> = [
    ["Fatturato atteso", formatEuro(outA?.fatturatoAtteso ?? null), formatEuro(outB?.fatturatoAtteso ?? null)],
    ["ROAS", formatRoas(outA?.roas ?? null), formatRoas(outB?.roas ?? null)],
  ];

  const prossimiPassiLines = splitLines(report.prossimiPassi ?? "");

  return h(
    Document,
    { title: `Report commerciale — ${titolo}`, author: COMPANY_NAME },
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
          h(Text, { style: styles.headerTitle }, titolo),
          sottotitolo ? h(Text, { style: styles.headerSubtitle }, sottotitolo) : null
        ),
        logoBuf
          ? h(PDFImage, { src: logoBuf, style: styles.headerLogo })
          : h(Text, { style: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BRAND_COLOR } }, COMPANY_NAME)
      ),

      h(
        View,
        { style: styles.metaStrip },
        h(MetaChip, { icon: "calendar", label: "Data", value: report.data || "—" }),
        h(MetaChip, { icon: "users", label: "Partecipanti", value: partecipanti.length > 0 ? partecipanti.join(", ") : "—" }),
        h(MetaChip, { icon: "link", label: "Registrazione", value: sourceLabel(report.rawUrl) })
      ),

      h(
        View,
        { style: styles.content },

        haDefRows
          ? h(
              View,
              { style: styles.section },
              h(SectionHeading, { number: 1, title: "Dati del Cliente" }),
              h(View, { style: styles.defTable }, ...defRows.map(([icon, label, value], i) => h(DefRow, { key: label, icon, label, value, last: i === defRows.length - 1 })))
            )
          : null,

        h(CalloutSection, { number: 2, title: "Criticità del Cliente", tone: "warning", text: report.criticita ?? "" }),
        h(CalloutSection, { number: 3, title: "Tentate Soluzioni", tone: "neutral", text: report.tentateSoluzioni ?? "" }),
        h(CalloutSection, { number: 4, title: "PAIN", tone: "danger", text: report.pain ?? "" }),
        h(CalloutSection, { number: 5, title: "Obiettivi", tone: "success", text: report.obiettivi ?? "" }),
        h(CalloutSection, { number: 6, title: "Soluzione Proposta", tone: "brand", text: report.soluzioneProposta ?? "" }),

        report.livelloProblema || report.livelloProdotto
          ? h(
              View,
              { style: styles.section },
              h(SectionHeading, { number: 7, title: "Comunicazione Corretta secondo AL" }),
              h(
                View,
                { style: styles.compareTable },
                h(
                  View,
                  { style: [styles.compareCol, { borderColor: TONES.danger.border }] },
                  h(
                    View,
                    { style: [styles.compareHead, { backgroundColor: TONES.danger.bg }] },
                    h(View, { style: styles.compareHeadIcon }, h(Icon, { name: "x", color: TONES.danger.accent, size: 10 })),
                    h(Text, { style: [styles.compareHeadText, { color: TONES.danger.text }] }, "Livello Prodotto")
                  ),
                  h(View, { style: styles.compareBody }, h(Text, { style: styles.compareBodyText }, report.livelloProdotto || "—"))
                ),
                h(
                  View,
                  { style: [styles.compareCol, { borderColor: TONES.success.border }] },
                  h(
                    View,
                    { style: [styles.compareHead, { backgroundColor: TONES.success.bg }] },
                    h(View, { style: styles.compareHeadIcon }, h(Icon, { name: "check", color: TONES.success.accent, size: 10 })),
                    h(Text, { style: [styles.compareHeadText, { color: TONES.success.text }] }, "Livello Problema")
                  ),
                  h(View, { style: styles.compareBody }, h(Text, { style: styles.compareBodyText }, report.livelloProblema || "—"))
                )
              )
            )
          : null,

        haRoi
          ? h(
              View,
              { style: styles.section },
              h(SectionHeading, { number: 8, title: "Simulazione ROI" }),
              h(
                View,
                { style: styles.roiTable },
                h(
                  View,
                  { style: styles.roiHeaderRow },
                  h(View, { style: { flex: 1.3, flexDirection: "row", alignItems: "center", padding: 6 } }, h(Icon, { name: "bars", color: "#ffffff", size: 9 })),
                  h(Text, { style: styles.roiCellHeader }, nomeA),
                  h(Text, { style: styles.roiCellHeader }, nomeB)
                ),
                ...roiRighe.map(([label, va, vb], i) =>
                  h(
                    View,
                    { key: label, style: [styles.roiRow, { backgroundColor: i % 2 === 1 ? INK_100 : "#ffffff" }] },
                    h(Text, { style: styles.roiCellLabel }, label),
                    h(Text, { style: styles.roiCellValue }, va),
                    h(Text, { style: styles.roiCellValue }, vb)
                  )
                ),
                ...roiRigheFinali.map(([label, va, vb]) =>
                  h(
                    View,
                    { key: label, style: [styles.roiRow, { backgroundColor: BRAND_SOFT, borderTopWidth: 1, borderTopColor: BRAND_MED }] },
                    h(Text, { style: [styles.roiCellLabel, { fontFamily: "Helvetica-Bold", color: BRAND_TEXT }] }, label),
                    h(Text, { style: styles.roiCellValueStrong }, va),
                    h(Text, { style: styles.roiCellValueStrong }, vb)
                  )
                )
              )
            )
          : null,

        prossimiPassiLines.length > 0
          ? h(
              View,
              { style: styles.section },
              h(SectionHeading, { number: 9, title: "Prossimi Passi", tone: "brand" }),
              h(
                View,
                { style: [styles.callout, { backgroundColor: TONES.brand.bg, borderColor: TONES.brand.border }] },
                ...prossimiPassiLines.map((line, i) =>
                  h(
                    View,
                    { key: i, style: styles.bulletItem },
                    h(Icon, { name: "checkSquare", color: BRAND_COLOR, size: 10 }),
                    h(Text, { style: [styles.bulletText, { marginLeft: 7 }] }, line)
                  )
                )
              )
            )
          : null
      ),

      h(
        View,
        { style: styles.footer, fixed: true },
        h(Text, { style: styles.footerLeft }, `${COMPANY_NAME} · Report riservato ad uso interno`),
        h(Text, {
          style: styles.footerLeft,
          render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Pag. ${pageNumber}/${totalPages}`,
        }),
        report.rawUrl ? h(Link, { src: report.rawUrl, style: styles.footerLink }, "Visualizza chiamata completa") : null
      )
    )
  );
}
