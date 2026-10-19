# Calendario personale UniTo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consentire a ogni persona di usare il proprio calendario pubblico UniTo, modificarne singole lezioni e conservare i dati nel browser con backup ripristinabile.

**Architecture:** Frontend statico su GitHub Pages. Un adattatore UniTo recupera gli eventi, un archivio IndexedDB transazionale conserva un profilo per calendario e un modulo puro applica le personalizzazioni alla fonte senza modificarla. L'interfaccia presenta configurazione, editor, salvataggio verificato e backup; nessuna nuova API server.

**Tech Stack:** JavaScript ES modules, HTML/CSS esistenti, IndexedDB, Node >=20 e node:test. Aggiungere `fake-indexeddb` come sola dipendenza di test per verificare transazioni e migrazioni; nessuna dipendenza runtime frontend.

**Spec:** `docs/SPECIFICA-UNITO-PERSONALE.md`, approvata in chat il 19 ottobre 2026.

## Global Constraints

- La prima versione supporta esclusivamente il servizio `https://unito.prod.up.cineca.it`.
- Un unico sito su GitHub Pages, utilizzabile senza account.
- Non vengono inviate scritture a UniTo, Cloudflare o GitHub.
- La prima versione mostra un calendario alla volta e non unisce fonti diverse.
- Le modifiche valgono per quella singola occorrenza, identificata dall'ID evento della fonte insieme all'ID calendario.
- Il titolo personale non cambia l'identità della materia usata dal filtro.
- Le date sono interpretate e mostrate nel fuso Europe/Rome.
- “Salvato in questo browser” soltanto al completamento della transazione.
- Il ripristino riguarda solo i calendari inclusi nel backup; gli altri vengono conservati.
- Non è promessa una persistenza assoluta del solo browser.
- Lavorare sul branch `codex/aggiunte-calendario`, preservando gli altri cambiamenti; non pubblicare o fare merge in questa fase.

## Review Focus

1. Una lezione spostata in un'altra settimana resta visibile anche senza aver ricaricato la settimana originale: test di composizione in Task 2.
2. Una scheda vecchia non sovrascrive una modifica salvata da un'altra scheda: test di revisione atomica in Task 3 e prova di editor concorrenti in Task 4.
3. Una transazione abortita non produce “Salvato” né perde il draft esportabile: test archivio Task 3 e prova UI Task 4.
4. Un backup non fidato non introduce link arbitrari, HTML eseguibile, campi sconosciuti o cancellazioni di calendari estranei: test schema/import atomico Task 3.
5. Un evento ufficiale annullato o non presente nella risposta non viene confuso con una cancellazione delle modifiche personali: test Task 2 e prova UI Task 4.

## File e modello dati

- `calendar.js`: parametri fonte, parser link UniTo, normalizzazione e conversioni Roma; preservare gli export esistenti necessari ai test legacy.
- `personal-events.js` (nuovo): validazione modifiche, composizione eventi e confronto con la fonte.
- `local-store.js` (nuovo): apertura DB, profili versionati, migrazione, revisioni e notifiche; niente DOM.
- `backup.js` (nuovo): serializzazione e validazione del formato di backup; niente download o DOM.
- `personal-ui.js` (nuovo): configurazione fonte, editor singola lezione, backup e stato archivio; riuso dei dialog e dei token CSS.
- `app.js`, `index.html`, `style.css`: integrazione e sette giorni accessibili, con visualizzazione mobile leggibile.
- `tests/source.test.mjs`, `tests/personal-events.test.mjs`, `tests/local-store.test.mjs`, `tests/backup.test.mjs`: prove Node, oltre ai test esistenti.
- `server.mjs`, `.github/workflows/pages.yml`: whitelist dei nuovi moduli frontend. Workflow test separato per branch e PR, deploy solo da main.
- `README.md`, `docs/VERIFICA-PERSONALE.md`: istruzioni attuali e verifiche realmente eseguite.

DB `unito-calendar-personal`, versione 1: store `profiles` con chiave `calendarId`, store `meta` con chiave `key` per calendario attivo e marker migrazione. Profilo: `{calendarId, url, selection, revision, overrides}`. `selection` mantiene il formato null/array dei filtri attuali. Ogni override contiene `{eventId, patch, baseline, latestSource}`; le fotografie usano soltanto gli eventi normalizzati, non oggetti arbitrari ricevuti dal server.

Le proprietà modificabili sono `title`, `start`, `end`, `room`, `note`, `color`, `hidden`. `start/end` sono istanti ISO, `color` è un colore esadecimale oppure assente. Gli stati ufficiali e l'identità della materia non sono modificabili. I limiti di testo seguono la validazione esistente dove applicabile; fissare titolo/aula a 500 caratteri, nota a 10000, backup UTF-8 a 5 MiB, massimo 100 profili e 5000 modifiche complessive.

---

### Task 1: Fonte UniTo configurabile e date corrette

**Files:** `calendar.js`, `tests/source.test.mjs`, `tests/calendar.test.mjs`, `tests/live.mjs`.

**Interfaces:**
- Produce `parseCalendarLink(input) -> {calendarId, url}`: dominio HTTPS esatto, percorso osservato `/calendarioPubblico/linkCalendarioId=<24 hex>`, niente credenziali/query/frammento; trimmare gli spazi esterni.
- Estendere `payload(day, calendarId = DEFAULT_CALENDAR_ID)` e `fetchEvents(day, {calendarId, signal, fetcher})`; endpoint e cliente rimangono fissi UniTo.
- Produce `romeLocalInput(iso) -> string` e `romeInstant(localInput) -> ISO string` per datetime-local; rifiutare orari inesistenti e ambigui al cambio d'ora con messaggio esplicito.
- `romeMidnight(day)` deve usare l'offset della mezzanotte effettiva, non quello di mezzogiorno.

- [ ] Scrivere test per dominio estraneo, credenziali, link valido con spazi esterni, ID differenti nel payload e nessuna richiesta a host arbitrari. Assert sul risultato della richiesta e sul parser, non sul testo del sorgente.
- [ ] Scrivere test per mezzanotte 29 marzo e 25 ottobre 2026, conversioni Roma indipendenti dal fuso host, ora inesistente/ambigua e intervallo valido; eseguire `node --test tests/source.test.mjs tests/calendar.test.mjs` e verificare fallimenti per funzionalità mancanti.
- [ ] Implementare le interfacce mantenendo le settimane lunedì-lunedì e il significato di risposta vuota.
- [ ] Rieseguire test mirati e `npm test`; tutti verdi. Aggiornare il test live per scegliere il calendario tramite variabile d'ambiente validata.
- [ ] Commit dei soli file di questo task.

### Task 2: Modifiche personali indipendenti dalla fonte

**Files:** `personal-events.js`, `tests/personal-events.test.mjs`.

**Interfaces:**
- Consume eventi normalizzati di Task 1.
- Produce `validatePatch(patch) -> patch`, `makeOverride(source, patch) -> override`, `mergeSource(overrides, events) -> overrides` e `composeEvents(events, overrides, week, selection) -> events`.
- Gli eventi visualizzati preservano `subject` per il filtro, aggiungono `title`, `personalNote`, `personalColor`, `hidden`, `sourceChanged` e mantengono accesso al dato ufficiale. Override indicizzati per ID all'interno del profilo calendario.

- [ ] Scrivere test RED per modifica titolo senza alterare il filtro materia, modifica solo dell'occorrenza scelta e isolamento fra due profili con ID evento uguale.
- [ ] Scrivere test RED per spostamento fra settimane, deduplicazione del dato remoto e fotografato, evento nascosto ripristinabile, fonte annullata e risposta vuota che conserva la personalizzazione.
- [ ] Scrivere test RED per aggiornamento ufficiale: i campi non personalizzati si aggiornano; i campi personalizzati rimangono; conflitto riconoscibile rispetto a `baseline`. Uno spostamento personale usa il proprio intervallo nel filtro settimanale, una nota senza spostamento usa l'intervallo ufficiale aggiornato.
- [ ] Eseguire `node --test tests/personal-events.test.mjs`, osservare i fallimenti, implementare e rendere verdi i test. Non dedurre cancellazioni dall'assenza in una risposta settimanale.
- [ ] Eseguire `npm test` e fare commit del task.

### Task 3: Archivio IndexedDB, migrazione e backup

**Files:** `local-store.js`, `backup.js`, `tests/local-store.test.mjs`, `tests/backup.test.mjs`, `package.json`, `package-lock.json`.

**Interfaces:**
- `openLocalStore({indexedDB, legacyStorage, onExternalChange}) -> Promise<store>`; dipendenze esplicite per test, default browser in produzione.
- `store.getProfile(calendarId)`, `store.listProfiles()`, `store.getActiveCalendar()`, `store.activateCalendar(source)` restituiscono Promise; attivazione e creazione del profilo sono atomiche.
- `store.saveProfile(profile, expectedRevision)` aggiorna solo se la revisione coincide, incrementa `revision` e risolve solo su `transaction.oncomplete`; conflitto e abort sono errori distinti. Ogni modifica ai dati persistiti rispetta questa disciplina, incluse le notifiche di aggiornamento fonte.
- `store.importProfiles(profiles)` sostituisce atomicamente i soli profili importati, aggiorna le revisioni e preserva gli altri; `store.close()` rilascia DB e canali.
- `serializeBackup(profiles) -> string`, `parseBackup(text) -> profiles`: formato `{format:'unito-calendar-personal', version:1, exportedAt, profiles}`; validazione rigorosa e limiti sopra definiti.

- [ ] Installare `fake-indexeddb` come devDependency, senza librerie nuove nel frontend; scrivere test RED di apertura, persistenza dopo riapertura e separazione dei calendari.
- [ ] Scrivere test RED: migrazione della chiave legacy solo se presente/valida; nessuna importazione del codice cloud; marker e profilo salvati insieme; errore di migrazione lascia intatto il vecchio localStorage.
- [ ] Scrivere test RED con due connessioni allo stesso DB: revisione vecchia rifiutata; abort dopo una richiesta riuscita rifiuta l'intera Promise; non pubblicare una notifica di successo prima del commit.
- [ ] Scrivere test RED per backup round-trip, schema/versione non validi, ID/link incoerenti, campi estranei, patch e snapshot invalidi, dimensione eccessiva; import multi-profilo atomico e conservazione dei profili non inclusi.
- [ ] Eseguire i due file test, osservare RED, implementare e verificare GREEN e `npm test`. Gestire `blocked`/`versionchange` senza lasciare l'app in caricamento indefinito.
- [ ] Commit del task.

### Task 4: Flusso completo, pubblicazione statica e collaudo

**Files:** `personal-ui.js`, `app.js`, `index.html`, `style.css`, `server.mjs`, `.github/workflows/pages.yml`, nuovo workflow test, `README.md`, `docs/VERIFICA-PERSONALE.md`, test layout aggiornati e test integrazione archivio/modello.

**Interfaces:**
- Consume gli export dei tre task precedenti; l'app mantiene il profilo attivo, dati remoti e un draft locale distinto dall'ultima versione persistita.
- `setupPersonalUI({store, getContext, onProfileChange, onCalendarChange})` collega impostazioni, editor e backup; `getContext()` restituisce profilo corrente, settimana e stato dei salvataggi. Il rendering usa gli eventi composti da Task 2.
- Serializzare le scritture locali e controllare la revisione all'atto del commit. Un editor conserva revisione e ID calendario all'apertura; cambio fonte o aggiornamento esterno non può applicarlo al calendario sbagliato. I dati remoti arrivati tardi vengono ignorati dopo cambio calendario/settimana.

- [ ] Aggiungere prima test RED per layout di sette giorni, contatore coerente dopo filtri/hidden, pipeline archivio → compose → riapertura e ripristino backup. Aggiornare l'aspettativa dei cinque giorni del vecchio test perché il requisito approvato è cambiato.
- [ ] Integrare setup fonte e migrazione; rimuovere dal percorso pubblico la UI e gli import della sincronizzazione condivisa. Lasciare il Worker remoto invariato; i vecchi moduli non devono essere distribuiti se non più necessari.
- [ ] Integrare editor accessibile con dati originali, validazione dei campi, nascondi/ripristina e avviso conflitto. Gestire all-day e intervalli su più giorni senza perdere il significato originale.
- [ ] Collegare “Salvataggio…”, “Salvato in questo browser”, errore/riprova e export del draft in caso di scrittura fallita. Richiedere persistenza dove disponibile; il rifiuto non blocca l'uso. Usare BroadcastChannel con rilettura su focus come fallback; un editor sporco segnala aggiornamenti esterni.
- [ ] Integrare backup scaricabile, anteprima dell'import con numero di calendari/modifiche e conferma esplicita prima del ripristino; mantenere gli altri profili. Messaggi chiari su salvataggio locale e backup, senza dettagli tecnici superflui.
- [ ] Correggere import di `monday`, CSS dell'intestazione e griglia settimanale; su telefono rendere i sette giorni scorribili con colonne leggibili e intestazioni accessibili. Aggiornare whitelist server e deploy. Test CI sui branch/PR; deploy solo da main con dipendenze di test installate tramite `npm ci`.
- [ ] Eseguire `npm test`, `git diff --check` e controllare che il sito serva tutti i nuovi moduli senza esporre file privati. Nessun falso successo su scritture o caricamenti falliti.
- [ ] Browser reale: primo accesso, link invalido/valido, avanti/indietro/Oggi/data, filtro, modifica lezione, ricarica e chiusura/riapertura. Provare spostamento in altra settimana, weekend, hidden/ripristino, backup/export/import e due schede con editor concorrenti. Controllare console e richieste.
- [ ] Provare un errore IndexedDB controllato nel test di integrazione; se il browser non offre fault injection sicura, riportare il limite della prova UI e conservare l'evidenza automatica di abort. Provare rete assente senza scritture remote, fonti lente e risposte tardive.
- [ ] Individuare da pagine ufficiali UniTo un secondo link pubblico distinto; verificare il recupero reale oltre al calendario Informatica e annotare origine, data e risultato. Se manca un secondo link verificabile, non dichiarare compatibilità universale e documentare il collaudo rimasto aperto.
- [ ] Verifica visuale a larghezza telefono e desktop; se la superficie browser non consente il ridimensionamento, usare una superficie supportata o riportare esplicitamente il limite. Il test desktop non vale come test mobile fisico.
- [ ] Aggiornare README e report con risultati effettivi, revisione finale dell'intero diff, correzione dei problemi importanti con prova di regressione, suite finale verde e commit. Nessun merge o pubblicazione automatica.

## Completamento atteso

Branch locale pronto per revisione con codice, test e istruzioni. La consegna distingue i test automatici dalle verifiche browser, indica i link UniTo effettivamente collaudati e segnala eventuali limiti di dispositivo, persistenza o rete. La pubblicazione è un passaggio successivo.

## Stato

Specifica approvata. Piano scritto e controllato rispetto alla specifica; attende revisione dell'utente e scelta della modalità di esecuzione. Nessun codice applicativo modificato durante la pianificazione.
