AKEData ist auf die Domain www.akedata.wiki umgezogen. Die bisherige Domain akedata.top leitet nun hierher weiter.

# AKEData-Versionsprotokoll

### v1.3.9

Neu sind der Entwurf von [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home) v0.3, ein Beispielarchiv und die [AKEGF-Formatprüfung](/?plugin=akegf&id=validator). Forschungsartikel, AKEGF und Mitteilungen verwenden denselben Markdown-Renderer mit Syntaxhervorhebung.

### v1.2.11

#### Sekundärnavigation und gemeinsame Oberfläche

- Die Sekundärnavigation der wichtigsten Abfragemodule wurde neu aufgebaut. Struktur, aktive Zustände, Zähler, Versionsänderungsmarkierungen, Suche, Filter sowie Desktop- und Mobilbedienung sind nun vereinheitlicht.
- Eine gemeinsame Oberflächenschicht für Schaltflächen, Eingaben, Auswahllisten, Schalter, Filter, Karten, Statusansichten und Tabellen reduziert Darstellungs- und Bedienungsunterschiede zwischen Modulen.

#### Einstellungen und Darstellung

- Die Dialoge für globale Einstellungen und Website-Ankündigungen wurden mit klarerer Gliederung und konsistenter Darstellung in hellem, dunklem und augenschonendem Design neu gestaltet.
- Lade-, Leer- und Fehlerzustände wurden vereinheitlicht. Überschriften und Inhalte gemeinsamer Tabellen sind jetzt standardmäßig zentriert.

### v1.2.10-1

#### Versionsvergleich im Archiv

- Nur bei Verwendung der `Latest`-Daten vergleicht das Archiv mit dem letzten Hotfix der vorherigen Spielversion. In der aktuellen Version hinzugefügte Archive werden sowohl in der globalen Übersicht der Startseite als auch innerhalb der Verzeichniskategorien oben angeheftet und markiert; neue Einträge innerhalb einer Gruppe erscheinen ebenfalls zuerst. Bei fest ausgewählten historischen Versionen werden keine Neu-Markierungen angezeigt.

### v1.2.10

#### Archiv

- Das neue öffentliche Modul „Archiv“ wurde hinzugefügt. Die Startseite fasst alle Archive zusammen und unterstützt Verzeichnisse nach Medium und Kategorie, Volltextsuche sowie Direktlinks zu Archivgruppen.
- Die Detailansicht zeigt formatierte Titel und Texte sowie die originalen Archivbilder aus dem Spiel. Außerdem lassen sich Bilder umschalten, die sich je nach Geschlecht der Hauptfigur unterscheiden.
- Für audiovisuelle Archive wird ausschließlich eine zeilenweise Texttranskription angezeigt; eine Audiowiedergabe ist nicht enthalten.

#### Bedienung und Stabilität

- Verzeichnisse für Desktop- und Mobilgeräte, die Wiederherstellung des Ansichtsstatus und der Export als langes Bild werden unterstützt.
- Die Darstellung von Verdeckungsmarkierungen in formatierten Texten und die Behandlung fehlender Bilder wurden verbessert.

### v1.2.9

#### Verschiedenes und Aufgabenzentrale

- Das unabhängig erweiterbare Modul „Verschiedenes“ wurde hinzugefügt. Die ersten Werkzeuge decken Wochenaufgaben, Protokollpass-Aufgaben sowie Aktivitätsaufgaben für Training, Verträge, Renn-Dungeons und Turniere ab.
- Protokollpass-Aufgaben lassen sich nach Woche filtern und zeigen nun alle Stufen in sämtlichen drei Belohnungspfaden.

#### Symbole und Bezugsquellen

- Ein Generator für Charaktersymbole wurde hinzugefügt: Charakter und Fähigkeit wählen, Ergebnis als Vorschau prüfen und als PNG herunterladen.
- Shops zeigen jetzt Freischaltbedingungen und Stufen der Materialdisposition; Ausrüstungsdetails nennen Quellen wie Shops, Missionen und Vorlagenkisten auf der Karte. OEM-Kartenlinks werden erst beim Anklicken dynamisch aus LevelData berechnet.

#### Bedienung und Stabilität

- Die Ersatzanzeige bei fehlgeschlagenen Bildern wurde vereinheitlicht. Außerdem wurden das unabhängige Scrollen in „Verschiedenes“, mobile Bedienelemente und mehrere Belohnungslayouts korrigiert.
- Die neuen Datenmodule für Kampf `v3_skill` und Buffs `v3_buff` werden noch geprüft und sind in dieser Version nicht verfügbar.

### v1.2.8

#### Seitenleisten und Layout

- Die Hauptseitenleiste und die Seitenleisten der einzelnen Module lassen sich jetzt durch Ziehen in der Breite ändern; die angepassten Breiten werden getrennt gespeichert. Bei geringer Breite zeigen Einträge mit Symbol nur noch das Symbol, während Einträge ohne Symbol zur Erkennung ihren Namen behalten.
- Globale Einstellungen und der Export langer Bilder belegen nun einen eigenen Bereich am unteren Rand und überdecken die Modulliste nicht mehr.

#### Navigationsstatus

- Innerhalb derselben Browsersitzung werden beim Zurückkehren zu einem Modul die zuvor geöffnete Seite, der Eintrag und die Scrollposition wiederhergestellt.
- Detail-Scrollpositionen werden für verschiedene Einträge desselben Moduls getrennt gespeichert. Beim Neuladen der Seite werden diese temporären Zustände gelöscht und wieder die Startseite angezeigt.

### v1.2.7

#### Dungeons und Aktivitäten

- Dungeon-Details zeigen nun wiederholbare feste und zufällige Belohnungen, die Vernunft verbrauchen, getrennt von Erstabschluss-Belohnungen.
- Aktivitätsblöcke in der Übersichtszeitleiste werden jetzt anhand ihrer genauen Start- und Endzeit statt an ganzen Tagen positioniert.

#### Übersichten und Bildressourcen

- Charakterkarten und Seitenleiste zeigen nun Element- und Berufssymbole. Elementfarben wurden neu kalibriert und Berufssymbole werden über die Berufs-ID gewählt.
- Seltenheitssterne wurden aus Charakter- und Waffenübersichten entfernt, Gefahrenstufen aus der Gegnerübersicht. Filter, Sortierung und Detaildaten bleiben unverändert.
- Eingebettete Rich-Text-Symbole, Begriffslinks und Link-Tooltips werden über die aktive Datendomäne aufgelöst. Fehlende `data.akedata.wiki`-Hosts und fehlerhafte `//public/...`-Pfade wurden behoben.

### v1.2.6

#### Baker-Kommunikation

- Das neue Baker-Modul zeigt vollständige Unterhaltungen von Operatoren, Kontakten und Gruppen und bietet Typfilter, Volltextsuche sowie URL-Deep-Links.
- Mehrere Gespräche mit demselben Kontakt erscheinen nun als getrennte Einträge in der Seitenleiste; Dialogoptionen wechseln den weiteren Gesprächszweig.
- Unterstützt werden Text, Bilder, Gegenstands- und Missionsanhänge, Systemmeldungen, Reaktionen und Bilder für `sns_emoji`-Optionen; außerdem wurden Avatare, Bildlauf sowie Desktop- und Mobil-Layouts verbessert.

### v1.2.5

#### Bilder und Asset-Upload

- Bilder behalten nun ihre ursprüngliche Struktur unter `assets/beyond/dynamicassets/gameplay`; alle Module verwenden die neuen Pfade.
- Fehlende Dateien durch die Verzeichniszuordnung und unvollständige interne Zuordnung von beyond-sdk wurden behoben, einschließlich der exakten Trennung von `charremoteicon` und `charremoteicon700`.
- AKE Data Tool kann Bilder, Json-Daten oder beides hochladen und prüft die aktuelle sowie die erwartete Spitzengröße des gesamten R2-Buckets; ab 10 GB wird der Upload blockiert.
- `pluginversion` und `jsversion` versionieren Modul-HTML und JavaScript getrennt, sodass unveränderte Dateien im lokalen Cache bleiben.
- Das Baker-Modul ist nicht Teil dieser Version und wurde auf `1.2.6` verschoben.

### v1.2.3

#### Module und Sichtbarkeit

- Das Missionsmodul ist vorübergehend ausgeblendet und als „In Entwicklung“ markiert. Die Debugmodule BuffData, SkillData und SpawnerConfig wurden deaktiviert; die Beschreibung von Echoes of War wurde aktualisiert.
- Wenn „Verborgene Module anzeigen“ deaktiviert ist, werden interne IDs von Charakteren, Ausrüstung, Aktivitäten, Buffs und weiteren Daten nicht mehr angezeigt. Rohwerte und Berechnungsformeln sind nun dauerhaft verfügbar.
- Attributmodifikatoren werden nach Quelle zusammengefasst, etwa Spawn-, Buff- oder Stufenbonus. Attribut-Buffs im Gegnermodul fließen in die Berechnung ein; bei deaktiviertem verborgenen Modus werden Buff-IDs und Buffs ohne Attributwirkung nicht angezeigt.

#### Gegner und Spielmodi

- Dungeons, Contingency Contract und Echoes of War verwenden einen gemeinsamen Gegner-Renderer für Stufenwerte, Spawn-Buffs und korrigierte Ergebnisse. Die neuen Elementarresistenzen (94–99) werden einheitlich genutzt; alte Koeffizienten (80–85) werden nicht mehr angezeigt.
- Rotationen in Echoes of War lassen sich ein- und ausklappen; Rahmenfarben kennzeichnen aktive, kommende und beendete Zustände. Standardmäßig ist nur die aktive Rotation geöffnet und darin nur die Gegnerkonfiguration des höchsten Schwierigkeitsgrads.
- Sind Eigenschafts- und Bonusbeschreibungen in allen drei Schwierigkeitsgraden identisch, erscheinen sie einmal vor der Liste. Abweichende Beschreibungen bleiben beim jeweiligen Schwierigkeitsgrad.
- Die Darstellung von `v2cc-term-param` in Contingency Contract wurde korrigiert. Aktivitätskonfigurationen sind standardmäßig eingeklappt und Freischaltbedingungen von Missionen werden ausgeblendet.

#### Aktivitäten und Oberfläche

- Die Aktivitätsstartseite besitzt nun eine Kalender-Zeitleiste mit Start, Ende und Status. Sie zeigt Datumsangaben beim Überfahren, hält außerhalb des Bildschirms liegende Titel am linken Rand und zeigt rechts höhenfüllende Aktivitätssymbole. Auch nach Rückkehr über die Home-Schaltfläche wird sie korrekt neu gerendert.
- Maskierte Zeilenumbrüche in Fertigkeitsbeschreibungen von Charakteren und Waffen wurden korrigiert. Neben der Schaltfläche für Herstellungskosten erscheint das Symbol der standardmäßigen Ausrüstungskomponente.
- Der Langbild-Export ist nicht mehr experimentell und standardmäßig aktiviert. Die Seitenleiste wird ausgeschlossen und der Dateiname entspricht dem aktuellen Modul oder der Seite.

#### Daten und Ankündigungen

- Der dauerhafte TableCfg-Cache ändert sich nur bei einem neuen Hotfix. Json und Bilder verwenden eine unabhängige Revision gemeinsamer Daten und werden nicht allein durch Änderungen der Website-Version oder des Hotfix neu geladen.
- Ankündigungen stellen Markdown-Überschriften, Listen und Inline-Code jetzt korrekt dar. Auf der About-Seite und im README wurde außerdem der Datenpartner „终末地一图流“ verlinkt.

### v1.2.2

Rohwerte und Berechnungsformeln werden nun nach einem Klick auf eine Zahl in einem dauerhaft sichtbaren Popover angezeigt; die verzögerte Hover-Anzeige entfällt. Ein Klick auf einen anderen Wert wechselt den Inhalt, ein Klick auf eine freie Seitenfläche oder Esc schließt das Popover. Es wird beim Scrollen und Ändern der Fenstergröße neu positioniert, unterstützt Mobilgeräte und Tastatur und verändert die Darstellung der Zahlen nicht.

Ein Problem wurde behoben, durch das übergeordnete Klick-Handler einiger Module echte Mausklicks auf das Popover blockierten. Außerdem wurde die Anzeige `[object Object]` bei Fertigkeits-Rohwerten von `chr_0032_lizhiyan` behoben.

### v1.2.1

Ein Fehler wurde behoben, durch den einige Spielbilder nach einem Modulwechsel oder Neustart des Service Workers fälschlicherweise von `www.akedata.wiki` angefordert werden konnten. Bildpfade werden nun beim Einfügen in die Seite synchron auf `data.akedata.wiki` umgeschrieben.

Der Service Worker stellt Datenursprung und Revision der gemeinsamen Daten jetzt aus seiner Registrierungs-URL wieder her. Dadurch bleibt das Bild-Routing auch nach dem Beenden und Neustarten des Workers durch den Browser erhalten. Auch das Website-Symbol wird direkt vom Datenursprung geladen.

Die Gegnerdaten aus `LevelScriptData` wurden in die Attributberechnung für Dungeons, Contingency Contract und Echoes of War integriert. Gegner, Stufen und Start-Buffs, die direkt in Skripten definiert sind, sowie bedingte Buffs über Spawner werden nun berücksichtigt. Dadurch werden auch Stufen ohne SpawnerConfig korrekt berechnet. Außerdem wurden das Vorladen von Contingency-Contract-Buffs und die Neuberechnung nach einer Bedingungsänderung korrigiert.

Die Hinweise für Rohwerte wurden verbessert. Werte ohne rechnerische Änderung zeigen weiterhin den ursprünglichen Wert; durch Attribute, Buffs, Vertragsbedingungen oder Ausdrücke veränderte Werte zeigen nun Ausgangswert, eingesetzte Parameter, vollständige Formel und Endergebnis. Die Formelverfolgung gilt für Dungeons, Contingency Contract, Echoes of War, Gegner sowie berechnete Beschreibungen von Charakteren, Waffen, Ausrüstung und Gegenständen.

### v1.2.0

Der Datenvergleich zwischen Spielversionen wurde hinzugefügt. Bei Auswahl von `Latest` vergleicht die Website automatisch mit dem letzten Hotfix der vorherigen Spielversion. Neue Einträge werden stets zuerst angezeigt und markiert; Markierungen für Änderungen und der Detail-Diff lassen sich über die standardmäßig deaktivierte experimentelle globale Einstellung aktivieren.

Der Detail-Diff vergleicht nur tatsächlich sichtbare Seiteninhalte, zeigt Entferntes rot und Hinzugefügtes grün an und ignoriert ausgeblendete Felder. Aktivitäten sind von der Erkennung neuer Einträge ausgenommen. Ausrüstung und Medaillen werden anhand ihrer einzelnen IDs verglichen; zugehörige Sets und Kategorien werden ebenfalls markiert. Kartenrahmen behalten ihre Seltenheitsfarben.

### v1.2.0-pre2

Die vollständige Attributzuordnung wurde um die IDs 93–100 aktualisiert und mit den `maps.json`-Dateien aller 14 Sprachen synchronisiert.

Die Gegner- und Dungeonmodule verwenden nun die neuen Elementarresistenz-Parameter (IDs 94–99). Die alten Resistenzkoeffizienten mit den IDs 80–85 werden nicht mehr in Attributkarten, Modifikatorübersichten oder zugehörigen Buff-Hinweisen angezeigt.

### v1.1.9

Das Themenmodul für die permanente Herausforderung „Echo des Krieges“ wurde ergänzt. Es zeigt nach Saison und Rotation Stufen, Schwierigkeitsgrade, Bewertungstitel, Verdienstbelohnungen und offizielle Anleitungen. Außerdem werden Gegnerwellen, Spawnkarten, Start-Buffs und stufenbereinigte Attribute mit Wellenwechsel und verknüpfter Kartenhervorhebung dargestellt.

### v1.1.8

Debugmodus und erzwungene Aktualisierung des Webcaches wurden ergänzt; Charakter-Attributknoten und die Auswertung von Entwicklungskosten anhand der Gegenstandsbeschreibungen wurden korrigiert; Aktivitätstypen stammen nun aus ActivityTagTable; Rich-Text-Stile und Begriffe werden direkt aus TableCfg gelesen; und Module mit Startseite erhielten eine Home-Schaltfläche in der Seitenleiste.

### v1.1.6

Interne Ankündigungen und ein Update-Countdown wurden ergänzt, Jues zweiförmige Fertigkeitsgruppen angepasst, Ladehinweise verbessert und zahlreiche veraltete v2-Module entfernt.

### v1.1.5

Ein mehrsprachiges Framework wurde eingeführt, das Oberfläche, Module, Filter und Datenzuordnungen sprachabhängig umschaltet, einschließlich eines ersten Pakets mehrsprachiger Ressourcen.

### v1.1.4

Versionsparameter für Datenanfragen wurden korrigiert, Aktualisierungsversionen von Anwendungsressourcen und öffentlichen Daten getrennt und die Versionsprüfung von Seitencache und Service Worker vereinheitlicht.

### v1.1.3

Das Gegenstandsmodul erhielt Nutzungseffekte für Verbrauchsgegenstände und Herstellungsrezepte sowie Material-Produkt-Beziehungen, Detailstile und die zugehörige v3-Datenanpassung.

### v1.1.2

Gruppierte Übersichten in Kartenform wurden für Charaktere, Waffen, Gegner, Ausrüstung, Aktivitäten, Gegenstände, Dungeons, Medaillen, Forschung und weitere Module ergänzt.

### v1.1.1

Der Gegenstandskategoriefilter wurde mit einklappbaren Bereichen und Trefferzahlen überarbeitet; außerdem wurden Anfrage-Deduplizierung, IndexedDB-Cache und Fortschrittsanzeige beim Datenladen verbessert.

### v1.1.0

Eine auf TableCfg und Json basierende v3-Datenanpassungsschicht für die wichtigsten Abfragemodule wurde eingeführt, ergänzt um Moduldeaktivierung und Caching großer Datendateien.

### v1.0.31

Eine Umschaltung zwischen chinesischer und englischer Oberfläche sowie Datenverzeichnissen mit zugehöriger Internationalisierungskonfiguration wurde vorübergehend ergänzt, danach jedoch vollständig zurückgenommen und in dieser Phase nicht weiter angeboten.

### v1.0.30

Eine einheitliche Anfrage-Cache-Schicht wurde ergänzt und alle Seiten auf akeFetch umgestellt, um wiederholte Anfragen zu reduzieren und das Laden beim Modulwechsel zu optimieren.

### v1.0.29

Eingebettete Skripte der Startseite und Module wurden in das Verzeichnis plugin/js ausgelagert, um Routing, Einstellungen, Attributberechnung und Modulcontroller zentral zu verwalten.

### v1.0.28

Hinweise zu Rohwerten wurden für die meisten Modulparameter ergänzt; außerdem wurden die Lebenspunktberechnung von Monstern und die Anzeige der Reduktion sämtlichen Schadens korrigiert.

### v1.0.27

Der Contingency Contract erhielt eine Visualisierung der Monsterwellen mit Spawnkoordinaten, Wellenwechsel und verknüpfter Hervorhebung; zudem wurde die zusammengefasste Statistik wiederholter Wellen korrigiert.

### v1.0.26

Der Contingency Contract erhielt eine Gegnerattributanzeige, die anhand von Stufe, Spawn-Buff und gewählten Vertragsmodifikatoren die tatsächlichen Attribute berechnet und darstellt.

### v1.0.25

Das Token-geschützte Contingency-Contract-Modul wurde vorgeladen und freigeschaltet, mit Saisonsuche, Bedingungs- und Konfliktprüfung von Modifikatoren, Wertung, Belohnungen, Aufgaben und Shopanzeige.

### v1.0.24

Die v2-Fertigkeitsanzeige der Charaktere wurde aktualisiert, die Reihenfolge von Kombinations- und ultimativen Fertigkeiten korrigiert und wichtige Parameter wie Abklingzeit und Energiekosten beibehalten.

### v1.0.23

Das Forschungsmodul wurde offiziell geöffnet, Markdown, Codehervorhebung, Inhaltsindex, Ankernavigation und Bildvorschau verbessert sowie Forschungsartikel zu Spielmechaniken ergänzt.

### v1.0.22

Token-basierte Zugriffsbeschränkungen für Module und Inhalte wurden ergänzt, einschließlich dauerhafter Speicherung, stapelweiser Ergänzung und Löschung von Token sowie Vorladen geschützter Inhalte.

### v1.0.21

Die v2-Attributwachstumstabelle der Charaktere erhielt Koeffizienten für physischen und magischen Anomalieschaden sowie unterschiedliche Genauigkeiten je nach Anzeigemodus.

### v1.0.20

Reihenfolge und teilweise Benennung detaillierter Gegnerattribute wurden angepasst, Unterbrechungsresistenz und Exekution vorgezogen und die Bezeichnungen der Schadensbonus-Modifikatoren vereinheitlicht.

### v1.0.19

Das Ausrüstungsmodul erhielt eine Anzeige der Ausrüstungs-ID; zugleich wurden v2-Stile für Charaktere, Waffen und Ausrüstung geordnet sowie Attributfarben und Auswahl der Wachstumswerte korrigiert.

### v1.0.18

Deep Links für Module und Einträge wurden ergänzt, die Adresszeile während der Navigation synchronisiert und ausgeblendete oder fehlende Inhalte behandelt; außerdem wurde die Anzeige der Charakterattribut-Modifikationstypen vervollständigt.

### v1.0.17

Waffen v2 wurden offiziell veröffentlicht und bieten Waffensuche sowie detaillierte Anzeigen zu Stufenattributen, Aufstiegsmaterialien, Potenzialen und Fertigkeiten.

### v1.0.16

Ausrüstung v2 wurde offiziell veröffentlicht und zeigt Setteile, Haupt- und Nebenattribute, Setfertigkeiten, Herstellungsrezepte, Feinschmiedegarantie und Verbesserungsinformationen nach Set gegliedert an.

### v1.0.15

Dungeons v2 wurden offiziell veröffentlicht, mit Dungeonreihen, Belohnungen und Gegnerdetails sowie Auswertung von Spawnkonfigurationen und Buff zur Anzeige von Wellen und korrigierten Attributen.

### v1.0.14

Gegner v2 wurden offiziell veröffentlicht, mit Suche, mobiler Liste, Stufenattributen, Gegnervarianten, Attributmodifikationen, Resistenzen und Ungleichgewichtsinformationen.

### v1.0.13

Charaktere v2 wurden offiziell veröffentlicht; Attribute, Fertigkeiten, Talente, Potenziale und Wachstumsinformationen wurden neu aufgebaut sowie Merkmale, Bilder und Knotenanzeigen korrigiert.

### v1.0.12

Die SkillData-v2-Zeitleiste wurde um Aktionsfilter, Flussdiagramme bedingter Verzweigungen, Knotensichtbarkeit und Frame-Dauer-Hinweise erweitert; außerdem wurden einige Monsterwerte korrigiert.

### v1.0.11

Eine ausgeblendete SkillData-v2-Debugansicht wurde ergänzt, die Fertigkeitslogik als Zeitleiste und Aktionsknoten darstellt und Suche sowie Rohdatenansicht unterstützt.

### v1.0.10

Der Neuaufbau von Charaktere v2 wurde fortgesetzt, eine neue Detailansicht an vollständige Charakterdaten angebunden und Feldzuordnungen sowie Darstellungsstruktur vervollständigt.

### v1.0.9

Ein SpawnerConfig-Abfragemodul wurde ergänzt, das Generatordaten nach Szene und Konfiguration durchsuchen kann; zugleich wurden die Abfragezugänge für BuffData und SkillData angepasst.

### v1.0.8

BuffData- und SkillData-Abfragemodule wurden ergänzt, mit Listenansicht, Suche und Details als Zugang für die Erforschung grundlegender Kampfdaten.

### v1.0.7

Aktivitätsabfragen wurden ergänzt, die Standardanzeige von Charaktermodifikatoren angepasst und Laevatains besondere Modifikatoren unterstützt; außerdem wurde eine Besucherstatistik der Website hinzugefügt.

### v1.0.6

Auf der Infoseite wurden eine Sponsorenliste und die zugehörigen Stile ergänzt, um die Danksagungen des Projekts vollständiger darzustellen.

### v1.0.5

Die mobile Anpassung wurde für die wichtigsten Module zu Charakteren, Waffen, Gegnern, Ausrüstung, Gegenständen, Dungeons und Erfolgen sowie für alle drei Themes abgeschlossen.

### v1.0.4

Filterfunktionen wurden für Charakter-, Waffen- und Gegenstandsmodule ergänzt und der Listenfilterbereich neu aufgebaut, um die Suche in umfangreichen Eintragsmengen zu beschleunigen.

### v1.0.3

Eine Oberfläche zur Gegenstandssuche wurde ergänzt und das Gegenstandsmodul registriert, mit Gegenstandsliste, Detailansicht und zugehörigen Basisinformationen.

### v1.0.2

Die Charakterseite erhielt Fertigkeitssymbole und Logistikfertigkeiten mit Einrichtungstyp, Fertigkeitsstufe, Beschreibung und Freischaltbedingung; außerdem wurden die zugehörigen Daten korrigiert.

### v1.0.1

Die fehlerhafte Anzeige fester Gegnerattribute wurde korrigiert und gleichzeitig die Gegnerinformationen auf der Dungeonseite vervollständigt.

### v1.0.0

AKEData 1.0 wurde offiziell veröffentlicht, mit Schwerpunkt auf der Vervollständigung der Dungeonabfragen und Anhebung der Projektversion von 0.99 auf 1.0.
