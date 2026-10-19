# Verifica del calendario personale UniTo

Data: 19 ottobre 2026. Branch: `codex/aggiunte-calendario`. Nessun deploy, push o cambiamento al Worker remoto.

## Test automatici

`npm test`: 36 test superati durante l'integrazione. Comprendono parsing dei link, dominio fisso UniTo, conversioni Roma e cambio d'ora, composizione delle personalizzazioni, spostamenti fra settimane, aggiornamenti e annullamenti ufficiali, IndexedDB simulato con fake-indexeddb, riapertura del DB, migrazione, revisioni concorrenti, abort dopo una richiesta riuscita, import atomico, schema del backup e integrazione backup/riapertura/eventi del weekend. I test legacy della sincronizzazione restano verdi.

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
- Controllo visuale a viewport desktop 1280 px e in un iframe di collaudo di 390 px che carica gli stessi asset. Su telefono simulato le colonne restano scorribili e i controlli si dispongono verticalmente; non equivale a un dispositivo fisico o a Safari.

## Due fonti UniTo effettivamente provate

Settimana 19–25 ottobre 2026, con fine intervallo esclusiva al 26 ottobre:

1. Informatica: `https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId=612617b82db4bb0017172839`, **38 eventi** letti dal browser.
2. Calendario collegato dalla pagina ufficiale di [Giurisprudenza — Modellazione di processi amministrativi e compliance normativa](https://www.giurisprudenza.unito.it/do/corsi.pl/Show?_id=ezkp): `https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId=68b93986d8f8f3001899434c`, **17 eventi** letti dal browser.

Per la seconda fonte sono stati controllati anche OPTIONS e POST con Origin `https://samulattanzio.github.io`: rispettivamente 204 e 200, header CORS compatibili con richieste senza credenziali. Il controllo Node degli header è distinto dalla lettura effettiva nel browser locale. Le policy della pagina di configurazione UniTo restano diverse da quelle dell'endpoint eventi: il frontend non dipende da quella pagina per recuperare il nome del calendario.

## Limiti del collaudo

Non sono stati modificati dati ufficiali per provocare annullamenti o cambiamenti: questi casi sono coperti da test sintetici. Le risposte tardive, la migrazione e gli abort vengono verificati soprattutto automaticamente. Nessuna prova su iPhone/Android fisici, Safari o dopo riavvio del sistema operativo; nessuna garanzia contro perdita del dispositivo o cancellazione volontaria dei dati del sito.

Esportazione/importazione, limiti e ripristino atomico sono coperti dai test automatici e dall'integrazione archivio/modello. Il percorso nativo di selezione e download dei file nel browser non è ancora stato dichiarato verificato end-to-end in questo report. Nessun sito pubblico è stato aggiornato.
