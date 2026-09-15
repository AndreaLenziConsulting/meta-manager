import { Document, Page, Text, View, StyleSheet, Link, Image as PDFImage } from "@react-pdf/renderer";
import React from "react";
import { FONT_LABEL, registraFontPdf, temaPdfCliente } from "@/lib/pdfFonts";
import type { CampiTema } from "@/lib/temaCliente";
import type { MeetingDataLoose } from "@/types/meeting";

registraFontPdf();

/**
 * Componente PDF del report meeting — porting fedele di `ReportPDF` in Fast Report
 * (`generate-pdf/route.ts`), stesso stile/sezioni. Scritto con `React.createElement` (niente JSX
 * diretto) per lo stesso motivo di Fast Report: evita rogne di JSX transform dentro una route API.
 *
 * Differenze dal porting originale, imposte da `MeetingDataLoose` (tutti i campi opzionali):
 * - accesso sempre difensivo (`?? ""` / `?? []`) — Fast Report assumeva i campi sempre presenti;
 * - `clienteNome` è una prop separata, risolta server-side da `clienteId` — mai `meeting.cliente`
 *   (testo libero dedotto dall'LLM, sempre ignorato, vedi types/meeting.ts).
 *
 * Font/colori: default dell'immagine coordinata ALC (src/lib/pdfFonts.ts, stesso criterio di
 * ReportCommercialePdf.tsx) — League Spartan Bold per il titolo del meeting, Oswald per eyebrow/
 * intestazioni di sezione e i numeri degli action item, Roboto per tutto il resto — SOSTITUITI dal
 * colore/font del cliente quando la prop `cliente` ne ha uno impostato (vedi temaPdfCliente in
 * pdfFonts.ts): stesso principio di styleTemaCliente per la scheda cliente sul web, qui in versione
 * PDF. Per questo `styles` è una funzione (non più un oggetto module-level): react-pdf non ha
 * bisogno che StyleSheet.create sia chiamato una sola volta, e qui serve un set diverso di colori/
 * font per ogni cliente — costruito una volta per render, non per singolo elemento.
 */

const BRAND_COLOR_DEFAULT = "#1a74bc";
const BRAND_LIGHT_DEFAULT = "#d6e8f5"; // tinta media, per il risalto degli action item
const BRAND_SOFT_DEFAULT = "#e8f1f9"; // = --brand-primary-light in globals.css, per i box informativi
const COMPANY_NAME = "Andrea Lenzi Consulting";

function buildStyles(tema: { colore: string; coloreChiaro: string; coloreMedio: string; fontHeading: string; fontBody: string }) {
  const { colore, coloreChiaro, coloreMedio, fontHeading, fontBody } = tema;
  return StyleSheet.create({
    // Margine di pagina impostato QUI (non sulle singole sezioni): @react-pdf/renderer reapplica lo
    // style di Page a ogni pagina generata dall'auto-paginazione. Prima paddingTop/paddingHorizontal
    // stavano solo su header/infoRow/content, quindi la pagina 1 "sembrava" avere un margine (per il
    // padding interno di quelle sezioni) ma la pagina 2+ ripartiva a ridosso del bordo — bug segnalato.
    page: { fontFamily: fontBody, fontWeight: 400, backgroundColor: "#ffffff", paddingTop: 28, paddingHorizontal: 36, paddingBottom: 50 },

    header: {
      paddingBottom: 18,
      borderBottomWidth: 2,
      borderBottomColor: colore,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
    },
    headerLeft: { flex: 1, marginRight: 16 },
    headerLabel: { fontSize: 7, color: colore, letterSpacing: 0.6, marginBottom: 6, fontFamily: FONT_LABEL, fontWeight: 700 },
    headerTitle: { fontSize: 18, fontFamily: fontHeading, fontWeight: 700, color: "#111827", lineHeight: 1.25 },
    headerMeta: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
    headerMetaItem: { fontSize: 9, color: "#6b7280" },
    headerLogo: { width: 110, height: 44, objectFit: "contain" },

    infoRow: { flexDirection: "row", gap: 10, paddingTop: 16 },
    infoBox: { flex: 1, backgroundColor: coloreChiaro, borderRadius: 5, paddingVertical: 8, paddingHorizontal: 10 },
    infoLabel: { fontSize: 7, color: colore, letterSpacing: 0.5, fontFamily: FONT_LABEL, fontWeight: 500 },
    infoValue: { fontSize: 11, color: "#111827", fontFamily: fontBody, fontWeight: 700, marginTop: 3 },

    content: { paddingTop: 16 },
    section: { marginBottom: 14 },
    // wrap/minPresenceAhead NON vanno qui dentro: @react-pdf/layout li legge da node.props, non da
    // style (mergeStyles per i nodi View/Text non li riversa in props — verificato leggendo
    // @react-pdf/layout/lib/index.js — a differenza degli elementi Svg). Passati come prop react
    // vere e proprie a ogni h(View, {style, wrap: ...}) sotto. minPresenceAhead 90 (non 40,
    // verificato dal vivo insufficiente): deve coprire intestazione + almeno la prima riga/bullet
    // del contenuto sotto — altrimenti l'intestazione resta sola in fondo pagina col corpo che
    // riparte sulla successiva.
    sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
    sectionBar: { width: 3, height: 13, backgroundColor: colore, borderRadius: 2, marginRight: 7 },
    sectionTitle: { fontSize: 11, fontFamily: FONT_LABEL, fontWeight: 700, color: "#111827" },
    bodyText: { fontSize: 9, color: "#374151", lineHeight: 1.6 },

    participantRow: { flexDirection: "row", flexWrap: "wrap" },
    participantBadge: {
      backgroundColor: colore,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
      marginRight: 5,
      marginBottom: 5,
    },
    participantText: { fontSize: 8, color: "#ffffff", fontFamily: fontBody, fontWeight: 700 },

    // wrap:false (passato come prop a ogni chiamata, vedi nota sopra su sectionHeader): senza, un
    // bullet lungo (pallino + testo su più righe) può spezzarsi esattamente al bordo pagina
    // lasciando il pallino solo in fondo a una pagina col testo che ricomincia sulla successiva
    // senza il suo pallino. wrap:false forza l'intero bullet (pallino+testo) a spostarsi in blocco
    // sulla pagina nuova se non ci sta — corretto per contenuto reale (poche frasi), che non arriva
    // mai vicino all'altezza di una pagina intera. Stesso ragionamento in ReportCommercialePdf.tsx.
    bulletItem: { flexDirection: "row", marginBottom: 4, alignItems: "flex-start" },
    bullet: { width: 5, height: 5, borderRadius: 3, backgroundColor: colore, marginTop: 4, marginRight: 7, flexShrink: 0 },
    bulletText: { fontSize: 9, color: "#374151", lineHeight: 1.5, flex: 1 },

    // actionItem resta atomico (wrap:false passato come prop sotto): un action item è per natura
    // una riga corta (un impegno, non un paragrafo) — non lo stesso rischio di bulletItem sopra.
    actionItem: {
      flexDirection: "row",
      marginBottom: 4,
      backgroundColor: coloreMedio,
      borderRadius: 4,
      minHeight: 24,
      overflow: "hidden",
    },
    actionNumberBox: {
      width: 24,
      backgroundColor: colore,
      justifyContent: "center",
      alignItems: "center",
      flexShrink: 0,
      paddingVertical: 6,
    },
    actionNumberText: { fontSize: 7, fontFamily: FONT_LABEL, fontWeight: 700, color: "#ffffff" },
    actionBody: { flex: 1, paddingHorizontal: 8, paddingVertical: 5 },
    actionText: { fontSize: 8.5, color: "#1e3a5f", lineHeight: 1.4 },
    actionAssignee: { fontSize: 7.5, color: colore, fontFamily: fontBody, fontWeight: 700, marginTop: 2 },

    kpiGrid: { flexDirection: "row", flexWrap: "wrap" },
    kpiCell: { width: "50%", paddingRight: 5, paddingBottom: 5 },
    kpiInner: { borderWidth: 0.75, borderColor: "#e5e7eb", borderRadius: 4, padding: 8, minHeight: 70 },
    kpiLabel: { fontSize: 7, letterSpacing: 0.5, color: colore, fontFamily: FONT_LABEL, fontWeight: 500, marginBottom: 4 },
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
    footerLink: { fontSize: 7, color: colore, fontFamily: fontBody, fontWeight: 500 },
  });
}

function splitLines(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

const h = React.createElement;

// `styles` non è più un oggetto module-level (vedi buildStyles sopra: un set diverso per
// cliente, costruito per render) — questi helper, definiti fuori dal componente, lo ricevono
// come prop invece di chiuderlo per closure.
type Styles = ReturnType<typeof buildStyles>;

function SectionHeader({ title, styles }: { title: string; styles: Styles }) {
  return h(View, { style: styles.sectionHeader, wrap: false, minPresenceAhead: 90 }, h(View, { style: styles.sectionBar }), h(Text, { style: styles.sectionTitle }, title));
}

function BulletSection({ title, text, styles }: { title: string; text: string; styles: Styles }) {
  const lines = splitLines(text);
  if (lines.length === 0) return null;
  return h(
    View,
    { style: styles.section },
    h(SectionHeader, { title, styles }),
    ...lines.map((line, i) => h(View, { key: i, style: styles.bulletItem, wrap: false }, h(View, { style: styles.bullet }), h(Text, { style: styles.bulletText }, line)))
  );
}

function KpiCell({ label, value, styles }: { label: string; value: string; styles: Styles }) {
  return h(
    View,
    { style: styles.kpiCell, wrap: false },
    h(View, { style: styles.kpiInner }, h(Text, { style: styles.kpiLabel }, label.toUpperCase()), h(Text, { style: styles.kpiValue }, value))
  );
}

export function MeetingReportPdf({
  meeting,
  clienteNome,
  logoBuf,
  cliente,
}: {
  meeting: MeetingDataLoose;
  clienteNome: string;
  logoBuf: Buffer | null;
  // Colore/font personalizzati del cliente (vedi temaPdfCliente in pdfFonts.ts) — assente o senza
  // alcun campo valido = resta sui default ALC, stesso comportamento di styleTemaCliente sul web.
  cliente?: CampiTema;
}) {
  const tema = temaPdfCliente(cliente ?? { colorePrimario: "", coloreSecondario: "", fontPersonalizzato: "" }, {
    colore: BRAND_COLOR_DEFAULT,
    coloreChiaro: BRAND_SOFT_DEFAULT,
    coloreMedio: BRAND_LIGHT_DEFAULT,
  });
  const styles = buildStyles(tema);

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
          : h(Text, { style: { fontSize: 9, fontFamily: tema.fontHeading, fontWeight: 700, color: tema.colore } }, COMPANY_NAME)
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
              h(SectionHeader, { title: "Partecipanti", styles }),
              h(View, { style: styles.participantRow }, ...participants.map((p, i) => h(View, { key: i, style: styles.participantBadge, wrap: false }, h(Text, { style: styles.participantText }, p))))
            )
          : null,

        meeting.summary ? h(View, { style: styles.section }, h(SectionHeader, { title: "Sommario", styles }), h(Text, { style: styles.bodyText }, meeting.summary)) : null,

        highlights.length > 0
          ? h(
              View,
              { style: styles.section },
              h(SectionHeader, { title: "Punti salienti", styles }),
              ...highlights.map((hl, i) => h(View, { key: i, style: styles.bulletItem, wrap: false }, h(View, { style: styles.bullet }), h(Text, { style: styles.bulletText }, hl)))
            )
          : null,

        h(BulletSection, { title: "Task della settimana", text: meeting.taskSettimana ?? "", styles }),
        h(BulletSection, { title: "Task del mese", text: meeting.taskMese ?? "", styles }),
        h(BulletSection, { title: "Programma del trimestre", text: meeting.programmaTrimestre ?? "", styles }),

        actionItems.length > 0
          ? h(
              View,
              { style: styles.section },
              h(SectionHeader, { title: "Action items", styles }),
              ...actionItems.map((item, i) =>
                h(
                  View,
                  { key: i, style: styles.actionItem, wrap: false },
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
              h(SectionHeader, { title: "KPI", styles }),
              h(View, { style: styles.kpiGrid }, ...kpis.map(([label, value]) => h(KpiCell, { key: label, label, value, styles })))
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
