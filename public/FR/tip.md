AKEData a été transféré vers le domaine www.akedata.wiki. L'ancien domaine akedata.top redirige désormais vers celui-ci.

# Journal des mises à jour d'AKEData

### v1.3.9

Ajout du projet de norme [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home) v0.3, de son exemple et du [Validateur AKEGF](/?plugin=akegf&id=validator). Les articles de recherche, les documents AKEGF et les annonces partagent le rendu Markdown et la coloration syntaxique.

### v1.2.11

#### Navigation secondaire et interface commune

- La navigation secondaire des principaux modules de consultation a été reconstruite afin d'unifier la structure des éléments, les états actifs, les compteurs, les marqueurs de changement de version, la recherche, les filtres et les interactions sur ordinateur et mobile.
- Une couche d'interface commune regroupe les boutons, champs, sélecteurs, interrupteurs, filtres, cartes, états et tableaux, réduisant les différences visuelles et fonctionnelles entre les modules.

#### Réglages et affichage

- Les fenêtres des réglages globaux et des annonces du site ont été repensées avec une organisation plus claire et un rendu cohérent pour les thèmes clair, sombre et confort visuel.
- Les états de chargement, de contenu vide et d'erreur ont été harmonisés. Les en-têtes et le contenu des tableaux communs sont désormais centrés par défaut.

### v1.2.10-1

#### Comparaison des versions de la Bibliothèque d'archives

- Avec les données Latest, la Bibliothèque d'archives est comparée au dernier Hotfix de la version précédente du jeu. Les archives ajoutées dans cette version sont épinglées et signalées globalement dans la vue d'ensemble initiale, puis en tête et signalées dans leur catégorie du répertoire ; les nouvelles entrées de chaque groupe sont également affichées en premier. Les versions historiques fixes n'affichent aucun indicateur de nouveauté.

### v1.2.10

#### Bibliothèque d'archives

- Ajout de la Bibliothèque d'archives comme module public pour consulter les archives, documents et relevés présents dans le jeu.
- La page d'accueil propose une vue d'ensemble de toutes les archives, un répertoire par support et catégorie, une recherche en texte intégral et des liens directs vers chaque groupe d'archives.
#### Contenu des archives

- Les détails affichent les titres et le corps du texte avec leur mise en forme enrichie, ainsi que les images originales du jeu. Lorsqu'un document comporte des variantes du protagoniste, il est possible de basculer entre les images de la protagoniste féminine et du protagoniste masculin.
- Les archives audiovisuelles proposent uniquement une transcription ligne par ligne ; cette version ne charge ni ne lit aucun contenu audio.

#### Navigation et affichage

- Ajout de répertoires adaptés aux ordinateurs et aux appareils mobiles, de la restauration de l'état de navigation au retour dans le module et de la prise en charge de l'exportation en image longue.
- Le texte enrichi restitue désormais correctement les marques de masquage. Les icônes introuvables utilisent l'image d'absence par défaut, tandis qu'un message clair remplace les images de contenu indisponibles.

### v1.2.9

#### Divers et centre de tâches

- Ajout du module Divers, extensible par outils indépendants. Sa première version couvre les tâches hebdomadaires, le Pass Protocole et les tâches d'activité d'entraînement, de contrats, de donjons de course et de tournois.
- Les tâches du Pass Protocole peuvent être filtrées par semaine et affichent désormais tous les niveaux des trois parcours de récompenses.

#### Icônes et sources d'obtention

- Ajout d'un générateur d'icônes de personnage permettant de choisir un personnage et une compétence, de prévisualiser le montage puis de le télécharger en PNG.
- Les boutiques affichent maintenant leurs conditions de déverrouillage et les niveaux de répartition du matériel ; les détails d'équipement indiquent les sources telles que boutiques, missions et caisses de modèle sur la carte. Les liens cartographiques OEM sont calculés dynamiquement depuis LevelData uniquement après un clic.

#### Expérience et stabilité

- Uniformisation de l'image de remplacement en cas d'échec de chargement, et correction du défilement indépendant de Divers, des commandes mobiles et de plusieurs mises en page de récompenses.
- Les nouveaux modules de données de combat `v3_skill` et de Buff `v3_buff` sont toujours en cours de validation et ne sont pas disponibles dans cette version.

### v1.2.8

#### Barres latérales et mise en page

- La barre latérale principale et celles de chaque module peuvent désormais être redimensionnées par glissement, et leurs largeurs sont enregistrées séparément. Lorsqu'une barre devient étroite, les entrées dotées d'une icône n'affichent plus que celle-ci, tandis que les entrées sans icône conservent leur nom.
- Les boutons Paramètres globaux et export d'image longue disposent maintenant d'une zone inférieure réservée et ne recouvrent plus la liste des modules.

#### État de navigation

- Pendant une même session de navigation, revenir à un module restaure la page, l'entrée et la position de défilement précédemment affichées.
- La position de défilement des détails est mémorisée séparément pour chaque entrée d'un même module. L'actualisation de la page efface ces états temporaires et ramène à la page de départ.

### v1.2.7

#### Donjons et activités

- Les détails des donjons affichent désormais les récompenses fixes et aléatoires répétables consommant de la Raison, séparément des récompenses de première réussite.
- Les blocs de la chronologie des activités utilisent maintenant les heures exactes de début et de fin au lieu d'être alignés sur des journées entières.

#### Vues d'ensemble et images

- Les cartes de personnages et la barre latérale affichent maintenant les icônes d'élément et de profession, avec des couleurs recalibrées et l'icône choisie selon l'ID de profession.
- Les étoiles de rareté ont été retirées des vues Personnages et Armes, et le niveau de danger de la vue Ennemis. Les filtres, le tri et les détails restent inchangés.
- Les icônes intégrées au texte riche, aux liens de termes et aux infobulles passent par le domaine de données actif, corrigeant l'absence de `data.akedata.wiki` et les chemins `//public/...` incorrects.

### v1.2.6

#### Communications Baker

- Ajout du module Baker pour consulter les conversations complètes des opérateurs, contacts et groupes, avec filtres de type, recherche plein texte et liens profonds URL.
- Les conversations distinctes avec un même contact apparaissent désormais séparément dans la barre latérale, et les choix de dialogue permettent de changer la branche suivante.
- Prise en charge du texte, des images, des pièces jointes d'objets et de missions, des messages système, des réactions et des images des choix `sns_emoji`, avec amélioration des avatars, du défilement et des mises en page ordinateur/mobile.

### v1.2.5

#### Images et envoi des ressources

- Les images conservent désormais leur arborescence d'origine sous `assets/beyond/dynamicassets/gameplay`, et tous les modules utilisent les nouveaux chemins.
- Les ressources manquantes dues aux règles de répertoire et à la table interne incomplète de beyond-sdk ont été corrigées, avec une distinction exacte entre `charremoteicon` et `charremoteicon700`.
- AKE Data Tool peut envoyer les images, les données Json ou les deux. Il contrôle la taille actuelle et le pic estimé de l'ensemble du bucket R2 et bloque l'envoi à 10 Go.
- `pluginversion` et `jsversion` versionnent séparément le HTML des modules et JavaScript afin de conserver les ressources inchangées dans le cache local.
- Le module Baker n'est pas inclus dans cette version et est reporté à la `1.2.6`.

### v1.2.3

#### Modules et visibilité

- Le module Missions est temporairement masqué et indiqué « En développement ». Les modules de débogage BuffData, SkillData et SpawnerConfig sont désactivés, et la description d'Echoes of War a été mise à jour.
- Lorsque « Afficher les modules masqués » est désactivé, les identifiants internes des personnages, équipements, activités, Buffs et autres données ne sont plus affichés. Les valeurs brutes et formules restent désormais toujours accessibles.
- Les modificateurs sont regroupés selon leur source : apparition, Buff ou stage. Les Buffs d'attributs du module Ennemis participent au calcul ; hors mode masqué, leurs identifiants et les Buffs sans effet sur les attributs ne sont pas affichés.

#### Ennemis et modes de jeu

- Donjons, Contingency Contract et Echoes of War partagent désormais un même moteur d'affichage des ennemis pour les statistiques de niveau, Buffs d'apparition et résultats modifiés. Les nouvelles résistances élémentaires (94–99) sont utilisées et les anciens coefficients (80–85) ne sont plus affichés.
- Les rotations d'Echoes of War peuvent être dépliées ou repliées ; la couleur de bordure distingue les états en cours, à venir et terminés. Seule la rotation active s'ouvre par défaut, avec uniquement la configuration ennemie de difficulté maximale dépliée.
- Lorsque les trois difficultés partagent les mêmes descriptions de caractéristique et de bonus, celles-ci s'affichent une seule fois avant la liste. Les différences restent affichées dans chaque difficulté concernée.
- Correction du rendu de `v2cc-term-param` dans Contingency Contract. La configuration d'activité est repliée par défaut et les conditions de déverrouillage des missions sont masquées.

#### Activités et interface

- La page d'accueil des Activités reçoit une frise calendrier avec dates de début, de fin et statut. Elle propose une infobulle de dates, maintient les titres hors écran sur le bord gauche et affiche à droite des icônes occupant toute la hauteur. Le bouton Accueil la restitue désormais correctement.
- Correction des sauts de ligne échappés dans les descriptions de compétences des personnages et armes. L'icône du composant par défaut apparaît à côté du bouton de coût de fabrication d'équipement.
- L'export d'image longue quitte le mode expérimental et est activé par défaut. La barre latérale est exclue et le nom de fichier correspond au module ou à la page en cours.

#### Chargement des données et annonces

- Le cache persistant de TableCfg ne change qu'avec le Hotfix. Json et les images utilisent une révision indépendante des données partagées et ne sont plus rechargés à cause d'un changement de version du site ou de Hotfix.
- Les annonces rendent désormais correctement les titres, listes et code en ligne Markdown. La page À propos et le README ajoutent aussi le lien partenaire « 终末地一图流 ».

### v1.2.2

Les valeurs brutes et les formules s'ouvrent désormais dans une fenêtre persistante en cliquant sur un nombre, à la place de l'infobulle retardée au survol. Cliquer sur une autre valeur change le contenu ; cliquer dans une zone vide ou appuyer sur Échap ferme la fenêtre. Elle se repositionne lors du défilement ou du redimensionnement, prend en charge le mobile et le clavier, et ne modifie pas le style visuel des nombres.

Correction d'un problème où les gestionnaires de clic parents de certains modules empêchaient un vrai clic de souris d'ouvrir la fenêtre. Correction également des valeurs de compétence de `chr_0032_lizhiyan` affichées comme `[object Object]`.

### v1.2.1

Correction d'un problème pouvant entraîner le chargement de certaines images du jeu depuis `www.akedata.wiki` après un changement de module ou un redémarrage du Service Worker. Les chemins d'image sont désormais réécrits de façon synchrone vers `data.akedata.wiki` lors de leur insertion dans la page.

Le Service Worker restaure maintenant l'origine des données et la révision des données partagées depuis son URL d'enregistrement. Le routage des images reste ainsi correct même après sa suspension et son redémarrage par le navigateur. L'icône du site est également chargée directement depuis l'origine des données.

L'analyse des ennemis de `LevelScriptData` a été ajoutée aux calculs de statistiques des Donjons, de Contingency Contract et d'Echoes of War. Les ennemis, niveaux et Buffs d'apparition définis directement dans les scripts, ainsi que les Buffs conditionnels appliqués par les générateurs, sont maintenant pris en compte. Les stages sans SpawnerConfig sont donc calculés correctement. Le préchargement des Buffs de conditions et le recalcul après changement de condition ont également été corrigés.

Les infobulles de valeurs brutes ont été améliorées. Les valeurs sans modification de calcul continuent d'afficher leur valeur d'origine ; celles modifiées par des statistiques, Buffs, conditions de contrat ou expressions affichent désormais la valeur d'origine, les paramètres substitués, la formule complète et le résultat final. Le suivi couvre les Donjons, Contingency Contract, Echoes of War, les ennemis et les expressions des personnages, armes, équipements et objets.

### v1.2.0

Ajout de la comparaison des données entre versions du jeu. Lorsque `Latest` est sélectionné, le site compare automatiquement avec le dernier Hotfix de la version précédente. Les nouvelles entrées sont toujours placées en tête et étiquetées ; les étiquettes de modification et le Diff détaillé peuvent être activés via le réglage global expérimental, désactivé par défaut.

Le Diff détaillé compare uniquement les informations réellement visibles sur la page : les suppressions sont en rouge, les ajouts en vert et les champs masqués sont ignorés. Les activités sont exclues de la détection des nouveautés. Les équipements et médailles sont comparés par ID individuel, et leurs ensembles ou catégories sont également étiquetés. Les bordures conservent les couleurs de rareté.

### v1.2.0-pre2

La correspondance complète des attributs a été mise à jour avec les ID 93–100, puis synchronisée dans les fichiers `maps.json` des 14 langues.

Les modules des ennemis et des donjons utilisent désormais les nouveaux paramètres de résistance élémentaire (ID 94–99). Les anciens coefficients de résistance, ID 80–85, ne sont plus affichés dans les fiches d'attributs, les résumés de modificateurs ni les infobulles de Buff associées.

### v1.1.9

Ajout du module consacré au défi permanent « Échos de guerre », avec une consultation par saison et rotation des niveaux, difficultés, titres de classement, récompenses de mérite et instructions officielles. Le module affiche aussi les vagues d'ennemis, les cartes d'apparition, les Buff initiaux et les attributs ajustés au niveau, avec changement de vague et surbrillance liée sur la carte.

### v1.1.8

Ajout du mode de débogage et de l'actualisation forcée du cache web ; correction des nœuds d'attributs des personnages et de l'analyse des coûts de développement d'après les descriptions des objets ; utilisation d'ActivityTagTable pour les types d'activités ; lecture directe des styles et termes de texte enrichi depuis TableCfg ; et ajout d'un bouton d'accueil latéral aux modules disposant d'une page initiale.

### v1.1.6

Ajout des annonces internes et du compte à rebours des mises à jour, adaptation des groupes de compétences à deux formes de Jue, amélioration des indications de chargement et suppression de nombreux modules v2 obsolètes.

### v1.1.5

Déploiement du framework multilingue permettant de changer la langue de l'interface, des modules, des filtres et des correspondances de données, avec un premier ensemble de ressources traduites.

### v1.1.4

Correction des paramètres de version des requêtes, séparation des versions d'actualisation des ressources applicatives et des données publiques, et harmonisation du contrôle de version du cache des pages et du Service Worker.

### v1.1.3

Ajout au module des objets des effets d'utilisation des consommables et des recettes de fabrication, avec les relations entre matériaux et produits, les styles détaillés et l'adaptation v3 correspondante.

### v1.1.2

Ajout d'un aperçu par groupes sous forme de cartes pour les modules de personnages, armes, ennemis, équipements, activités, objets, donjons, médailles et recherches.

### v1.1.1

Refonte du filtre des catégories d'objets avec repli et compteur de résultats, et amélioration de la déduplication des requêtes, du cache IndexedDB et de l'affichage de progression du chargement.

### v1.1.0

Déploiement de la couche d'adaptation des données v3 fondée sur TableCfg et Json pour les principaux modules de recherche, avec désactivation des modules et cache des fichiers volumineux.

### v1.0.31

Ajout temporaire du basculement entre interfaces chinoise et anglaise, des répertoires de données et des réglages d'internationalisation associés, puis annulation complète de cette fonctionnalité durant cette phase.

### v1.0.30

Ajout d'une couche unifiée de cache des requêtes et adoption d'akeFetch par toutes les pages, afin de réduire les requêtes répétées et d'optimiser le chargement lors du changement de module.

### v1.0.29

Déplacement des scripts intégrés de l'accueil et des modules vers le répertoire plugin/js, pour centraliser le routage, les réglages, le calcul des attributs et les contrôleurs de modules.

### v1.0.28

Ajout d'indications sur les valeurs brutes pour la plupart des paramètres de modules, et correction du calcul des PV des monstres ainsi que de l'affichage de la réduction de tous les dégâts.

### v1.0.27

Ajout au Contrat de Contingence d'une visualisation des vagues de monstres, avec coordonnées d'apparition, changement de vague et surbrillance liée, et correction du regroupement statistique des vagues répétées.

### v1.0.26

Ajout de l'affichage des attributs ennemis au Contrat de Contingence, calculés selon le niveau, les Buff de naissance et les clauses sélectionnées afin de présenter leurs valeurs réelles.

### v1.0.25

Préchargement et ouverture du module Contrat de Contingence limité par Token, avec recherche de saisons, validation des conditions et conflits de clauses, score, récompenses, missions et boutique.

### v1.0.24

Actualisation de l'affichage des compétences des personnages v2, correction de l'ordre des compétences combinées et ultimes, et conservation des paramètres essentiels comme le temps de recharge et le coût énergétique.

### v1.0.23

Ouverture officielle du module de recherche, amélioration de Markdown, de la coloration du code, de l'index, des ancres et de l'aperçu des images, et ajout d'articles sur les mécaniques.

### v1.0.22

Ajout de restrictions d'accès aux modules et contenus fondées sur un Token, avec persistance, ajout groupé et suppression des Token, ainsi que préchargement des contenus protégés.

### v1.0.21

Ajout au tableau de progression des attributs des personnages v2 des coefficients de dégâts d'anomalie physique et magique, avec une précision adaptée à chaque mode d'affichage.

### v1.0.20

Réorganisation et renommage partiel des attributs détaillés des ennemis, déplacement en tête de la résistance à l'interruption et de l'exécution, et harmonisation des libellés de bonus de dégâts.

### v1.0.19

Ajout de l'ID d'équipement au module concerné, réorganisation des styles v2 des personnages, armes et équipements, et correction des couleurs d'attributs et du choix des valeurs de progression.

### v1.0.18

Ajout de liens profonds vers les modules et entrées, synchronisation de l'adresse pendant la navigation et gestion des contenus masqués ou absents, avec amélioration des types de modification d'attributs des personnages.

### v1.0.17

Lancement officiel des armes v2, avec recherche d'armes et affichage détaillé des attributs par niveau, matériaux de promotion, potentiels et compétences.

### v1.0.16

Lancement officiel des équipements v2, présentant par ensemble les pièces, attributs principaux et secondaires, compétences d'ensemble, recettes, garantie de forge fine et informations de renforcement.

### v1.0.15

Lancement officiel des donjons v2, avec séries, récompenses et détails des ennemis, plus analyse des configurations d'apparition et Buff pour afficher les vagues et attributs corrigés.

### v1.0.14

Lancement officiel des ennemis v2, avec recherche, liste mobile, attributs par niveau, variantes, modifications d'attributs, résistances et informations de déséquilibre.

### v1.0.13

Lancement officiel des personnages v2, avec refonte des attributs, compétences, talents, potentiels et données de progression, et correction des traits, images et nœuds.

### v1.0.12

Amélioration de la chronologie SkillData v2 avec filtres d'actions, graphe des branches conditionnelles, affichage des nœuds et durée des frames, et correction de certaines valeurs de monstres.

### v1.0.11

Ajout d'une vue de débogage SkillData v2 masquée, présentant la logique des compétences par chronologie et nœuds d'action, avec recherche et consultation des données brutes.

### v1.0.10

Poursuite de la refonte des personnages v2 avec une nouvelle fiche détaillée reliée aux données complètes, et amélioration des correspondances de champs et de la structure d'affichage.

### v1.0.9

Ajout du module de recherche SpawnerConfig permettant de parcourir les données des générateurs par scène et configuration, et ajustement des accès de recherche BuffData et SkillData.

### v1.0.8

Ajout des modules de recherche BuffData et SkillData avec listes, recherche et détails, offrant un accès aux données fondamentales pour l'étude des combats.

### v1.0.7

Ajout de la recherche d'activités, ajustement de l'affichage par défaut des clauses de personnages et prise en charge des clauses spéciales de Laevatain, avec statistiques de fréquentation du site.

### v1.0.6

Ajout de la liste des sponsors et de ses styles sur la page À propos, afin de compléter la présentation des remerciements du projet.

### v1.0.5

Adaptation mobile achevée pour les principaux modules de personnages, armes, ennemis, équipements, objets, donjons et succès, ainsi que pour les trois thèmes.

### v1.0.4

Ajout de filtres aux modules de personnages, armes et objets, et refonte de la zone de filtrage des listes pour accélérer la recherche parmi de nombreuses entrées.

### v1.0.3

Ajout de l'interface de recherche d'objets et enregistrement de son module, avec liste, fiches détaillées et informations fondamentales associées.

### v1.0.2

Ajout sur la page des personnages des icônes de compétences et des compétences logistiques, avec type d'installation, niveau, description et condition de déverrouillage, et correction des données associées.

### v1.0.1

Correction de l'affichage anormal des attributs fixes des ennemis et amélioration simultanée de leurs informations sur la page des donjons.

### v1.0.0

Lancement officiel d'AKEData 1.0, principalement consacré à compléter la recherche de donjons, avec passage de la version du projet de 0.99 à 1.0.
