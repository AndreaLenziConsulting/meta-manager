-- Appuntamenti e vendite letti dagli stadi di pipeline (08/10/2026, per Agricobots): quali stadi
-- valgono come appuntamento fissato, appuntamento effettuato e vendita per una sede collegata a GHL.
-- Un oggetto vuoto = come sempre (calendari e stato "vinta"). Vedi StadiGhl in src/types/ghl.ts e
-- src/lib/ghlStadi.ts.
--
-- Solo una colonna in più, con un valore predefinito: il codice già in produzione, che legge le
-- colonne per nome, continua a funzionare. Va applicata PRIMA di pubblicare il codice che la legge.
alter table public.ghl_connessioni add column if not exists stadi jsonb not null default '{}'::jsonb;
