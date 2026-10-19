# Il mio calendario UniTo

Calendario personale per i link pubblici UniTo/CINECA, ospitabile interamente su GitHub Pages. Non richiede account: ogni profilo browser conserva i propri calendari, filtri e modifiche in IndexedDB.

## Avvio e verifiche

Serve Node.js 22 o successivo per tutti gli strumenti di sviluppo (i test di base e il server richiedono Node 20).

~~~sh
npm ci
npm start
# Apri http://127.0.0.1:4173
npm test
npm run test:live
~~~

Il test live usa per impostazione predefinita Informatica, settimana del 6 ottobre 2025. È possibile impostare TEST_CALENDAR_ID, TEST_WEEK (un lunedì con eventi) e TEST_ORIGIN. Interroga davvero UniTo; Node verifica gli header ma non applica le restrizioni CORS del browser. Non aprire index.html con file://.

## Utilizzo

1. Incolla il link pubblico UniTo nel formato https://unito.prod.up.cineca.it/calendarioPubblico/linkCalendarioId= seguito dall'identificativo del calendario.
2. Scegli le materie della settimana. Tutte include anche denominazioni future; Nessuna è una selezione vuota memorizzata.
3. Apri una singola lezione per modificarne titolo, data, orari, aula, nota e colore, oppure nasconderla. Ripristina originale elimina la personalizzazione di quell'occorrenza. Le lezioni nascoste si ritrovano nell'elenco dedicato.
4. Cambia calendario dallo stesso campo o dall'elenco dei calendari salvati. Le preferenze rimangono separate per identificativo del calendario.
5. Da Backup e conservazione dei dati esporta il file JSON delle tue impostazioni e personalizzazioni. L'importazione mostra un riepilogo e richiede conferma; sostituisce solo i calendari contenuti nel file.

I link supportati appartengono esclusivamente al servizio HTTPS unito.prod.up.cineca.it; sono rifiutati host diversi, credenziali, query e frammenti. Non sono supportati calendari privati o link che richiedono login. Una settimana vuota non dimostra che il calendario non esista.

Gli orari sono sempre nel fuso Europe/Rome. La griglia comprende lunedì–domenica ed è scorribile orizzontalmente sui telefoni; le sovrapposizioni sono affiancate. All'apertura nel weekend si propone la settimana successiva. Aggiornamento ad apertura, cambio settimana, pulsante, ogni cinque minuti a pagina visibile e al ritorno alla pagina dopo oltre un minuto dall'ultimo successo.

## Modifiche personali e aggiornamenti ufficiali

L'app legge gli eventi da UniTo e non modifica il calendario ufficiale. Le personalizzazioni sono associate a ID calendario + ID della singola lezione. La rinomina personale non cambia la materia usata per il filtro.

Gli eventi ufficiali rimangono separati dalle modifiche. I campi non personalizzati seguono la fonte aggiornata. Se cambiano dati ufficiali che hai modificato, l'editor segnala il cambiamento e permette il confronto con l'originale. Annullamenti e sospensioni ufficiali restano evidenti.

Una fotografia ufficiale viene conservata per le sole lezioni personalizzate, così uno spostamento in un'altra settimana non va perso. L'assenza da una risposta settimanale non cancella automaticamente le modifiche: una lezione potrebbe essere stata spostata nella fonte. Non sono incluse regole ricorrenti, eventi creati da zero o unione di più calendari nella stessa vista.

## Cosa significa salvato

Salvato in questo browser appare dopo il completamento della transazione IndexedDB, non dopo la sola richiesta di scrittura. Un errore lascia la modifica in memoria, permette di esportarla e non viene mostrato come successo. Le revisioni impediscono a una scheda con dati vecchi di sovrascrivere una versione più recente. In caso di conflitto, esporta il draft oppure ricarica esplicitamente i dati salvati.

I dati restano nello stesso profilo browser e nella stessa origine del sito. Un browser o telefono diverso ha un archivio diverso. Cambiare dominio o protocollo del sito cambia anche l'archivio disponibile. La richiesta Proteggi archivio riduce le cancellazioni automatiche se il browser concede la persistenza; non impedisce la cancellazione dei dati del sito o la perdita del dispositivo. In navigazione privata la conservazione può essere temporanea. **Conserva un backup delle modifiche importanti.**

I vecchi filtri localStorage del calendario Informatica sono migrati una sola volta, senza cancellare l'originale. I vecchi codici cloud non sono migrati né utilizzati. Gli altri calendari vengono configurati al primo accesso.

Limiti: 100 calendari e 5000 personalizzazioni complessive; titolo/aula 500 caratteri, nota 10000, archivio rappresentabile da un backup JSON UTF-8 massimo di 5 MiB. Un candidato troppo grande viene rifiutato prima di sostituire il draft corrente; i campi aperti nell'editor restano disponibili per ridurli. Anche l'importazione verifica il limite complessivo per evitare archivi salvati ma non esportabili. Il backup contiene link e note personali: conservarlo e condividerlo con attenzione. L'app non conserva offline l'intero orario: senza rete rimangono disponibili le sole lezioni personalizzate e le impostazioni.

Se non è possibile leggere tutti i calendari, oppure un draft valido non entra nel backup insieme agli altri, l'esportazione di emergenza include soltanto il calendario corrente e dichiara esplicitamente che il file è **parziale**. Gli altri calendari non devono essere considerati protetti da quel file.

## GitHub Pages

Il workflow .github/workflows/pages.yml pubblica da main dopo npm ci e npm test. Non pubblica dai branch di sviluppo. Il workflow tests.yml esegue i test anche sui push e sulle pull request. Per attivare il sito seleziona GitHub Actions nelle impostazioni Pages del repository.

La pubblicazione include soltanto HTML, CSS, icona e i moduli frontend app.js, calendar.js, preferences.js, personal-events.js, source-reconciliation.js, local-store.js, backup.js, personal-ui.js. I percorsi sono relativi e funzionano sotto /nome-repository/. Nessun database server, secret o account è necessario.

Il vecchio Worker Cloudflare e i moduli sync restano nel repository come implementazione legacy, con i relativi test. Il frontend personale non li importa e non li distribuisce; nessun cambiamento viene applicato ai servizi remoti esistenti. Wrangler rimane uno strumento di sviluppo opzionale per il codice legacy.

## Struttura e limiti della fonte

- calendar.js: collegamento a UniTo, parser e date Roma.
- personal-events.js: composizione fra eventi ufficiali e modifiche personali.
- source-reconciliation.js: accodamento degli aggiornamenti UniTo arrivati durante un salvataggio o un errore recuperabile.
- local-store.js: IndexedDB, migrazione, revisioni e notifiche fra schede.
- backup.js: schema e validazione del backup.
- personal-ui.js: configurazione, editor, backup e stato salvataggio.
- app.js: layout settimanale, sovrapposizioni e colori.

Il catalogo materie deriva dalla settimana richiesta e dalle scelte/personalizzazioni salvate, non dall'intero anno. I nomi esatti della fonte identificano le materie: variazioni nelle denominazioni possono richiedere una nuova selezione. Il servizio pubblico UniTo può cambiare schema, policy o disponibilità; il sito non aggira autenticazione o CORS.

I dati vengono mostrati come testo. Le risposte errate non sono convertite in settimane vuote. I report storici in docs/VERIFICA.md e docs/SYNC-VERIFICA.md descrivono la versione precedente; il collaudo attuale è riportato in docs/VERIFICA-PERSONALE.md.
