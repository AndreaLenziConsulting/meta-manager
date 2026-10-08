"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown } from "lucide-react";
import type { CategoriaCommerciale, Cliente, Consulente, Sede, Venditore } from "@/types/kpi";
import { Modal } from "@/components/ui/Modal";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfermaEliminazioneModal } from "@/components/ui/ConfermaEliminazioneModal";
import { ConfermaEliminazioneNomeModal } from "@/components/ui/ConfermaEliminazioneNomeModal";
import { PersonalizzazioneCliente } from "@/components/PersonalizzazioneCliente";
import { ProdottoCliente } from "@/components/ProdottoCliente";
import { Tabs } from "@/components/Tabs";
import { Nota } from "@/components/ui/Nota";
import { erroreStadi, nomiStadi, stadiEscludibili } from "@/lib/ghlStadi";
import type { StadiGhl } from "@/types/ghl";

/** Come torna GET /api/ghl-connessioni — mai il token vero, solo una versione mascherata. */
type GhlConnessioneVista = {
  connessioneId: string;
  locationId: string;
  attivo: boolean;
  tokenMascherato: string;
  calendarIds: string[];
  pipelineIds: string[];
  stadi: StadiGhl;
};

/** Come torna GET /api/ghl-connessioni/calendari. */
type GhlCalendarioVista = { id: string; name: string; calendarType: string };

/** Come torna GET /api/ghl-connessioni/pipeline. */
type GhlPipelineVista = { id: string; name: string; stadi?: { id: string; name: string; position: number }[] };

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

type SchedaModale = "cliente" | "aspetto" | "sedi" | "prodotto" | "elimina";
// Lettura di un elenco collegato alle sedi (connessioni GHL, categorie, venditori).
type StatoLettura = "caricamento" | "ok" | "errore";

/** Riepilogo accanto al titolo di una sezione chiusa della sede. Mentre il dato arriva (o se non è
 * arrivato) lo dice, invece di scrivere "non collegata" o "nessuno" senza saperlo. */
function riepilogoSezione(stato: StatoLettura, quandoPronto: string): string {
  return stato === "caricamento" ? "lettura in corso" : stato === "errore" ? "non disponibile" : quandoPronto;
}

/**
 * Modifica di un cliente, divisa in schede (07/10/2026, audit UX): Cliente, Aspetto, Sedi e — solo
 * per l'admin — Prodotto (08/10/2026: assegnare un prodotto a un cliente nato senza, vedi
 * ProdottoCliente.tsx) ed Elimina. Prima era un'unica colonna alta più di quattromila pixel con una
 * settantina di campi, otto pulsanti "Salva" e cinque "Elimina" uno sotto l'altro. Dentro "Sedi" si
 * guarda una sede alla volta, e le parti meno usate (recupero storico, GHL, categorie, venditori) si
 * aprono a richiesta.
 *
 * Tutte le schede restano montate (solo nascoste): ciò che si è scritto in una non si perde
 * passando a un'altra. "Salva modifiche" salva insieme Cliente e Aspetto, che sono lo stesso
 * salvataggio; ogni sede ha il suo "Salva sede", come prima.
 */
export function ModificaClienteModal({ cliente, sedi, consulenti, ruoloAdmin, onClose, onSalvato }: Props) {
  const [scheda, setScheda] = useState<SchedaModale>("cliente");
  // La scheda Prodotto legge l'elenco dei prodotti: lo fa la prima volta che la si apre, non a ogni
  // apertura della finestra. Poi resta montata come le altre.
  const [prodottoAperto, setProdottoAperto] = useState(false);
  const [sedeScelta, setSedeScelta] = useState(sedi[0]?.sedeId ?? "");
  // La sede scelta può sparire (eliminata, e l'elenco si ricarica): si torna alla prima.
  const sedeAperta = sedi.some((s) => s.sedeId === sedeScelta) ? sedeScelta : (sedi[0]?.sedeId ?? "");
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
  const [appuntamentiFileUrl, setAppuntamentiFileUrl] = useState(cliente.appuntamentiFileUrl);

  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [confermaEliminaClienteAperta, setConfermaEliminaClienteAperta] = useState(false);

  // Fase 1 integrazione GHL/Squadd: connessioni indicizzate per sedeId, caricate a parte (Sede
  // non le porta con sé — vedi src/types/ghl.ts) e ricaricate dopo ogni creazione/modifica.
  const [ghlPerSede, setGhlPerSede] = useState<Record<string, GhlConnessioneVista>>({});
  const [ghlTick, setGhlTick] = useState(0);
  const [statoGhl, setStatoGhl] = useState<StatoLettura>("caricamento");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ghl-connessioni?clienteId=${encodeURIComponent(cliente.clienteId)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((body: { connessioni?: (GhlConnessioneVista & { sedeId: string })[] }) => {
        const mappa: Record<string, GhlConnessioneVista> = {};
        for (const c of body.connessioni ?? []) mappa[c.sedeId] = c;
        setGhlPerSede(mappa);
        setStatoGhl("ok");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatoGhl("errore");
      });
    return () => controller.abort();
  }, [cliente.clienteId, ghlTick]);

  // Categorie commerciali (Fase 1, 11/2026) — stesso schema di ghlPerSede sopra: indicizzate per
  // sedeId (qui un array, non un valore singolo: una sede può averne fino a 3), ricaricate dopo
  // ogni creazione/modifica/eliminazione.
  const [categoriePerSede, setCategoriePerSede] = useState<Record<string, CategoriaCommerciale[]>>({});
  const [categorieTick, setCategorieTick] = useState(0);
  const [statoCategorie, setStatoCategorie] = useState<StatoLettura>("caricamento");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/categorie-commerciali?clienteId=${encodeURIComponent(cliente.clienteId)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((body: { categorie?: CategoriaCommerciale[] }) => {
        const mappa: Record<string, CategoriaCommerciale[]> = {};
        for (const c of body.categorie ?? []) (mappa[c.sedeId] ??= []).push(c);
        setCategoriePerSede(mappa);
        setStatoCategorie("ok");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatoCategorie("errore");
      });
    return () => controller.abort();
  }, [cliente.clienteId, categorieTick]);

  // Venditori (Fase 2, 11/2026) — stesso schema di categoriePerSede sopra.
  const [venditoriPerSede, setVenditoriPerSede] = useState<Record<string, Venditore[]>>({});
  const [venditoriTick, setVenditoriTick] = useState(0);
  const [statoVenditori, setStatoVenditori] = useState<StatoLettura>("caricamento");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/venditori?clienteId=${encodeURIComponent(cliente.clienteId)}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((body: { venditori?: Venditore[] }) => {
        const mappa: Record<string, Venditore[]> = {};
        for (const v of body.venditori ?? []) (mappa[v.sedeId] ??= []).push(v);
        setVenditoriPerSede(mappa);
        setStatoVenditori("ok");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatoVenditori("errore");
      });
    return () => controller.abort();
  }, [cliente.clienteId, venditoriTick]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Il modulo ha `noValidate`: un campo non valido dentro una scheda nascosta bloccherebbe
    // l'invio senza poter mostrare il suo messaggio. Lo si controlla qui e, se serve, si torna
    // sulla scheda dove sta il campo prima di far comparire l'avviso del browser.
    const modulo = e.currentTarget;
    if (!modulo.checkValidity()) {
      setScheda("cliente");
      requestAnimationFrame(() => modulo.reportValidity());
      return;
    }
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
          appuntamentiFileUrl,
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

  const schede: { id: SchedaModale; label: string }[] = [
    { id: "cliente", label: "Cliente" },
    { id: "aspetto", label: "Aspetto" },
    { id: "sedi", label: sedi.length > 1 ? `Sedi (${sedi.length})` : "Sede" },
    ...(ruoloAdmin ? [{ id: "prodotto" as const, label: "Prodotto" }, { id: "elimina" as const, label: "Elimina" }] : []),
  ];
  const inAnagrafica = scheda === "cliente" || scheda === "aspetto";

  return (
    <Modal title="Modifica cliente" subtitle={cliente.clienteId} onClose={onClose} maxWidth="max-w-2xl">
      <Tabs
        etichetta="Sezioni della modifica cliente"
        tabs={schede}
        attivo={scheda}
        onChange={(id) => {
          setScheda(schede.find((s) => s.id === id)?.id ?? "cliente");
          if (id === "prodotto") setProdottoAperto(true);
        }}
      />

      <form onSubmit={handleSubmit} noValidate hidden={!inAnagrafica} className="space-y-5">
        <div hidden={scheda !== "cliente"} className="space-y-4">
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
          <label className="flex min-h-8 items-center gap-2.5 text-sm text-ink-700 cursor-pointer">
            <input type="checkbox" checked={mostraTabExtra} onChange={(e) => setMostraTabExtra(e.target.checked)} className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer flex-shrink-0" />
            Il cliente vede anche il tab Meeting (oltre a KPI)
          </label>
          <label className={`flex min-h-8 items-center gap-2.5 text-sm text-ink-700 ${ruoloAdmin ? "cursor-pointer" : ""}`}>
            <input
              type="checkbox"
              checked={attivo}
              onChange={(e) => setAttivo(e.target.checked)}
              disabled={!ruoloAdmin}
              className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
            />
            Cliente attivo{!ruoloAdmin && " (solo l'amministratore può cambiarlo)"}
          </label>
        </div>

        <div className="pt-4 border-t border-linea space-y-4">
          <div>
            <p className="text-base font-bold text-ink-900">Link rapidi</p>
            <p className="text-xs text-ink-500 mt-0.5">
              Compaiono in alto sulla scheda cliente. Li vede solo il team, mai il cliente sul link pubblico. I funnel si gestiscono
              dal pulsante &ldquo;Funnel&rdquo; della scheda, non da qui.
            </p>
          </div>
          <Field label="Cartella Drive">
            <Input value={driveFolderUrl} onChange={(e) => setDriveFolderUrl(e.target.value)} placeholder="https://drive.google.com/…" />
          </Field>
          <Field
            label="File contatti (foglio Google)"
            hint="Per le sedi senza GHL: una riga per contatto, con il menù a tendina dello stato (Da contattare, Non lavorabile, In contatto, Appuntamento fissato, Appuntamento effettuato, Vendita) e il fatturato nella colonna accanto. L'app lo legge dal vivo. Lascia vuoto per scollegarlo."
          >
            <Input
              value={appuntamentiFileUrl}
              onChange={(e) => setAppuntamentiFileUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/…"
            />
          </Field>
        </div>

        </div>

        <div hidden={scheda !== "aspetto"} className="space-y-4">
          <p className="text-sm leading-[22px] text-ink-500">
            Logo, colori e carattere di questo cliente sulla sua scheda e sul link pubblico. Lasciati vuoti, resta l&apos;aspetto ALC.
          </p>
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

        {errore && (
          <Nota tono="critico" etichetta="Modifiche non salvate" compatta role="alert">
            <p>{errore}</p>
          </Nota>
        )}

        <div className="flex flex-wrap gap-3 pt-4 border-t border-linea">
          <Button type="submit" disabled={salvando || !nome || !consulenteId}>
            {salvando ? "Salvataggio…" : "Salva modifiche"}
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Annulla
          </Button>
        </div>
      </form>

      {ruoloAdmin && prodottoAperto && (
        <div hidden={scheda !== "prodotto"}>
          <ProdottoCliente cliente={cliente} />
        </div>
      )}

      <div hidden={scheda !== "sedi"} className="space-y-4">
        <p className="text-sm leading-[22px] text-ink-500">
          Ogni sede ha il suo account pubblicitario e i suoi target: ads e risultati commerciali restano separati da una sede all&apos;altra.
        </p>
        {sedi.length > 1 && (
          <Tabs
            etichetta="Sede da modificare"
            tabs={sedi.map((s) => ({ id: s.sedeId, label: s.attivo ? s.nome : `${s.nome} (non attiva)` }))}
            attivo={sedeAperta}
            onChange={setSedeScelta}
          />
        )}
        {sedi.map((sede) => (
          <div key={sede.sedeId} hidden={sede.sedeId !== sedeAperta}>
            <SedeRow
              sede={sede}
              ghlConnessione={ghlPerSede[sede.sedeId]}
              onGhlSalvato={() => setGhlTick((t) => t + 1)}
              categorie={categoriePerSede[sede.sedeId] ?? []}
              onCategorieSalvato={() => setCategorieTick((t) => t + 1)}
              venditori={venditoriPerSede[sede.sedeId] ?? []}
              onVenditoriSalvato={() => setVenditoriTick((t) => t + 1)}
              ruoloAdmin={ruoloAdmin}
              numeroSediCliente={sedi.length}
              letture={{ ghl: statoGhl, categorie: statoCategorie, venditori: statoVenditori }}
            />
          </div>
        ))}
        <div className="pt-4 border-t border-linea">
          <NuovaSedeForm clienteId={cliente.clienteId} />
        </div>
      </div>

      {ruoloAdmin && (
        <div hidden={scheda !== "elimina"} className="space-y-4">
          <Nota tono="critico" etichetta="Azione definitiva">
            <p>
              Eliminare <strong className="font-bold text-ink-900">{cliente.nome}</strong> cancella per sempre anagrafica, sedi, connessioni GHL,
              attività, meeting e risultati commerciali. Non si può annullare. Se vuoi solo toglierlo dall&apos;elenco, disattivalo dalla
              scheda Cliente.
            </p>
          </Nota>
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
              giornalieri) resta in archivio ma non sarà più visibile da nessuna parte dell&apos;app.
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
  letture,
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
  letture: { ghl: StatoLettura; categorie: StatoLettura; venditori: StatoLettura };
}) {
  const [nome, setNome] = useState(sede.nome);
  const [adAccountId, setAdAccountId] = useState(sede.adAccountId);
  const [targetCpa, setTargetCpa] = useState(sede.targetCpa !== null ? String(sede.targetCpa) : "");
  const [targetCpl, setTargetCpl] = useState(sede.targetCpl !== null ? String(sede.targetCpl) : "");
  const [tipoConversioneLead, setTipoConversioneLead] = useState(sede.tipoConversioneLead);
  const [tutteLeCampagne, setTutteLeCampagne] = useState(Boolean(sede.tutteLeCampagne));
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
          tutteLeCampagne,
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
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Target CPA (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpa} onChange={(e) => setTargetCpa(e.target.value)} />
        </Field>
        <Field label="Target CPL (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpl} onChange={(e) => setTargetCpl(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 items-end">
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
      <label className="flex items-start gap-2.5 text-sm text-ink-700 cursor-pointer">
        <input
          type="checkbox"
          checked={tutteLeCampagne}
          onChange={(e) => setTutteLeCampagne(e.target.checked)}
          className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer mt-0.5 flex-shrink-0"
        />
        <span>
          Considera tutte le campagne dell&apos;account
          <span className="block text-xs text-ink-500 mt-0.5">
            Se non è spuntato e la sede ha campagne con &quot;ALC&quot; nel nome, KPI, grafici e dashboard contano di default solo
            quelle. Spuntalo quando tutte le campagne dell&apos;account sono gestite dall&apos;agenzia.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <label className="flex min-h-8 items-center gap-2.5 text-sm text-ink-700 cursor-pointer">
          <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer flex-shrink-0" />
          Sede attiva
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {salvato && (
            <span role="status" className="flex items-center gap-1 text-xs font-bold text-ok">
              <CheckCircle2 size={16} aria-hidden="true" /> Salvato
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
      {errore && (
        <p role="alert" className="text-xs font-semibold text-critico">
          {errore}
        </p>
      )}

      <div>
        <SezioneSede titolo="Connessione GHL/Squadd" riepilogo={riepilogoSezione(letture.ghl, ghlConnessione ? "collegata" : "non collegata")}>
          <GhlConnessioneBlock sedeId={sede.sedeId} connessione={ghlConnessione} onSalvato={onGhlSalvato} ruoloAdmin={ruoloAdmin} />
        </SezioneSede>
        <SezioneSede
          titolo="Categorie commerciali"
          riepilogo={riepilogoSezione(letture.categorie, categorie.length === 0 ? "nessuna" : `${categorie.length} su 3`)}
        >
          <CategorieCommercialiBlock sedeId={sede.sedeId} categorie={categorie} onSalvato={onCategorieSalvato} ruoloAdmin={ruoloAdmin} />
        </SezioneSede>
        <SezioneSede titolo="Venditori" riepilogo={riepilogoSezione(letture.venditori, venditori.length === 0 ? "nessuno" : String(venditori.length))}>
          <VenditoriBlock sedeId={sede.sedeId} venditori={venditori} onSalvato={onVenditoriSalvato} ruoloAdmin={ruoloAdmin} />
        </SezioneSede>
        {ruoloAdmin && sede.adAccountId && (
          <SezioneSede titolo="Recupero storico campagne">
            <BackfillCampagneBlock sedeId={sede.sedeId} />
          </SezioneSede>
        )}
      </div>

      {mostraConfermaElimina && (
        <ConfermaEliminazioneModal
          titolo="Eliminare questa sede?"
          messaggio={
            <>
              Cancella anche la sua connessione GHL, se presente. Lo storico ads (Campagne, risultati
              commerciali) di questa sede resta in archivio ma non sarà più visibile da nessuna parte
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

/** Una parte della sede che si apre a richiesta (GHL, categorie, venditori, recupero storico): il
 * titolo dice cos'è e in che stato è, il contenuto resta montato anche da chiuso. */
function SezioneSede({ titolo, riepilogo, children }: { titolo: string; riepilogo?: string; children: ReactNode }) {
  return (
    <details className="group border-t border-linea last:border-b">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 [&::-webkit-details-marker]:hidden">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-bold text-ink-900">{titolo}</span>
          {riepilogo && <span className="text-xs font-medium text-ink-500">{riepilogo}</span>}
        </span>
        <ChevronDown size={18} aria-hidden="true" className="shrink-0 text-ink-500 transition-transform group-open:rotate-180" />
      </summary>
      <div className="pb-4 pt-1">{children}</div>
    </details>
  );
}

/**
 * Recupero storico campagne (20/09/2026, segnalato dall'utente: campagne reali mancanti nel
 * pannello KPI per un cliente) — la sincronizzazione ordinaria (pulsante "Aggiorna KPI" in
 * KpiSection.tsx + cron giornaliero) guarda sempre e solo gli ultimi 3 giorni (GIORNI_ROLLING in
 * lib/sync.ts): una campagna mai attiva in nessuna di quelle finestre non viene mai salvata, per
 * nessun periodo. Azione manuale, solo admin, `since` scelto esplicitamente (mai un default
 * silenzioso "da sempre" — vedi il commento su backfillSede in lib/sync.ts): un account con anni
 * di storico può avere molto rumore che l'admin potrebbe non voler importare.
 */
function BackfillCampagneBlock({ sedeId }: { sedeId: string }) {
  const [since, setSince] = useState(`${new Date().getFullYear()}-01-01`);
  const [caricamento, setCaricamento] = useState(false);
  const [risultato, setRisultato] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  async function recupera() {
    setErrore(null);
    setRisultato(null);
    setCaricamento(true);
    try {
      const res = await fetch("/api/admin/backfill-campagne", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sedeId, since }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Recupero non riuscito");
      setRisultato(`Recuperate ${body.righe} righe giornaliere da Meta — le campagne mancanti compaiono ora nei filtri.`);
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setCaricamento(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-500">
        La sincronizzazione automatica guarda solo gli ultimi giorni: una campagna in pausa da tempo può non essere mai
        stata salvata, per nessun periodo. Recuperala una volta da qui — poi resta aggiornata da sola.
      </p>
      <div className="flex items-center gap-2">
        <Input type="date" value={since} onChange={(e) => setSince(e.target.value)} className="w-auto" />
        <Button type="button" size="sm" variant="ghost" onClick={recupera} disabled={caricamento || !since}>
          {caricamento ? "Recupero…" : "Recupera storico"}
        </Button>
      </div>
      {risultato && <p className="text-xs text-ok">{risultato}</p>}
      {errore && <p className="text-xs text-critico">{errore}</p>}
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
      {errore && <p className="text-xs text-critico">{errore}</p>}
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
      {connessione && <GhlPipelinePicker connessione={connessione} onSalvato={onSalvato} />}
      {connessione && <GhlStadiPicker connessione={connessione} onSalvato={onSalvato} />}

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
    return <p className="text-xs text-critico pt-2">{erroreCaricamento}</p>;
  }
  if (calendari.length === 0) {
    return <p className="text-xs text-ink-500 pt-2">Nessun calendario trovato su questa location.</p>;
  }

  return (
    <div className="space-y-2 pt-2 border-t border-linea mt-2">
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-ink-500">
        Calendari da includere negli appuntamenti
      </p>
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        {calendari.map((c) => (
          <label key={c.id} className="flex min-h-8 items-center gap-2.5 text-sm text-ink-700 cursor-pointer">
            <input
              type="checkbox"
              checked={selezionati.has(c.id)}
              onChange={() => toggle(c.id)}
              className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer flex-shrink-0"
            />
            <span className="truncate">{c.name}</span>
            <span className="text-ink-500 flex-shrink-0">({c.calendarType})</span>
          </label>
        ))}
      </div>
      {erroreSalvataggio && <p className="text-xs text-critico">{erroreSalvataggio}</p>}
      <Button type="button" size="sm" onClick={salvaSelezione} disabled={salvando}>
        {salvando ? "Salvataggio…" : "Salva calendari"}
      </Button>
    </div>
  );
}

/**
 * Sceglie quali pipeline della location appartengono a QUESTA sede (01/10/2026) — per i clienti che
 * tengono più divisioni nella stessa location GHL separandole per pipeline (Agricobots: Italia e
 * Spagna). Nessuna selezionata = la sede vale per tutta la location, comportamento di sempre: qui
 * non c'è nessuna preselezione automatica, a differenza dei calendari. Con una selezione, vendite,
 * appuntamenti e attribuzione della sede contano solo i contatti con un'opportunità in quelle
 * pipeline (vedi restringiAllePipeline in lib/ghl.ts).
 */
function GhlPipelinePicker({ connessione, onSalvato }: { connessione: GhlConnessioneVista; onSalvato: () => void }) {
  const [stato, setStato] = useState<"caricamento" | "ok" | "errore">("caricamento");
  const [pipeline, setPipeline] = useState<GhlPipelineVista[]>([]);
  const [selezionate, setSelezionate] = useState<Set<string>>(new Set());
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroreSalvataggio, setErroreSalvataggio] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        setStato("caricamento");
        return fetch(`/api/ghl-connessioni/pipeline?connessioneId=${encodeURIComponent(connessione.connessioneId)}`, {
          signal: controller.signal,
        });
      })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Errore nel caricamento delle pipeline");
        setPipeline((body.pipeline ?? []) as GhlPipelineVista[]);
        setSelezionate(new Set(connessione.pipelineIds));
        setStato("ok");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErroreCaricamento(err.message);
        setStato("errore");
      });
    return () => controller.abort();
  }, [connessione.connessioneId, connessione.pipelineIds]);

  function toggle(id: string) {
    setSelezionate((prec) => {
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
        body: JSON.stringify({ connessioneId: connessione.connessioneId, pipelineIds: Array.from(selezionate) }),
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
    return <p className="text-xs text-ink-500 pt-2">Caricamento pipeline…</p>;
  }
  if (stato === "errore") {
    return <p className="text-xs text-critico pt-2">{erroreCaricamento}</p>;
  }
  if (pipeline.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2 pt-2 border-t border-linea mt-2">
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-ink-500">Pipeline di questa sede</p>
      <p className="text-xs text-ink-500">
        Nessuna selezionata = la sede vale per tutta la location. Seleziona le pipeline solo quando più sedi condividono la stessa
        location GHL: vendite e appuntamenti conteranno solo i contatti con un&apos;opportunità in quelle pipeline.
      </p>
      <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
        {pipeline.map((p) => (
          <label key={p.id} className="flex min-h-8 items-center gap-2.5 text-sm text-ink-700 cursor-pointer">
            <input type="checkbox" checked={selezionate.has(p.id)} onChange={() => toggle(p.id)} className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer flex-shrink-0" />
            <span className="truncate">{p.name}</span>
          </label>
        ))}
      </div>
      {erroreSalvataggio && <p className="text-xs text-critico">{erroreSalvataggio}</p>}
      <Button type="button" size="sm" onClick={salvaSelezione} disabled={salvando}>
        {salvando ? "Salvataggio…" : "Salva pipeline"}
      </Button>
    </div>
  );
}

/**
 * Sceglie quali STADI di pipeline valgono come appuntamento e come vendita (08/10/2026) — per i
 * clienti che su GHL non usano il calendario né lo stato "vinta" ma spostano i contatti di stadio
 * (Agricobots: "Videocall 1 - Programmata", "Videocall 1 - Effettuata", "Acconto Versato - Diventa
 * Cliente"). Tutto vuoto = come sempre. Le regole e il limite del metodo stanno in
 * src/lib/ghlStadi.ts; qui ci sono la scelta e la spiegazione per chi sceglie.
 *
 * Gli stadi proposti sono quelli delle pipeline della sede (o di tutta la location, se la sede non
 * ne ha scelte): si sceglie un NOME, che vale per tutte le pipeline che hanno uno stadio con quel nome.
 */
function GhlStadiPicker({ connessione, onSalvato }: { connessione: GhlConnessioneVista; onSalvato: () => void }) {
  const [stato, setStato] = useState<"caricamento" | "ok" | "errore">("caricamento");
  const [pipeline, setPipeline] = useState<GhlPipelineVista[]>([]);
  const [erroreCaricamento, setErroreCaricamento] = useState<string | null>(null);
  const [stadi, setStadi] = useState<StadiGhl>(connessione.stadi);
  const [salvando, setSalvando] = useState(false);
  const [erroreSalvataggio, setErroreSalvataggio] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve()
      .then(() => {
        setStato("caricamento");
        return fetch(`/api/ghl-connessioni/pipeline?connessioneId=${encodeURIComponent(connessione.connessioneId)}`, { signal: controller.signal });
      })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || "Errore nel caricamento degli stadi");
        setPipeline((body.pipeline ?? []) as GhlPipelineVista[]);
        setStato("ok");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setErroreCaricamento(err.message);
        setStato("errore");
      });
    return () => controller.abort();
  }, [connessione.connessioneId]);

  if (stato === "caricamento") return <p className="text-xs text-ink-500 pt-2">Caricamento stadi…</p>;
  if (stato === "errore") return <p className="text-xs text-critico pt-2">{erroreCaricamento}</p>;

  const dellaSede = (connessione.pipelineIds.length > 0 ? pipeline.filter((p) => connessione.pipelineIds.includes(p.id)) : pipeline).map((p) => ({ id: p.id, name: p.name, stadi: p.stadi ?? [] }));
  // Uno stadio già salvato che GHL non ha più (rinominato o tolto) resta in elenco: si vede cosa c'era.
  const nomi = Array.from(new Set([...nomiStadi(dellaSede), stadi.appuntamentoFissato, stadi.appuntamentoEffettuato, stadi.vendita, ...stadi.ignorati].filter(Boolean)));
  if (nomi.length === 0) return null;

  const errore = erroreStadi(stadi);
  const inUso = Boolean(stadi.appuntamentoFissato || stadi.appuntamentoEffettuato || stadi.vendita);
  const escludibili = stadiEscludibili(dellaSede, stadi);
  const imposta = (campi: Partial<StadiGhl>) => {
    setStadi((prima) => ({ ...prima, ...campi }));
    setSalvato(false);
    setErroreSalvataggio(null);
  };
  const cambiaIgnorato = (nome: string) => imposta({ ignorati: stadi.ignorati.includes(nome) ? stadi.ignorati.filter((n) => n !== nome) : [...stadi.ignorati, nome] });

  async function salva() {
    setErroreSalvataggio(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/ghl-connessioni", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Senza nessuno stadio scelto quelli "da non contare" non hanno senso: si salva tutto vuoto.
        body: JSON.stringify({ connessioneId: connessione.connessioneId, stadi: inUso ? stadi : { appuntamentoFissato: "", appuntamentoEffettuato: "", vendita: "", ignorati: [] } }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Salvataggio non riuscito");
      setSalvato(true);
      onSalvato();
    } catch (err) {
      setErroreSalvataggio(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  const scelta = (etichetta: string, campo: "appuntamentoFissato" | "appuntamentoEffettuato" | "vendita") => (
    <Field label={etichetta}>
      <Select value={stadi[campo]} onChange={(e) => imposta({ [campo]: e.target.value })} disabled={salvando}>
        <option value="">Non usare gli stadi</option>
        {nomi.map((nome) => (
          <option key={nome} value={nome}>
            {nome}
          </option>
        ))}
      </Select>
    </Field>
  );

  return (
    <div className="space-y-3 pt-2 border-t border-linea mt-2">
      <p className="text-xs font-semibold uppercase tracking-[.12em] text-ink-500">Appuntamenti e vendite dagli stadi</p>
      <p className="text-xs text-ink-500">
        Solo per chi su GHL non usa il calendario né lo stato &quot;vinta&quot;, ma sposta i contatti di stadio. Scegli da quale stadio un contatto conta: vale per quello stadio e per tutti quelli che
        vengono dopo nella pipeline. Lasciando tutto su &quot;Non usare gli stadi&quot; resta com&apos;è: appuntamenti dai calendari, vendite dalle opportunità vinte.
      </p>
      {/* Uno sotto l'altro, a tutta larghezza: i nomi degli stadi sono lunghi e in tre colonne si troncavano. */}
      <div className="space-y-2.5">
        {scelta("Appuntamento fissato da", "appuntamentoFissato")}
        {scelta("Appuntamento effettuato da", "appuntamentoEffettuato")}
        {scelta("Vendita da", "vendita")}
      </div>
      {escludibili.length > 0 && (
        <fieldset className="space-y-1">
          <legend className="text-xs text-ink-700">Fra gli stadi che vengono dopo, quali non contare mai (per esempio un archivio in fondo alla pipeline):</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {escludibili.map((nome) => (
              <label key={nome} className="flex min-h-8 items-center gap-2 text-sm text-ink-700 cursor-pointer">
                <input type="checkbox" checked={stadi.ignorati.includes(nome)} onChange={() => cambiaIgnorato(nome)} disabled={salvando} className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer flex-shrink-0" />
                {nome}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      {inUso && (
        <p className="text-xs text-ink-500">
          Da sapere: GHL dice solo in che stadio è un contatto adesso e quando ci è entrato. Ogni contatto conta una volta, alla data del suo ultimo spostamento: i numeri di un periodo passato possono
          calare quando i contatti avanzano. Con gli appuntamenti dagli stadi, i calendari scelti sopra non vengono più contati.
        </p>
      )}
      {errore && <p className="text-xs text-critico">{errore}</p>}
      {erroreSalvataggio && <p className="text-xs text-critico">{erroreSalvataggio}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={salva} disabled={salvando || Boolean(errore)}>
          {salvando ? "Salvataggio…" : "Salva stadi"}
        </Button>
        {salvato && (
          <span role="status" className="text-xs text-ink-500">
            Salvato.
          </span>
        )}
      </div>
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
  // Cluster definito per pipeline GHL invece che per tag (CategoriaCommerciale.pipelineGhl,
  // 01/10/2026). L'elenco arriva dalla connessione attiva della sede — vuoto (nessun selettore) se la
  // sede non è connessa a GHL o la richiesta non va a buon fine; in quel caso il valore salvato
  // resta com'è, mai azzerato da un salvataggio fatto senza vedere il selettore.
  const [pipelineSelezionate, setPipelineSelezionate] = useState<Set<string>>(
    () =>
      new Set(
        (categoria.pipelineGhl ?? "")
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      )
  );
  const [pipelineDisponibili, setPipelineDisponibili] = useState<GhlPipelineVista[]>([]);
  const [target, setTarget] = useState<TargetCategoriaForm>(() => targetCategoriaDa(categoria));
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [salvato, setSalvato] = useState(false);
  const [mostraConfermaElimina, setMostraConfermaElimina] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/ghl-connessioni/pipeline?sedeId=${encodeURIComponent(categoria.sedeId)}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { pipeline?: GhlPipelineVista[]; pipelineIdsSede?: string[] } | null) => {
        if (!body) return;
        // Se la sede è delimitata da alcune pipeline, un suo cluster può essere solo una di quelle.
        const dellaSede = new Set(body.pipelineIdsSede ?? []);
        const tutte = body.pipeline ?? [];
        setPipelineDisponibili(dellaSede.size > 0 ? tutte.filter((p) => dellaSede.has(p.id)) : tutte);
      })
      .catch(() => {
        // Nessun selettore: vedi il commento su pipelineSelezionate sopra.
      });
    return () => controller.abort();
  }, [categoria.sedeId]);

  function togglePipeline(id: string) {
    setPipelineSelezionate((prec) => {
      const nuovo = new Set(prec);
      if (nuovo.has(id)) nuovo.delete(id);
      else nuovo.add(id);
      return nuovo;
    });
  }

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
          pipelineGhl: Array.from(pipelineSelezionate).join(","),
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
      {pipelineDisponibili.length > 0 && (
        <Field
          label="Pipeline GHL (opzionale)"
          hint="In alternativa al tag: se selezioni una o più pipeline, richieste/appuntamenti/fatturato di questa categoria vengono calcolati dalle opportunità in quelle pipeline. Se sono impostati entrambi vale la pipeline."
        >
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {pipelineDisponibili.map((p) => (
              <label key={p.id} className="flex min-h-8 items-center gap-2.5 text-sm text-ink-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={pipelineSelezionate.has(p.id)}
                  onChange={() => togglePipeline(p.id)}
                  className="h-[18px] w-[18px] accent-[var(--brand-primary)] cursor-pointer flex-shrink-0"
                />
                <span className="truncate">{p.name}</span>
              </label>
            ))}
          </div>
        </Field>
      )}
      <CampiTargetCategoria valori={target} onChange={(campo, valore) => setTarget((t) => ({ ...t, [campo]: valore }))} />
      {errore && <p className="text-xs text-critico">{errore}</p>}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {salvato && (
            <span className="flex items-center gap-1 text-xs font-semibold text-ok">
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
      {errore && <p className="text-xs text-critico">{errore}</p>}
      <div className="flex gap-2">
        <Button variant="crea" type="button" size="sm" onClick={crea} disabled={creando || !nome.trim()}>
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
      {venditori.length === 0 && !attiva && (
        <p className="text-xs text-ink-500">
          Nessuno — il riquadro dei venditori in fondo al tab KPI resta vuoto finché non ne aggiungi almeno uno.
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
  // 0 = capienza non indicata (facoltativa dall'08/10/2026): il campo resta vuoto, non mostra uno zero.
  const [capienza, setCapienza] = useState(venditore.capienzaAppuntamentiMensile > 0 ? String(venditore.capienzaAppuntamentiMensile) : "");
  const [attivo, setAttivo] = useState(venditore.attivo);
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
        body: JSON.stringify({ venditoreId: venditore.venditoreId, nome, ghlUserId, capienzaAppuntamentiMensile: capienza.trim() === "" ? 0 : Number(capienza), attivo }),
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

  const capienzaValida = capienza.trim() === "" || Number(capienza) >= 0;

  return (
    <div className="rounded-lg border border-ink-300/60 p-2.5 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-2.5">
        <Field label="Nome">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Field>
        <Field label="Appuntamenti al mese">
          <Input type="number" step="1" min={0} value={capienza} onChange={(e) => setCapienza(e.target.value)} placeholder="facoltativo" />
        </Field>
      </div>
      <Field
        label="Utente GHL (facoltativo)"
        hint="Il codice del suo utente su GHL. Se c'è e la sede è collegata a GHL, i suoi appuntamenti, vendite e fatturato si leggono da lì; altrimenti si inseriscono a mano dal tab KPI."
      >
        <Input value={ghlUserId} onChange={(e) => setGhlUserId(e.target.value)} placeholder="codice utente GHL" />
      </Field>
      <label className="flex min-h-8 cursor-pointer items-start gap-2 text-sm text-ink-700">
        <input type="checkbox" checked={attivo} onChange={(e) => setAttivo(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] flex-shrink-0 cursor-pointer accent-[var(--brand-primary)]" />
        <span>
          <span className="font-semibold text-ink-900">Attivo</span>
          <span className="block text-xs text-ink-500">Un venditore non attivo non compare più nel tab KPI. I risultati inseriti per lui restano.</span>
        </span>
      </label>
      {errore && <p className="text-xs text-critico">{errore}</p>}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {salvato && (
            <span className="flex items-center gap-1 text-xs font-semibold text-ok">
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
              La sua quota di carico si ridistribuisce sugli altri venditori attivi della sede. I risultati
              mensili inseriti per lui vengono eliminati insieme a lui.
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
  const [ghlUserId, setGhlUserId] = useState("");
  const [creando, setCreando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function crea() {
    setErrore(null);
    setCreando(true);
    try {
      const res = await fetch("/api/venditori", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sedeId, nome, capienzaAppuntamentiMensile: capienza.trim() === "" ? 0 : Number(capienza), ghlUserId }),
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

  const capienzaValida = capienza.trim() === "" || Number(capienza) >= 0;

  return (
    <div className="rounded-lg border border-dashed border-ink-300 p-2.5 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-2.5">
        <Field label="Nome">
          <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="es. Mario Rossi" />
        </Field>
        <Field label="Appuntamenti al mese" hint="Facoltativo: serve solo a dividere il target fra i venditori.">
          <Input type="number" step="1" min={0} value={capienza} onChange={(e) => setCapienza(e.target.value)} placeholder="es. 20" />
        </Field>
      </div>
      <Field label="Utente GHL (facoltativo)" hint="Il codice del suo utente su GHL: con quello i suoi numeri si leggono da GHL invece di inserirli a mano.">
        <Input value={ghlUserId} onChange={(e) => setGhlUserId(e.target.value)} placeholder="codice utente GHL" />
      </Field>
      {errore && <p className="text-xs text-critico">{errore}</p>}
      <div className="flex gap-2">
        <Button variant="crea" type="button" size="sm" onClick={crea} disabled={creando || !nome.trim() || !capienzaValida}>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Target CPA (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpa} onChange={(e) => setTargetCpa(e.target.value)} />
        </Field>
        <Field label="Target CPL (€, opzionale)">
          <Input type="number" step="0.01" value={targetCpl} onChange={(e) => setTargetCpl(e.target.value)} />
        </Field>
      </div>
      {errore && <p className="text-xs text-critico">{errore}</p>}
      <div className="flex gap-2">
        <Button variant="crea" type="button" size="sm" onClick={crea} disabled={creando || !nome || (adAccountId !== "" && !/^\d+$/.test(adAccountId))}>
          {creando ? "Creazione…" : "Crea sede"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAttiva(false)}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
