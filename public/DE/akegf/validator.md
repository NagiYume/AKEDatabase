# AKEGF · Zertifizierung von Werkzeugen

Zertifizierte Anwendungen müssen v0.3 importieren und exportieren können und ihre unterstützte Version mit einem Link zu [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home) angeben.

Projekte mit AKEGF-Unterstützung können über einen [Pull Request](https://github.com/NagiYume/AKEDatabase/pulls) um Aufnahme in die Liste der [Partnerprojekte](/?plugin=akegf&id=partners) bitten.

Das [Beispiel mit mehreren Charakteren](/plugin/data/akegf/example.json) importieren und wieder exportieren. Die CN-Gruppe muss drei, die globale Gruppe einen Eintrag behalten. Typ, Pool, Ergebnis, Seltenheit, Millisekundenzeit und vorhandene Sequenznummer vergleichen. Operator- und Waffenzug mit identischer Nummer bleiben getrennt; die geschenkte Waffe behält gift_weapon.

## AKEGF-Formatprüfung

JSON einfügen oder eine lokale Datei wählen. Der Browser prüft Feldregeln, doppelte Gruppen und Sequenznummern innerhalb eines Typs. /endfield/0/list/1 bezeichnet den zweiten Eintrag der ersten Gruppe.
