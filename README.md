# Révizz 📚

Application de révision, sur Android (APK) et en version web : on prend en photo une fiche ou un cahier, et Claude prépare :

- **📸 Scanner** : au départ, on choisit « Une page » ou « Plusieurs pages ». Le scanner intégré garde la caméra ouverte : chaque appui sur le déclencheur ajoute une page (flash, vibration, compteur), sans rien valider. Le bouton ↩︎ retire la dernière page, « Terminé » revient à la liste. L'ordre se corrige avec les flèches. Import depuis la galerie ou un PDF toujours possible.
- **🔍 Lecture des cours manuscrits** : au scan, on choisit « Manuscrite » (par défaut), « Imprimée » ou « Les deux » (photocopie ou manuel annoté à la main : l'imprimé et chaque annotation manuscrite sont transcrits, les annotations à leur place, puis intégrées à la fiche). Les pages sont lues une par une (requêtes légères, reprise automatique si la connexion saute, écran gardé allumé pendant la lecture). En manuscrit, la photo est nettoyée sur le téléphone (ombres et jaunissement effacés, crayon et encre pâle foncés, couleurs conservées) et envoyée en haute définition (2200 px). Claude fait une lecture dédiée, en réflexion poussée, avec un outil de zoom : il agrandit lui-même les mots petits, pâles ou raturés (découpés sur le téléphone dans une copie à 3200 px). Il n'invente rien : une lecture incertaine est marquée [?mot], un passage impossible [illisible]. L'élève vérifie ensuite seulement ces passages, avec la photo sous les yeux, avant la création de la fiche. Le texte scanné reste corrigeable depuis la fiche, et les QCM, sujets et réponses du prof utilisent la version corrigée.
- **📝 Résumé** : une fiche de révision structurée, les points clés, le vocabulaire et une astuce mémo. Le texte scanné reste consultable.
- **🃏 Flashcards** : répétition espacée. Les cartes ratées reviennent vite, les cartes sues de plus en plus tard. Une « Révision du jour » regroupe toutes les matières.
- **✅ QCM** : 5, 10 ou 20 questions, en facile, moyen ou difficile. Chaque réponse est expliquée et l'appli garde l'historique des notes. Les nouveaux QCM évitent les questions déjà posées. Chaque question ne demande qu'une seule chose (jamais « quand et pourquoi… ? »).
- **📄 Sujets d'entraînement** : interro express, contrôle, sujet type Brevet ou Bac, oral. Le sujet se présente question par question, avec les points de chaque question et la zone de réponse juste en dessous ; les réponses sont gardées au fil de la frappe. La correction reste cachée tant que toutes les réponses ne sont pas remplies (« je ne sais pas » est accepté). Une fois la copie rendue : note sur 20, appréciation, points forts, points à travailler, puis sous chaque question les points obtenus, le niveau de maîtrise, un commentaire, la réponse attendue, le barème détaillé et l'erreur fréquente. On peut refaire le même sujet.
- **Attendus officiels par matière** (`src/evaluation.js`) : les sujets reprennent les types d'exercices de l'Éducation nationale, avec leur nom et leur méthode rappelée à l'élève (volet « Méthode » au-dessus de chaque exercice) ; la correction utilise la grille de critères de la matière. Histoire-géographie : réponse à une question problématisée (le « développement construit » du collège), analyse de document(s), production graphique (légende organisée), repères. Français : commentaire, dissertation, explication linéaire, question de grammaire. Mathématiques : automatismes et problèmes, comme l'épreuve anticipée de 1re. Physique-chimie : compétences APP, ANA-RAI, REA, VAL, COM. SVT : mobiliser ses connaissances, démarche scientifique sur documents. SES : mobilisation des connaissances, étude d'un document, raisonnement sur dossier. Langues : compréhension et expression selon le CECRL (B1 à consolider en LVA, A2 en LVB). Aussi EMC, SNT, NSI, enseignement scientifique, philosophie. Le type « Format officiel » reprend la structure de l'épreuve de la matière à la mesure d'un élève de Seconde.
- **Maîtrise de la langue** : comme aux examens à partir de la session 2027 (note de service du BO spécial n° 4 du 17 septembre 2026), chaque sujet réserve 2 points sur 20 à l'expression écrite, dans toutes les matières, maths et sciences comprises (la phrase de justification ou de conclusion compte, pas le calcul). Critères : orthographe et grammaire, syntaxe et ponctuation, clarté du raisonnement, lexique et registre. Quatre niveaux, jugés sur l'ensemble de la copie (une ou deux fautes isolées ne coûtent rien). La langue n'est notée que sur cette ligne, jamais dans les questions. Les phrases fautives sont listées avec leur correction et la règle. Dans les matières très rédactionnelles (français, histoire-géographie, SES, EMC, philosophie…), une copie défaillante sur l'ensemble de la langue ne peut pas avoir la moyenne (note ramenée à 9,5), comme le prévoit le texte.
- **Méthode de correction** : Revizz note la compréhension, pas les mots : une idée juste dite autrement que dans le cours (synonyme, périphrase, autre exemple, autre raisonnement correct) obtient tous les points ; le vocabulaire exact ne compte que si la question demande une définition ou un terme, et même alors une idée juste mal nommée garde au moins la moitié des points. Dans le doute, la note la plus favorable est retenue. Le bouton « Faire relire ma copie » relance la correction des mêmes réponses. Il n'existe pas de barème national unique, chaque professeur fait le sien. Revizz suit les pratiques courantes : barème annoncé question par question (total 20), critère par critère, demi-points ; en maths et en sciences, la démarche compte même si le résultat est faux (compétences du lycée : chercher, modéliser, représenter, raisonner, calculer, communiquer) ; les réponses rédigées reçoivent un des 4 niveaux de maîtrise utilisés au collège et dans de nombreuses grilles de lycée (très insuffisant, insuffisant, satisfaisant, très satisfaisant) ; l'orthographe et l'expression comptent pour au plus 10 % des points (choix de Revizz) ; une réponse vide vaut 0. La note est recalculée sur le téléphone à partir des points de chaque question, sans jamais dépasser le barème.
- **💬 Prof** : un professeur particulier qui répond aux questions sur le cours.

- **🗂️ Mes matières** : l'appli démarre avec les matières de Seconde (Français, Mathématiques, Histoire-Géographie, EMC, SES, SVT, Physique-Chimie, SNT, Anglais, Espagnol, Italien). On en ajoute au fur et à mesure depuis un catalogue (Enseignement scientifique, Philosophie, HGGSP, NSI, HLP, LLCER…) ou en créant la sienne (nom, icône, couleur). Dans une matière, les fiches sont rangées par chapitre. Toucher le titre d'une fiche permet de changer sa matière, son chapitre ou son titre.
- **🔗 Sujets connexes** : sur chaque fiche, « Pour aller plus loin » propose une notion à revoir avant, des notions pour approfondir et des liens avec d'autres matières. Ils sont produits dans la même demande que le scan (aucun appel en plus). Toucher un sujet ouvre son explication et, si besoin, une mini-fiche (un petit appel, gardé ensuite). L'appli signale aussi les fiches de l'élève qui traitent de la même chose.
- **📅 Planning des contrôles** (onglet Planning) : on choisit la matière, la date (calendrier intégré, avec raccourcis « Demain », « Dans 1 semaine »…) et les chapitres. L'appli calcule un planning jour par jour calé sur les 3 paliers de chaque chapitre : d'abord relire les fiches et le QCM du chapitre (palier 1), puis les exercices d'application (palier 2), puis le défi (palier 3) ; les cartes tous les jours, un sujet blanc à mi-parcours pour les longues préparations, et la veille un sujet blanc type contrôle, un QCM bilan difficile et la relecture des points clés. Un palier validé disparaît des jours suivants, et l'écran du contrôle montre où en est chaque chapitre. On peut ajouter (QCM, sujet blanc, relecture, cartes, test final du chapitre) ou retirer des tâches pour chaque jour, et changer la date ou les chapitres à tout moment. Rappel chaque jour vers 18 h sur le téléphone ; après le contrôle, on note sa note. Aucun appel à Claude.
- **Deux tuteurs selon l'âge** (`src/tuteurs.js`) : Gribouille du collège à la Seconde, puis Atlas, un héros du savoir (masque, livre ouvert sur la poitrine), de la Première aux études supérieures. Choix automatique selon la classe, ou au choix de l'élève dans son profil. Atlas est dessiné dans un style de jeu mobile (grosse tête, contour épais, ombres franches, gants et bottes massifs, sourcils expressifs) et a trois skins débloqués avec le niveau : Recrue (rare, niveau 1), Héros avec cape (épique, niveau 5), Légendaire en noir et or avec aura (niveau 10). Un nouveau skin est fêté à son déblocage ; le Profil montre les skins, y compris ceux à gagner. Chacun a son ton dans le chat : Gribouille chaleureux et drôle, Atlas motivant, direct et un peu épique.
- **Gribouille, le prof de poche** (`src/mascotte.js`) : une goutte d'encre bleue à lunettes, dessinée en SVG dans l'appli et animée (clin d'œil, coucou, saut de joie, balancement quand il réfléchit). Il accueille l'élève avec une phrase adaptée à sa journée (cartes à revoir, série, contrôle proche), réagit aux notes des QCM, tests et sujets, patiente pendant les chargements et incarne le prof dans le chat, avec un ton chaleureux et un brin d'humour.
- **Dose du jour** (`src/dose.js`) : l'appli ne montre jamais tout le stock de cartes en retard. Chaque jour, une petite dose (10, 15 ou 25 cartes au choix dans le Profil, environ 5 minutes ; +10 les 3 jours avant un contrôle), choisie par priorité : chapitres du prochain contrôle, cartes ratées, cartes les plus en retard, puis nouvelles cartes (8 au plus par jour, pour qu'une nouvelle fiche n'écrase pas tout). Le reste attend tranquillement les jours suivants. Dose finie : Gribouille dit qu'on peut s'arrêter là, avec 10 cartes bonus en option.
- **Côté jeu** (`src/jeu.js`) : chaque activité rapporte des gouttes d'encre (carte revue, QCM terminé, sans-faute, sujet rendu, exercice réussi, défi, question au prof, nouvelle fiche). Niveaux avec titres (Apprenti, Curieux, Studieux…), objectif du jour (30 gouttes), 3 quêtes du jour (+10 gouttes chacune), combo de bonnes réponses dans les QCM, graphique de la semaine et 18 badges (Premier scan, Mémoire d'éléphant, Sans faute, Semaine de feu, Copie modèle, Plume d'or, Au sommet, Fusée…). Gribouille fête chaque badge, niveau ou objectif atteint. Tout est synchronisé entre les appareils, sans double comptage. Pas de classement ni de pression : on se compare seulement à soi-même.
- **Sujets officiels et annales** : dans l'onglet Sujet, liens vers la Banque nationale de sujets, les sujets officiels du bac et du brevet, les annales du brevet sur Éduscol, l'APMEP (maths) et les épreuves pratiques de NSI. L'élève télécharge un sujet (ou photographie un devoir), l'importe en PDF ou en photos, et Révizz le transforme en sujet à remplir question par question, avec le barème officiel s'il est indiqué et le corrigé officiel s'il est fourni.
- **👤 Comptes élèves** (`src/compte.js`, `netlify/functions/compte.mjs`) : identifiant et mot de passe, sur le téléphone comme sur le site web. Tout le travail (fiches, cartes, QCM, sujets, contrôles, progrès, badges) est rattaché au compte et synchronisé. La création d'un compte demande le code famille (seule la famille peut créer des comptes et utiliser la clé Claude du site). Mots de passe jamais stockés (empreinte scrypt salée), jeton signé gardé sur l'appareil (120 jours), blocage de 15 minutes après 8 essais ratés. Changer de mot de passe déconnecte les autres appareils ; un parent peut réinitialiser un mot de passe oublié depuis l'Espace parent avec le code famille. Se déconnecter efface le travail de l'appareil (pratique sur un ordinateur partagé) après une dernière synchronisation. Plusieurs enfants peuvent avoir chacun leur compte. Le mode « code famille » sans compte reste possible.
- **🔄 Synchronisation automatique** (connexion « Code famille ») : le téléphone et le site web partagent les mêmes fiches, contrôles, progrès et matières. L'appli synchronise à l'ouverture, au retour dans l'appli et quelques secondes après chaque modification ; fiche par fiche, la version la plus récente gagne, et une fiche supprimée reste supprimée sur les autres appareils. Les données passent compressées par le site Netlify (fonction `netlify/functions/sync.mjs`, stockage Netlify Blobs), protégées par le code famille. La clé API et le code ne sont jamais envoyés dans les données. Réglages → Synchronisation pour la couper ou la lancer à la main.
- **💾 Sauvegarde dans un fichier** : un fichier de sauvegarde (sans la clé ni le code famille) à envoyer sur Drive depuis le menu de partage, et à reprendre sur un autre appareil ou sur le site web, en fusionnant (la version la plus récente de chaque fiche est gardée) ou en remplaçant tout.
- **🪜 Parcours en 3 paliers** (écran « Parcours » de chaque chapitre) :
  1. **Je sais** : cartes et QCM du chapitre. Validé quand 80 % des cartes ont été sues au moins une fois et qu'un QCM du chapitre atteint 16/20.
  2. **Je sais faire** : 3 exercices d'application adaptés à la matière (calcul, analyse de document, exploitation d'expérience, lecture de données…), chacun avec 3 coups de pouce progressifs et une correction pas à pas. Validé après 3 exercices réussis sans le 3e coup de pouce.
  3. **Je vais plus loin** : un défi dans une situation nouvelle, avec les critères d'évaluation visibles ; Claude lit la réponse, note sur 20 et valide si le raisonnement tient.
  Liens vers Lumni (vidéos et quiz) et, en maths, MathALÉA (exercices corrigés). Claude suit les attendus du programme officiel (Éduscol).
- **📈 Progrès par chapitre** : au début d'un chapitre, un test de départ de 10 questions sur tout le chapitre mesure d'où l'on part. À la fin, le test final reprend les mêmes questions dans un autre ordre, sans nouvel appel à Claude. Deux grandes barres « Avant / Après » et une courbe (départ, QCM d'entraînement, test final, ligne de la moyenne) montrent les progrès.

Les fiches restent sur l'appareil (et dans les sauvegardes). Les photos ne sont pas conservées : seul le texte est gardé.

## Interface

Navigation par onglets en bas de l'écran (Accueil, Matières, Scanner, Planning, Profil). Style sobre : cartes plates, listes groupées, une pastille de couleur et une icône au trait par matière (Lucide), police Plus Jakarta Sans intégrée à l'appli (fonctionne hors connexion), thème clair et sombre.

## Essayer sans clé : le mode démo

Au premier lancement, « Essayer la démo, sans clé » charge une fiche d'histoire d'exemple avec des réponses préparées à l'avance. Toutes les fonctions marchent, sans appel à Claude. En démo, scanner n'importe quelle photo donne une fiche de maths d'exemple. Se connecter dans les Réglages (code famille ou clé) quitte la démo et retire les exemples.

`npm run maquette` produit la même démo en une seule page web : `dist-maquette/revizz-maquette.html`.

## Installer l'APK sur le téléphone

1. Ouvrir l'onglet **Releases** du dépôt [AventumGroupe/revizz](https://github.com/AventumGroupe/revizz/releases) (ou **Actions** → dernière exécution → *Revizz-apk*).
2. Télécharger `Revizz.apk` depuis le téléphone, puis l'ouvrir.
3. Si Android le demande, autoriser « Installer des applis inconnues » pour le navigateur.

Chaque modification poussée sur la branche `main` recompile l'APK automatiquement (versions 1.1.x ; les 1.0.x venaient de l'ancien dépôt). La clé de signature est toujours la même : la nouvelle version s'installe par-dessus l'ancienne et garde les fiches.

## Mettre en ligne le site web et le serveur (parent, une fois)

Le site web et l'APK utilisent le même code. Netlify héberge le site **et** garde la clé Claude côté serveur : elle n'est plus sur le téléphone ni dans le navigateur. Chaque appareil se connecte avec un **code famille**.

1. **Clé Claude** : sur **platform.claude.com**, ajouter du crédit, créer une clé (*API Keys*) et **fixer une limite de dépense mensuelle** (*Limits*), par exemple 10 €.
2. **Netlify** : créer un compte gratuit sur **netlify.com** (« Sign up with GitHub »).
3. *Add new site* → *Import an existing project* → **GitHub** → autoriser l'accès au dépôt, puis le choisir. Branche : celle de Révizz. Les réglages de compilation sont lus dans `netlify.toml` : ne rien changer.
4. Avant de lancer, ou ensuite dans *Site configuration → Environment variables*, ajouter :
   - `ANTHROPIC_API_KEY` : la clé Claude (cocher « secret ») ;
   - `REVIZZ_CODE` : le code famille, au moins 12 caractères (ex. `fusee-bleue-cerisier-42`).
5. *Deploy*. Noter l'adresse du site (ex. `https://revizz-famille.netlify.app`, modifiable dans *Site configuration → Change site name*). Après un changement de variable, relancer un déploiement (*Deploys → Trigger deploy*).
6. **Dans l'appli** (APK et site) : ⚙️ Réglages → Espace parent → **Code famille** → adresse du site (préremplie sur le site web) + code → *Enregistrer* → *Tester la connexion*.
7. Facultatif : dans GitHub, *Settings → Secrets and variables → Actions → Variables*, créer `REVIZZ_SERVEUR` avec l'adresse du site : les prochains APK l'auront déjà remplie.

Le serveur (`netlify/edge-functions/claude.js`) refuse les appels sans le bon code famille, n'accepte que les modèles de l'appli et ne relaie que la création de messages. Pour changer le code, modifier `REVIZZ_CODE` dans Netlify, relancer un déploiement, puis le ressaisir sur chaque appareil.

**Option sans serveur** : Réglages → Espace parent → *Clé API (ancienne méthode)*. La clé est alors enregistrée sur l'appareil, et toute personne qui l'a en main peut la lire. Les versions précédentes de l'APK, qui utilisaient une clé, gardent ce mode après la mise à jour.

## Passer du téléphone au site web

Les fiches sont enregistrées sur chaque appareil. Pour retrouver sur le site les fiches du téléphone (ou l'inverse) :

1. Sur l'appareil qui a les fiches : Réglages → **Sauvegarder vers Drive** (sur le téléphone, choisir « Drive » dans le menu de partage ; sur le site, le fichier est téléchargé).
2. Sur l'autre appareil : Réglages → **Reprendre une sauvegarde** → choisir le fichier `revizz-sauvegarde-…json` → **Fusionner**.

L'accueil rappelle de sauvegarder quand la dernière sauvegarde a plus d'une semaine.

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

- **Photos imprimées à 1280 px** (environ 1 600 tokens par page) ; les cours manuscrits passent en 2400 px pour la précision, et la fiche est rédigée à partir du texte relu, sans renvoyer les photos.
- **Cours mis en cache** : le texte du cours est placé dans une partie fixe de la requête. Les QCM, sujets, cartes et questions au prof le relisent depuis le cache pendant 5 minutes, à 10 % du prix.
- **Pas de doublon** : seule la transcription sert de référence, la fiche résumé n'est plus renvoyée.
- **Réflexion dosée** : effort faible pour les QCM, les cartes et le prof ; moyen pour la lecture des photos, les sujets et les corrections.
- **Réponses courtes** : moins de cartes, mais plus précises, corrections limitées à 25 lignes, prof à 8 lignes, 10 derniers messages seulement.
- **Zéro appel quand c'est possible** : refaire le dernier QCM (questions et propositions mélangées), réviser les cartes ou relire un sujet ne consomme rien.
- **Compteur** dans les Réglages : demandes, tokens lus et écrits, part relue depuis le cache.

## Développement

```bash
git clone https://github.com/AventumGroupe/revizz && cd revizz
npm install
npm run dev            # version web sur http://localhost:5173
npm run android:apk    # compile l'APK (Android SDK requis), sortie : android/app/build/outputs/apk/debug/
```

Structure :

- `.github/workflows/apk.yml` : compilation et publication de l'APK.
- `src/claude.js` : tous les appels à l'API Claude (SDK officiel `@anthropic-ai/sdk`, réponses en streaming, sorties JSON structurées, repli automatique si un modèle refuse).
- `src/matieres.js` : catalogue des matières, « Mes matières » de l'élève, rattachement des anciennes fiches.
- `src/demo.js` : contenu et réponses du mode démo.
- `src/image.js` : nettoyage des photos, définition selon le type de document, zoom.
- `src/icons.js` : icônes de l'interface.
- `src/scanner.js` : scanner plein écran en rafale (caméra en direct).
- `src/sauvegarde.js` : fichier de sauvegarde, reprise par fusion ou remplacement, fusion de deux appareils.
- `src/synchro.js` et `netlify/functions/sync.mjs` : synchronisation automatique par le site Netlify.
- `src/compte.js`, `netlify/functions/compte.mjs`, `netlify/shared/jeton.mjs` : comptes élèves et jetons de connexion.
- `src/paliers.js` : règles de validation des 3 paliers.
- `src/controles.js` : mode « J'ai un contrôle » (planning et rappels).
- `netlify/edge-functions/claude.js` et `netlify.toml` : site web et relais vers Claude (clé côté serveur, code famille).
- `src/store.js` : stockage local, répétition espacée (boîtes de Leitner), série de jours.
- `src/main.js` : les écrans.
- `android/` : projet Android natif (Capacitor).
