# Ce que tu dois faire

## Maintenant : valider la refonte visuelle

- [ ] **Jouer** sur ton téléphone (lien de l'aperçu, ou `npm install` puis `npm run dev` et l'adresse
      indiquée, même réseau Wi-Fi), en portrait puis en paysage, et si possible sur une tablette.
- [ ] **Fluidité** : vols des cartes, glisser-déposer, distribution, cascade « Terminer ». Trop lent,
      trop rapide, ou juste bien ?
- [ ] **Netteté** : les cartes et les textes sont-ils nets sur ton écran ?
- [ ] **Décor** : le lagon animé (jeu) et la marine (menu) te plaisent-ils ? Le tapis classique reste
      disponible dans Réglages → Affichage → Décor.
- [ ] **Animations** : éclats sur les fondations, « +10 », fête de victoire : assez, trop, pas assez ?
- [ ] **Style visuel** : faces des cartes, figures (Valet-capitaine, Dame au coquillage, Roi à la barre),
      dos « vagues ». La planche complète : `http://localhost:5173/cardsheet.html?w=160`.
- [ ] **Sons** : ils sont synthétisés en attendant des assets définitifs ; dis-moi s'ils conviennent.
- [ ] **Décisions** : relire [DECISIONS.md](DECISIONS.md) (n° 37 à 46 pour la refonte).

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
