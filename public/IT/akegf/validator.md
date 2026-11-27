# AKEGF · Certificazione degli strumenti

La certificazione richiede sia l’importazione sia l’esportazione v1.1 / v1.2. Indica la versione supportata nell’applicazione e collega [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home).

Per aggiungere un progetto compatibile ai [Progetti partner](/?plugin=akegf&id=partners), invia una [Pull Request](https://github.com/NagiYume/AKEDatabase/pulls).

Importa l’[Esempio con più personaggi](/plugin/data/akegf/example.json) e riesportalo. Il personaggio cinese deve mantenere tre record, quello globale uno. Confronta tipo, banner, risultato, rarità, millisecondi e numero di sequenza. Conserva sia l’operatore sia l’arma con lo stesso numero, e il tipo gift_weapon del regalo.

## Validatore AKEGF

Incolla il JSON o scegli un file locale. Il browser controlla lo schema, i gruppi duplicati e i numeri ripetuti nello stesso tipo. /endfield/0/list/1 indica il secondo record del primo personaggio.
