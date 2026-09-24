# Ce que tu dois faire

## Maintenant : valider la phase 1

- [ ] **Jouer** : `npm install` puis `npm run dev`, et ouvrir l'adresse indiquée sur un téléphone
      (même réseau Wi-Fi) et sur une tablette, en portrait et en paysage.
- [ ] **Ressenti** : vitesse des animations, tap = meilleur coup, glisser-déposer, indice, « Terminer »,
      dialogue « Plus aucun coup possible », animation de victoire.
- [ ] **Style visuel** : faces des cartes, figures (Valet-capitaine, Dame au coquillage, Roi à la barre),
      dos « vagues », tapis, menu et voilier. La planche complète :
      `http://localhost:5173/cardsheet.html?w=160`.
- [ ] **Sons** : ils sont synthétisés en attendant des assets définitifs ; dis-moi s'ils conviennent.
- [ ] **Décisions** : relire [DECISIONS.md](DECISIONS.md) et me signaler ce qui doit changer.

## Informations à me fournir

- [ ] Les **interfaces des services** (`ads`, `storage`, `audio`, `haptics`, `analytics`) des autres jeux
      du studio, si elles existent : elles n'étaient pas accessibles depuis cette session.
- [ ] Vérifier la **disponibilité du nom** « Solitaire Tides » sur l'App Store et Google Play.

## À préparer pour les phases suivantes

- [ ] **Phase 3** : comptes Apple Developer et Google Play Console ; compte **AdMob** (identifiants
      d'application et de blocs d'annonces, à mettre dans un `.env` non versionné — voir `.env.example`) ;
      un Mac avec Xcode pour les builds iOS, Android Studio pour Android.
- [ ] **Phase 4** : projet **Firebase** (Analytics) ; validation du modèle de politique de confidentialité.
- [ ] **Assets à commander (facultatif, plus tard)** : sons définitifs (CC0 ou commandés), musique douce
      acoustique, éventuellement figures illustrées à la main (le système de skins permettra de remplacer
      celles générées en code), icône et écran de démarrage.
