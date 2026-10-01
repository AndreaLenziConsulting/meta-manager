import { NextRequest, NextResponse } from "next/server";
import { getSessione } from "@/lib/auth";
import { getCampagne, getCategorieCommerciali, getClienti, getGhlConnessioni, getSedi, getVenditori } from "@/lib/sheets";
import { interpretaFoglioContatti, leggiFoglioContatti, riepilogoDaContatti } from "@/lib/foglioContatti";
import { puoVedereCliente } from "@/lib/authz";
import { normalizzaIntervallo } from "@/lib/kpi";
import {
  appuntamentiGhlPerSettimana,
  breakdownGhlPerCampagna,
  breakdownGhlPerInserzione,
  fatturatoGhlPerSettimana,
  fetchAppuntamenti,
  contaContattiSenzaTagNelPeriodo,
  fetchContattiPerTag,
  fetchOpportunita,
  mappaCampagnaPerContatto,
  mappaInserzionePerContatto,
  pipelineDiCategoria,
  restringiAllePipeline,
  riepilogoPerPipeline,
  riepilogoSenzaPipeline,
  primoAppuntamentoPerContatto,
  riepilogoAppuntamenti,
  riepilogoOpportunita,
  riepilogoPerTag,
  riepilogoPerVenditoreGhl,
  riepilogoSenzaTag,
} from "@/lib/ghl";
import type { GhlBreakdownCampagna, GhlBreakdownTag, GhlRiepilogoResponse } from "@/types/ghl";

export const runtime = "nodejs";
// Rete di sicurezza, non più il fix principale: il 25/09/2026 questa route arrivava a ~40s (la
// vecchia fetchContattiSenzaTag paginava l'intera location, ~3.800 contatti importati in blocco) e
// senza un maxDuration esplicito andava in timeout in produzione — dashboard di Andrea Lenzi
// Consulting a zero ovunque. Dal 27/09/2026 il conteggio "senza cluster" è una sola chiamata (vedi
// contaContattiSenzaTagNelPeriodo in lib/ghl.ts) e la route torna nell'ordine dei secondi; 90s resta
// per le sedi con molti calendari/opportunità (fetchAppuntamenti/fetchOpportunita paginano
// comunque), stesso principio delle altre route lente del progetto (report-commerciale/estrai).
export const maxDuration = 90;

function meseCorrente(): string {
  return new Date().toISOString().slice(0, 7);
}

/**
 * Riepilogo "vendite e appuntamenti" da GHL/Squadd per una sede — Fase 1, sola lettura. Mai sul
 * link pubblico cliente (nessun ramo `code`, a differenza di /api/kpi): dato non ancora validato
 * quanto RisultatiCommerciali, resta un pannello solo per il team — vedi src/lib/ghl.ts. Se la sede non ha
 * una GhlConnessione attiva, torna { connesso: false } con status 200 (non è un errore, è lo
 * stato normale finché nessuno l'ha collegata).
 *
 * Gli appuntamenti contano sempre e solo il primo per contatto (vedi primoAppuntamentoPerContatto)
 * e `perCampagna`/`campagneAttribuibili` nella risposta portano l'attribuzione a campagna Meta
 * reale (join contatto->opportunità->attributions, vedi mappaCampagnaPerContatto) — decisione
 * esplicita dell'utente (08/09/2026). Il query param opzionale `campagne` (stesso formato del
 * filtro campagne di /api/kpi: campaignId separati da virgola) restringe appuntamenti/opportunità/
 * trend ai soli contatti attribuiti a quelle campagne, invece di disattivare il pannello come
 * faceva prima di questa feature.
 *
 * `perTag` (Fase 3, 11/2026) porta lo stesso riepilogo ma per categoria commerciale invece che per
 * campagna Meta — join per tag contatto GHL (fetchContattiPerTag/riepilogoPerTag in lib/ghl.ts,
 * verificato con chiamate reali: l'account usa tag come "mobilieri - cluster a (<500k)" per
 * dividere i lead in cluster) invece che per attribuzione UTM. Sempre sul perimetro pieno della
 * sede, mai ristretto dal filtro opzionale `campagne` sopra — sono due assi di lettura indipendenti.
 *
 * `senzaTag` (20/09/2026, segnalato dall'utente: i totali di sede non coincidevano con la somma dei
 * blocchi per categoria) — il complemento di `perTag`: contatti/appuntamenti/opportunità senza
 * NESSUNO dei tag configurati — contaContattiSenzaTagNelPeriodo (una sola chiamata di conteggio) +
 * riepilogoSenzaTag (complemento locale dei contatti taggati) in lib/ghl.ts. Nessun target: solo
 * per non far sparire in silenzio numeri che il totale sede include ma nessun cluster cattura.
 *
 * `perVenditore` (Fase 4, 11/2026) — stesso principio ma per venditore, join su
 * assignedUserId/assignedTo (già presenti sugli oggetti GHL, zero chiamate in più a differenza di
 * perTag). A differenza di perTag/perCampagna, conta OGNI appuntamento del venditore, non solo il
 * primo per contatto — è carico di lavoro, non attribuzione marketing, vedi riepilogoPerVenditoreGhl.
 */
export async function GET(req: NextRequest) {
  const sessione = await getSessione();
  if (!sessione) {
    return NextResponse.json({ error: "Non autenticato" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const clienteId = searchParams.get("clienteId");
  const sedeIdParam = searchParams.get("sedeId");
  // da/a: un mese ("YYYY-MM", chiamanti storici come PacingTargetChart.tsx) o un giorno
  // ("YYYY-MM-DD", selettore periodo in stile Meta, 26/09/2026) — normalizzati a due giorni inclusi
  // esattamente come /api/kpi (stesso valore passato da KpiSection.tsx a entrambe le route).
  const { da, a } = normalizzaIntervallo(searchParams.get("da") || meseCorrente(), searchParams.get("a") || meseCorrente());
  // Stesso parametro/formato del filtro campagne di /api/kpi (campaignId separati da virgola) —
  // qui scoped appuntamenti/opportunità ai soli contatti attribuiti a queste campagne (vedi
  // mappaCampagnaPerContatto), invece di disattivare il pannello GHL come prima di questa feature.
  const campagneParam = searchParams.get("campagne");
  const campagneFiltro = campagneParam ? new Set(campagneParam.split(",").filter(Boolean)) : null;

  if (!clienteId) {
    return NextResponse.json({ error: "clienteId mancante" }, { status: 400 });
  }
  const clienti = await getClienti();
  if (!puoVedereCliente(sessione, clienteId, clienti)) {
    return NextResponse.json({ error: "Non autorizzato per questo cliente" }, { status: 403 });
  }

  const tutteLeSedi = await getSedi();
  const sediCliente = tutteLeSedi.filter((s) => s.clienteId === clienteId && s.attivo);
  if (sediCliente.length === 0) {
    return NextResponse.json({ error: "Nessuna sede attiva per questo cliente" }, { status: 404 });
  }
  const sede = (sedeIdParam && sediCliente.find((s) => s.sedeId === sedeIdParam)) || sediCliente[0];

  // Intervallo di giorni inclusi: primo istante di `da` -> ultimo istante di `a` (UTC, come tutte le
  // chiavi-giorno dell'app).
  const startMs = new Date(`${da}T00:00:00Z`).getTime();
  const endMs = new Date(`${a}T23:59:59.999Z`).getTime();

  const connessioni = await getGhlConnessioni();
  const connessione = connessioni.find((c) => c.sedeId === sede.sedeId && c.attivo);
  if (!connessione) {
    // Sede senza GHL: la fonte è il file contatti del cliente, se c'è (01/10/2026, vedi
    // src/lib/foglioContatti.ts) — una riga per contatto con stato e fatturato, letta dal vivo. La
    // risposta ha la stessa forma di quella GHL, con `fonte: "foglio"`. Un file collegato ma senza
    // contatti riconoscibili (il vecchio modello mensile, o ancora vuoto) vale come nessuna fonte:
    // si resta sui Risultati Commerciali inseriti a mano, mai uno zero al posto di un dato assente.
    const urlFile = clienti.find((c) => c.clienteId === clienteId)?.appuntamentiFileUrl;
    if (urlFile) {
      try {
        let contatti = interpretaFoglioContatti(await leggiFoglioContatti(urlFile));
        if (contatti.length > 0) {
          // Il file è uno per cliente: con più sedi, a questa sede appartengono solo i contatti delle
          // sue campagne. Un contatto senza campagna non è assegnabile a nessuna sede e resta fuori.
          if (sediCliente.length > 1) {
            const campagneSede = new Set(
              (await getCampagne()).filter((c) => c.clienteId === clienteId && c.sedeId === sede.sedeId).map((c) => c.campaignId)
            );
            contatti = contatti.filter((c) => c.campaignId !== null && campagneSede.has(c.campaignId));
          }
          return NextResponse.json(riepilogoDaContatti(contatti, startMs, endMs, campagneFiltro));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Errore sconosciuto";
        return NextResponse.json({ error: `Errore dal file contatti: ${msg}` }, { status: 502 });
      }
    }
    const risposta: GhlRiepilogoResponse = { connesso: false };
    return NextResponse.json(risposta);
  }

  try {
    const [{ appuntamenti: appuntamentiLocation, calendariFalliti }, opportunitaLocation, categorieAutomatiche, venditoriConGhl] = await Promise.all([
      fetchAppuntamenti(connessione.locationId, connessione.privateToken, connessione.calendarIds, startMs, endMs),
      // Nessun filtro status server-side (a differenza di prima di questa feature): serve TUTTA la
      // location per costruire mappaCampagna sotto — un contatto con appuntamento ma opportunità
      // ancora "open" (non vinta) porterebbe comunque la sua attribuzione, persa se si fetchasse
      // solo "won". riepilogoOpportunita/fatturatoGhlPerSettimana filtrano "won" lato client come
      // già facevano, quindi il comportamento di vendite/fatturato non cambia.
      fetchOpportunita(connessione.locationId, connessione.privateToken, {}),
      // Fase 3 (11/2026): solo le categorie di questa sede con un tagGhl impostato — vedi
      // CategoriaCommerciale in types/kpi.ts. [] per una sede senza categorie/tag configurati,
      // nessuna chiamata GHL aggiuntiva in quel caso (il .map sotto su un array vuoto è un no-op).
      getCategorieCommerciali().then((tutte) => tutte.filter((c) => c.sedeId === sede.sedeId && c.attivo && (c.tagGhl.trim() || pipelineDiCategoria(c).length > 0))),
      // Fase 4 (11/2026): solo i venditori di questa sede con un ghlUserId impostato — vedi
      // Venditore in types/kpi.ts. Nessuna chiamata GHL in più: assignedTo/assignedUserId sono già
      // su appuntamenti/opportunitaGrezze già scaricati sopra, il join sotto è puro filtro locale.
      getVenditori().then((tutti) => tutti.filter((v) => v.sedeId === sede.sedeId && v.attivo && v.ghlUserId.trim())),
    ]);

    // Perimetro della sede dentro la location (GhlConnessione.pipelineIds, 01/10/2026): PRIMA di ogni
    // altro calcolo, così tutto ciò che segue vale solo per questa sede. Senza pipeline configurate
    // è un no-op e la sede copre l'intera location come sempre. Vedi restringiAllePipeline.
    const { opportunita: opportunitaGrezze, appuntamenti } = restringiAllePipeline(
      opportunitaLocation,
      appuntamentiLocation,
      connessione.pipelineIds ?? []
    );

    // Sempre applicata, non un filtro opzionale — vedi il commento su primoAppuntamentoPerContatto.
    const appuntamentiPrimi = primoAppuntamentoPerContatto(appuntamenti);
    const opportunitaVinte = opportunitaGrezze.filter((o) => o.status === "won");
    const mappaCampagna = mappaCampagnaPerContatto(opportunitaGrezze);

    // Fase 3: un /contacts/search per categoria + UNA chiamata di conteggio per "senza cluster",
    // tutte in parallelo (tipicamente 2-4 chiamate — "fino a 3 categorie per sede" di Fase 1) — MAI
    // sullo scoping `campagne` sopra: il tag GHL è un'assegnazione di cluster indipendente
    // dall'attribuzione a campagna Meta, stesso perimetro "tutta la sede" di perCampagna/
    // appuntamentiPrimi/opportunitaVinte, non delle versioni "Scoped" sotto.
    // Due modi di definire un cluster (vedi CategoriaCommerciale in types/kpi.ts): per PIPELINE
    // (pipelineGhl, 01/10/2026 — account che separano i cluster mettendo le opportunità in pipeline
    // diverse, es. Agricobots "+50 hectáreas"/"-50 hectáreas") o per TAG contatto (tagGhl, Fase 3).
    // Se una categoria ha entrambi vince la pipeline. I cluster per pipeline non fanno nessuna
    // chiamata GHL in più: lavorano sulle opportunità già scaricate sopra.
    const categoriePipeline = categorieAutomatiche.filter((c) => pipelineDiCategoria(c).length > 0);
    const categorieConTag = categorieAutomatiche.filter((c) => pipelineDiCategoria(c).length === 0);
    const tags = categorieConTag.map((c) => c.tagGhl.trim());
    const [contattiPerCategoria, richiesteSenzaTag] = await Promise.all([
      Promise.all(tags.map((tag) => fetchContattiPerTag(connessione.locationId, connessione.privateToken, tag))),
      categorieConTag.length > 0
        ? contaContattiSenzaTagNelPeriodo(connessione.locationId, connessione.privateToken, tags, startMs, endMs)
        : Promise.resolve(0),
    ]);
    const perTag: Record<string, GhlBreakdownTag> = {};
    const idTaggati = new Set<string>();
    categorieConTag.forEach((categoria, i) => {
      const contattiTag = contattiPerCategoria[i];
      for (const c of contattiTag) idTaggati.add(c.id);
      perTag[categoria.categoriaId] = riepilogoPerTag(contattiTag, appuntamentiPrimi, opportunitaVinte, startMs, endMs);
    });
    for (const categoria of categoriePipeline) {
      perTag[categoria.categoriaId] = riepilogoPerPipeline(pipelineDiCategoria(categoria), opportunitaGrezze, appuntamentiPrimi, startMs, endMs);
    }

    // "Senza cluster": complemento dei cluster sopra (segnalato dall'utente, 20/09/2026) — solo se la
    // sede ha almeno un cluster automatico, altrimenti non è una domanda sensata. Calcolato col
    // metodo dei cluster della sede (tutti per pipeline oppure tutti per tag); in una sede che li
    // mescola i due complementi non sono confrontabili e il blocco non viene mostrato, mai un numero
    // costruito a metà.
    const senzaTag =
      categoriePipeline.length > 0 && categorieConTag.length === 0
        ? riepilogoSenzaPipeline(categoriePipeline.flatMap(pipelineDiCategoria), opportunitaGrezze, appuntamentiPrimi, startMs, endMs)
        : categorieConTag.length > 0 && categoriePipeline.length === 0
          ? riepilogoSenzaTag(richiesteSenzaTag, idTaggati, appuntamentiPrimi, opportunitaVinte, startMs, endMs)
          : undefined;

    // Fase 4: zero chiamate GHL in più — join locale su assignedUserId/assignedTo, già presenti
    // sugli oggetti già scaricati sopra. `appuntamenti` GREZZI (non appuntamentiPrimi): per il
    // carico di lavoro di un venditore ogni appuntamento tenuto conta, vedi riepilogoPerVenditoreGhl.
    const perVenditore: Record<string, GhlBreakdownCampagna> = {};
    for (const venditore of venditoriConGhl) {
      perVenditore[venditore.venditoreId] = riepilogoPerVenditoreGhl(
        venditore.ghlUserId.trim(),
        appuntamenti,
        opportunitaVinte,
        startMs,
        endMs
      );
    }

    // Sempre calcolato (non solo quando `campagne` è in query): alimenta la tabella "per singola
    // campagna" di DettaglioCampagneEsteso, che può essere aperta indipendentemente dal filtro
    // campagne delle tessere.
    const perCampagna = breakdownGhlPerCampagna(appuntamentiPrimi, opportunitaVinte, mappaCampagna, startMs, endMs);
    const campagneAttribuibili = Object.keys(perCampagna).length > 0;
    // Stesso perimetro "tutta la sede" di perCampagna, a livello di singola inserzione — nessuna
    // chiamata GHL in più, l'id inserzione è sulle stesse opportunità già scaricate sopra.
    const perInserzione = breakdownGhlPerInserzione(
      appuntamentiPrimi,
      opportunitaVinte,
      mappaInserzionePerContatto(opportunitaGrezze),
      startMs,
      endMs
    );

    // Scoping per le tessere/grafici: se è stato richiesto un sottoinsieme di campagne, si restringe
    // ai soli contatti la cui mappaCampagna cade in quel sottoinsieme — altrimenti tutta la sede,
    // comportamento identico a prima di questa feature.
    const appartieneAlFiltro = (contactId: string) => {
      if (!campagneFiltro) return true;
      const campaignId = mappaCampagna.get(contactId);
      return campaignId !== undefined && campagneFiltro.has(campaignId);
    };
    const appuntamentiScoped = campagneFiltro ? appuntamentiPrimi.filter((a) => appartieneAlFiltro(a.contactId)) : appuntamentiPrimi;
    const opportunitaScoped = campagneFiltro ? opportunitaVinte.filter((o) => appartieneAlFiltro(o.contactId)) : opportunitaVinte;

    const risposta: GhlRiepilogoResponse = {
      connesso: true,
      calendariConfigurati: connessione.calendarIds.length > 0,
      appuntamenti: riepilogoAppuntamenti(appuntamentiScoped, startMs, endMs),
      opportunita: riepilogoOpportunita(opportunitaScoped, startMs, endMs),
      fatturatoPerSettimana: fatturatoGhlPerSettimana(opportunitaScoped, startMs, endMs),
      // Vuoto se calendari non ancora scelti — stesso motivo di appuntamenti sopra (0 non sarebbe
      // un dato vero), vedi il commento su appuntamentiPerSettimana in types/ghl.ts.
      appuntamentiPerSettimana:
        connessione.calendarIds.length > 0 ? appuntamentiGhlPerSettimana(appuntamentiScoped, startMs, endMs) : [],
      calendariFalliti,
      perCampagna,
      perInserzione,
      campagneAttribuibili,
      perTag,
      senzaTag,
      perVenditore,
    };
    return NextResponse.json(risposta);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Errore sconosciuto";
    return NextResponse.json({ error: `Errore dal collegamento GHL: ${msg}` }, { status: 502 });
  }
}
