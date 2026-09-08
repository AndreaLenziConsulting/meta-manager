"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Folder, ExternalLink } from "lucide-react";
import { LogoONomeCliente } from "@/components/LogoONomeCliente";

/**
 * Prima cosa visibile sulla scheda di un cliente: il nome (o il suo logo, se personalizzato — vedi
 * temaCliente.ts) e la via per tornare indietro. Usa le prop passate da page.tsx (risolte lato
 * server, note subito) — non aspetta la risposta di /api/kpi come faceva `dati.cliente.nome` in
 * precedenza, così compare prima di qualunque fetch. Mai sul link pubblico (`code`): quella pagina
 * (src/app/report/[code]/page.tsx) ha già il proprio header col nome/logo del cliente sopra
 * SchedaCliente — qui comparirebbe raddoppiato.
 *
 * "Torna indietro" usa router.back() (cronologia del browser), non più un link fisso: si arriva a
 * una scheda cliente sia dalla vista priorità sia da quella per consulente (entrambe dentro
 * /dashboard, vedi DashboardClienti.tsx), e "indietro" deve tornare a quella di partenza, non
 * sempre alla stessa. Fallback a /dashboard solo se non c'è cronologia (arrivo diretto via URL,
 * link pubblico incluso raro ma possibile).
 *
 * `settimanaProgetto`/`driveFolderUrl`/`landingPageUrl` sono le stesse aggiunte "anagrafiche" del
 * cliente (mai sul link pubblico, stesso motivo del resto dell'header) — link rapidi e contesto
 * temporale che il consulente vuole avere sotto mano senza aprire "Modifica cliente". Se un link
 * non è ancora impostato, l'admin può aggiungerlo qui stesso (LinkRapido sotto, mini-form inline,
 * stesso pattern di "+ Aggiungi ad account" in KpiSection.tsx) invece di dover aprire l'intero
 * modale — richiesta esplicita dell'utente ("non c'è modo di arrivarci se non dalla modifica").
 *
 * `appuntamentiFileUrl` invece non è mai impostato a mano (nessun LinkRapido "+ Appuntamenti"): è
 * un get-or-create automatico dentro driveFolderUrl (vedi /api/clienti/file-appuntamenti +
 * src/lib/appuntamentiFile.ts), gated su `!haConnessioneGhl` — decisione esplicita dell'utente
 * (08/09/2026): un cliente con GHL connesso ha gli appuntamenti letti in diretta, non ha senso
 * chiedergli di compilarli a mano. Se manca driveFolderUrl (prerequisito: serve una cartella dove
 * creare il file) l'errore è mostrato solo all'admin, unico ruolo che può risolverlo.
 */
export function ClienteHeader({
  clienteId,
  clienteNome,
  clienteLogoUrl,
  settimanaProgetto,
  driveFolderUrl,
  landingPageUrl,
  appuntamentiFileUrl,
  haConnessioneGhl,
  ruoloAdmin,
}: {
  clienteId: string;
  clienteNome: string;
  clienteLogoUrl?: string;
  settimanaProgetto?: number | null;
  driveFolderUrl?: string;
  landingPageUrl?: string;
  appuntamentiFileUrl?: string;
  haConnessioneGhl?: boolean;
  ruoloAdmin?: boolean;
}) {
  const router = useRouter();

  // Override ottimistico dopo un salvataggio riuscito, scoped al clienteId corrente — stesso
  // pattern "contesto" di sedeScelta/filtroCampagne in KpiSection.tsx: senza questo confronto, se
  // il componente non si smonta passando a un altro cliente (transizione client-side), l'override
  // del cliente precedente resterebbe visibile su quello nuovo.
  const [linkSalvati, setLinkSalvati] = useState<{ clienteId: string; driveFolderUrl?: string; landingPageUrl?: string }>({ clienteId });
  const driveFolderUrlEffettivo = (linkSalvati.clienteId === clienteId ? linkSalvati.driveFolderUrl : undefined) ?? driveFolderUrl;
  const landingPageUrlEffettivo = (linkSalvati.clienteId === clienteId ? linkSalvati.landingPageUrl : undefined) ?? landingPageUrl;

  // Stato del get-or-create automatico del file appuntamenti — stesso schema "contesto" di
  // linkSalvati sopra, ma qui la fonte è un fetch automatico, non un salvataggio dell'utente.
  const [statoFile, setStatoFile] = useState<{ clienteId: string; url?: string; errore?: string }>({ clienteId });
  const appuntamentiFileUrlEffettivo = (statoFile.clienteId === clienteId ? statoFile.url : undefined) ?? appuntamentiFileUrl;
  const erroreFile = statoFile.clienteId === clienteId ? statoFile.errore : undefined;

  useEffect(() => {
    // Niente da fare: GHL connesso (nessuna compilazione manuale ha senso) o il link esiste già
    // (creato in una visita precedente, arrivato via prop da Cliente.appuntamentiFileUrl).
    if (haConnessioneGhl || appuntamentiFileUrl) return;
    const controller = new AbortController();
    fetch("/api/clienti/file-appuntamenti", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Errore sconosciuto");
        setStatoFile({ clienteId, url: body.url });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatoFile({ clienteId, errore: err instanceof Error ? err.message : "Errore sconosciuto" });
      });
    return () => controller.abort();
  }, [clienteId, haConnessioneGhl, appuntamentiFileUrl]);

  async function salvaLinkRapido(campo: "driveFolderUrl" | "landingPageUrl", valore: string) {
    const res = await fetch("/api/clienti", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId, [campo]: valore }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
    setLinkSalvati((prev) => ({ ...(prev.clienteId === clienteId ? prev : { clienteId }), [campo]: valore }));
  }

  function tornaIndietro() {
    // history.length === 1 -> questa scheda era la prima voce di cronologia della sessione (arrivo
    // diretto via URL/bookmark): router.back() non avrebbe nessun posto dove tornare.
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <button
        type="button"
        onClick={tornaIndietro}
        aria-label="Torna indietro"
        title="Torna indietro"
        className="flex items-center justify-center w-9 h-9 rounded-xl border border-ink-300 bg-surface-card text-ink-500 hover:text-ink-900 hover:border-ink-400 transition shrink-0 cursor-pointer"
      >
        <ArrowLeft size={18} />
      </button>
      <h1>
        <LogoONomeCliente
          nome={clienteNome}
          logoUrl={clienteLogoUrl}
          className={clienteLogoUrl ? "h-9 w-auto object-contain" : "font-heading font-bold text-2xl text-ink-900"}
        />
      </h1>

      {Boolean(settimanaProgetto) && (
        <span className="text-xs font-semibold text-ink-500 bg-surface-card border border-ink-300 rounded-full px-3 py-1">
          Settimana {settimanaProgetto}
        </span>
      )}

      <div className="flex items-center gap-2 ml-auto">
        <LinkRapido
          label="Drive"
          icona={Folder}
          url={driveFolderUrlEffettivo}
          titleApri="Apri la cartella Drive del cliente"
          placeholder="https://drive.google.com/…"
          puoModificare={Boolean(ruoloAdmin)}
          onSalva={(valore) => salvaLinkRapido("driveFolderUrl", valore)}
        />
        <LinkRapido
          label="Landing page"
          icona={ExternalLink}
          url={landingPageUrlEffettivo}
          titleApri="Apri la landing page del cliente"
          placeholder="https://…"
          puoModificare={Boolean(ruoloAdmin)}
          onSalva={(valore) => salvaLinkRapido("landingPageUrl", valore)}
        />
        {!haConnessioneGhl && appuntamentiFileUrlEffettivo && (
          <a
            href={appuntamentiFileUrlEffettivo}
            target="_blank"
            rel="noopener noreferrer"
            title="Apri il file dove compilare gli appuntamenti del cliente"
            className={classePillo}
          >
            <ClipboardList size={14} /> Appuntamenti
          </a>
        )}
        {/* Errore visibile solo all'admin: è l'unico ruolo che può risolverlo (collegando la
            cartella Drive, vedi il commento sopra sull'effect) — un consulente non ci può fare
            nulla, mostrarglielo sarebbe solo rumore. */}
        {!haConnessioneGhl && !appuntamentiFileUrlEffettivo && erroreFile && ruoloAdmin && (
          <span
            title={erroreFile}
            className="flex items-center gap-1.5 text-xs font-semibold text-yellow-800 bg-yellow-50 border border-yellow-100 rounded-full px-3 py-1.5 cursor-help"
          >
            <ClipboardList size={14} /> Appuntamenti — errore
          </span>
        )}
      </div>
    </div>
  );
}

const classePillo =
  "flex items-center gap-1.5 text-xs font-semibold text-ink-700 bg-surface-card border border-ink-300 rounded-full px-3 py-1.5 hover:border-brand hover:text-brand transition cursor-pointer";

/**
 * Un link rapido dell'header (Drive/Landing page): pillola che apre il link se impostato, altrimenti
 * — solo per chi può modificare il cliente — una pillola "+ <label>" che apre un mini-form inline
 * per aggiungerlo, senza dover passare da "Modifica cliente". Chi non può modificare (consulente,
 * link pubblico) semplicemente non vede nulla quando il link manca — comportamento invariato.
 */
function LinkRapido({
  label,
  icona: Icona,
  url,
  titleApri,
  placeholder,
  puoModificare,
  onSalva,
}: {
  label: string;
  icona: typeof Folder;
  url: string | undefined;
  titleApri: string;
  placeholder: string;
  puoModificare: boolean;
  onSalva: (valore: string) => Promise<void>;
}) {
  const [aperto, setAperto] = useState(false);
  const [bozza, setBozza] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" title={titleApri} className={classePillo}>
        <Icona size={14} /> {label}
      </a>
    );
  }

  if (!puoModificare) return null;

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        title={`Aggiungi il link ${label}`}
        className="flex items-center gap-1.5 text-xs font-semibold text-ink-500 bg-surface-card border border-dashed border-ink-300 rounded-full px-3 py-1.5 hover:border-brand hover:text-brand transition cursor-pointer"
      >
        <Icona size={14} /> + {label}
      </button>
    );
  }

  async function handleSalva() {
    const valore = bozza.trim();
    if (!/^https?:\/\//.test(valore)) {
      setErrore("Deve iniziare con http:// o https://");
      return;
    }
    setSalvando(true);
    setErrore(null);
    try {
      await onSalva(valore);
      setAperto(false);
      setBozza("");
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        value={bozza}
        onChange={(e) => setBozza(e.target.value)}
        placeholder={placeholder}
        autoFocus
        className="rounded-lg border border-ink-300 bg-surface-card px-2.5 py-1.5 text-xs text-ink-900 outline-none focus:ring-2 focus:ring-brand/30 w-56"
      />
      <button
        type="button"
        onClick={handleSalva}
        disabled={salvando}
        className="rounded-lg bg-cta hover:bg-cta-dark disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 transition cursor-pointer"
      >
        {salvando ? "Salvataggio…" : "Salva"}
      </button>
      <button
        type="button"
        onClick={() => {
          setAperto(false);
          setErrore(null);
        }}
        className="text-ink-500 hover:text-ink-700 text-xs font-medium px-1 cursor-pointer"
      >
        Annulla
      </button>
      {errore && <span className="text-red-600 text-[11px]">{errore}</span>}
    </div>
  );
}
