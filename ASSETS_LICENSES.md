# Assets et licences

## Assets du jeu

Tout est **original et généré en code**, à l'exception de la police Fredoka (licence libre OFL).

| Élément                                      | Origine                                                    |
| -------------------------------------------- | ---------------------------------------------------------- |
| Faces des cartes, enseignes, figures V/D/R   | dessinées en code (`src/render/cardart/`)                  |
| Dos « vagues », tapis, emplacements, halo    | dessinés en code (`src/render/cardart/`)                   |
| Voilier du menu, pictogrammes de l'interface | dessinés en code (`src/render/objects/`, `src/render/ui/`) |
| Décors (lagon, marine), poissons, confettis  | dessinés en code (`src/render/decor/`)                     |
| Sons                                         | synthétisés en Web Audio (`src/services/audio.ts`)         |
| Police des titres et boutons : **Fredoka**   | The Fredoka Project Authors, **SIL Open Font License 1.1** |
| Police des cartes et des textes              | polices système de l'appareil                              |

Aucune interface, illustration ni dos de carte n'est repris d'une application existante.

## Bibliothèques

| Paquet                                                                   | Usage                   | Licence    |
| ------------------------------------------------------------------------ | ----------------------- | ---------- |
| phaser                                                                   | moteur de rendu         | MIT        |
| @fontsource/fredoka (fichiers de la police Fredoka, sous-ensemble latin) | police embarquée        | OFL-1.1    |
| typescript                                                               | développement           | Apache-2.0 |
| vite, vitest, @vitest/coverage-v8                                        | développement           | MIT        |
| eslint, @eslint/js, typescript-eslint, globals, eslint-config-prettier   | développement           | MIT        |
| prettier, tsx                                                            | développement           | MIT        |
| playwright                                                               | vérifications visuelles | Apache-2.0 |

Tout futur asset tiers (sons CC0, musique, illustrations commandées) sera ajouté ici avec sa source,
son auteur et sa licence.
