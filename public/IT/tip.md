AKEData è stato trasferito al dominio www.akedata.wiki. Il precedente dominio akedata.top ora reindirizza qui.

# Registro degli aggiornamenti di AKEData

### v1.3.9

Aggiunti la bozza [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home) v0.3, un esempio con più personaggi e il [Validatore AKEGF](/?plugin=akegf&id=validator). Ricerca, AKEGF e avvisi condividono il rendering Markdown e l’evidenziazione del codice.

### v1.2.11

#### Navigazione secondaria e interfaccia condivisa

- La navigazione secondaria dei principali moduli di consultazione è stata ricostruita, uniformando struttura degli elementi, stati attivi, conteggi, indicatori delle modifiche di versione, ricerca, filtri e interazioni su desktop e dispositivi mobili.
- È stato introdotto un livello di interfaccia condiviso per pulsanti, campi, selettori, interruttori, filtri, schede, stati e tabelle, riducendo le differenze visive e operative tra i moduli.

#### Impostazioni e visualizzazione

- Le finestre delle impostazioni globali e degli annunci del sito sono state ridisegnate con una struttura più chiara e un aspetto coerente nei temi chiaro, scuro e riposante per gli occhi.
- Gli stati di caricamento, contenuto vuoto ed errore sono stati uniformati. Le intestazioni e il contenuto delle tabelle condivise sono ora centrati per impostazione predefinita.

### v1.2.10-1

#### Confronto tra versioni dell'Archivio

- Con i dati Latest, l'Archivio viene confrontato con l'Hotfix finale della versione precedente del gioco. Gli archivi aggiunti in questa versione vengono fissati in alto e contrassegnati globalmente nella panoramica iniziale, nonché fissati e contrassegnati nella relativa categoria dell'elenco; anche le nuove voci di ogni gruppo vengono mostrate per prime. Le versioni storiche fisse non mostrano indicatori di novità.

### v1.2.10

#### Archivio

- Aggiunto l'Archivio come modulo pubblico per consultare archivi, documenti e registrazioni presenti nel gioco.
- La pagina iniziale offre una panoramica di tutti gli archivi, un elenco per supporto e categoria, la ricerca nel testo completo e collegamenti diretti a ogni gruppo di archivi.
#### Contenuto degli archivi

- I dettagli mostrano titoli e testi con formattazione avanzata, oltre alle immagini originali del gioco. Quando un documento include varianti del protagonista, è possibile alternare le immagini della protagonista femminile e del protagonista maschile.
- Gli archivi audiovisivi mostrano soltanto una trascrizione riga per riga; questa versione non richiede né riproduce contenuti audio.

#### Navigazione e visualizzazione

- Aggiunti elenchi adattati a desktop e dispositivi mobili, il ripristino dello stato di navigazione al ritorno nel modulo e il supporto all'esportazione come immagine lunga.
- Il testo avanzato ora riproduce correttamente i contrassegni di oscuramento. Le icone che non possono essere caricate usano l'immagine predefinita per i contenuti mancanti, mentre le immagini del contenuto non disponibili vengono sostituite da un avviso chiaro.

### v1.2.9

#### Varie e centro attività

- Aggiunto il modulo Varie, espandibile con strumenti indipendenti. La prima versione comprende attività settimanali, Pass Protocollo e attività legate ad Addestramento, Contratti, Dungeon di corsa e Tornei.
- Le attività del Pass Protocollo possono essere filtrate per settimana e ora mostrano tutti i livelli dei tre percorsi di ricompensa.

#### Icone e fonti di ottenimento

- Aggiunto un generatore di icone personaggio per scegliere personaggio e abilità, visualizzare l'anteprima e scaricare il risultato in PNG.
- I negozi mostrano ora requisiti di sblocco e livelli di Smistamento materiali; i dettagli dell'equipaggiamento includono fonti come negozi, missioni e casse modello sulla mappa. I link alla mappa OEM vengono calcolati dinamicamente da LevelData solo dopo il clic.

#### Esperienza e stabilità

- Uniformata l'immagine sostitutiva in caso di caricamento fallito; corretti inoltre lo scorrimento indipendente di Varie, i controlli su dispositivi mobili e diversi layout delle ricompense.
- I nuovi moduli dati di combattimento `v3_skill` e Buff `v3_buff` sono ancora in fase di verifica e non sono disponibili in questa versione.

### v1.2.8

#### Barre laterali e layout

- La barra laterale principale e quelle dei singoli moduli possono ora essere ridimensionate trascinandole, con le larghezze regolate salvate separatamente. Quando una barra è stretta, le voci con un'icona mostrano solo l'icona, mentre quelle senza icona mantengono il nome per essere riconoscibili.
- I pulsanti Impostazioni globali ed esportazione dell'immagine lunga occupano ora un'area inferiore dedicata e non si sovrappongono più all'elenco dei moduli.

#### Stato di navigazione

- Durante la stessa sessione di navigazione, tornando a un modulo vengono ripristinati la pagina, la voce e la posizione di scorrimento aperte in precedenza.
- Le posizioni di scorrimento dei dettagli vengono memorizzate separatamente per le diverse voci dello stesso modulo. Ricaricando la pagina, questi stati temporanei vengono cancellati e viene mostrata nuovamente la pagina iniziale.

### v1.2.7

#### Dungeon e attività

- I dettagli dei dungeon ora mostrano le ricompense fisse e casuali ripetibili che consumano Sanità, separate dalle ricompense per il primo completamento.
- I blocchi nella cronologia delle attività usano ora gli orari esatti di inizio e fine invece di essere allineati a giorni interi.

#### Panoramiche e immagini

- Le schede personaggio e la barra laterale mostrano ora le icone di elemento e professione, con colori ricalibrati e l'icona scelta in base all'ID della professione.
- Rimosse le stelle di rarità dalle panoramiche Personaggi e Armi e il livello di pericolo dalla panoramica Nemici. Filtri, ordinamento e dettagli restano invariati.
- Le icone integrate nel testo ricco, nei collegamenti dei termini e nei tooltip ora passano dal dominio dati attivo, correggendo l'assenza di `data.akedata.wiki` e i percorsi `//public/...` errati.

### v1.2.6

#### Comunicazioni Baker

- Aggiunto il modulo Baker per consultare le conversazioni complete di operatori, contatti e gruppi, con filtri per tipo, ricerca testuale completa e deep link URL.
- Più conversazioni con lo stesso contatto sono ora mostrate come voci separate nella barra laterale e le opzioni di dialogo permettono di cambiare il ramo successivo.
- Sono supportati testo, immagini, allegati di oggetti e missioni, messaggi di sistema, reazioni e immagini per le opzioni `sns_emoji`, con miglioramenti ad avatar, scorrimento e layout desktop/mobile.

### v1.2.5

#### Immagini e caricamento delle risorse

- Le immagini mantengono ora la struttura originale sotto `assets/beyond/dynamicassets/gameplay` e tutti i moduli usano i nuovi percorsi.
- Sono state corrette le risorse mancanti causate dalla corrispondenza delle cartelle e dalla mappa interna incompleta di beyond-sdk, distinguendo esattamente `charremoteicon` da `charremoteicon700`.
- AKE Data Tool può caricare immagini, dati Json o entrambi e controlla la dimensione attuale e il picco previsto dell'intero bucket R2, bloccando il caricamento a 10 GB.
- `pluginversion` e `jsversion` aggiornano separatamente HTML dei moduli e JavaScript, mantenendo nella cache locale le risorse invariate.
- Il modulo Baker non è incluso in questa versione ed è rinviato alla `1.2.6`.

### v1.2.3

#### Moduli e visibilità

- Il modulo Missioni è temporaneamente nascosto e indicato come “In sviluppo”. I moduli di debug BuffData, SkillData e SpawnerConfig sono stati disattivati e la descrizione di Echoes of War è stata aggiornata.
- Quando “Mostra moduli nascosti” è disattivato, gli ID interni di personaggi, equipaggiamento, attività, Buff e altri dati non vengono mostrati. Valori originali e formule di calcolo sono ora sempre disponibili.
- I modificatori degli attributi sono raggruppati per origine, come comparsa, Buff o fase. I Buff degli attributi nel modulo Nemici partecipano ai calcoli; con la modalità nascosta disattivata, gli ID e i Buff senza effetti sugli attributi non vengono visualizzati.

#### Nemici e modalità di gioco

- Dungeon, Contingency Contract ed Echoes of War condividono un unico renderer dei nemici per attributi di livello, Buff di comparsa e risultati modificati. Usano le nuove resistenze elementali (94–99), mentre i vecchi coefficienti (80–85) non vengono più mostrati.
- Le rotazioni di Echoes of War possono essere espanse o compresse; i colori del bordo distinguono gli stati attivo, futuro e concluso. Per impostazione predefinita si apre solo la rotazione attiva e, al suo interno, solo la configurazione nemici della difficoltà massima.
- Se le descrizioni della caratteristica e del relativo bonus sono uguali nelle tre difficoltà, vengono mostrate una sola volta prima dell'elenco. Le differenze restano associate alla rispettiva difficoltà.
- Corretta la visualizzazione di `v2cc-term-param` in Contingency Contract. La configurazione dell'attività è compressa per impostazione predefinita e le condizioni di sblocco delle missioni sono nascoste.

#### Attività e interfaccia

- La pagina iniziale delle Attività include ora una sequenza temporale con date di inizio, fine e stato. Mostra le date al passaggio del mouse, mantiene i titoli fuori schermo sul bordo sinistro e dispone a destra icone che riempiono l'altezza. Il pulsante Home ora la ridisegna correttamente.
- Corretti i ritorni a capo con escape nelle descrizioni delle abilità di personaggi e armi. L'icona del componente predefinito appare accanto al pulsante del costo di produzione dell'equipaggiamento.
- L'esportazione di immagini lunghe non è più sperimentale ed è attiva per impostazione predefinita. Esclude la barra laterale e usa il nome corretto del modulo o della pagina.

#### Caricamento dati e annunci

- La cache persistente di TableCfg cambia solo quando cambia l'Hotfix. Json e immagini usano una revisione indipendente dei dati condivisi e non vengono ricaricati solo per variazioni della versione del sito o dell'Hotfix.
- Gli annunci ora mostrano correttamente titoli, elenchi e codice inline Markdown. La pagina Informazioni e il README includono inoltre il collegamento del partner dati “终末地一图流”.

### v1.2.2

I valori originali e le formule ora si aprono in un popover persistente facendo clic su un numero, sostituendo il suggerimento ritardato al passaggio del mouse. Un clic su un altro valore cambia il contenuto; un clic su un'area vuota o Esc chiude il popover. La posizione viene aggiornata durante scorrimento e ridimensionamento, con supporto per dispositivi mobili e tastiera, senza modificare lo stile visivo dei numeri.

Risolto un problema per cui i gestori di clic dei contenitori di alcuni moduli impedivano ai veri clic del mouse di aprire il popover. Corretti anche i valori delle abilità di `chr_0032_lizhiyan` mostrati come `[object Object]`.

### v1.2.1

Risolto un problema per cui alcune immagini di gioco potevano essere richieste erroneamente da `www.akedata.wiki` dopo il cambio di modulo o il riavvio del Service Worker. I percorsi delle immagini vengono ora riscritti in modo sincrono verso `data.akedata.wiki` quando sono inseriti nella pagina.

Il Service Worker ora ripristina l'origine dati e la revisione dei dati condivisi dal proprio URL di registrazione. Il routing delle immagini resta quindi corretto anche dopo la sospensione e il riavvio del Worker da parte del browser. Anche l'icona del sito viene caricata direttamente dall'origine dati.

L'analisi dei nemici da `LevelScriptData` è stata aggiunta ai calcoli degli attributi di Dungeon, Contingency Contract ed Echoes of War. Ora vengono letti nemici, livelli e Buff di comparsa definiti direttamente negli script, oltre ai Buff condizionali applicati dagli spawner. Anche le fasi senza SpawnerConfig vengono quindi calcolate correttamente. Sono stati inoltre corretti il precaricamento dei Buff delle condizioni e il ricalcolo dopo il cambio delle condizioni.

Migliorati i suggerimenti dei valori originali. I valori senza modifiche di calcolo continuano a mostrare il valore originale; quelli modificati da attributi, Buff, condizioni del contratto o espressioni mostrano ora valore originale, parametri sostituiti, formula completa e risultato finale. Il tracciamento delle formule copre Dungeon, Contingency Contract, Echoes of War, nemici ed espressioni di personaggi, armi, equipaggiamento e oggetti.

### v1.2.0

Aggiunto il confronto dei dati tra versioni del gioco. Selezionando `Latest`, il sito confronta automaticamente con l'ultimo Hotfix della versione precedente. Le nuove voci vengono sempre mostrate per prime e contrassegnate; le etichette delle modifiche e il Diff dettagliato possono essere attivati tramite l'opzione sperimentale globale, disattivata per impostazione predefinita.

Il Diff dettagliato confronta solo le informazioni realmente visibili nella pagina, mostrando le rimozioni in rosso e le aggiunte in verde e ignorando i campi nascosti. Le attività sono escluse dal rilevamento delle novità. Equipaggiamenti e medaglie vengono confrontati per ID individuale, con etichette anche sui relativi set o categorie. I bordi delle schede mantengono i colori di rarità.

### v1.2.0-pre2

Aggiornata la mappatura completa degli Attribute con gli ID 93–100 e sincronizzati i file `maps.json` di tutte le 14 lingue.

I moduli di nemici e dungeon ora utilizzano i nuovi parametri di resistenza elementale (ID 94–99). I precedenti coefficienti di resistenza, ID 80–85, non vengono più mostrati nelle schede degli attributi, nei riepiloghi dei modificatori o nei tooltip dei Buff correlati.

### v1.1.9

Aggiunto il modulo dedicato alla sfida permanente “Echi di guerra”, con visualizzazione per stagione e rotazione di livelli, difficoltà, titoli di valutazione, ricompense al merito e istruzioni ufficiali. Il modulo mostra anche ondate di nemici, mappe dei punti di comparsa, Buff iniziali e attributi adattati al livello, con cambio dell'ondata ed evidenziazione collegata sulla mappa.

### v1.1.8

Aggiunti la modalità di debug e l'aggiornamento forzato della cache web; corretti i nodi degli attributi dei personaggi e l'analisi dei costi di sviluppo basata sulle descrizioni degli oggetti; i tipi di attività ora provengono da ActivityTagTable; stili e termini rich text vengono letti direttamente da TableCfg; e i moduli con pagina iniziale hanno ricevuto un pulsante Home nella barra laterale.

### v1.1.6

Aggiunti gli annunci nel sito e il conto alla rovescia degli aggiornamenti, adattati i gruppi di abilità a doppia forma di Jue, ottimizzati gli avvisi di caricamento e rimossi numerosi moduli v2 deprecati.

### v1.1.5

Introdotto il framework multilingue, con cambio di lingua per interfaccia, moduli, filtri e mappature dei dati, insieme al primo gruppo di risorse localizzate.

### v1.1.4

Corretti i parametri di versione delle richieste dati, separate le versioni di aggiornamento delle risorse applicative e dei dati pubblici, e uniformata la verifica della versione per cache delle pagine e Service Worker.

### v1.1.3

Nel modulo oggetti sono stati aggiunti gli effetti d'uso dei consumabili e le ricette di sintesi, completando relazioni tra materiali e prodotti, stili dei dettagli e relativo adattamento dati v3.

### v1.1.2

Aggiunti accessi panoramici con schede raggruppate per i moduli di personaggi, armi, nemici, equipaggiamento, attività, oggetti, dungeon, medaglie e ricerca.

### v1.1.1

Riprogettati i filtri delle categorie degli oggetti con compressione e conteggio dei risultati; migliorati anche deduplicazione delle richieste, cache IndexedDB e visualizzazione dell'avanzamento del caricamento dati.

### v1.1.0

Introdotto il livello di adattamento dati v3 basato su TableCfg e Json per i principali moduli di consultazione, aggiungendo la disattivazione dei moduli e la cache dei file dati di grandi dimensioni.

### v1.0.31

Erano stati aggiunti il passaggio tra interfaccia cinese e inglese, il cambio della directory dati e le relative configurazioni di internazionalizzazione, ma la funzione fu poi completamente annullata e non rimase disponibile in questa fase.

### v1.0.30

Aggiunto un wrapper unificato per la cache delle richieste; tutte le pagine usano akeFetch per caricare i dati, riducendo le richieste duplicate e ottimizzando il caricamento durante il cambio di modulo.

### v1.0.29

Separati gli script incorporati della pagina iniziale e dei vari moduli nella directory plugin/js, centralizzando la gestione di routing, impostazioni, calcolo degli attributi e controller dei moduli.

### v1.0.28

Aggiunti suggerimenti con i valori originali per i parametri della maggior parte dei moduli, correggendo inoltre il calcolo dei punti vita dei nemici e la visualizzazione di «riduzione di tutti i danni».

### v1.0.27

Aggiunta al Contratto di Contingenza la visualizzazione delle ondate nemiche, con coordinate di generazione, cambio ondata ed evidenziazione collegata, e corrette le statistiche aggregate delle ondate duplicate.

### v1.0.26

Aggiunta al Contratto di Contingenza la consultazione degli attributi nemici, calcolando e mostrando i valori effettivi in base a livello, Buff di nascita e clausole contrattuali selezionate.

### v1.0.25

Precaricato e aperto il modulo Contratto di Contingenza soggetto a Token, con ricerca delle stagioni, condizioni e conflitti delle clausole, punteggio, ricompense, missioni e negozio.

### v1.0.24

Aggiornata la visualizzazione delle abilità personaggio v2, corretto l'ordine delle abilità combo e finali, mantenendo parametri chiave come tempo di recupero e consumo di energia.

### v1.0.23

Aperto ufficialmente il modulo ricerca, migliorando Markdown, evidenziazione del codice, indice, collegamenti alle ancore e anteprima immagini, e aggiungendo articoli di studio delle meccaniche.

### v1.0.22

Aggiunte restrizioni di accesso a moduli e contenuti basate su Token, con persistenza, aggiunta in blocco e cancellazione dei Token, oltre al precaricamento dei contenuti protetti.

### v1.0.21

Aggiunti alla tabella di crescita degli attributi personaggio v2 i coefficienti di danno da anomalia fisica e magica, con precisione differente secondo la modalità di visualizzazione.

### v1.0.20

Riordinati e rinominati alcuni attributi dettagliati dei nemici, anticipando le voci resistenza all'interruzione ed esecuzione e uniformando la terminologia dei bonus ai danni.

### v1.0.19

Aggiunta la visualizzazione dell'ID equipaggiamento; riorganizzati gli stili v2 di personaggi, armi ed equipaggiamento, correggendo colori degli attributi e selezione dei valori di crescita.

### v1.0.18

Aggiunti deep link per moduli e voci, sincronizzando la barra degli indirizzi durante la navigazione e gestendo contenuti nascosti o inesistenti; completata inoltre la visualizzazione dei tipi di correzione degli attributi personaggio.

### v1.0.17

Pubblicato ufficialmente il modulo armi v2, con ricerca delle armi e visualizzazione dettagliata di attributi per livello, materiali di potenziamento, potenziali e abilità.

### v1.0.16

Pubblicato ufficialmente il modulo equipaggiamento v2, mostrando per set componenti, attributi principali e secondari, abilità del set, ricette di produzione, garanzia di raffinazione e informazioni sul potenziamento.

### v1.0.15

Pubblicato ufficialmente il modulo dungeon v2, con serie, ricompense e dettagli nemici; analizzate configurazioni di generazione e Buff per mostrare ondate e attributi corretti.

### v1.0.14

Pubblicato ufficialmente il modulo nemici v2, aggiungendo ricerca, elenco mobile, attributi per livello, varianti, modifiche degli attributi, resistenze e informazioni sullo squilibrio.

### v1.0.13

Pubblicato ufficialmente il modulo personaggi v2, riorganizzando attributi, abilità, talenti, potenziali e crescita, e correggendo tratti, immagini e visualizzazione dei nodi.

### v1.0.12

Potenziata la timeline SkillData v2 con filtro delle azioni, diagramma di flusso dei rami condizionali, visibilità dei nodi e durata dei frame, correggendo inoltre alcuni valori dei nemici.

### v1.0.11

Aggiunta una vista di debug SkillData v2 nascosta che mostra la logica delle abilità tramite timeline e nodi azione, con ricerca e consultazione dei dati originali.

### v1.0.10

Proseguita la ristrutturazione dei personaggi v2, creando la nuova pagina dettagli e collegando i dati completi dei personaggi, con mappature dei campi e struttura di visualizzazione migliorate.

### v1.0.9

Aggiunto il modulo di consultazione SpawnerConfig per esplorare i dati dei generatori per scena e configurazione, modificando anche gli accessi alle consultazioni BuffData e SkillData.

### v1.0.8

Aggiunti i moduli di consultazione BuffData e SkillData, con esplorazione degli elenchi, ricerca e dettagli, offrendo un accesso allo studio dei dati di combattimento sottostanti.

### v1.0.7

Aggiunta la consultazione delle informazioni sulle attività, modificata la visualizzazione predefinita delle clausole personaggio con supporto per quelle speciali di Laecy, e introdotte le statistiche delle visite al sito.

### v1.0.6

Aggiunti nella pagina Informazioni l'elenco dei sostenitori e i relativi stili, completando la presentazione dei ringraziamenti del progetto.

### v1.0.5

Completato l'adattamento mobile per i principali moduli di personaggi, armi, nemici, equipaggiamento, oggetti, dungeon e obiettivi, inclusi tutti e tre i temi.

### v1.0.4

Aggiunti filtri ai moduli personaggi, armi e oggetti, ristrutturando l'area dei filtri degli elenchi per rendere più efficiente la ricerca tra numerose voci.

### v1.0.3

Aggiunta l'interfaccia di consultazione degli oggetti e registrato il relativo modulo, con elenco, dettagli e visualizzazione delle informazioni di base associate.

### v1.0.2

Aggiunte alla pagina personaggio le icone delle abilità e le abilità logistiche, incluse struttura, livello, descrizione e condizioni di sblocco, correggendo inoltre i dati correlati.

### v1.0.1

Corretta la visualizzazione anomala dei dati relativi agli attributi fissi dei nemici e completate contestualmente le informazioni sui nemici nella pagina dungeon.

### v1.0.0

AKEData 1.0 è stato pubblicato ufficialmente, completando soprattutto i contenuti di consultazione dei dungeon e portando la versione del progetto da 0.99 a 1.0.
