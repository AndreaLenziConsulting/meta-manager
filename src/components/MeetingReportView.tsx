"use client";

import Image from "next/image";
import { EditableInline } from "@/components/ui/EditableInline";
import { EditableTextarea } from "@/components/ui/EditableTextarea";
import { MultilineEditor } from "@/components/ui/MultilineEditor";
import { BulletListEditor } from "@/components/ui/BulletListEditor";
import type { ActionItem, MeetingDataLoose } from "@/types/meeting";

const COMPANY_NAME = "Andrea Lenzi Consulting";

/**
 * Vista "report" del meeting — porting fedele di `ReportPreview.tsx` di Fast Report: lo stesso
 * report brandizzato, leggibile direttamente in pagina (senza dover scaricare il PDF) e, se
 * `onChange` è passato, modificabile inline sezione per sezione. Usata sia per l'anteprima
 * pre-salvataggio sia per rivedere/correggere un meeting già salvato nello storico — stessa identica
 * vista in entrambi i casi, `editable` decide solo se i campi sono input o testo statico.
 *
 * Differenze dal porting originale, imposte da `MeetingDataLoose` (tutti i campi opzionali):
 * - accesso sempre difensivo (`?? ""` / `?? []`);
 * - "Cliente" è `clienteNome` (prop separata, dal contesto) e non è mai editabile qui — `meeting.cliente`
 *   è testo libero dedotto dall'LLM, sempre ignorato (vedi types/meeting.ts);
 * - aggiunta "Data consulenza" (assente nel form precedente, ma già usata da PDF/email/foglio esterno
 *   con fallback su `date` — va esposta ed editabile, non solo derivata);
 * - il campo data nell'header resta legato a `date` (non `dataConsulenza`): è quello che il server
 *   valida per salvare (`dataItalianaAIso`), quindi deve restare l'unico bound lì.
 */
export function MeetingReportView({
  meeting,
  clienteNome,
  onChange,
}: {
  meeting: MeetingDataLoose;
  clienteNome?: string;
  onChange?: (updates: Partial<MeetingDataLoose>) => void;
}) {
  const editable = !!onChange;
  const set = (updates: Partial<MeetingDataLoose>) => onChange?.(updates);

  const participants = meeting.participants ?? [];
  const highlights = meeting.highlights ?? [];
  const actionItems = meeting.actionItems ?? [];

  return (
    <div className="rounded-2xl border border-ink-300 bg-surface-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 sm:px-10 py-7 sm:py-8 bg-brand">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-blue-100 text-[10px] font-medium uppercase tracking-widest mb-2">Meeting Report</p>
            <EditableInline
              value={meeting.title ?? ""}
              onChange={(v) => set({ title: v })}
              editable={editable}
              className="text-white text-xl sm:text-2xl font-bold leading-tight break-words w-full bg-transparent placeholder-white/60"
              placeholder="Titolo meeting"
            />
          </div>
          <div className="flex-shrink-0">
            <Image
              src="/lenzi.webp"
              alt={COMPANY_NAME}
              width={110}
              height={44}
              className="object-contain"
              style={{ filter: "brightness(0) invert(1)" }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-5">
          <MetaItem>
            <DateIcon />
            <EditableInline
              value={meeting.date ?? ""}
              onChange={(v) => set({ date: v })}
              editable={editable}
              className="text-blue-100 bg-transparent placeholder-blue-200/60 w-24"
              placeholder="GG/MM/AAAA"
            />
          </MetaItem>
          <MetaItem>
            <ClockIcon />
            <EditableInline
              value={meeting.duration ?? ""}
              onChange={(v) => set({ duration: v })}
              editable={editable}
              className="text-blue-100 bg-transparent placeholder-blue-200/60 w-20"
              placeholder="durata"
            />
          </MetaItem>
          {participants.length > 0 && (
            <MetaItem>
              <PeopleIcon />
              {participants.length} partecipanti
            </MetaItem>
          )}
        </div>
      </div>

      <div className="px-6 sm:px-10 py-7 sm:py-8 space-y-7">
        {/* Cliente / Referente / Data consulenza */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl bg-brand-light px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest font-semibold text-brand">Cliente</p>
            <p className="mt-1 text-sm font-semibold text-ink-900 truncate">{clienteNome || "—"}</p>
          </div>
          <InfoBlock label="Referente" value={meeting.referente ?? ""} onChange={(v) => set({ referente: v })} editable={editable} />
          {(meeting.dataConsulenza || editable) && (
            <InfoBlock
              label="Data consulenza"
              value={meeting.dataConsulenza ?? ""}
              onChange={(v) => set({ dataConsulenza: v })}
              editable={editable}
              placeholder={meeting.date || "GG/MM/AAAA"}
            />
          )}
        </section>

        {(meeting.sentiment || editable) && (
          <section>
            <SectionTitle>Sentiment cliente</SectionTitle>
            <EditableTextarea
              value={meeting.sentiment ?? ""}
              onChange={(v) => set({ sentiment: v })}
              editable={editable}
              className="mt-3 text-ink-700 text-sm leading-relaxed"
              placeholder="Sentiment generale del cliente, con una breve giustificazione…"
            />
          </section>
        )}

        <section>
          <SectionTitle>Partecipanti</SectionTitle>
          <ParticipantsEditor items={participants} onChange={(items) => set({ participants: items })} editable={editable} />
        </section>

        <section>
          <SectionTitle>Sommario</SectionTitle>
          <EditableTextarea
            value={meeting.summary ?? ""}
            onChange={(v) => set({ summary: v })}
            editable={editable}
            className="mt-3 text-ink-700 text-sm leading-relaxed"
            placeholder="Sommario del meeting…"
          />
        </section>

        <section>
          <SectionTitle>Punti salienti</SectionTitle>
          <BulletListEditor
            items={highlights}
            onChange={(items) => set({ highlights: items })}
            editable={editable}
            placeholder="Aggiungi un punto saliente"
          />
        </section>

        {(meeting.taskSettimana || editable) && (
          <section>
            <SectionTitle>Task della settimana</SectionTitle>
            <MultilineEditor
              value={meeting.taskSettimana ?? ""}
              onChange={(v) => set({ taskSettimana: v })}
              editable={editable}
              placeholder="Una task per riga, formato 'Nome: azione'"
            />
          </section>
        )}

        {(meeting.taskMese || editable) && (
          <section>
            <SectionTitle>Task del mese</SectionTitle>
            <MultilineEditor
              value={meeting.taskMese ?? ""}
              onChange={(v) => set({ taskMese: v })}
              editable={editable}
              placeholder="Obiettivi del mese, una riga per voce"
            />
          </section>
        )}

        {(meeting.programmaTrimestre || editable) && (
          <section>
            <SectionTitle>Programma del trimestre</SectionTitle>
            <MultilineEditor
              value={meeting.programmaTrimestre ?? ""}
              onChange={(v) => set({ programmaTrimestre: v })}
              editable={editable}
              placeholder="Direzione strategica del trimestre"
            />
          </section>
        )}

        <section>
          <SectionTitle>Action items</SectionTitle>
          {editable && <p className="text-xs text-ink-500 mt-0.5">Diventano attività nel tab Attività al salvataggio.</p>}
          <ActionItemsEditor items={actionItems} onChange={(items) => set({ actionItems: items })} editable={editable} />
        </section>

        {(meeting.kpiReali || meeting.kpiStorico || meeting.kpiTargetMarketing || meeting.kpiTargetCommerciali || editable) && (
          <section>
            <SectionTitle>KPI</SectionTitle>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <KpiBlock label="Reali" text={meeting.kpiReali ?? ""} onChange={(v) => set({ kpiReali: v })} editable={editable} />
              <KpiBlock label="Storico" text={meeting.kpiStorico ?? ""} onChange={(v) => set({ kpiStorico: v })} editable={editable} />
              <KpiBlock
                label="Target marketing"
                text={meeting.kpiTargetMarketing ?? ""}
                onChange={(v) => set({ kpiTargetMarketing: v })}
                editable={editable}
              />
              <KpiBlock
                label="Target commerciali"
                text={meeting.kpiTargetCommerciali ?? ""}
                onChange={(v) => set({ kpiTargetCommerciali: v })}
                editable={editable}
              />
            </div>
          </section>
        )}

        <div className="pt-5 mt-2 border-t border-ink-300/40 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-500">
          <span>{COMPANY_NAME} — Report meeting</span>
          {meeting.rawUrl && (
            <a href={meeting.rawUrl} className="hover:underline font-medium text-brand" target="_blank" rel="noopener noreferrer">
              Apri il meeting originale →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Action items (ActionItem[]) ───────────────────────────────────────
function ActionItemsEditor({
  items,
  onChange,
  editable,
}: {
  items: ActionItem[];
  onChange: (items: ActionItem[]) => void;
  editable: boolean;
}) {
  if (!editable) {
    return (
      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white bg-brand">{i + 1}</span>
            <span className="text-ink-700 flex-1">{item.text}</span>
            {item.assignee && <span className="text-xs text-ink-500 font-medium flex-shrink-0">{item.assignee}</span>}
          </li>
        ))}
      </ul>
    );
  }

  const update = (i: number, patch: Partial<ActionItem>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const add = () => onChange([...items, { text: "", assignee: "" }]);

  return (
    <div className="mt-3 space-y-1.5">
      {items.map((item, i) => (
        <div key={i} className="group flex items-start gap-2 text-sm">
          <span className="mt-1.5 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-white bg-brand">{i + 1}</span>
          <input
            type="text"
            value={item.text}
            onChange={(e) => update(i, { text: e.target.value })}
            placeholder="Descrizione azione"
            className="flex-1 rounded-md border border-transparent hover:border-ink-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 px-2 py-1 outline-none transition-colors text-ink-700"
          />
          <input
            type="text"
            value={item.assignee || ""}
            onChange={(e) => update(i, { assignee: e.target.value })}
            placeholder="Assegnatario"
            className="w-32 rounded-md border border-transparent hover:border-ink-300 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 px-2 py-1 outline-none transition-colors text-xs text-ink-500 font-medium"
          />
          <button type="button" onClick={() => remove(i)} className="opacity-0 group-hover:opacity-100 transition-opacity text-ink-500 hover:text-red-500 px-1 mt-1.5" aria-label="Rimuovi">
            ×
          </button>
        </div>
      ))}
      <button type="button" onClick={add} className="text-xs font-medium ml-7 mt-1.5 hover:underline text-brand">
        + Aggiungi action item
      </button>
    </div>
  );
}

// ─── Partecipanti (chips) ───────────────────────────────────────────────
function ParticipantsEditor({
  items,
  onChange,
  editable,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  editable: boolean;
}) {
  if (!editable) {
    return (
      <div className="flex flex-wrap gap-2 mt-3">
        {items.map((p, i) => (
          <span key={i} className="px-3 py-1 rounded-full text-xs font-medium text-white bg-brand">
            {p}
          </span>
        ))}
      </div>
    );
  }
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i: number, v: string) => {
    const next = [...items];
    next[i] = v;
    onChange(next);
  };
  const add = () => onChange([...items, ""]);

  return (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      {items.map((p, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 pl-3 pr-2 py-1 rounded-full text-xs font-medium text-white bg-brand">
          <input
            type="text"
            value={p}
            onChange={(e) => update(i, e.target.value)}
            className="bg-transparent outline-none border-none w-[100px] sm:w-auto sm:min-w-[80px] focus:ring-0 placeholder-white/60"
            style={{ width: `${Math.max(p.length, 6)}ch` }}
            placeholder="nome"
          />
          <button type="button" onClick={() => remove(i)} className="text-white/70 hover:text-white text-base leading-none" aria-label="Rimuovi">
            ×
          </button>
        </span>
      ))}
      <button type="button" onClick={add} className="text-xs font-medium hover:underline text-brand">
        + partecipante
      </button>
    </div>
  );
}

// ─── Helper statici ──────────────────────────────────────────────────
function MetaItem({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-1.5 text-blue-100 text-sm">{children}</div>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-1 h-5 rounded-full bg-brand" />
      <h3 className="font-semibold text-ink-900 text-[15px]">{children}</h3>
    </div>
  );
}

function InfoBlock({
  label,
  value,
  onChange,
  editable,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editable: boolean;
  placeholder?: string;
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
          placeholder={placeholder || `Inserisci ${label.toLowerCase()}`}
        />
      ) : (
        <p className="mt-1 text-sm font-semibold text-ink-900">{value || "—"}</p>
      )}
    </div>
  );
}

function KpiBlock({
  label,
  text,
  onChange,
  editable,
}: {
  label: string;
  text: string;
  onChange: (v: string) => void;
  editable: boolean;
}) {
  if (!editable && !text) return null;
  return (
    <div className="rounded-xl border border-ink-300/40 p-4 bg-surface-card">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-brand">{label}</p>
      <div className="mt-2">
        <EditableTextarea value={text} onChange={onChange} editable={editable} className="text-sm text-ink-700 leading-relaxed" placeholder="—" />
      </div>
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

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
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
