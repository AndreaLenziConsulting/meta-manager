"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Cliente } from "@/types/kpi";
import { Field } from "@/components/ui/Field";
import { Input, Select } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Nota } from "@/components/ui/Nota";
import { formatDataBreve } from "@/lib/format";
import { etichettaIntervallo } from "@/lib/periodo";
import { giornoValido, prodottoAssegnabile, type RiepilogoRoadmap } from "@/lib/assegnaProdotto";

/** Come torna GET /api/clienti/prodotto. */
type ProdottoScelta = { prodottoId: string; nome: string; attivo: boolean; attivitaNelModello: number };
type StatoLettura = "caricamento" | "ok" | "errore";
/** L'anteprima vale per una scelta precisa (prodotto + data): con un'altra scelta non si mostra. */
type Anteprima = { chiave: string } & ({ riepilogo: RiepilogoRoadmap } | { errore: string });

const plurale = (n: number, una: string, tante: string) => `${n} ${n === 1 ? una : tante}`;

/**
 * Scheda "Prodotto" di Modifica cliente (08/10/2026), solo per l'amministratore: assegna un prodotto
 * a un cliente che è nato senza, e con lui fa nascere la roadmap del modello nella scheda Attività.
 * Prima si poteva fare solo dalla tabella del database. Le regole stanno in
 * src/lib/assegnaProdotto.ts; qui c'è la scelta, l'anteprima di ciò che nascerà e la conferma.
 *
 * Chi ha già prodotto e data li vede soltanto: cambiare prodotto a un cliente che ha già la sua
 * roadmap lascerebbe mescolate le attività dei due modelli.
 */
export function ProdottoCliente({ cliente }: { cliente: Cliente }) {
  const router = useRouter();
  const [prodotti, setProdotti] = useState<ProdottoScelta[]>([]);
  const [statoProdotti, setStatoProdotti] = useState<StatoLettura>("caricamento");
  // Un prodotto già scritto ma senza data di inizio (capitava nel foglio) si può solo completare.
  const [prodottoId, setProdottoId] = useState(cliente.prodottoId);
  const [data, setData] = useState("");
  const [anteprima, setAnteprima] = useState<Anteprima | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  // Ciò che è stato appena assegnato da qui: la scheda lo mostra subito, senza aspettare che la
  // pagina rilegga il cliente.
  const [assegnato, setAssegnato] = useState<{ prodottoId: string; dataInizioProgetto: string; attivitaCreate: number } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/clienti/prodotto", { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("lettura non riuscita");
        const body = (await res.json()) as { prodotti?: ProdottoScelta[] };
        setProdotti(body.prodotti ?? []);
        setStatoProdotti("ok");
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setStatoProdotti("errore");
      });
    return () => controller.abort();
  }, []);

  const attuale = assegnato ?? { prodottoId: cliente.prodottoId, dataInizioProgetto: cliente.dataInizioProgetto };
  const assegnabile = prodottoAssegnabile(attuale);
  const sceltaCompleta = assegnabile && Boolean(prodottoId) && giornoValido(data);
  const chiave = `${prodottoId}|${data}`;

  // L'anteprima si chiede al server, che ha il modello del prodotto e le attività che il cliente ha già.
  useEffect(() => {
    if (!sceltaCompleta) return;
    const controller = new AbortController();
    fetch("/api/clienti/prodotto", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId: cliente.clienteId, prodottoId, dataInizioProgetto: data, anteprima: true }),
      signal: controller.signal,
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as { riepilogo?: RiepilogoRoadmap; error?: string };
        if (res.ok && body.riepilogo) setAnteprima({ chiave, riepilogo: body.riepilogo });
        else setAnteprima({ chiave, errore: body.error || "Non riesco a calcolare le attività" });
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setAnteprima({ chiave, errore: "Non riesco a calcolare le attività: controlla la connessione" });
      });
    return () => controller.abort();
  }, [sceltaCompleta, chiave, cliente.clienteId, prodottoId, data]);

  const anteprimaAttuale = sceltaCompleta && anteprima?.chiave === chiave ? anteprima : null;
  const riepilogo = anteprimaAttuale && "riepilogo" in anteprimaAttuale ? anteprimaAttuale.riepilogo : null;
  const nomeDi = (id: string) => prodotti.find((p) => p.prodottoId === id)?.nome ?? id;

  async function assegna() {
    setErrore(null);
    setSalvando(true);
    try {
      const res = await fetch("/api/clienti/prodotto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clienteId: cliente.clienteId, prodottoId, dataInizioProgetto: data }),
      });
      const body = (await res.json().catch(() => ({}))) as { attivitaCreate?: number; error?: string };
      if (!res.ok) throw new Error(body.error || "Assegnazione non riuscita");
      setAssegnato({ prodottoId, dataInizioProgetto: data, attivitaCreate: body.attivitaCreate ?? 0 });
      // La pagina rilegge il cliente: la scheda Attività riparte con la roadmap nuova.
      router.refresh();
    } catch (err) {
      setErrore(err instanceof Error ? err.message : "Errore sconosciuto");
    } finally {
      setSalvando(false);
    }
  }

  if (!assegnabile) {
    return (
      <div className="space-y-4">
        {assegnato && (
          <Nota tono="ok" etichetta="Prodotto assegnato" compatta role="status">
            <p>
              {assegnato.attivitaCreate > 0
                ? `${plurale(assegnato.attivitaCreate, "attività creata", "attività create")}: ${assegnato.attivitaCreate === 1 ? "la trovi" : "le trovi"} nella scheda Attività del cliente.`
                : "Le attività del modello il cliente le aveva già: non ne è nata nessuna nuova."}
            </p>
          </Nota>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-ink-500">Prodotto</dt>
          <dd className="font-semibold text-ink-900">{nomeDi(attuale.prodottoId)}</dd>
          <dt className="text-ink-500">Inizio progetto</dt>
          <dd className="font-semibold text-ink-900">{attuale.dataInizioProgetto ? formatDataBreve(attuale.dataInizioProgetto) : "—"}</dd>
        </dl>
        <p className="text-sm leading-[22px] text-ink-500">
          La roadmap di questo prodotto è nella scheda Attività del cliente. Da qui il prodotto non si cambia: le attività già create resterebbero quelle del prodotto di prima, mescolate alle nuove.
        </p>
      </div>
    );
  }

  const prodottoBloccato = Boolean(cliente.prodottoId);
  const sceglibili = prodotti.filter((p) => p.attivo || p.prodottoId === cliente.prodottoId);

  return (
    <div className="space-y-4">
      <p className="text-sm leading-[22px] text-ink-500">
        {prodottoBloccato
          ? "Questo cliente ha un prodotto ma non la data di inizio del progetto: senza, la sua roadmap non può nascere. Indicala qui."
          : "Questo cliente non ha un prodotto. Assegnandolo nasce la sua roadmap nella scheda Attività: le attività del modello del prodotto, con le date calcolate dalla data di inizio. Dopo l'assegnazione il prodotto non si cambia da qui."}
      </p>

      {statoProdotti === "caricamento" && (
        <p role="status" className="text-sm text-ink-500">
          Lettura dei prodotti…
        </p>
      )}
      {statoProdotti === "errore" && (
        <Nota tono="critico" etichetta="Prodotti non letti" compatta role="alert">
          <p>Non riesco a leggere l&apos;elenco dei prodotti. Chiudi questa finestra e riaprila.</p>
        </Nota>
      )}
      {statoProdotti === "ok" && sceglibili.length === 0 && (
        <p className="text-sm text-ink-700">Non c&apos;è ancora nessun prodotto attivo: si creano da Impostazioni, in &quot;Prodotti e modelli&quot;.</p>
      )}

      {statoProdotti === "ok" && sceglibili.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prodotto" hint={prodottoBloccato ? "Già scritto sul cliente: manca solo la data." : undefined}>
              <Select value={prodottoId} onChange={(e) => setProdottoId(e.target.value)} disabled={prodottoBloccato || salvando}>
                <option value="">Scegli…</option>
                {sceglibili.map((p) => (
                  <option key={p.prodottoId} value={p.prodottoId} disabled={p.attivitaNelModello === 0}>
                    {p.nome}
                    {p.attivitaNelModello === 0 ? " (senza modello di attività)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Inizio progetto" hint="Le date delle attività si calcolano da questo giorno. Per un progetto già partito, indica il giorno vero.">
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} disabled={salvando} />
            </Field>
          </div>

          {sceltaCompleta && !anteprimaAttuale && (
            <p role="status" className="text-sm text-ink-500">
              Calcolo delle attività…
            </p>
          )}
          {anteprimaAttuale && "errore" in anteprimaAttuale && (
            <Nota tono="critico" etichetta="Non si può assegnare" compatta role="alert">
              <p>{anteprimaAttuale.errore}</p>
            </Nota>
          )}
          {riepilogo && (
            <div className="space-y-3">
              <p className="text-sm leading-[22px] text-ink-700">
                {riepilogo.nuove > 0 && riepilogo.dal && riepilogo.al ? (
                  <>
                    {riepilogo.nuove === 1 ? "Nascerà " : "Nasceranno "}
                    <strong className="font-semibold text-ink-900">{plurale(riepilogo.nuove, "attività", "attività")}</strong>, nel periodo {etichettaIntervallo(riepilogo.dal, riepilogo.al)}.
                  </>
                ) : (
                  "Il cliente ha già tutte le attività di questo modello: verranno scritti solo il prodotto e la data."
                )}
                {riepilogo.nuove > 0 && riepilogo.giaPresenti > 0 && ` Altre ${riepilogo.giaPresenti} del modello il cliente le ha già: restano come sono.`}
              </p>
              {riepilogo.giaScadute > 0 && (
                <Nota tono="attenzione" etichetta="Scadenze già passate" compatta>
                  <p>
                    {riepilogo.giaScadute === riepilogo.nuove ? "Tutte" : `${riepilogo.giaScadute} su ${riepilogo.nuove}`} hanno la scadenza prima di oggi: compariranno subito fra le attività in ritardo
                    del cliente. Se quel lavoro è già stato fatto, andranno segnate come fatte una per una.
                  </p>
                </Nota>
              )}
            </div>
          )}

          {errore && (
            <Nota tono="critico" etichetta="Prodotto non assegnato" compatta role="alert">
              <p>{errore}</p>
            </Nota>
          )}

          <div className="pt-4 border-t border-linea">
            <Button variant={riepilogo && riepilogo.nuove > 0 ? "crea" : "primary"} onClick={assegna} disabled={!riepilogo || salvando}>
              {salvando ? "Assegnazione…" : riepilogo && riepilogo.nuove > 0 ? `Assegna e crea ${plurale(riepilogo.nuove, "attività", "attività")}` : "Assegna prodotto"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
