-- Risultati inseriti a mano: una sola riga per periodo, sede e tipo di campagna (08/10/2026).
--
-- Da oggi i risultati commerciali si inseriscono dall'app (scheda cliente → KPI → "Inserisci
-- risultati"), che per una sede e un periodo sostituisce le righe esistenti con quelle nuove. Questi
-- indici fanno sì che due righe uguali non possano esistere comunque — due salvataggi nello stesso
-- istante, o una riga aggiunta a mano dall'editor di tabelle: un doppione verrebbe sommato due volte
-- nei numeri del cliente. Le due tabelle oggi sono vuote, quindi non c'è nulla da ripulire prima.

create unique index risultati_commerciali_unico on public.risultati_commerciali (cliente_id, sede_id, periodo, tipo_campagna);

create unique index risultati_venditori_unico on public.risultati_venditori (sede_id, mese, venditore_id);
