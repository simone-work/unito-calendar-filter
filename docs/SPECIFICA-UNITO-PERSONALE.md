# Calendario personale UniTo — specifica

Data: 19 ottobre 2026. Stato: approvata dall'utente in chat; implementazione ancora da avviare.

## Obiettivo e confini

Un unico sito su GitHub Pages, utilizzabile senza account. Ogni persona inserisce un link pubblico del calendario UniTo/CINECA e conserva nel proprio browser filtri e modifiche personali. La prima versione supporta esclusivamente il servizio `https://unito.prod.up.cineca.it`.

Le modifiche riguardano la copia personale mostrata nell'app. Non vengono inviate scritture a UniTo, Cloudflare o GitHub. I dati locali sono condivisi dalle schede dello stesso sito nello stesso profilo browser; non vengono sincronizzati fra dispositivi. Non sono previsti calendari che richiedono login.

## Primo accesso e scelta della fonte

All'apertura senza una fonte salvata compare un campo per il link pubblico UniTo. Il formato attualmente verificato è `/calendarioPubblico/linkCalendarioId=<id>` sul dominio UniTo indicato sopra. Il parser accetta soltanto formati esplicitamente supportati e ricava l'identificativo senza eseguire il contenuto del link o richiedere URL arbitrari.

L'endpoint eventi e l'identificativo dell'ateneo restano configurazione UniTo; l'identificativo del calendario diventa variabile. Una settimana vuota viene presentata come tale: non dimostra che il link sia inesistente. Gli errori di rete o della fonte non cancellano i dati salvati.

Il link deve essere ricordato e modificabile dalle impostazioni. Cambiare calendario mantiene separati i dati dei calendari precedenti, che tornano disponibili reinserendo il relativo link. La prima versione mostra un calendario alla volta e non unisce fonti diverse.

Il calendario di Informatica già usato viene migrato insieme alla selezione locale esistente. L'URL e il codice del vecchio servizio di sincronizzazione non vengono utilizzati dal nuovo percorso pubblico. Non si modifica il servizio remoto esistente.

## Modifiche personali

Aprendo una singola lezione si possono modificare titolo visualizzato, data e orario, aula, nota personale e colore; si può nascondere la lezione e ripristinare i dati originali. L'editor distingue le informazioni ufficiali dalle modifiche personali.

Le modifiche valgono per quella singola occorrenza, identificata dall'ID evento della fonte insieme all'ID calendario. Non sono previste modifiche automatiche a tutte le lezioni di una materia, regole ricorrenti o creazione di eventi indipendenti in questa prima versione.

Il titolo personale non cambia l'identità della materia usata dal filtro. Le date sono interpretate e mostrate nel fuso Europe/Rome, con validazione dell'intervallo e dei cambi d'ora.

## Aggiornamenti UniTo e modifiche locali

Gli eventi ufficiali e le modifiche personali rimangono separati. Si conserva soltanto la differenza personale, insieme a una fotografia dell'evento ufficiale utile a riconoscere cambiamenti e a visualizzare gli eventi spostati anche in settimane diverse da quella originale.

Un recupero riuscito aggiorna la fonte senza eliminare le modifiche personali. Se cambia un campo ufficiale modificato anche dall'utente, compare un avviso con accesso al dato UniTo aggiornato e alla possibilità di ripristinarlo. Annullamenti e sospensioni ufficiali restano evidenti anche in presenza di modifiche personali.

L'assenza di un evento da una sola risposta settimanale non basta a stabilire che sia stato cancellato: potrebbe essere stato spostato. L'app non elimina automaticamente una modifica salvata in questo caso. Un errore di rete viene distinto da una risposta valida senza eventi.

La vista deve permettere di vedere anche sabato e domenica. Il contatore deve corrispondere agli eventi effettivamente rappresentati, tenendo conto dei filtri e delle lezioni nascoste.

## Salvataggio nel browser

IndexedDB conserva fonti, preferenze e modifiche con schema versionato. Il tema può continuare a usare localStorage. La migrazione dei vecchi filtri non elimina la copia originale prima che il nuovo salvataggio sia riuscito.

L'interfaccia mostra “Salvataggio…” durante la scrittura e “Salvato in questo browser” soltanto al completamento della transazione. Gli errori mantengono visibili i dati ancora in memoria e permettono di riprovare o esportarli; non viene dichiarato un salvataggio riuscito quando la scrittura fallisce.

Si richiede lo storage persistente quando il browser lo supporta, senza confondere l'eventuale concessione con una garanzia contro cancellazioni volontarie o perdita del dispositivo. Le schede aperte ricevono una notifica delle modifiche locali e rileggono i dati; un editor con modifiche non salvate segnala il conflitto prima di sovrascrivere una revisione più recente.

Esportazione e importazione di un file JSON versionato includono link, preferenze e modifiche personali. L'importazione valida contenuti e dimensioni, mostra cosa verrà ripristinato e scrive in una transazione atomica. Il ripristino riguarda solo i calendari inclusi nel backup; gli altri vengono conservati.

La pagina spiega brevemente che la cancellazione dei dati del sito elimina l'archivio e che un backup scaricato consente di recuperarlo. Non è promessa una persistenza assoluta del solo browser.

## Struttura del codice

- Adattatore UniTo: parser dei link, richieste, normalizzazione e gestione degli errori della fonte.
- Archivio locale: transazioni, revisioni, migrazioni e backup.
- Personalizzazioni: applicazione delle differenze agli eventi ufficiali e riconoscimento dei cambiamenti.
- Interfaccia: configurazione della fonte, calendario, filtri, editor e stato dei salvataggi.

Si riutilizzano le funzioni di layout e filtro dove compatibili. Si correggono l'import mancante di `monday`, il selettore CSS alterato e il calcolo della mezzanotte prima di ampliare l'editing delle date. Il deploy Pages continua a pubblicare solo gli asset frontend necessari.

## Verifiche necessarie

Test su parser dei link, separazione per calendario, migrazione, transazioni fallite, esportazione/importazione, modifica di singoli eventi, aggiornamenti della fonte, spostamenti fra settimane e date al cambio d'ora. Test dei pulsanti nel browser e del ripristino dopo ricarica, oltre alla suite esistente.

Prova reale di almeno due link pubblici UniTo relativi a calendari differenti, dal sito pubblicato o da un'origine equivalente. Il recupero attuale è stato verificato soltanto per Informatica: l'uso dello stesso fornitore non dimostra da solo la compatibilità di tutti i calendari dipartimentali. Eventuali formati diversi si aggiungono dopo averli osservati e verificati.

Verifica visiva su desktop e telefono; controllo degli stati vuoti, offline e di errore. Il collaudo della persistenza deve comprendere il ricaricamento, la chiusura e riapertura della pagina e la gestione di schede concorrenti.
