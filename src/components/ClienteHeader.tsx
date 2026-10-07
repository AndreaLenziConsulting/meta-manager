"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ClipboardList, Filter, Folder, Pencil, Trash2 } from "lucide-react";
import { LogoONomeCliente } from "@/components/LogoONomeCliente";
import { TopbarPortal } from "@/components/TopbarSlot";
import { ModificaClienteModal } from "@/components/ModificaClienteModal";
import { Badge } from "@/components/ui/Badge";
import { Button, CLASSE_PULSANTE, DIMENSIONE_PULSANTE, VARIANTE_PULSANTE } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Nota } from "@/components/ui/Nota";
import { PulsanteIcona } from "@/components/ui/PulsanteIcona";
import { cn } from "@/lib/cn";
import type { Cliente, Consulente, Funnel, Sede } from "@/types/kpi";

/**
 * Prima cosa visibile sulla scheda di un cliente: il nome (o il suo logo, se personalizzato — vedi
 * temaCliente.ts) e la via per tornare indietro. Usa le prop passate da page.tsx (risolte lato
 * server, note subito) — non aspetta la risposta di /api/kpi come faceva `dati.cliente.nome` in
 * precedenza, così compare prima di qualunque fetch. Mai sul link pubblico (`code`): quella pagina
 * (src/app/report/[code]/page.tsx) ha già il proprio header col nome/logo del cliente sopra
 * SchedaCliente — qui comparirebbe raddoppiato.
 *
 * Redesign "Vetro ALC", topbar unificata (09/09/2026): torna-indietro + nome/logo cliente sono
 * portati (via TopbarPortal, vedi TopbarSlot.tsx) dentro la barra sticky di DashboardShell.tsx,
 * così restano visibili durante lo scroll — DashboardShell non conosce il concetto di "cliente",
 * il portal è l'unico modo pulito per farceli comparire senza prop-drilling attraverso ogni rotta.
 * Il resto (pillola "Settimana N", cluster link rapidi) resta nel flusso della pagina, non sale
 * anch'esso: il mockup di riferimento non mostra queste pillole nella barra, che è già stretta.
 *

 * "Torna indietro" usa router.back() (cronologia del browser), non più un link fisso: si arriva a
 * una scheda cliente sia dalla vista priorità sia da quella per consulente (entrambe dentro
 * /dashboard, vedi DashboardClienti.tsx), e "indietro" deve tornare a quella di partenza, non
 * sempre alla stessa. Fallback a /dashboard solo se non c'è cronologia (arrivo diretto via URL,
 * link pubblico incluso raro ma possibile).
 *
 * `settimanaProgetto`/`driveFolderUrl` sono le stesse aggiunte "anagrafiche" del cliente (mai sul
 * link pubblico, stesso motivo del resto dell'header) — contesto temporale e link rapido che il
 * consulente vuole avere sotto mano senza aprire "Modifica cliente". Se il link non è ancora
 * impostato, si può aggiungere qui stesso (LinkRapido sotto, mini-form inline, stesso pattern di
 * "+ Aggiungi ad account" in KpiSection.tsx) invece di dover aprire l'intero modale — richiesta
 * esplicita dell'utente ("non c'è modo di arrivarci se non dalla modifica"). La landing page
 * singola di un tempo è diventata FunnelPopover sotto (11/2026, overhaul "la maggior parte dei
 * clienti avrà più di un funnel attivo"): elenco di funnel con link ciascuno, in un popover invece
 * di una singola pillola — legge `cliente.funnels` invece di un prop a parte, dato che `cliente`
 * arriva comunque qui per il pennino "Modifica cliente".
 *
 * `appuntamentiFileUrl` invece non è mai impostato a mano (nessun LinkRapido "+ Appuntamenti"): è
 * un get-or-create automatico dentro driveFolderUrl (vedi /api/clienti/file-appuntamenti +
 * src/lib/appuntamentiFile.ts), gated su `!haConnessioneGhl` — decisione esplicita dell'utente
 * (08/09/2026): un cliente con GHL connesso ha gli appuntamenti letti in diretta, non ha senso
 * chiedergli di compilarli a mano. Se manca driveFolderUrl (prerequisito: serve una cartella dove
 * creare il file) non c'è nessun errore da mostrare e nessuna chiamata da fare: il pulsante
 * "+ Drive" dice già cosa manca (07/10/2026 — prima partiva comunque la richiesta, tornava un 409 e
 * compariva una pillola "Appuntamenti — errore" con il motivo leggibile solo al passaggio del mouse).
 * Un errore vero di Drive è scritto per esteso sotto la riga, solo per l'admin che può risolverlo.
 */
export function ClienteHeader({
  clienteId,
  clienteNome,
  clienteLogoUrl,
  settimanaProgetto,
  driveFolderUrl,
  appuntamentiFileUrl,
  haConnessioneGhl,
  ruoloAdmin,
  cliente,
  sedi,
  consulenti,
}: {
  clienteId: string;
  clienteNome: string;
  clienteLogoUrl?: string;
  settimanaProgetto?: number | null;
  driveFolderUrl?: string;
  appuntamentiFileUrl?: string;
  haConnessioneGhl?: boolean;
  ruoloAdmin?: boolean;
  // Solo per il pennino "Modifica cliente" (richiesta utente 11/2026, "consulente e admin devono
  // poterlo editare direttamente dalla sua interfaccia") — assenti sul link pubblico (code), dove
  // ClienteHeader non viene mai renderizzato affatto (vedi il gate in SchedaCliente.tsx). Il
  // consulente arriva qui SOLO sul proprio cliente assegnato (puoVedereCliente in
  // dashboard/cliente/[clienteId]/page.tsx) — nessun controllo di ruolo aggiuntivo qui, il vero
  // cancello è lato server (PATCH /api/clienti, aggiornato in coppia con questo pennino).
  cliente?: Cliente;
  sedi?: Sede[];
  consulenti?: Consulente[];
}) {
  const router = useRouter();
  const [modificaAperta, setModificaAperta] = useState(false);

  // Override ottimistico dopo un salvataggio riuscito, scoped al clienteId corrente — stesso
  // pattern "contesto" di sedeScelta/filtroCampagne in KpiSection.tsx: senza questo confronto, se
  // il componente non si smonta passando a un altro cliente (transizione client-side), l'override
  // del cliente precedente resterebbe visibile su quello nuovo.
  const [linkSalvati, setLinkSalvati] = useState<{ clienteId: string; driveFolderUrl?: string }>({ clienteId });
  const driveFolderUrlEffettivo = (linkSalvati.clienteId === clienteId ? linkSalvati.driveFolderUrl : undefined) ?? driveFolderUrl;

  // Stato del get-or-create automatico del file appuntamenti — stesso schema "contesto" di
  // linkSalvati sopra, ma qui la fonte è un fetch automatico, non un salvataggio dell'utente.
  const [statoFile, setStatoFile] = useState<{ clienteId: string; url?: string; errore?: string }>({ clienteId });
  const appuntamentiFileUrlEffettivo = (statoFile.clienteId === clienteId ? statoFile.url : undefined) ?? appuntamentiFileUrl;
  const erroreFile = statoFile.clienteId === clienteId ? statoFile.errore : undefined;

  useEffect(() => {
    // Niente da fare: GHL connesso (nessuna compilazione manuale ha senso), il link esiste già
    // (creato in una visita precedente, arrivato via prop da Cliente.appuntamentiFileUrl), oppure
    // manca la cartella Drive dove crearlo (la route risponderebbe 409: non è un errore, è un
    // prerequisito — riparte da sola appena la cartella viene collegata).
    if (haConnessioneGhl || appuntamentiFileUrl || !driveFolderUrlEffettivo) return;
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
  }, [clienteId, haConnessioneGhl, appuntamentiFileUrl, driveFolderUrlEffettivo]);

  async function salvaDriveFolderUrl(valore: string) {
    const res = await fetch("/api/clienti", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId, driveFolderUrl: valore }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
    setLinkSalvati({ clienteId, driveFolderUrl: valore });
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
    <>
      <TopbarPortal>
        <PulsanteIcona etichetta="Torna indietro" onClick={tornaIndietro} className="text-ink-700">
          <ArrowLeft size={20} aria-hidden="true" />
        </PulsanteIcona>
        <h1 className="min-w-0 truncate">
          <LogoONomeCliente
            nome={clienteNome}
            logoUrl={clienteLogoUrl}
            className={clienteLogoUrl ? "h-8 w-auto object-contain" : "font-heading text-xl leading-[26px] font-extrabold text-ink-900 truncate"}
          />
        </h1>
        {cliente && sedi && consulenti && (
          <PulsanteIcona etichetta="Modifica cliente" onClick={() => setModificaAperta(true)}>
            <Pencil size={18} aria-hidden="true" />
          </PulsanteIcona>
        )}
      </TopbarPortal>

      <div className="flex items-center gap-2 flex-wrap">
        {Boolean(settimanaProgetto) && <Badge tono="info">Settimana {settimanaProgetto}</Badge>}

        <LinkRapido
          label="Drive"
          icona={Folder}
          url={driveFolderUrlEffettivo}
          titleApri="Apri la cartella Drive del cliente"
          // Senza GHL il file appuntamenti nasce dentro la cartella Drive: dirlo qui, dove si collega.
          titleAggiungi={
            haConnessioneGhl
              ? "Collega la cartella Drive del cliente"
              : "Collega la cartella Drive del cliente: lì viene creato anche il file degli appuntamenti"
          }
          placeholder="https://drive.google.com/…"
          // Chiunque arriva su ClienteHeader è admin o il consulente assegnato a QUESTO cliente
          // (mai un altro ruolo, mai sul link pubblico code — vedi puoVedereCliente lato server):
          // entrambi possono salvare questo link, PATCH /api/clienti lo accetta per entrambi.
          puoModificare={true}
          onSalva={salvaDriveFolderUrl}
        />
        {cliente && <FunnelPopover clienteId={clienteId} funnelsIniziali={cliente.funnels} />}
        {!haConnessioneGhl && appuntamentiFileUrlEffettivo && (
          <a
            href={appuntamentiFileUrlEffettivo}
            target="_blank"
            rel="noopener noreferrer"
            title="Apri il file dove compilare gli appuntamenti del cliente"
            className={classePillo}
          >
            <ClipboardList size={16} aria-hidden="true" /> Appuntamenti
          </a>
        )}
      </div>

      {/* Errore vero di Drive (non la cartella che manca: vedi l'effect sopra). Scritto per esteso e
          solo per l'admin: è l'unico ruolo che può risolverlo, a un consulente sarebbe solo rumore. */}
      {!haConnessioneGhl && !appuntamentiFileUrlEffettivo && erroreFile && ruoloAdmin && (
        <Nota tono="attenzione" etichetta="File appuntamenti non creato" compatta className="w-full">
          <p>{erroreFile}</p>
        </Nota>
      )}

      {modificaAperta && cliente && sedi && consulenti && (
        <ModificaClienteModal
          cliente={cliente}
          sedi={sedi}
          consulenti={consulenti}
          ruoloAdmin={ruoloAdmin}
          onClose={() => setModificaAperta(false)}
          onSalvato={() => {
            setModificaAperta(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// Link rapidi dell'intestazione (Drive, Funnel, Appuntamenti): pulsanti piccoli a contorno neutro.
const classePillo = cn(CLASSE_PULSANTE, VARIANTE_PULSANTE.ghost, DIMENSIONE_PULSANTE.sm, "bg-surface-card");

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
  titleAggiungi,
  placeholder,
  puoModificare,
  onSalva,
}: {
  label: string;
  icona: typeof Folder;
  url: string | undefined;
  titleApri: string;
  titleAggiungi: string;
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
        <Icona size={16} aria-hidden="true" /> {label}
      </a>
    );
  }

  if (!puoModificare) return null;

  if (!aperto) {
    return (
      <button type="button" onClick={() => setAperto(true)} title={titleAggiungi} className={cn(classePillo, "border-dashed")}>
        <Icona size={16} aria-hidden="true" /> + {label}
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
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="url"
        aria-label={`Link ${label}`}
        value={bozza}
        onChange={(e) => setBozza(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSalva();
          }
        }}
        placeholder={placeholder}
        autoFocus
        className="w-64"
      />
      <Button onClick={handleSalva} disabled={salvando}>
        {salvando ? "Salvataggio…" : "Salva"}
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          setAperto(false);
          setErrore(null);
        }}
      >
        Annulla
      </Button>
      {errore && (
        <span role="alert" className="text-critico text-xs font-semibold">
          {errore}
        </span>
      )}
    </div>
  );
}

/**
 * Elenco funnel/landing page del cliente (overhaul 11/2026: "la maggior parte dei clienti avrà
 * più di un funnel attivo" — sostituisce la singola pillola "Landing page" di prima). Pillola
 * "Funnel (N)" che apre un popover con un link per ciascuno + un mini-form per aggiungerne uno
 * nuovo, stesso pattern di PopoverAssegnatari/GhlCalendariPicker altrove nell'app: nessuna chiusura
 * al click fuori (nessun popover di questo codebase lo fa), si chiude ricliccando la pillola o con
 * "Chiudi". L'intero array viene sempre riscritto per intero via PATCH /api/clienti — vedi
 * erroreFunnels in quella route.
 */
function FunnelPopover({ clienteId, funnelsIniziali }: { clienteId: string; funnelsIniziali: Funnel[] }) {
  const [aperto, setAperto] = useState(false);
  // Stesso pattern "override scoped al clienteId" di linkSalvati sopra in ClienteHeader.
  const [override, setOverride] = useState<{ clienteId: string; funnels: Funnel[] } | null>(null);
  const funnels = override?.clienteId === clienteId ? override.funnels : funnelsIniziali;

  const [nomeBozza, setNomeBozza] = useState("");
  const [urlBozza, setUrlBozza] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function salva(nuovi: Funnel[]) {
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/clienti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId, funnels: nuovi }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      setOverride({ clienteId, funnels: nuovi });
      return true;
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
      return false;
    } finally {
      setSalvando(false);
    }
  }

  async function aggiungi() {
    const nome = nomeBozza.trim();
    const url = urlBozza.trim();
    if (!nome) {
      setErrore("Il nome è obbligatorio");
      return;
    }
    if (!/^https?:\/\//.test(url)) {
      setErrore("L'url deve iniziare con http:// o https://");
      return;
    }
    const ok = await salva([...funnels, { id: crypto.randomUUID(), nome, url }]);
    if (ok) {
      setNomeBozza("");
      setUrlBozza("");
    }
  }

  function elimina(id: string) {
    salva(funnels.filter((f) => f.id !== id));
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setAperto((v) => !v)} aria-expanded={aperto} className={classePillo}>
        <Filter size={16} aria-hidden="true" /> Funnel{funnels.length > 0 ? ` (${funnels.length})` : ""}
      </button>
      {aperto && (
        <div className="absolute right-0 top-full mt-2 z-30 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-linea bg-surface-card shadow-[var(--shadow-alta)] p-4 space-y-3">
          <p className="text-sm font-bold text-ink-900">Funnel attivi</p>
          {funnels.length > 0 ? (
            <ul className="max-h-56 overflow-y-auto -mr-2">
              {funnels.map((f) => (
                <li key={f.id} className="flex items-center gap-1">
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={f.url}
                    className="flex-1 min-w-0 truncate py-1.5 text-sm font-semibold text-brand hover:underline"
                  >
                    {f.nome}
                  </a>
                  {/* Sempre visibile (prima compariva solo al passaggio del mouse: irraggiungibile da
                      tastiera e su telefono). */}
                  <PulsanteIcona etichetta={`Elimina il funnel ${f.nome}`} dimensione="sm" onClick={() => elimina(f.id)} className="hover:text-critico">
                    <Trash2 size={16} aria-hidden="true" />
                  </PulsanteIcona>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-500">Nessun funnel ancora. Aggiungine uno qui sotto.</p>
          )}
          <div className="space-y-2 pt-3 border-t border-linea">
            <Input
              aria-label="Nome del funnel"
              value={nomeBozza}
              onChange={(e) => setNomeBozza(e.target.value)}
              placeholder="Nome (es. Funnel webinar)"
            />
            <Input
              type="url"
              aria-label="Indirizzo del funnel"
              value={urlBozza}
              onChange={(e) => setUrlBozza(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  aggiungi();
                }
              }}
              placeholder="https://…"
            />
            {errore && (
              <p role="alert" className="text-xs font-semibold text-critico">
                {errore}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setAperto(false)}>
                Chiudi
              </Button>
              <Button variant="crea" size="sm" onClick={aggiungi} disabled={salvando}>
                {salvando ? "Salvataggio…" : "+ Aggiungi"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
