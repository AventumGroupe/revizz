# Révizz 📚

Application Android de révision : on prend en photo une fiche ou un cahier, et Claude prépare :

- **📝 Résumé** : une fiche de révision structurée, les points clés, le vocabulaire et une astuce mémo. Le texte scanné reste consultable.
- **🃏 Flashcards** : répétition espacée. Les cartes ratées reviennent vite, les cartes sues de plus en plus tard. Une « Révision du jour » regroupe toutes les matières.
- **✅ QCM** : 5, 10 ou 20 questions, en facile, moyen ou difficile. Chaque réponse est expliquée et l'appli garde l'historique des notes. Les nouveaux QCM évitent les questions déjà posées.
- **📄 Sujets d'entraînement** : interro express, contrôle, sujet type Brevet ou Bac, oral. Chaque sujet a un corrigé caché, et l'élève peut écrire sa copie pour la faire **noter sur 20** avec des conseils.
- **💬 Prof** : un professeur particulier qui répond aux questions sur le cours.

- **🗂️ Classement par matière** : l'accueil montre une tuile par matière (icône, nombre de fiches, cartes à revoir). Dans une matière, les fiches sont rangées par chapitre, avec un bouton pour réviser les cartes de cette matière seulement. Au scan, on peut choisir la matière ou laisser Claude la détecter. Toucher le titre d'une fiche permet de changer sa matière, son chapitre ou son titre.

Les fiches restent sur le téléphone. Les photos ne sont pas conservées : seul le texte est gardé.

## Essayer sans clé : le mode démo

Au premier lancement, « Essayer la démo, sans clé » charge une fiche d'histoire d'exemple avec des réponses préparées à l'avance. Toutes les fonctions marchent, sans appel à Claude. En démo, scanner n'importe quelle photo donne une fiche de maths d'exemple. Saisir une clé dans les Réglages quitte la démo et retire les fiches d'exemple.

`npm run maquette` produit la même démo en une seule page web : `dist-maquette/revizz-maquette.html`.

## Installer l'APK sur le téléphone

1. Ouvrir l'onglet **Releases** du dépôt GitHub (ou **Actions** → dernière exécution « Révizz » → *Revizz-apk*).
2. Télécharger `Revizz.apk` depuis le téléphone, puis l'ouvrir.
3. Si Android le demande, autoriser « Installer des applis inconnues » pour le navigateur.

Chaque modification poussée dans `revizz/` recompile l'APK automatiquement. La clé de signature est toujours la même : la nouvelle version s'installe par-dessus l'ancienne et garde les fiches.

## Configurer la clé API Claude (parent)

1. Créer un compte sur **platform.claude.com**, ajouter du crédit, puis créer une clé dans *API Keys*.
2. **Fixer une limite de dépense mensuelle** dans la console (*Limits*), par exemple 10 €.
3. Dans l'appli : ⚙️ Réglages → Espace parent → coller la clé → « Tester la clé ».

La clé est enregistrée seulement sur le téléphone et envoyée directement à l'API d'Anthropic. Toute personne qui a le téléphone en main peut la lire. C'est pour cela que la limite de dépense est importante.

### Coût indicatif

Le modèle par défaut est **Claude Opus 5.5**, le plus fiable pour lire l'écriture manuscrite et rédiger de bons sujets. Ordres de grandeur :

| Action | Opus 5.5 | Sonnet 5.5 | Haiku 5.5 |
|---|---|---|---|
| Scanner une fiche de 2 pages | ~0,15 € | ~0,08 € | ~0,01 € |
| QCM de 10 questions | ~0,08 € | ~0,04 € | < 0,01 € |
| Sujet + corrigé | ~0,20 € | ~0,10 € | ~0,01 € |

Ce sont des estimations. Le vrai coût s'affiche dans la console (*Usage*).

Le modèle se change dans les Réglages.

### Éco-conception

- **Photos réduites à 1280 px** : environ 1 600 tokens par page au lieu de 2 400, l'écriture reste lisible.
- **Cours mis en cache** : le texte du cours est placé dans une partie fixe de la requête. Les QCM, sujets, cartes et questions au prof le relisent depuis le cache pendant 5 minutes, à 10 % du prix.
- **Pas de doublon** : seule la transcription sert de référence, la fiche résumé n'est plus renvoyée.
- **Réflexion dosée** : effort faible pour les QCM, les cartes et le prof ; moyen pour la lecture des photos, les sujets et les corrections.
- **Réponses courtes** : moins de cartes, mais plus précises, corrections limitées à 25 lignes, prof à 8 lignes, 10 derniers messages seulement.
- **Zéro appel quand c'est possible** : refaire le dernier QCM (questions et propositions mélangées), réviser les cartes ou relire un sujet ne consomme rien.
- **Compteur** dans les Réglages : demandes, tokens lus et écrits, part relue depuis le cache.

## Développement

```bash
cd revizz
npm install
npm run dev            # version web sur http://localhost:5173
npm run android:apk    # compile l'APK (Android SDK requis), sortie : android/app/build/outputs/apk/debug/
```

Structure :

- `src/claude.js` : tous les appels à l'API Claude (SDK officiel `@anthropic-ai/sdk`, réponses en streaming, sorties JSON structurées, repli automatique si un modèle refuse).
- `src/matieres.js` : liste des matières (icône, couleur) et rattachement des anciennes fiches.
- `src/demo.js` : contenu et réponses du mode démo.
- `src/store.js` : stockage local, répétition espacée (boîtes de Leitner), série de jours.
- `src/main.js` : les écrans.
- `android/` : projet Android natif (Capacitor).
- `.github/workflows/revizz-apk.yml` : compilation de l'APK et publication.
