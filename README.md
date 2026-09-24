# Solitaire Tides

Un Solitaire classique, impeccable et confortable, pensé d'abord pour les joueurs de 40 à 75 ans :
lisibilité, fluidité, zéro frustration. Le thème voilier (voyage d'île en île) arrive en phase 2.

> **État : phase 1 terminée — Klondike jouable sur le web.** En attente de validation
> (ressenti, style visuel). Voir [ce que tu dois faire](A_FAIRE.md) et [les décisions prises](DECISIONS.md).

## Lancer le jeu

Prérequis : Node.js 20.19+ (testé avec Node 22).

```bash
npm install
npm run dev          # http://localhost:5173 (aussi accessible depuis un téléphone du même réseau)
```

| Commande            | Rôle                                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `npm run dev`       | serveur de développement (rechargement à chaud)                       |
| `npm run build`     | vérification des types puis build de production dans `dist/`          |
| `npm run preview`   | sert le build de production                                           |
| `npm test`          | tous les tests (règles, solveur, banque de donnes rejouée en entier…) |
| `npm run coverage`  | couverture du cœur (`src/core`), seuil imposé : 100 %                 |
| `npm run lint`      | ESLint (le cœur n'a pas le droit d'importer Phaser ni les services)   |
| `npm run format`    | Prettier                                                              |
| `npm run gen-deals` | régénère les banques de donnes gagnables (≈ 15 min sur 4 cœurs)       |

Outil de développement : `http://localhost:5173/cardsheet.html?w=160` affiche la planche des 52 cartes
et du dos (`&only=faces` pour les figures seules, `&lang=en` pour les index anglais).

## Ce que contient la phase 1

- **Klondike complet** : pioche 1 ou 3 cartes, passages illimités ou limités, score standard ou aucun,
  chrono affiché ou masqué, donnes gagnables (par défaut) ou aléatoires.
- **Tap = meilleur coup** : la carte tapée part vers la meilleure destination (fondation d'abord, sinon
  la colonne la plus proche) ; petite secousse si aucun coup n'est possible.
- **Glisser-déposer** aimanté : les piles valides s'illuminent pendant le geste, la carte se pose sur la
  pile valide la plus recouverte ou la plus proche.
- **Annuler illimité et gratuit**, y compris le retournement des cartes et le recyclage de la pioche.
- **Indice** : premier coup d'une solution trouvée par le solveur (Web Worker, jamais sur le thread
  principal), ou heuristique si le solveur dépasse son temps. La carte et sa destination s'illuminent
  et une carte « fantôme » montre le geste.
- **Terminer** : dès que tout est visible et la fin triviale, un bouton envoie tout aux fondations en
  cascade (un tap pendant la cascade la termine).
- **Plus aucun coup possible** : proposition d'annuler, de rejouer la donne ou d'en commencer une autre.
- **Victoire** : les cartes s'envolent comme des mouettes (passable d'un tap), puis bilan temps / coups /
  score.
- **Lisibilité** : cartes générées en code à la résolution exacte de l'écran, gros index en haut de carte
  (lisible même en chevauchement), colonnes qui se resserrent automatiquement, portrait **et** paysage
  (mise en page dédiée), tablettes (cartes plus grandes, interface de taille normale), mode gaucher,
  animations réduites.
- **Confort** : sons doux synthétisés, vibrations légères, sauvegarde automatique après chaque coup et à
  la mise en arrière-plan (historique d'annulation compris), français et anglais.
- **Raccourcis clavier (web)** : `Ctrl/Cmd+Z`, `U` ou `Retour arrière` annuler ; `H` indice ;
  `Espace` ou `D` piocher ; `N` nouvelle partie.

## Architecture

```
src/
  core/                    Logique pure (sans Phaser ni DOM), testée à 100 %
    cards.ts               cartes 0..51, enseignes ♠ ♥ ♣ ♦ (rouge = indice impair)
    rng.ts, deck.ts        générateur seedé (mulberry32) et mélange de Fisher-Yates
    history.ts             pile d'annulation générique
    session.ts             partie en cours : état, historique, compteurs, sérialisation
    autoMove.ts            « tap = meilleur coup »
    deals.ts, playedDeals.ts  banques de donnes, tirage sans répétition
    settings.ts, save.ts   réglages et sauvegarde versionnée (migrations)
    games/types.ts         interface commune à toutes les variantes
    games/klondike/        règles, score, analyse (auto-complétion, blocage), solveur, codec
    data/winnable_deals/   banques générées (JSON chargés à la demande + solutions pour les tests)
  render/                  Phaser : scènes, mise en page, art des cartes, interface
  services/                stockage, audio, haptique, analytics, client du solveur
  workers/                 Web Worker du solveur (indices et détection de blocage)
  config/                  balance.ts (tous les chiffres du jeu), theme.ts (palette, proportions)
  i18n/                    textes fr (référence) et en
scripts/gen-deals.ts       génération des banques de donnes
tests/                     Vitest
```

### Moteur générique

Chaque variante implémente `SolitaireVariant` (`src/core/games/types.ts`) : `setup`, `legalMoves`,
`applyMove`, `undo`, `isWon`, `canAutoComplete`, plus ce dont le rendu a besoin (`piles`, `tapMove`,
`dropTargets`, `dropMove`, `describeMove`…). Le rendu ne manipule que des piles et anime chaque carte
d'après la différence entre deux instantanés : ajouter Spider ou FreeCell revient à écrire ses règles et
sa mise en page, sans toucher aux scènes.

### Solveur et donnes gagnables

`src/core/games/klondike/solver.ts` est un solveur « clairvoyant » (il connaît les cartes cachées, comme
tous les générateurs de donnes gagnables) : recherche en profondeur avec ordre heuristique, table de
transposition 64 bits insensible à l'ordre des colonnes, coups sûrs vers les fondations appliqués
d'office, « macro-coups » de pioche (toute carte atteignable en piochant est jouable directement),
élagage des déplacements inutiles, limites de nœuds et de temps, et 40 redémarrages courts à ordre
perturbé contre la longue traîne de la recherche. Chaque solution est reconstruite en coups atomiques et
rejouée avec les règles : elle est garantie légale et gagnante.

`npm run gen-deals` résout les graines 1, 2, 3… en parallèle et garde les premières donnes résolues
(seule une limite de nœuds est utilisée : le résultat est reproductible).

| Banque                       | Donnes | Graines testées | Résolues | Limite atteinte | Épuisées |
| ---------------------------- | -----: | --------------: | -------: | --------------: | -------: |
| Pioche 1, passages illimités | 10 000 |          11 474 |   87,2 % |          12,3 % |    0,6 % |
| Pioche 3, passages illimités | 10 000 |          12 900 |   77,5 % |          16,5 % |    6,0 % |
| Pioche 1, 1 passage          |  1 000 |          11 895 |    8,4 % |          83,5 % |    8,1 % |
| Pioche 3, 3 passages         |  1 000 |           2 707 |   36,9 % |          51,1 % |   11,9 % |

L'app ne charge que l'index (graine, coups de la solution, nœuds explorés, passages) : 55 à 58 Ko
compressés par banque principale, chargés à la demande. Les solutions complètes
(`*.solutions.txt`) ne servent qu'aux tests, qui les rejouent **toutes** à chaque exécution.

### Services

Interfaces volontairement minimales (`src/services/`), à aligner sur celles des autres jeux du studio
(voir [DECISIONS.md](DECISIONS.md)) :

- `storage` : `get / set / remove` asynchrones (localStorage ; `@capacitor/preferences` en phase 3) ;
- `audio` : `play(nom)`, `setEnabled`, `unlock` (sons synthétisés en Web Audio) ;
- `haptics` : `light / medium / success`, `setEnabled` (`navigator.vibrate` ; `@capacitor/haptics` en phase 3) ;
- `analytics` : `track(événement, paramètres)` (console ; Firebase en phase 4) ;
- `ads` : phase 2 (pubs simulées), avec `showBanner()` / `hideBanner()`.

## Tests

125 tests, dont : légalité de tous les types de coups, séquences multiples, Roi sur colonne vide,
fondation → tableau, pioche 1 et 3 avec passages limités ou illimités, annulation de longues séquences
aléatoires (retournements et recyclages compris) jusqu'à la donne initiale, auto-complétion, cas ambigus
du tap, score, détection de blocage, déterminisme du mélange (empreinte figée), solveur (y compris une
position qui exige de redescendre une carte de fondation), sauvegarde et migrations, mise en page, et
**relecture des 22 000 solutions** de la banque.

## Feuille de route

- **Phase 2** : carte du voyage (1er archipel), déblocages, défis quotidiens et calendrier, statistiques,
  options de lisibilité restantes (4 couleurs, extra-large, contraste élevé, taille du texte), pubs
  simulées, 6 langues.
- **Phase 3** : Capacitor iOS/Android, AdMob (ID de test), UMP, ATT, haptique native.
- **Phase 4** : Spider, FreeCell, Firebase Analytics, icône, captures, politique de confidentialité.
- **Phase 5** : Pyramid, TriPeaks, nouveaux archipels, achat « Supprimer les pubs ».
