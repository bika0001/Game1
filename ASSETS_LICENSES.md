# Assets et licences

## Assets du jeu

Aucun asset tiers en phase 1 : tout est **original et généré en code**.

| Élément                                      | Origine                                                    |
| -------------------------------------------- | ---------------------------------------------------------- |
| Faces des cartes, enseignes, figures V/D/R   | dessinées en code (`src/render/cardart/`)                  |
| Dos « vagues », tapis, emplacements, halo    | dessinés en code (`src/render/cardart/`)                   |
| Voilier du menu, pictogrammes de l'interface | dessinés en code (`src/render/objects/`, `src/render/ui/`) |
| Sons                                         | synthétisés en Web Audio (`src/services/audio.ts`)         |
| Polices                                      | polices système de l'appareil (aucun fichier embarqué)     |

Aucune interface, illustration ni dos de carte n'est repris d'une application existante.

## Bibliothèques

| Paquet                                                                 | Usage                   | Licence    |
| ---------------------------------------------------------------------- | ----------------------- | ---------- |
| phaser                                                                 | moteur de rendu         | MIT        |
| typescript                                                             | développement           | Apache-2.0 |
| vite, vitest, @vitest/coverage-v8                                      | développement           | MIT        |
| eslint, @eslint/js, typescript-eslint, globals, eslint-config-prettier | développement           | MIT        |
| prettier, tsx                                                          | développement           | MIT        |
| playwright                                                             | vérifications visuelles | Apache-2.0 |

Tout futur asset tiers (sons CC0, musique, illustrations commandées) sera ajouté ici avec sa source,
son auteur et sa licence.
