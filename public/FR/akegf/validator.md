# AKEGF · Certification des outils

La certification exige l’importation et l’exportation de v0.4. Afficher la version prise en charge et un lien vers [AKEGF](https://www.akedata.wiki/?plugin=akegf&id=home) dans l’application.

Les projets compatibles peuvent proposer leur ajout aux [Projets partenaires](/?plugin=akegf&id=partners) par une [Pull Request](https://github.com/NagiYume/AKEDatabase/pulls).

Importer l’[Exemple avec plusieurs personnages](/plugin/data/akegf/example.json), puis le réexporter. Le groupe chinois doit conserver trois entrées et le groupe international une. Comparer l’événement, la bannière, le résultat, la rareté, l’heure en millisecondes et le numéro de séquence. Garder le tirage d’opérateur et celui d’arme qui partagent un numéro, ainsi que le type gift_weapon du cadeau.

## Validateur AKEGF

Coller le JSON ou choisir un fichier local. Le navigateur contrôle le schéma, les groupes en double et les numéros répétés dans un même type. /endfield/0/list/1 désigne la deuxième entrée du premier personnage.
