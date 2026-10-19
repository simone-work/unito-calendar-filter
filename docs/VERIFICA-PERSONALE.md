# Verifica del calendario personale UniTo

Data: 19 ottobre 2026. Branch: `codex/aggiunte-calendario`. Nessun deploy, push o cambiamento al Worker remoto.

## Test automatici

`npm test`: 42 test superati dopo integrazione e correzioni della revisione indipendente. Comprendono parsing dei link, dominio fisso UniTo, conversioni Roma e cambio d'ora, composizione delle personalizzazioni, spostamenti fra settimane, aggiornamenti e annullamenti ufficiali, IndexedDB simulato con fake-indexeddb, riapertura del DB, migrazione, revisioni concorrenti, abort dopo una richiesta riuscita, import atomico, schema del backup e integrazione backup/riapertura/eventi del weekend. I test legacy della sincronizzazione restano verdi.

La prova di abort agisce sulla vera transazione dell'emulatore IndexedDB: il successo della singola `put` è seguito da abort. La Promise del salvataggio deve rifiutarsi e i dati precedenti restare intatti. Non è una prova di spegnimento fisico del telefono durante una scrittura.

`npm audit`: nessuna vulnerabilità rilevata dopo l'aggiornamento dello strumento di sviluppo Wrangler da 4.135.0 a 4.151.2. `wrangler deploy --dry-run`: bundle legacy riuscito senza distribuzione. Nessuna dipendenza runtime aggiunta al frontend; fake-indexeddb viene usato solo nei test.

## Browser reale

Frontend locale nel browser integrato; nessun codice personale o credenziale cloud usato.

- Primo accesso con archivio vuoto, inserimento del link Informatica, salvataggio della fonte e recupero degli eventi.
- Navigazione alla settimana successiva e ritorno con Oggi; sette colonne lunedì–domenica.
- Lezione di prova rinominata, annotata e spostata al sabato; chiusura dell'editor e ricarica della pagina: titolo, nota e data conservati.
- Seconda scheda sullo stesso sito: la personalizzazione è letta dall'archivio condiviso. Un editor lasciato aperto nella prima scheda non può sovrascrivere il salvataggio successivo della seconda; compare il conflitto.
- Chiusura dell'editor, ricaricamento esplicito dei dati salvati e conferma: recuperata la versione più recente.
- Nascondi: evento rimosso dalla griglia e dal conteggio, presente nell'elenco delle lezioni nascoste. Ripristina originale: personalizzazione di prova rimossa, ritorno a 38 eventi.
- Cambio fra due calendari con selezioni separate; link con dominio esterno rifiutato con messaggio. Il salvataggio della fonte è indipendente dall'esito della richiesta eventi.
- Console controllata durante i flussi: nessun errore applicativo osservato.
- Chiusura delle due schede principali e riapertura del sito: fonte attiva e calendari precedenti ritrovati.
- Pagina di collaudo separata con fault injection di un abort reale dopo la `put`: l'editor segnala mancato salvataggio, il draft rimane esportabile e “Riprova salvataggio” riesce. Il codice di fault injection non è parte degli asset pubblicati.
- Esportazione dal pulsante del sito: download avviato e messaggio mostrato. Importazione nel browser con un file JSON fornito dal fixture al normale input file, senza passare per il selettore nativo: anteprima, conferma, evento ripristinato e conservazione dopo ricarica verificati. Il fixture è confinato al server di collaudo e non viene pubblicato.
- Controllo visuale a viewport desktop 1280 px e in un iframe di collaudo di 390 px che carica gli stessi asset. Su telefono simulato le colonne restano scorribili e i controlli si dispongono verticalmente; non equivale a un dispositivo fisico o a Safari.
- Controllo finale del tema scuro: selettore dei calendari reso leggibile con sfondo e testo coerenti; verificati gli stili calcolati e la schermata. [Anteprima acquisita](images/calendario-personale.png).

## Due fonti UniTo effettivamente provate

Settimana 19–25 ottobre 2026, con fine intervallo esclusiva al 26 ottobre:

1. Informatica: `https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId=612617b82db4bb0017172839`, **38 eventi** letti dal browser.
2. Calendario collegato dalla pagina ufficiale di [Giurisprudenza — Modellazione di processi amministrativi e compliance normativa](https://www.giurisprudenza.unito.it/do/corsi.pl/Show?_id=ezkp): `https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId=68b93986d8f8f3001899434c`, **17 eventi** letti dal browser.

Per la seconda fonte sono stati controllati anche OPTIONS e POST con Origin `https://samulattanzio.github.io`: rispettivamente 204 e 200, header CORS compatibili con richieste senza credenziali. Il controllo Node degli header è distinto dalla lettura effettiva nel browser locale. Le policy della pagina di configurazione UniTo restano diverse da quelle dell'endpoint eventi: il frontend non dipende da quella pagina per recuperare il nome del calendario.

Ripetuti nella verifica finale `tests/live.mjs` su entrambe le fonti con settimana `2026-10-19` e Origin GitHub: entrambe OPTIONS 204, POST 200, Allow-Origin `*`; Informatica 38 eventi/18 denominazioni, Giurisprudenza 17 eventi/8 denominazioni.

## Limiti del collaudo

Non sono stati modificati dati ufficiali per provocare annullamenti o cambiamenti: questi casi sono coperti da test sintetici. Le risposte tardive, la migrazione e gli abort vengono verificati soprattutto automaticamente. Nessuna prova su iPhone/Android fisici, Safari o dopo riavvio del sistema operativo; nessuna garanzia contro perdita del dispositivo o cancellazione volontaria dei dati del sito.

Esportazione/importazione, limiti e ripristino atomico sono coperti dai test automatici e dall'integrazione archivio/modello. Il selettore file nativo del sistema e il file finale nella cartella download dell'utente non sono stati ispezionati: la prova browser dell'import usa un File controllato. Nessun sito pubblico è stato aggiornato.

## Revisione indipendente e correzioni

Un secondo agente ha esaminato il diff senza modificarlo e ha segnalato tre problemi di gravità media, corretti con regressioni prima fallite e poi riuscite:

1. Limite del backup incoerente con la capacità dell'archivio: il budget di 5 MiB viene ora controllato sia sul singolo draft prima di accettarlo, sia sull'archivio complessivo dentro la transazione di salvataggio/importazione. In caso di conflitto di capacità resta possibile il backup esplicitamente parziale del draft valido.
2. Aggiornamenti ufficiali osservati durante una scrittura: una coda per calendario conserva le risposte pertinenti e le riconcilia dopo il completamento o il nuovo tentativo. La regressione verifica che l'annullamento resti visibile anche nella settimana di destinazione di una lezione spostata.
3. Lettura fallita dell'archivio durante l'export: l'eventuale salvataggio d'emergenza del solo calendario corrente viene indicato come parziale e non come backup completo.

Nessun rilievo critico o minore rinviato dal revisore. I limiti di collaudo elencati sopra restano espliciti.

## Decisioni operative

- Riutilizzato il checkout del branch richiesto dall'utente anziché crearne un altro; le modifiche rimangono in questo checkout.
- Registro di avanzamento gestito in PowerShell anziché con gli script bash della skill, mantenendo task e risultati; richiede controllo esplicito del registro.
- Aggiornato Wrangler per eliminare le vulnerabilità note dello strumento legacy; il rischio di compatibilità è stato verificato con bundle dry-run, senza deploy remoto.
- Fissato il budget dell'archivio al formato di backup approvato: le note molto grandi possono raggiungere il limite prima del massimo teorico di 5000 personalizzazioni. Il rifiuto mantiene i dati già salvati e non è presentato come successo.
