"use client";

import Image from "next/image";
import { EditableInline } from "@/components/ui/EditableInline";
import { MultilineEditor } from "@/components/ui/MultilineEditor";
import { formatEuro } from "@/lib/format";
import type { ReportCommercialeDataLoose } from "@/types/prospect";

const COMPANY_NAME = "Andrea Lenzi Consulting";

// Definisce l'ordine reale delle sezioni narrative — usato SIA per generare l'Indice sia per gli
// id di scroll (#quadro-emerso ecc.) sotto: un solo elenco, mai due liste che possono disallinearsi.
const SEZIONI: Array<{ id: string; titolo: string }> = [
  { id: "quadro-emerso", titolo: "Quadro emerso" },
  { id: "obiettivi-aziendali", titolo: "Obiettivi aziendali" },
  { id: "strategia-proposta", titolo: "Strategia proposta" },
  { id: "soluzione", titolo: "Soluzione" },
  { id: "prossimi-passi", titolo: "Prossimi passi" },
];

/**
 * Vista "report" del Report Commerciale — stessa impostazione di MeetingReportView.tsx (report
 * brandizzato, leggibile in pagina, modificabile inline sezione per sezione se `onChange` è
 * passato). Struttura rivista 11/2026 (richiesta esplicita dell'utente, "più discorsivo"): le
 * vecchie sezioni separate Criticità/Tentate Soluzioni/PAIN/Comunicazione Corretta secondo AL
 * sono fuse in un unico "Quadro emerso" narrativo — vedi il commento su
 * ReportCommercialeDataLoose in types/prospect.ts per il perché. Riusa gli editor generici così
 * come sono (EditableInline/MultilineEditor).
 */
export function ReportCommercialeView({
  report,
  onChange,
}: {
  report: ReportCommercialeDataLoose;
  onChange?: (updates: Partial<ReportCommercialeDataLoose>) => void;
}) {
  const editable = !!onChange;
  const set = (updates: Partial<ReportCommercialeDataLoose>) => onChange?.(updates);
  const partecipanti = report.partecipanti ?? [];

  return (
    <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 sm:px-10 py-7 sm:py-8 bg-brand">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-blue-100 text-[10px] font-medium uppercase tracking-widest mb-2">Report Commerciale</p>
            <EditableInline
              value={report.titolo ?? ""}
              onChange={(v) => set({ titolo: v })}
              editable={editable}
              className="font-heading text-white text-xl sm:text-2xl font-bold leading-tight break-words w-full bg-transparent placeholder-white/60"
              placeholder="Titolo chiamata"
            />
          </div>
          <div className="flex-shrink-0">
            <Image src="/lenzi.webp" alt={COMPANY_NAME} width={110} height={44} className="object-contain" style={{ filter: "brightness(0) invert(1)" }} />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5">
          <MetaItem>
            <DateIcon />
            <EditableInline
              value={report.data ?? ""}
              onChange={(v) => set({ data: v })}
              editable={editable}
              className="text-blue-100 bg-transparent placeholder-blue-200/60 w-24"
              placeholder="GG/MM/AAAA"
            />
          </MetaItem>
          {partecipanti.length > 0 && (
            <MetaItem>
              <PeopleIcon />
              {partecipanti.join(", ")}
            </MetaItem>
          )}
          <MetaItem>
            <FlagIcon />
            {editable ? (
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!report.chiamataDiChiusura}
                  onChange={(e) => set({ chiamataDiChiusura: e.target.checked })}
                  className="rounded"
                />
                Chiamata di chiusura (con presentazione dell&apos;offerta)
              </label>
            ) : (
              <span>{report.chiamataDiChiusura ? "Chiamata di chiusura" : "Chiamata di scoperta"}</span>
            )}
          </MetaItem>
        </div>
      </div>

      <div className="px-6 sm:px-10 py-7 sm:py-8 space-y-7">
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <InfoBlock label="Ragione sociale" value={report.ragioneSociale ?? ""} onChange={(v) => set({ ragioneSociale: v })} editable={editable} />
          <InfoBlock label="Nome e cognome" value={report.nomeContatto ?? ""} onChange={(v) => set({ nomeContatto: v })} editable={editable} />
          <InfoBlock label="Tipo business" value={report.tipoBusiness ?? ""} onChange={(v) => set({ tipoBusiness: v })} editable={editable} />
          <InfoBlock label="Fatturato" value={report.fatturato ?? ""} onChange={(v) => set({ fatturato: v })} editable={editable} />
          <InfoBlock label="Sedi" value={report.sedi ?? ""} onChange={(v) => set({ sedi: v })} editable={editable} />
        </section>

        {/* Indice — sola navigazione, mai modificabile: riflette sempre l'ordine reale delle
            sezioni sotto (stesso elenco SEZIONI usato per gli id di scroll). */}
        <nav aria-label="Indice del report" className="rounded-xl border border-ink-300/60 bg-surface px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-500 mb-2">Indice</p>
          <ol className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm">
            {SEZIONI.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-brand hover:underline">
                  {i + 1}. {s.titolo}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <section id="quadro-emerso">
          <SectionTitle>Quadro emerso</SectionTitle>
          <MultilineEditor
            value={report.quadroEmerso ?? ""}
            onChange={(v) => set({ quadroEmerso: v })}
            editable={editable}
            placeholder="Criticità, cosa ha già provato e l'impatto reale sul prospect — un racconto unico"
          />
        </section>

        <section id="obiettivi-aziendali">
          <SectionTitle>Obiettivi aziendali</SectionTitle>
          <MultilineEditor value={report.obiettivi ?? ""} onChange={(v) => set({ obiettivi: v })} editable={editable} placeholder="Cosa vuole ottenere il prospect" />
        </section>

        <section id="strategia-proposta">
          <SectionTitle>Strategia proposta</SectionTitle>
          <MultilineEditor
            value={report.strategiaProposta ?? ""}
            onChange={(v) => set({ strategiaProposta: v })}
            editable={editable}
            placeholder="Il ragionamento/approccio proposto in risposta al quadro emerso"
          />
        </section>

        <section id="soluzione">
          <SectionTitle>Soluzione</SectionTitle>
          <p className="text-xs text-ink-500 mt-0.5">Dettaglio del servizio proposto.</p>
          <div className="mt-3">
            <MultilineEditor
              value={report.soluzioneProposta ?? ""}
              onChange={(v) => set({ soluzioneProposta: v })}
              editable={editable}
              placeholder="Cosa è incluso, come funziona in pratica"
            />
          </div>
        </section>

        {(editable || report.budgetMedioMensile != null || report.fatturatoAttesoMensile != null) && (
          <section>
            <SectionTitle>Target commerciali</SectionTitle>
            <p className="text-xs text-ink-500 mt-0.5">
              Stima a mano del commerciale — per il calcolo automatico (budget/appuntamenti/lead necessari) vedi il
              Calcolatore Budget del prospect.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumeroBlock
                label="Budget medio mensile"
                value={report.budgetMedioMensile ?? null}
                onChange={(v) => set({ budgetMedioMensile: v })}
                editable={editable}
              />
              <NumeroBlock
                label="Fatturato atteso mensile"
                value={report.fatturatoAttesoMensile ?? null}
                onChange={(v) => set({ fatturatoAttesoMensile: v })}
                editable={editable}
              />
            </div>
          </section>
        )}

        <section id="prossimi-passi">
          <SectionTitle>Prossimi passi</SectionTitle>
          <MultilineEditor value={report.prossimiPassi ?? ""} onChange={(v) => set({ prossimiPassi: v })} editable={editable} placeholder="Cosa è stato concordato per il seguito" />
        </section>

        <div className="pt-5 mt-2 border-t border-ink-300/60 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
          <span>{COMPANY_NAME} — Report commerciale</span>
          {report.rawUrl && (
            <a href={report.rawUrl} className="hover:underline font-medium text-brand" target="_blank" rel="noopener noreferrer">
              Apri la chiamata originale →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaItem({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1.5 text-blue-100 text-sm">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1 h-5 rounded-full bg-brand" />
      <h3 className="font-heading font-bold text-ink-900 text-[15px]">{children}</h3>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  onChange,
  editable,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
}) {
  return (
    <div className="rounded-xl bg-brand-light px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest font-semibold text-brand">{label}</p>
      {editable ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full text-sm font-semibold text-ink-900 bg-transparent border border-transparent hover:border-blue-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded px-2 -mx-2 py-1 outline-none transition-colors"
          placeholder={`Inserisci ${label.toLowerCase()}`}
        />
      ) : (
        <p className="mt-1 text-sm font-semibold text-ink-900">{value || "—"}</p>
      )}
    </div>
  );
}

function NumeroBlock({
  label,
  value,
  onChange,
  editable,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  editable: boolean;
}) {
  return (
    <div className="rounded-xl bg-brand-light px-4 py-3">
      <p className="text-[10px] uppercase tracking-widest font-semibold text-brand">{label}</p>
      {editable ? (
        <input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="mt-1 w-full text-sm font-semibold text-ink-900 bg-transparent border border-transparent hover:border-blue-200 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 rounded px-2 -mx-2 py-1 outline-none transition-colors"
          placeholder="—"
        />
      ) : (
        <p className="mt-1 text-sm font-semibold text-ink-900">{value !== null ? formatEuro(value) : "—"}</p>
      )}
    </div>
  );
}

function DateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function PeopleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}
