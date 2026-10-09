import { ordinaPerPriorita, type SaluteClienteItem } from "@/lib/dashboardAdmin";
import { formatDataBreve, formatEuro } from "@/lib/format";
import { giorniTra } from "@/lib/roadmap";
import type { Consulente } from "@/types/kpi";

/**
 * Il riepilogo via email per l'amministrazione (09/10/2026, ultima voce della Fase 1 della roadmap:
 * "riepilogo periodico via email dei clienti che richiedono attenzione, senza dover aprire la
 * dashboard"). Funzioni pure: da ciò che la pagina Clienti già calcola (src/lib/saluteClienti.ts)
 * ricavano chi va guardato e perché, e compongono oggetto e corpo dell'email.
 *
 * Un cliente "richiede attenzione" per le stesse ragioni per cui la pagina Clienti lo segnala:
 *   - il costo per lead degli ultimi sette giorni è oltre il target (stato "interveni");
 *   - ha attività scadute e non fatte;
 *   - il clima degli incontri è negativo (stessa regola dell'avviso "cliente a rischio").
 * In testa, se ci sono, le sedi i cui dati Meta sono fermi: lì i numeri non sono affidabili.
 *
 * L'email parte anche quando non c'è nulla da segnalare, e lo dice: un riepilogo che non arriva non
 * distingue "tutto a posto" da "si è rotto l'invio".
 */

/**
 * Chi riceve il riepilogo se nessuno ha indicato altro: la casella dell'agenzia e Francesco (aggiunto
 * su richiesta dell'utente il 09/10/2026). Per cambiarli senza toccare il codice c'è la variabile
 * d'ambiente RIEPILOGO_ADMIN_DESTINATARI, che li SOSTITUISCE.
 */
export const DESTINATARI_PREDEFINITI = ["info@andrealenziconsulting.com", "francesco@andrealenziconsulting.com"];

/** I destinatari da una riga di indirizzi separati da virgola; vuota o assente = quelli predefiniti. */
export function destinatariDa(indicati: string | undefined): string[] {
  const scelti = Array.from(new Set((indicati ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)));
  return scelti.length > 0 ? scelti : DESTINATARI_PREDEFINITI;
}

/** Quante attività in ritardo si elencano per cliente: le altre si contano soltanto. */
const ATTIVITA_ELENCATE = 3;

export type DatiMetaFermi = { nomeCliente: string; nomeSede: string | null; ultimoGiorno: string | null; causa: "accesso" | "non-verificato" | "sincronizzazione" };

export type VoceRiepilogo = {
  clienteId: string;
  nome: string;
  consulente: string;
  /** Una frase per ogni ragione, già pronta da leggere. */
  motivi: string[];
  /** Le attività più in ritardo, e quante ne restano fuori dall'elenco. */
  attivita: { descrizione: string; giorniDiRitardo: number }[];
  altreAttivita: number;
  link: string;
};

function motivoAds(item: SaluteClienteItem): string[] {
  const fuoriTarget = item.sedi.filter((s) => s.valutazione.stato === "interveni");
  const piuSedi = item.sedi.length > 1;
  return fuoriTarget.map((s) => {
    const cosa = s.valutazione.metricaUsata === "vendita" ? "Costo per vendita" : "Costo per lead";
    return `${piuSedi ? `${s.sede.nome}: ` : ""}${cosa} ${formatEuro(s.valutazione.valoreAttuale)} contro un target di ${formatEuro(s.valutazione.targetUsato)}`;
  });
}

/** Solo i clienti che richiedono attenzione, dal più urgente (stesso ordine della pagina Clienti). */
export function vociDaGuardare(input: { items: SaluteClienteItem[]; consulenti: Pick<Consulente, "consulenteId" | "nome">[]; oggi: string; indirizzoApp: string }): VoceRiepilogo[] {
  const { items, consulenti, oggi, indirizzoApp } = input;
  const nomeConsulente = new Map(consulenti.map((c) => [c.consulenteId, c.nome]));
  return ordinaPerPriorita(items)
    .filter((i) => i.valutazione.stato === "interveni" || i.attivitaInRitardo.length > 0 || i.sentimentCritico)
    .map((i) => {
      const motivi = motivoAds(i);
      const inRitardo = i.attivitaInRitardo.length;
      if (inRitardo > 0) motivi.push(inRitardo === 1 ? "1 attività in ritardo" : `${inRitardo} attività in ritardo`);
      if (i.sentimentCritico) motivi.push("Clima degli incontri negativo: cliente a rischio");
      return {
        clienteId: i.cliente.clienteId,
        nome: i.cliente.nome,
        consulente: nomeConsulente.get(i.cliente.consulenteId) ?? "nessun consulente assegnato",
        motivi,
        attivita: i.attivitaInRitardo.slice(0, ATTIVITA_ELENCATE).map((a) => ({ descrizione: a.descrizione, giorniDiRitardo: giorniTra(a.dataFine, oggi) })),
        altreAttivita: Math.max(0, inRitardo - ATTIVITA_ELENCATE),
        link: `${indirizzoApp}/dashboard/cliente/${encodeURIComponent(i.cliente.clienteId)}`,
      };
    });
}

const CAUSA_FERMO: Record<DatiMetaFermi["causa"], string> = {
  accesso: "Meta rifiuta la lettura: va controllato l'accesso",
  sincronizzazione: "su Meta c'è spesa che in app non è arrivata",
  "non-verificato": "Meta non ha risposto alla verifica",
};

function rigaFermo(f: DatiMetaFermi): string {
  const dove = f.nomeSede ? `${f.nomeCliente} (${f.nomeSede})` : f.nomeCliente;
  return `${dove}: dati fermi ${f.ultimoGiorno ? `al ${formatDataBreve(f.ultimoGiorno)}` : "da sempre"} — ${CAUSA_FERMO[f.causa]}`;
}

const giorni = (n: number) => (n === 1 ? "1 giorno" : `${n} giorni`);
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type RiepilogoAdmin = { oggetto: string; testo: string; html: string; clientiDaGuardare: number; datiFermi: number };

/**
 * Oggetto, testo semplice e html dell'email. `da`/`a` sono i giorni su cui è giudicato il costo per
 * lead (gli stessi della pagina Clienti); `clientiValutati` quanti clienti sono stati guardati.
 */
export function componiRiepilogoAdmin(input: { voci: VoceRiepilogo[]; datiFermi: DatiMetaFermi[]; clientiValutati: number; da: string; a: string; oggi: string; indirizzoApp: string }): RiepilogoAdmin {
  const { voci, datiFermi, clientiValutati, da, a, oggi, indirizzoApp } = input;
  const n = voci.length;
  const oggetto =
    n === 0
      ? datiFermi.length > 0
        ? `Clienti: nessuno da guardare, ma dati Meta fermi (${formatDataBreve(oggi)})`
        : `Clienti: nessuno richiede attenzione (${formatDataBreve(oggi)})`
      : `Clienti da guardare: ${n} su ${clientiValutati} (${formatDataBreve(oggi)})`;
  const apertura =
    n === 0
      ? `Nessuno dei ${clientiValutati} clienti attivi richiede attenzione: nessun costo per lead oltre il target, nessuna attività in ritardo, nessun cliente a rischio.`
      : `${n === 1 ? "1 cliente richiede" : `${n} clienti richiedono`} attenzione, su ${clientiValutati} attivi. Sono in ordine di urgenza.`;
  const periodo = `Il costo per lead è quello degli ultimi sette giorni (${formatDataBreve(da)} – ${formatDataBreve(a)}).`;
  const chiusura = `È lo stesso quadro della pagina Clienti: ${indirizzoApp}/dashboard`;

  // ---------- testo semplice ----------
  const righe: string[] = [apertura, periodo, ""];
  if (datiFermi.length > 0) {
    righe.push("DATI META FERMI — qui i numeri non sono affidabili:");
    for (const f of datiFermi) righe.push(`- ${rigaFermo(f)}`);
    righe.push("");
  }
  for (const v of voci) {
    righe.push(`${v.nome} — ${v.consulente}`);
    for (const m of v.motivi) righe.push(`- ${m}`);
    for (const t of v.attivita) righe.push(`    · ${t.descrizione} (scaduta da ${giorni(t.giorniDiRitardo)})`);
    if (v.altreAttivita > 0) righe.push(`    · e altre ${v.altreAttivita}`);
    righe.push(`  ${v.link}`, "");
  }
  righe.push(chiusura);

  // ---------- html ----------
  const stile = {
    corpo: "font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#33475b;max-width:640px;margin:0 auto;padding:8px 0;",
    titolo: "font-size:20px;line-height:26px;font-weight:bold;color:#002f54;margin:0 0 8px;",
    secondario: "color:#5d6b7d;font-size:13px;line-height:20px;margin:0 0 20px;",
    scheda: "border:1px solid #dde3ea;border-radius:10px;padding:14px 16px;margin:0 0 12px;",
    nome: "font-size:16px;line-height:22px;font-weight:bold;color:#002f54;text-decoration:none;",
    fermi: "border-left:4px solid #9a5c00;background:#fcefd2;padding:12px 16px;margin:0 0 20px;border-radius:0 8px 8px 0;",
  };
  const schede = voci
    .map(
      (v) => `<div style="${stile.scheda}">
  <a href="${escapeHtml(v.link)}" style="${stile.nome}">${escapeHtml(v.nome)}</a>
  <span style="color:#5d6b7d;font-size:13px;"> · ${escapeHtml(v.consulente)}</span>
  <ul style="margin:8px 0 0;padding-left:20px;">${v.motivi.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>${
    v.attivita.length > 0
      ? `\n  <ul style="margin:6px 0 0;padding-left:36px;color:#5d6b7d;font-size:13px;line-height:20px;">${v.attivita
          .map((t) => `<li>${escapeHtml(t.descrizione)} — scaduta da ${giorni(t.giorniDiRitardo)}</li>`)
          .join("")}${v.altreAttivita > 0 ? `<li>e altre ${v.altreAttivita}</li>` : ""}</ul>`
      : ""
  }
</div>`
    )
    .join("\n");
  const html = `<div style="${stile.corpo}">
<p style="${stile.titolo}">${n === 0 ? "Nessun cliente richiede attenzione" : n === 1 ? "1 cliente da guardare" : `${n} clienti da guardare`}</p>
<p style="${stile.secondario}">${escapeHtml(apertura)} ${escapeHtml(periodo)}</p>
${
  datiFermi.length > 0
    ? `<div style="${stile.fermi}"><strong style="color:#9a5c00;">Dati Meta fermi</strong> — qui i numeri non sono affidabili:<ul style="margin:6px 0 0;padding-left:20px;">${datiFermi
        .map((f) => `<li>${escapeHtml(rigaFermo(f))}</li>`)
        .join("")}</ul></div>`
    : ""
}
${schede}
<p style="${stile.secondario}margin-top:20px;">È lo stesso quadro della <a href="${escapeHtml(indirizzoApp)}/dashboard" style="color:#1b75bc;">pagina Clienti</a>.</p>
</div>`;

  return { oggetto, testo: righe.join("\n"), html, clientiDaGuardare: n, datiFermi: datiFermi.length };
}
