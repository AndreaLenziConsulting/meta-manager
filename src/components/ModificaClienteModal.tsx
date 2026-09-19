"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import type { CategoriaCommerciale, Cliente, Consulente, Sede, Venditore } from "@/types/kpi";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfermaEliminazioneModal } from "@/components/ui/ConfermaEliminazioneModal";
import { ConfermaEliminazioneNomeModal } from "@/components/ui/ConfermaEliminazioneNomeModal";
import { PersonalizzazioneCliente } from "@/components/PersonalizzazioneCliente";

/** Come torna GET /api/ghl-connessioni — mai il token vero, solo una versione mascherata. */
type GhlConnessioneVista = {
  connessioneId: string;
  locationId: string;
  attivo: boolean;
  tokenMascherato: string;
  calendarIds: string[];
};

/** Come torna GET /api/ghl-connessioni/calendari. */
type GhlCalendarioVista = { id: string; name: string; calendarType: string };

type Props = {
  cliente: Cliente;
  sedi: Sede[];
  consulenti: Consulente[];
  // Mostra le azioni di eliminazione (Connessione GHL/Sede/Cliente — quest'ultime nelle fasi
  // successive del piano) — SOLO admin, mai il consulente (che può comunque apire questa stessa
  // modale per modificare l'anagrafica). Assente = nessuna azione distruttiva mostrata.
  ruoloAdmin?: boolean;
  onClose: () => void;
  onSalvato: () => void;
};

export function ModificaClienteModal({ cliente, sedi, consulenti, ruoloAdmin, onClose, onSalvato }: Props) {
  const [nome, setNome] = useState(cliente.nome);
  const [email, setEmail] = useState(cliente.email);
  const [consulenteId, setConsulenteId] = useState(cliente.consulenteId);
  const [mostraTabExtra, setMostraTabExtra] = useState(cliente.mostraTabExtra);
  const [attivo, setAttivo] = useState(cliente.attivo);
  const [logoUrl, setLogoUrl] = useState(cliente.logoUrl);
  const [colorePrimario, setColorePrimario] = useState(cliente.colorePrimario);
  const [coloreSecondario, setColoreSecondario] = useState(cliente.coloreSecondario);
  const [fontPersonalizzato, setFontPersonalizzato] = useState(cliente.fontPersonalizzato);
  const [driveFolderUrl, setDriveFolderUrl] = useState(cliente.driveFolderUrl);

  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [confermaEliminaClienteAperta, setConfermaEliminaClienteAperta] = useState(false);

  // Fase 1 integrazione GHL/Squadd: connessioni indicizzate per sedeId, caricate a parte (Sede
  // non le porta con sé — vedi src/types/ghl.ts) e ricaricate dopo ogni creazione/modifica.
  const [ghlPerSede, setGhlPerSede] = useState<Record<string, GhlConnessioneVista>>({});
  const [ghlTick, setGhlTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ghl-connessioni?clienteId=${encodeURIComponent(cliente.clienteId)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((body: { connessioni?: (GhlConnessioneVista & { sedeId: string })[] }) => {
        const mappa: Record<string, GhlConnessioneVista> = {};
        for (const c of body.connessioni ?? []) mappa[c.sedeId] = c;
        setGhlPerSede(mappa);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [cliente.clienteId, ghlTick]);

  // Categorie commerciali (Fase 1, 11/2026) — stesso schema di ghlPerSede sopra: indicizzate per
  // sedeId (qui un array, non un valore singolo: una sede può averne fino a 3), ricaricate dopo
  // ogni creazione/modifica/eliminazione.
  const [categoriePerSede, setCategoriePerSede] = useState<Record<string, CategoriaCommerciale[]>>({});
  const [categorieTick, setCategorieTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/categorie-commerciali?clienteId=${encodeURIComponent(cliente.clienteId)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((body: { categorie?: CategoriaCommerciale[] }) => {
        const mappa: Record<string, CategoriaCommerciale[]> = {};
        for (const c of body.categorie ?? []) (mappa[c.sedeId] ??= []).push(c);
        setCategoriePerSede(mappa);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [cliente.clienteId, categorieTick]);

  // Venditori (Fase 2, 11/2026) — stesso schema di categoriePerSede sopra.
  const [venditoriPerSede, setVenditoriPerSede] = useState<Record<string, Venditore[]>>({});
  const [venditoriTick, setVenditoriTick] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/venditori?clienteId=${encodeURIComponent(cliente.clienteId)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((body: { venditori?: Venditore[] }) => {
        const mappa: Record<string, Venditore[]> = {};
        for (const v of body.venditori ?? []) (mappa[v.sedeId] ??= []).push(v);
        setVenditoriPerSede(mappa);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
      });
    return () => controller.abort();
  }, [cliente.clienteId, venditoriTick]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/clienti", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId: cliente.clienteId,
          nome,
          email,
          consulenteId,
          mostraTabExtra,
          attivo,
          logoUrl,
          colorePrimario,
          coloreSecondario,
          fontPersonalizzato,
          driveFolderUrl,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      onSalvato();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal title="Modifica cliente" subtitle={cliente.clienteId} onClose={onClose} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome cliente">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </Field>

        <Field label="Email cliente (opzionale)" hint="Per l'invio automatico del follow-up meeting — più indirizzi separati da virgola">
          <Input type="email" multiple value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>

        {/* Riassegnazione e (dis)attivazione restano azioni amministrative — un consulente può
            modificare solo il proprio cliente assegnato, mai spostarlo su qualcun altro né
            disattivarlo (vedi PATCH /api/clienti). Mostrate come sola lettura invece che nascoste:
            il consulente vede comunque a chi è assegnato e se il cliente è attivo. */}
        {ruoloAdmin ? (
          <Field label="Consulente di riferimento">
            <Select value={consulenteId} onChange={(e) => setConsulenteId(e.target.value)} required>
              {consulenti.map((c) => (
                <option key={c.consulenteId} value={c.consulenteId}>
                  {c.nome}
                  {!c.attivo ? " (disattivato)" : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label="Consulente di riferimento">
            <p className="text-sm text-ink-700 px-3 py-2">{consulenti.find((c) => c.consulenteId === consulenteId)?.nome ?? consulenteId}</p>
          </Field>
        )}

        <div className="space-y-2 pt-1">
          <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
            <input type="checkbox" checked={mostraTabExtra} onChange={(e) => setMostraTabExtra(e.target.checked)} className="accent-current text-brand" />
            Il cliente vede anche il tab Meeting (oltre a KPI)
          </label>
          <label className={`flex items-center gap-2 text-xs text-ink-700 ${ruoloAdmin ? "cursor-pointer" : "opacity-70"}`}>
            <input
              type="checkbox"
              checked={attivo}
              onChange={(e) => setAttivo(e.target.checked)}
              disabled={!ruoloAdmin}
              className="accent-current text-brand disabled:cursor-not-allowed"
            />
            Cliente attivo{!ruoloAdmin && " (solo l'amministratore può cambiarlo)"}
          </label>
        </div>

        <div className="pt-2 border-t border-ink-300/60 space-y-4">
          <div>
            <p className="text-sm font-semibold text-ink-900">Link rapidi</p>
            <p className="text-xs text-ink-500 mt-0.5">
              Comparsa in alto sulla scheda cliente — visibile solo al team, mai sul link pubblico. I funnel si
              gestiscono dalla pillola &ldquo;Funnel&rdquo; dell&apos;header, non da qui.
            </p>
          </div>
          <Field label="Cartella Drive">
            <Input value={driveFolderUrl} onChange={(e) => setDriveFolderUrl(e.target.value)} placeholder="https://drive.google.com/…" />
          </Field>
        </div>

        <div className="pt-2 border-t border-ink-300/60 space-y-3">
          <div>
            <p className="text-sm font-semibold text-ink-900">Personalizzazione</p>
            <p className="text-xs text-ink-500 mt-0.5">
              Sostituisce il brand ALC standard su questo cliente (scheda cliente + link pubblico) — vuoto = brand di default.
            </p>
          </div>
          <PersonalizzazioneCliente
            logoUrl={logoUrl}
            onLogoUrlChange={setLogoUrl}
            colorePrimario={colorePrimario}
            onColorePrimarioChange={setColorePrimario}
            coloreSecondario={coloreSecondario}
            onColoreSecondarioChange={setColoreSecondario}
            fontPersonalizzato={fontPersonalizzato}
            onFontPersonalizzatoChange={setFontPersonalizzato}
          />
        </div>

        {errore && <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-100 text-red-700 text-xs">{errore}</div>}

        <div className="flex gap-2 pt-2 border-t border-ink-300/60">
          <Button type="submit" disabled={salvando || !nome || !consulenteId}>
            {salvando ? "Salvataggio…" : "Salva modifiche"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annulla
          </Button>
        </div>
      </form>

      <div className="pt-4 mt-4 border-t border-ink-300/60 space-y-3">
        <div>
          <p className="text-sm font-semibold text-ink-900">Sedi</p>
          <p className="text-xs text-ink-500 mt-0.5">
            Ogni sede ha il proprio account pubblicitario e il proprio target — ads e risultati commerciali restano separati tra sedi diverse.
          </p>
        </div>
        <div className="space-y-3">
          {sedi.map((sede) => (
            <SedeRow
              key={sede.sedeId}
              sede={sede}
              ghlConnessione={ghlPerSede[sede.sedeId]}
              onGhlSalvato={() => setGhlTick((t) => t + 1)}
              categorie={categoriePerSede[sede.sedeId] ?? []}
              onCategorieSalvato={() => setCategorieTick((t) => t + 1)}
              venditori={venditoriPerSede[sede.sedeId] ?? []}
              onVenditoriSalvato={() => setVenditoriTick((t) => t + 1)}
              ruoloAdmin={ruoloAdmin}
              numeroSediCliente={sedi.length}
            />
          ))}
        </div>
        <NuovaSedeForm clienteId={cliente.clienteId} />
      </div>

      {ruoloAdmin && (
        <div className="pt-4 mt-4 border-t border-ink-300/60 space-y-3">
          <div>
            <p className="text-sm font-semibold text-red-600">Zona pericolosa</p>
            <p className="text-xs text-ink-500 mt-0.5">Elimina questo cliente e tutti i suoi dati collegati per sempre.</p>
          </div>
          <Button type="button" variant="danger" onClick={() => setConfermaEliminaClienteAperta(true)}>
            Elimina cliente
          </Button>
        </div>
      )}

      {confermaEliminaClienteAperta && (
        <ConfermaEliminazioneNomeModal
          titolo="Eliminare questo cliente per sempre?"
          nomeDaConfermare={cliente.nome}
          messaggio={
            <>
              Cancella per sempre: anagrafica, tutte le sedi e le loro connessioni GHL, attività,
              meeting, fasi completate e risultati commerciali. Lo storico ads Meta (campagne e dati
              giornalieri) resta nel foglio ma non sarà più visibile da nessuna parte dell&apos;app.
              Azione irreversibile.
            </>
          }
          onClose={() => setConfermaEliminaClienteAperta(false)}
          onConferma={async () => {
            const res = await fetch("/api/clienti/elimina", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ clienteId: cliente.clienteId, nomeConferma: cliente.nome }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
            setConfermaEliminaClienteAperta(false);
            onSalvato();
          }}
        />
      )}
    </Modal>
  );
}

function SedeRow({
  sede,
  ghlConnessione,
  onGhlSalvato,
  categorie,
  onCategorieSalvato,
  venditori,
  onVenditoriSalvato,
  ruoloAdmin,
  numeroSediCliente,
}: {
  sede: Sede;
  ghlConnessione?: GhlConnessioneVista;
  onGhlSalvato: () => void;
  categorie: CategoriaCommerciale[];
  venditori: Venditore[];
  onVenditoriSalvato: () => void;
  onCategorieSalvato: () => void;
  ruoloAdmin?: boolean;
  numeroSediCliente: number;
}) {
  const [nome, setNome] = useState(sede.nome);
  const [adAccountId, setAdAccountId] = useState(sede.adAccountId);
  const [targetCpa, setTargetCpa] = useState(sede.targetCpa !== null ? String(sede.targetCpa) : "");
  const [targetCpl, setTargetCpl] = useState(sede.targetCpl !== null ? String(sede.targetCpl) : "");
  const [tipoConversioneLead, setTipoConversioneLead] = useState(sede.tipoConversioneLead);
  const [attivo, setAttivo] = useState(sede.attivo);
  // Target commerciali concordati col cliente (Fase 1 roadmap) — stesso trattamento di
  // targetCpa/targetCpl sopra, ma su volumi/fatturato invece che su costo. Controllati contro il
  // reale del periodo negli avvisi operativi (vedi src/lib/targetCommerciali.ts).
  const [targetBudgetMensile, setTargetBudgetMensile] = useState(sede.targetBudgetMensile !== null ? String(sede.targetBudgetMensile) : "");
  const [targetLeadSettimana, setTargetLeadSettimana] = useState(sede.targetLeadSettimana !== null ? String(sede.targetLeadSettimana) : "");
  const [targetAppuntamentiSettimana, setTargetAppuntamentiSettimana] = useState(
    sede.targetAppuntamentiSettimana !== null ? String(sede.targetAppuntamentiSettimana) : ""
  );
  const [targetFatturatoMensile, setTargetFatturatoMensile] = useState(
    sede.targetFatturatoMensile !== null ? String(sede.targetFatturatoMensile) : ""
  );
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);
  const [mostraConfermaElimina, setMostraConfermaElimina] = useState(false);
  const router = useRouter();

  // `onSalvato` (prop condivisa con il form principale del cliente) chiude l'intera modale — giusto
  // per "Salva modifiche" in cima, sbagliato qui: prima questo bottone lo richiamava anche per una
  // singola sede, e la modale spariva di colpo subito dopo un salvataggio andato a buon fine (era
  // già persistito lato server, ma sembrava un salvataggio fallito/un componente rotto). Qui invece
  // solo un router.refresh() — la modale resta aperta, un check verde temporaneo conferma il salvataggio.
  async function salva() {
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/sedi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sedeId: sede.sedeId,
          nome,
          adAccountId,
          targetCpa: targetCpa ? Number(targetCpa) : null,
          targetCpl: targetCpl ? Number(targetCpl) : null,
          tipoConversioneLead,
          attivo,
          targetBudgetMensile: targetBudgetMensile ? Number(targetBudgetMensile) : null,
          targetLeadSettimana: targetLeadSettimana ? Number(targetLeadSettimana) : null,
          targetAppuntamentiSettimana: targetAppuntamentiSettimana ? Number(targetAppuntamentiSettimana) : null,
          targetFatturatoMensile: targetFatturatoMensile ? Number(targetFatturatoMensile) : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      router.refresh();
      setSalvato(true);
      setTimeout(() => setSalvato(false), 2500);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-xl border border-ink-300 p-3 space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Nome sede">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field
          label="Ad account Meta (opzionale)"
          error={adAccountId !== "" && !/^\d+$/.test(adAccountId) ? 'Solo cifre, senza il prefisso "act_" — così "Salva sede" resta disabilitato' : undefined}
        >
          <Input value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} placeholder="Solo cifre, senza act_" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Target CPA (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpa} onChange={(e) => setTargetCpa(e.target.value)} />
        </Field>
        <Field label="Target CPL (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpl} onChange={(e) => setTargetCpl(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Field label="Budget mensile (€, opz.)">
          <Input type="number" step="0.01" value={targetBudgetMensile} onChange={(e) => setTargetBudgetMensile(e.target.value)} />
        </Field>
        <Field label="Lead/settimana (opz.)">
          <Input type="number" step="1" value={targetLeadSettimana} onChange={(e) => setTargetLeadSettimana(e.target.value)} />
        </Field>
        <Field label="Appuntamenti/sett. (opz.)">
          <Input type="number" step="1" value={targetAppuntamentiSettimana} onChange={(e) => setTargetAppuntamentiSettimana(e.target.value)} />
        </Field>
        <Field label="Fatturato mensile (€, opz.)">
          <Input type="number" step="0.01" value={targetFatturatoMensile} onChange={(e) => setTargetFatturatoMensile(e.target.value)} />
        </Field>
      </div>
      <Field
        label="Tipo conversione lead (opzionale)"
        hint="Action type esatto di Meta Insights da contare come lead — solo per sedi con tracciamento non standard."
      >
        <Input
          value={tipoConversioneLead}
          onChange={(e) => setTipoConversioneLead(e.target.value)}
          placeholder="Vuoto = usa la lista di default (Lead Ads classici)"
        />
      </Field>
      <div className="flex items-center justify-between gap-2 pt-1">
        <label className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
          <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} className="accent-current text-brand" />
          Sede attiva
        </label>
        <div className="flex items-center gap-2">
          {salvato && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <CheckCircle2 size={14} /> Salvato
            </span>
          )}
          <Button
            type="button"
            size="sm"
            onClick={salva}
            disabled={salvando || !nome || (adAccountId !== "" && !/^\d+$/.test(adAccountId))}
          >
            {salvando ? "Salvataggio…" : "Salva sede"}
          </Button>
          {ruoloAdmin && numeroSediCliente > 1 && (
            <Button type="button" size="sm" variant="danger" onClick={() => setMostraConfermaElimina(true)}>
              Elimina sede
            </Button>
          )}
        </div>
      </div>
      {errore && <p className="text-xs text-red-600">{errore}</p>}

      <div className="pt-2 mt-1 border-t border-ink-300/60">
        <GhlConnessioneBlock sedeId={sede.sedeId} connessione={ghlConnessione} onSalvato={onGhlSalvato} ruoloAdmin={ruoloAdmin} />
      </div>

      <div className="pt-2 mt-1 border-t border-ink-300/60">
        <CategorieCommercialiBlock sedeId={sede.sedeId} categorie={categorie} onSalvato={onCategorieSalvato} ruoloAdmin={ruoloAdmin} />
      </div>

      <div className="pt-2 mt-1 border-t border-ink-300/60">
        <VenditoriBlock sedeId={sede.sedeId} venditori={venditori} onSalvato={onVenditoriSalvato} ruoloAdmin={ruoloAdmin} />
      </div>

      {mostraConfermaElimina && (
        <ConfermaEliminazioneModal
          titolo="Eliminare questa sede?"
          messaggio={
            <>
              Cancella anche la sua connessione GHL, se presente. Lo storico ads (Campagne, risultati
              commerciali) di questa sede resta nel foglio ma non sarà più visibile da nessuna parte
              dell&apos;app. Azione irreversibile.
            </>
          }
          onClose={() => setMostraConfermaElimina(false)}
          onConferma={async () => {
            const res = await fetch("/api/sedi/elimina", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sedeId: sede.sedeId, clienteId: sede.clienteId }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
            setMostraConfermaElimina(false);
            // Non onGhlSalvato/onSalvato (chiuderebbe l'intera modale, stesso motivo di salva()
            // sopra): router.refresh() ricarica sedi da zero, la riga di questa sede sparisce.
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

/**
 * Collegamento GHL/Squadd di una sede (sola lettura — alimenta le tessere del tab KPI, vedi
 * src/lib/kpiGhlOverlay.ts). Il token non
 * viene mai ri-mostrato per intero dopo la creazione, solo mascherato ("••••3f9a"): il campo di
 * modifica parte vuoto e sovrascrive solo se l'admin ci digita davvero un nuovo valore.
 */
function GhlConnessioneBlock({
  sedeId,
  connessione,
  onSalvato,
  ruoloAdmin,
}: {
  sedeId: string;
  connessione?: GhlConnessioneVista;
  onSalvato: () => void;
  ruoloAdmin?: boolean;
}) {
  const [attiva, setAttiva] = useState(false);
  const [locationId, setLocationId] = useState(connessione?.locationId ?? "");
  const [privateToken, setPrivateToken] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [mostraConfermaElimina, setMostraConfermaElimina] = useState(false);

  if (!connessione && !attiva) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setAttiva(true)}>
        + Collega GHL
      </Button>
    );
  }

  async function salva() {
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/ghl-connessioni", {
        method: connessione ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          connessione
            ? { connessioneId: connessione.connessioneId, locationId, privateToken: privateToken || undefined }
            : { sedeId, locationId, privateToken }
        ),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      setPrivateToken("");
      onSalvato();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  const locationIdValido = locationId.trim().length > 0;
  const puoSalvare = connessione ? locationIdValido : locationIdValido && privateToken.trim().length > 0;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Connessione GHL/Squadd</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Location ID">
          <Input value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder="Location ID GHL" />
        </Field>
        <Field
          label="Private Integration Token"
          hint={connessione ? `Attuale: ${connessione.tokenMascherato} — lascia vuoto per non cambiarlo` : undefined}
        >
          <Input
            type="password"
            value={privateToken}
            onChange={(e) => setPrivateToken(e.target.value)}
            placeholder={connessione ? "Lascia vuoto per non cambiarlo" : "Incolla il token"}
          />
        </Field>
      </div>
      {errore && <p className="text-xs text-red-600">{errore}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={salva} disabled={salvando || !puoSalvare}>
          {salvando ? "Salvataggio…" : connessione ? "Aggiorna connessione" : "Collega"}
        </Button>
        {!connessione && (
          <Button type="button" size="sm" variant="ghost" onClick={() => setAttiva(false)}>
            Annulla
          </Button>
        )}
        {connessione && ruoloAdmin && (
          <Button type="button" size="sm" variant="danger" onClick={() => setMostraConfermaElimina(true)}>
            Elimina connessione
          </Button>
        )}
      </div>
      {connessione && <GhlCalendariPicker connessione={connessione} onSalvato={onSalvato} />}

      {mostraConfermaElimina && connessione && (
        <ConfermaEliminazioneModal
          titolo="Eliminare la connessione GHL?"
          messaggio={
            <>
              I KPI restano invariati (sono letti in diretta dall&apos;API GHL, nulla di storico dipende da
              questa riga) — viene rimosso solo il collegamento. Potrai ricollegare la stessa location in
              seguito.
            </>
          }
          onClose={() => setMostraConfermaElimina(false)}
          onConferma={async () => {
            const res = await fetch("/api/ghl-connessioni/elimina", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ connessioneId: connessione.connessioneId }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
            setMostraConfermaElimina(false);
            onSalvato();
          }}
        />
      )}
    </div>
  );
}

/**
 * Sceglie quali calendari della location contano per gli appuntamenti — mai automatico (vedi
 * ghl.ts): una location porta spesso anche calendari "personal" di singoli consulenti che
 * potrebbero essere pagine di prenotazione legittime o impegni non pertinenti, indistinguibili
 * in modo affidabile solo da calendarType. Preseleziona round_robin/collective la prima volta
 * (calendarIds ancora vuoto), poi rispecchia sempre l'ultima scelta salvata.
 */
function GhlCalendariPicker({ connessione, onSalvato }: { connessione: GhlConnessioneVista; onSalvato: () => void }) {
  const [stato, setStato] = useState<"caricamento" | "ok" | "errore">("caricamento");
  const [calendari, setCalendari] = useState<GhlCalendarioVista[]>([]);
  const [selezionati, setSelezionati] = useState<Set<string>>(new Set());
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroreSalvataggio, setErroreSalvataggio] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        setStato("caricamento");
        return fetch(`/api/ghl-connessioni/calendari?connessioneId=${encodeURIComponent(connessione.connessioneId)}`, {
          signal: controller.signal,
        });
      })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Errore nel caricamento dei calendari");
        const lista = (body.calendari ?? []) as GhlCalendarioVista[];
        setCalendari(lista);
        // Prima configurazione (calendarIds ancora vuoto): preseleziona i calendari che più
        // probabilmente sono pagine di prenotazione client-facing, sempre modificabile subito.
        const base =
          connessione.calendarIds.length > 0
            ? connessione.calendarIds
            : lista.filter((c) => c.calendarType !== "personal").map((c) => c.id);
        setSelezionati(new Set(base));
        setStato("ok");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErroreCaricamento(err.message);
        setStato("errore");
      });
    return () => controller.abort();
  }, [connessione.connessioneId, connessione.calendarIds]);

  function toggle(id: string) {
    setSelezionati((prec) => {
      const nuovo = new Set(prec);
      if (nuovo.has(id)) nuovo.delete(id);
      else nuovo.add(id);
      return nuovo;
    });
  }

  async function salvaSelezione() {
    setErroreSalvataggio(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/ghl-connessioni", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connessioneId: connessione.connessioneId, calendarIds: Array.from(selezionati) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      onSalvato();
    } catch (err) {
      setErroreSalvataggio(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  if (stato === "caricamento") {
    return <p className="text-xs text-ink-500 pt-2">Caricamento calendari…</p>;
  }
  if (stato === "errore") {
    return <p className="text-xs text-red-600 pt-2">{erroreCaricamento}</p>;
  }
  if (calendari.length === 0) {
    return <p className="text-xs text-ink-500 pt-2">Nessun calendario trovato su questa location.</p>;
  }

  return (
    <div className="space-y-2 pt-2 border-t border-ink-300/60 mt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
        Calendari da includere negli appuntamenti
      </p>
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        {calendari.map((c) => (
          <label key={c.id} className="flex items-center gap-2 text-xs text-ink-700 cursor-pointer">
            <input
              type="checkbox"
              checked={selezionati.has(c.id)}
              onChange={() => toggle(c.id)}
              className="accent-current text-brand"
            />
            <span className="truncate">{c.name}</span>
            <span className="text-ink-400 flex-shrink-0">({c.calendarType})</span>
          </label>
        ))}
      </div>
      {erroreSalvataggio && <p className="text-xs text-red-600">{erroreSalvataggio}</p>}
      <Button type="button" size="sm" onClick={salvaSelezione} disabled={salvando}>
        {salvando ? "Salvataggio…" : "Salva calendari"}
      </Button>
    </div>
  );
}

/**
 * Categorie commerciali (cluster) della sede — fino a 3, ciascuna coi propri target di
 * lead/appuntamenti/fatturato/budget (Fase 1, 11/2026: "target diversi per fasce diverse di
 * clienti/servizi", stesso spirito dei cluster A/B/C di ALC stessa). Alimentano un blocco di
 * pacing per categoria nel tab KPI (vedi PacingTargetChart.tsx) — una sede senza categorie
 * configurate continua a mostrare solo il target piatto esistente, invariato. Stesso trattamento
 * server-side dei target della sede sopra (solo admin, vedi /api/categorie-commerciali): UI non
 * specialmente gate-ata per consulente, stesso schema già in uso per i campi della sede stessa
 * (solo l'eliminazione lo è, vedi sotto).
 */
function CategorieCommercialiBlock({
  sedeId,
  categorie,
  onSalvato,
  ruoloAdmin,
}: {
  sedeId: string;
  categorie: CategoriaCommerciale[];
  onSalvato: () => void;
  ruoloAdmin?: boolean;
}) {
  const [attiva, setAttiva] = useState(false);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Categorie commerciali</p>
      {categorie.length === 0 && !attiva && (
        <p className="text-xs text-ink-500">
          Nessuna — il ritmo mensile (tab KPI) mostra solo il totale sede.
        </p>
      )}
      <div className="space-y-2">
        {categorie.map((cat) => (
          <CategoriaCommercialeRow key={cat.categoriaId} categoria={cat} onSalvato={onSalvato} ruoloAdmin={ruoloAdmin} />
        ))}
      </div>
      {categorie.length < 3 && !attiva && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setAttiva(true)}>
          + Aggiungi categoria
        </Button>
      )}
      {attiva && (
        <NuovaCategoriaCommercialeForm
          sedeId={sedeId}
          onCreata={() => {
            setAttiva(false);
            onSalvato();
          }}
          onAnnulla={() => setAttiva(false)}
        />
      )}
    </div>
  );
}

/** I 4 target opzionali di una categoria — stesso set di campi di Sede sopra, solo scomposto per
 * categoria invece che per l'intera sede. Un solo oggetto di stato + un onChange per campo (non 4
 * coppie useState separate): riusato identico da CategoriaCommercialeRow (valori iniziali da una
 * categoria esistente) e NuovaCategoriaCommercialeForm (valori iniziali vuoti). */
type TargetCategoriaForm = { budget: string; lead: string; appuntamenti: string; fatturato: string };

const TARGET_CATEGORIA_VUOTO: TargetCategoriaForm = { budget: "", lead: "", appuntamenti: "", fatturato: "" };

function targetCategoriaDa(categoria: CategoriaCommerciale): TargetCategoriaForm {
  return {
    budget: categoria.targetBudgetMensile !== null ? String(categoria.targetBudgetMensile) : "",
    lead: categoria.targetLeadSettimana !== null ? String(categoria.targetLeadSettimana) : "",
    appuntamenti: categoria.targetAppuntamentiSettimana !== null ? String(categoria.targetAppuntamentiSettimana) : "",
    fatturato: categoria.targetFatturatoMensile !== null ? String(categoria.targetFatturatoMensile) : "",
  };
}

// I target lead/appuntamenti sono settimanali (come quelli di sede), ma un piano commerciale si
// ragiona a mese (es. 80 lead/mese): l'equivalente mensile a fianco del campo rende il numero
// leggibile e i decimali (18,5/sett ≈ 80/mese) non sembrano un errore. × 52/12 = settimane per mese.
function equivalenteMensile(settimanale: string): string | undefined {
  const n = Number(settimanale);
  if (!settimanale || !(n > 0)) return undefined;
  return `≈ ${Math.round((n * 52) / 12)} al mese`;
}

function CampiTargetCategoria({
  valori,
  onChange,
}: {
  valori: TargetCategoriaForm;
  onChange: (campo: keyof TargetCategoriaForm, valore: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
      <Field label="Budget mensile (€, opz.)">
        <Input type="number" step="0.01" value={valori.budget} onChange={(e) => onChange("budget", e.target.value)} />
      </Field>
      <Field label="Lead/settimana (opz.)" hint={equivalenteMensile(valori.lead)}>
        <Input type="number" step="0.1" value={valori.lead} onChange={(e) => onChange("lead", e.target.value)} />
      </Field>
      <Field label="Appuntamenti/sett. (opz.)" hint={equivalenteMensile(valori.appuntamenti)}>
        <Input type="number" step="0.1" value={valori.appuntamenti} onChange={(e) => onChange("appuntamenti", e.target.value)} />
      </Field>
      <Field label="Fatturato mensile (€, opz.)">
        <Input type="number" step="0.01" value={valori.fatturato} onChange={(e) => onChange("fatturato", e.target.value)} />
      </Field>
    </div>
  );
}

function CategoriaCommercialeRow({
  categoria,
  onSalvato,
  ruoloAdmin,
}: {
  categoria: CategoriaCommerciale;
  onSalvato: () => void;
  ruoloAdmin?: boolean;
}) {
  const [nome, setNome] = useState(categoria.nome);
  const [tagGhl, setTagGhl] = useState(categoria.tagGhl);
  const [target, setTarget] = useState<TargetCategoriaForm>(() => targetCategoriaDa(categoria));
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);
  const [mostraConfermaElimina, setMostraConfermaElimina] = useState(false);

  async function salva() {
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/categorie-commerciali", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoriaId: categoria.categoriaId,
          nome,
          tagGhl,
          targetBudgetMensile: target.budget ? Number(target.budget) : null,
          targetLeadSettimana: target.lead ? Number(target.lead) : null,
          targetAppuntamentiSettimana: target.appuntamenti ? Number(target.appuntamenti) : null,
          targetFatturatoMensile: target.fatturato ? Number(target.fatturato) : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      onSalvato();
      setSalvato(true);
      setTimeout(() => setSalvato(false), 2500);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-lg border border-ink-300/60 p-2.5 space-y-2">
      <Field label="Nome (deve combaciare col Tipo campagna usato in Risultati commerciali)">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} />
      </Field>
      <Field
        label="Tag GHL (opzionale)"
        hint="Se impostato e la sede è connessa a GHL, richieste/appuntamenti/fatturato di questa categoria vengono calcolati automaticamente dai contatti con questo tag, al posto di Risultati commerciali."
      >
        <Input value={tagGhl} onChange={(e) => setTagGhl(e.target.value)} placeholder="es. mobilieri - cluster a (<500k)" />
      </Field>
      <CampiTargetCategoria valori={target} onChange={(campo, valore) => setTarget((t) => ({ ...t, [campo]: valore }))} />
      {errore && <p className="text-xs text-red-600">{errore}</p>}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {salvato && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <CheckCircle2 size={14} /> Salvato
            </span>
          )}
          <Button type="button" size="sm" onClick={salva} disabled={salvando || !nome.trim()}>
            {salvando ? "Salvataggio…" : "Salva categoria"}
          </Button>
        </div>
        {ruoloAdmin && (
          <Button type="button" size="sm" variant="danger" onClick={() => setMostraConfermaElimina(true)}>
            Elimina
          </Button>
        )}
      </div>
      {mostraConfermaElimina && (
        <ConfermaEliminazioneModal
          titolo="Eliminare questa categoria?"
          messaggio={
            <>
              Il ritmo mensile per questa categoria non sarà più mostrato nel tab KPI. I dati storici
              (Risultati commerciali, campagne) restano invariati.
            </>
          }
          onClose={() => setMostraConfermaElimina(false)}
          onConferma={async () => {
            const res = await fetch("/api/categorie-commerciali/elimina", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ categoriaId: categoria.categoriaId }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
            setMostraConfermaElimina(false);
            onSalvato();
          }}
        />
      )}
    </div>
  );
}

function NuovaCategoriaCommercialeForm({
  sedeId,
  onCreata,
  onAnnulla,
}: {
  sedeId: string;
  onCreata: () => void;
  onAnnulla: () => void;
}) {
  const [nome, setNome] = useState("");
  const [target, setTarget] = useState<TargetCategoriaForm>(TARGET_CATEGORIA_VUOTO);
  const [creando, setCreando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function crea() {
    setErrore(null);
    setCreando(true);
    try {
      const res = await fetch("/api/categorie-commerciali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sedeId,
          nome,
          targetBudgetMensile: target.budget ? Number(target.budget) : null,
          targetLeadSettimana: target.lead ? Number(target.lead) : null,
          targetAppuntamentiSettimana: target.appuntamenti ? Number(target.appuntamenti) : null,
          targetFatturatoMensile: target.fatturato ? Number(target.fatturato) : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Creazione non riuscita");
      onCreata();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed border-ink-300 p-2.5 space-y-2">
      <Field label="Nome (deve combaciare col Tipo campagna usato in Risultati commerciali)">
        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Acquisition" />
      </Field>
      <CampiTargetCategoria valori={target} onChange={(campo, valore) => setTarget((t) => ({ ...t, [campo]: valore }))} />
      {errore && <p className="text-xs text-red-600">{errore}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={crea} disabled={creando || !nome.trim()}>
          {creando ? "Creazione…" : "Crea categoria"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onAnnulla}>
          Annulla
        </Button>
      </div>
    </div>
  );
}

/**
 * Venditori/commerciali DEL CLIENTE (Fase 2, 11/2026) — non i Consulenti ALC, vedi il commento su
 * Venditore in types/kpi.ts. Nessun tetto di quantità (a differenza delle categorie sopra, per cui
 * l'utente ha esplicitamente chiesto "fino a 3"): qui non c'è un limite dichiarato. Stesso
 * trattamento server-side dei target della sede (solo admin, vedi /api/venditori) e stessa UI non
 * specialmente gate-ata per consulente delle Categorie sopra.
 */
function VenditoriBlock({
  sedeId,
  venditori,
  onSalvato,
  ruoloAdmin,
}: {
  sedeId: string;
  venditori: Venditore[];
  onSalvato: () => void;
  ruoloAdmin?: boolean;
}) {
  const [attiva, setAttiva] = useState(false);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Venditori</p>
      {venditori.length === 0 && !attiva && (
        <p className="text-xs text-ink-500">
          Nessuno — la vista &quot;Performance venditori&quot; (tab KPI) resta vuota finché non ne aggiungi almeno uno.
        </p>
      )}
      <div className="space-y-2">
        {venditori.map((v) => (
          <VenditoreRow key={v.venditoreId} venditore={v} onSalvato={onSalvato} ruoloAdmin={ruoloAdmin} />
        ))}
      </div>
      {!attiva && (
        <Button type="button" size="sm" variant="ghost" onClick={() => setAttiva(true)}>
          + Aggiungi venditore
        </Button>
      )}
      {attiva && (
        <NuovoVenditoreForm
          sedeId={sedeId}
          onCreato={() => {
            setAttiva(false);
            onSalvato();
          }}
          onAnnulla={() => setAttiva(false)}
        />
      )}
    </div>
  );
}

function VenditoreRow({
  venditore,
  onSalvato,
  ruoloAdmin,
}: {
  venditore: Venditore;
  onSalvato: () => void;
  ruoloAdmin?: boolean;
}) {
  const [nome, setNome] = useState(venditore.nome);
  const [ghlUserId, setGhlUserId] = useState(venditore.ghlUserId);
  const [capienza, setCapienza] = useState(String(venditore.capienzaAppuntamentiMensile));
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);
  const [mostraConfermaElimina, setMostraConfermaElimina] = useState(false);

  async function salva() {
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/venditori", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ venditoreId: venditore.venditoreId, nome, ghlUserId, capienzaAppuntamentiMensile: Number(capienza) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      onSalvato();
      setSalvato(true);
      setTimeout(() => setSalvato(false), 2500);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  const capienzaValida = Number(capienza) > 0;

  return (
    <div className="rounded-lg border border-ink-300/60 p-2.5 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-2.5">
        <Field label="Nome">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="Appuntamenti/mese sostenibili">
          <Input type="number" step="1" value={capienza} onChange={(e) => setCapienza(e.target.value)} />
        </Field>
      </div>
      <Field
        label="GHL User ID (opzionale)"
        hint="Se impostato e la sede è connessa a GHL, appuntamenti e vendite/fatturato di questo venditore vengono calcolati automaticamente dagli appuntamenti/opportunità assegnati a questo utente su GHL, al posto dei dati inseriti a mano."
      >
        <Input value={ghlUserId} onChange={(e) => setGhlUserId(e.target.value)} placeholder="id utente GHL" />
      </Field>
      {errore && <p className="text-xs text-red-600">{errore}</p>}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {salvato && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
              <CheckCircle2 size={14} /> Salvato
            </span>
          )}
          <Button type="button" size="sm" onClick={salva} disabled={salvando || !nome.trim() || !capienzaValida}>
            {salvando ? "Salvataggio…" : "Salva venditore"}
          </Button>
        </div>
        {ruoloAdmin && (
          <Button type="button" size="sm" variant="danger" onClick={() => setMostraConfermaElimina(true)}>
            Elimina
          </Button>
        )}
      </div>
      {mostraConfermaElimina && (
        <ConfermaEliminazioneModal
          titolo="Eliminare questo venditore?"
          messaggio={
            <>
              La sua quota di carico si ridistribuisce sugli altri venditori attivi della sede. I dati
              storici (RisultatiVenditori) restano invariati nel foglio.
            </>
          }
          onClose={() => setMostraConfermaElimina(false)}
          onConferma={async () => {
            const res = await fetch("/api/venditori/elimina", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ venditoreId: venditore.venditoreId }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body.error || "Eliminazione non riuscita");
            setMostraConfermaElimina(false);
            onSalvato();
          }}
        />
      )}
    </div>
  );
}

function NuovoVenditoreForm({
  sedeId,
  onCreato,
  onAnnulla,
}: {
  sedeId: string;
  onCreato: () => void;
  onAnnulla: () => void;
}) {
  const [nome, setNome] = useState("");
  const [capienza, setCapienza] = useState("");
  const [creando, setCreando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function crea() {
    setErrore(null);
    setCreando(true);
    try {
      const res = await fetch("/api/venditori", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sedeId, nome, capienzaAppuntamentiMensile: Number(capienza) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Creazione non riuscita");
      onCreato();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setCreando(false);
    }
  }

  const capienzaValida = Number(capienza) > 0;

  return (
    <div className="rounded-lg border border-dashed border-ink-300 p-2.5 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-2.5">
        <Field label="Nome">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Mario Rossi" />
        </Field>
        <Field label="Appuntamenti/mese sostenibili">
          <Input type="number" step="1" value={capienza} onChange={(e) => setCapienza(e.target.value)} placeholder="es. 20" />
        </Field>
      </div>
      {errore && <p className="text-xs text-red-600">{errore}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={crea} disabled={creando || !nome.trim() || !capienzaValida}>
          {creando ? "Creazione…" : "Crea venditore"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onAnnulla}>
          Annulla
        </Button>
      </div>
    </div>
  );
}

// Esportato: riusato anche da NuovoClienteForm.tsx, per aggiungere sedi aggiuntive subito dopo
// la creazione del cliente, senza dover riaprire "Modifica cliente" — vedi commento lì.
export function NuovaSedeForm({ clienteId }: { clienteId: string }) {
  const [attiva, setAttiva] = useState(false);
  const [nome, setNome] = useState("");
  const [adAccountId, setAdAccountId] = useState("");
  const [targetCpa, setTargetCpa] = useState("");
  const [targetCpl, setTargetCpl] = useState("");
  const [creando, setCreando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const router = useRouter();

  if (!attiva) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setAttiva(true)}>
        + Aggiungi sede
      </Button>
    );
  }

  // Solo router.refresh() (non onSalvato, che chiuderebbe l'intera modale — stesso motivo del
  // commento su SedeRow.salva sopra): dopo la creazione il form si richiude da solo (setAttiva(false)),
  // la nuova sede compare nella lista sopra, ma la modale resta aperta.
  async function crea() {
    setErrore(null);
    setCreando(true);
    try {
      const res = await fetch("/api/sedi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          nome,
          adAccountId,
          targetCpa: targetCpa ? Number(targetCpa) : null,
          targetCpl: targetCpl ? Number(targetCpl) : null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Creazione non riuscita");
      router.refresh();
      setAttiva(false);
      setNome("");
      setAdAccountId("");
      setTargetCpa("");
      setTargetCpl("");
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-ink-300 p-3 space-y-2.5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Nome sede">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Es. Milano" autoFocus />
        </Field>
        <Field
          label="Ad account Meta (opzionale)"
          error={adAccountId !== "" && !/^\d+$/.test(adAccountId) ? 'Solo cifre, senza il prefisso "act_"' : undefined}
        >
          <Input value={adAccountId} onChange={(e) => setAdAccountId(e.target.value)} placeholder="Solo cifre, senza act_" />
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <Field label="Target CPA (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpa} onChange={(e) => setTargetCpa(e.target.value)} />
        </Field>
        <Field label="Target CPL (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpl} onChange={(e) => setTargetCpl(e.target.value)} />
        </Field>
      </div>
      {errore && <p className="text-xs text-red-600">{errore}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={crea} disabled={creando || !nome || (adAccountId !== "" && !/^\d+$/.test(adAccountId))}>
          {creando ? "Creazione…" : "Crea sede"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAttiva(false)}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
