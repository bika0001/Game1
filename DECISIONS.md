# Décisions

Choix faits là où la spécification ne tranchait pas (option la plus simple, sauf mention contraire).
Tout ce qui touche au ressenti, au style visuel ou à la monétisation reste soumis à ta validation.

## Outillage

1. **Interfaces des services du studio.** La spécification demande « exactement la même interface que
   dans les autres jeux du studio », mais aucun de ces jeux n'est accessible depuis cette session (le
   compte GitHub contient Game1, Bika-site, bika-lab — une application de cuisine — et pedidos).
   J'ai donc défini des interfaces minimales (`src/services/`) ; il suffira de me fournir celles des
   autres jeux pour les aligner.
2. **Versions** : Phaser **3.90** (la spec demande Phaser 3 ; Phaser 4 existe mais n'est pas retenu),
   TypeScript 5.9 (typescript-eslint ne prend pas encore en charge TypeScript 7), Vite 7, Vitest 4.
3. **`.npmrc` avec `legacy-peer-deps`** : npm 10.9 plante (« reading 'edgesOut' ») en résolvant les
   dépendances optionnelles de Vitest.
4. **Polices système** (aucun téléchargement, fonctionne hors ligne) : sans-serif grasse pour les index
   des cartes, Georgia pour les titres.
5. **Canevas en pixels physiques** (densité plafonnée à 3) réduit par le zoom de Phaser : cartes et
   textes parfaitement nets sans surcoût notable.

## Règles et score

6. **Fondations** : n'importe quel As va sur n'importe quelle fondation vide ; un tap l'envoie sur la
   plus à gauche.
7. **As sur un 2 au tableau** : autorisé (c'est la règle standard, même si c'est rarement utile).
8. **Compteur de coups** : coups nets (une annulation le décrémente) ; les taps sur la pioche et les
   coups de la cascade « Terminer » comptent.
9. **Score** : barème de la spec, plancher à 0 ; pas de pénalité de recyclage ni de temps ; l'annulation
   rend exactement les points du coup annulé (gratuite). **Bonus de temps** (chrono affiché uniquement) :
   700 000 / secondes, minimum 30 s — la formule classique, réglable dans `balance.ts`.
10. **Passages limités** : pioche 1 → un seul passage, pioche 3 → trois passages (`balance.ts`).
11. **Banques dédiées aux passages limités** (1 000 donnes chacune) : les solutions trouvées avec
    passages illimités utilisent beaucoup de passages, elles ne garantiraient pas la victoire.

## Donnes gagnables et solveur

12. **« Gagnable » = résoluble en connaissant les cartes cachées** (définition standard des générateurs
    de donnes gagnables) : une suite de coups gagnante existe, le joueur doit la trouver.
13. **Banque = premières graines résolues** dans la limite de nœuds. Les donnes que le solveur ne
    prouve pas assez vite sont écartées (léger biais vers les donnes « simples à prouver », jugé
    acceptable pour ce public).
14. **Stockage** : l'app n'embarque que l'index compact (graines + estimation de difficulté : coups de
    déplacement de la solution et nœuds explorés) en morceaux chargés à la demande ; les solutions
    complètes restent hors du bundle et servent aux tests.
15. **Coups sûrs** : une carte monte d'office si les deux fondations de couleur opposée sont au moins au
    rang − 1 et l'autre fondation de même couleur au moins au rang − 2 (règle prudente, classique dans
    les solveurs ; dans le pire des cas elle ferait écarter une donne gagnable, jamais accepter une donne
    perdante, puisque chaque solution est rejouée avec les règles).
16. **Redémarrages** : 40 recherches courtes (la première selon l'heuristique, les suivantes à ordre
    perturbé). Mesuré sur 200 donnes : pioche 1 de 81 % à 92 % de donnes prouvées, pioche 3 de 72 % à
    84 %, à budget égal.
17. **Tirage** : au hasard parmi les donnes jamais jouées (ensemble de bits sauvegardé) ; quand tout a
    été joué, la banque repart de zéro.

## Aides de jeu

18. **Indice** : premier coup de la solution du solveur (qui connaît les cartes cachées : l'indice mène
    vers la victoire), limité à 1,5 s / 200 000 nœuds ; sinon heuristique « premier pas vers le progrès
    le plus proche » (révéler une carte > monter en fondation > vider la pioche). **Indices illimités en
    phase 1** ; le quota de 3 par jour et les pubs récompensées arrivent avec les pubs simulées (phase 2).
19. **Blocage** : la partie est bloquée si aucune suite de coups ne permet de révéler une carte, de vider
    un peu la pioche ou de dépasser le nombre de cartes en fondation de départ (ces trois mesures ne
    peuvent pas boucler). Recherche plafonnée à 20 000 positions ; au-delà, on conclut prudemment
    « non bloqué ». Le dialogue ajoute une 4e option « Regarder le jeu ».
20. **Terminer** : proposé dès qu'aucune carte n'est cachée et qu'une fin simple (fondations + pioche +
    recyclages) réussit ; en pioche 3, un mauvais alignement de la pioche peut l'empêcher.
21. **Tap = meilleur coup** : fondation d'abord (carte seule) ; sinon colonne non vide la plus proche de
    la colonne d'origine (la plus à gauche en cas d'égalité ou depuis la défausse) ; un Roi va sur la
    première colonne vide, mais jamais s'il est déjà au pied de sa colonne.
22. **Aimantation** : la pile valide la plus recouverte par la carte lâchée, sinon la plus proche à
    moins d'une largeur de carte ; pendant le glisser, les piles valides s'illuminent.

## Interface

23. **Droitier par défaut : pioche en haut à droite** (sous le pouce), fondations à gauche ; le mode
    gaucher inverse.
24. **Paysage** : fondations en colonne d'un côté, pioche et défausse de l'autre, tableau sur toute la
    hauteur, barre d'outils verticale sur le bord (plus de hauteur pour les cartes sur téléphone).
25. **Barre d'outils à 5 boutons avec libellés** (Menu, Réglages, Nouvelle, Indice, Annuler) :
    « Annuler » sous le pouce.
26. **Index des figures selon la langue** : V, D, R en français ; J, Q, K en anglais.
27. **Éventail de la défausse (pioche 3)** : 0,45 largeur de carte en portrait pour lire « 10 » en entier.
28. **Menu** : « Continuer la partie » si une partie est en cours ; commencer une nouvelle partie
    abandonne la précédente (événement `game_abandoned`).
29. **Réglages de pioche, donnes et passages** : s'appliquent à la prochaine partie (la partie en cours
    garde ses règles).
30. **Chrono** : masqué par défaut mais toujours mesuré (bilan de victoire, futures statistiques) ; il
    s'arrête pendant les dialogues et en arrière-plan.
31. **Sons activés par défaut** (effets discrets) ; l'ambiance vagues/mouettes (désactivée par défaut
    selon la spec) arrive en phase 2. Vibrations légères activées par défaut.
32. **Options de phase 2 déjà présentes** car peu coûteuses : mode gaucher et animations réduites.
33. **Langues** : français et anglais dès la phase 1 (détection de la langue du navigateur, français par
    défaut) ; pt, es, de, it en phase 2.

## Sauvegarde et analytics

34. **Sauvegarde** : localStorage sur le web (Preferences en phase 3), 250 ms après chaque coup et
    immédiatement à la mise en arrière-plan. Format versionné (v1) avec chaîne de migrations testée ;
    une sauvegarde illisible ou d'une version future repart de zéro sans bloquer le jeu.
35. **`gamesStarted`** est compté à la distribution (servira à la règle « pas d'interstitielle avant la
    3e partie »). Rejouer une donne compte comme une nouvelle partie.
36. **Web hors ligne** : pas de service worker en phase 1 (l'app mobile de la phase 3 est hors ligne par
    nature).
