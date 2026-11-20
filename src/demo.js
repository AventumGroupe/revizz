// Mode démo : contenu préparé à l'avance, sans appel à l'API Claude.
// Sert à découvrir l'appli avant de configurer une clé.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Simule une réponse qui s'écrit petit à petit.
async function simuler(texte, onProgress, duree = 2500) {
  const pas = 12;
  for (let i = 1; i <= pas; i++) {
    await wait(duree / pas);
    const n = Math.round((texte.length * i) / pas);
    onProgress?.(n, texte.slice(0, n));
  }
  return texte;
}

// ---------- Cours n°1 : Histoire, déjà présent au démarrage ----------
const HISTOIRE = {
  demoKey: "histoire",
  titre: "La Révolution française (1789-1799)",
  matiere: "Histoire-Géographie",
  chapitre: "La Révolution et l'Empire",
  transcription: `## La Révolution française
### I. 1789 : la fin de la monarchie absolue
En 1789, la France est en crise : les caisses de l'État sont vides et le tiers état paie presque tous les impôts. Louis XVI convoque les **États généraux** (5 mai 1789).
Le 20 juin, les députés du tiers état prêtent le **serment du Jeu de paume** : ils jurent de donner une Constitution à la France.
Le **14 juillet 1789**, le peuple de Paris prend la **Bastille**, symbole du pouvoir absolu du roi.
La nuit du **4 août**, les privilèges sont abolis. Le **26 août**, l'Assemblée vote la **Déclaration des droits de l'homme et du citoyen** (DDHC).

### II. De la monarchie constitutionnelle à la République
La Constitution de **1791** crée une monarchie constitutionnelle : le roi partage le pouvoir avec une Assemblée élue.
Le roi tente de fuir (Varennes, juin 1791) et perd la confiance du peuple. La royauté est abolie le **21 septembre 1792** : c'est la **Ire République**.
Louis XVI est guillotiné le **21 janvier 1793**.

### III. La Terreur puis le Directoire
Menacée par la guerre et les révoltes, la République met en place la **Terreur** (1793-1794) avec Robespierre et le Comité de salut public.
En 1799, le général **Napoléon Bonaparte** prend le pouvoir par un coup d'État (18 brumaire).`,
  resume: `## L'essentiel en 5 étapes
1. **5 mai 1789** : ouverture des **États généraux**.
2. **20 juin 1789** : **serment du Jeu de paume** → le tiers état veut une Constitution.
3. **14 juillet 1789** : **prise de la Bastille**.
4. **4 août 1789** : abolition des **privilèges** ; **26 août** : **DDHC**.
5. **21 septembre 1792** : abolition de la royauté → **Ire République**.

## Les idées nouvelles
- **Souveraineté nationale** : le pouvoir vient de la nation, plus du roi.
- **Égalité en droits** : fin des trois ordres (clergé, noblesse, tiers état).
- **Séparation des pouvoirs** : faire les lois, les appliquer et juger ne sont plus entre les mêmes mains.

## Une révolution violente
- **1793-1794 : la Terreur**, Robespierre fait arrêter et exécuter les « suspects ».
- **1799** : Bonaparte prend le pouvoir (coup d'État du **18 brumaire**).

> Phrase à savoir dire : « La Révolution remplace la monarchie absolue de droit divin par un pouvoir qui vient de la nation. »`,
  points_cles: [
    "La Révolution commence en 1789 à cause d'une crise financière et des inégalités entre les trois ordres.",
    "Le 14 juillet 1789, la prise de la Bastille devient le symbole de la fin de l'absolutisme.",
    "La DDHC (26 août 1789) affirme la liberté, l'égalité en droits et la souveraineté nationale.",
    "La France devient une monarchie constitutionnelle en 1791, puis une République en septembre 1792.",
    "La Terreur (1793-1794) est une période de violence pour défendre la République.",
    "En 1799, Napoléon Bonaparte met fin à la Révolution par un coup d'État.",
  ],
  vocabulaire: [
    { terme: "Monarchie absolue", definition: "Le roi a tous les pouvoirs, qu'il dit tenir de Dieu." },
    { terme: "Tiers état", definition: "Ceux qui ne sont ni nobles ni membres du clergé : environ 98 % de la population." },
    { terme: "Privilèges", definition: "Avantages réservés au clergé et à la noblesse (ne pas payer certains impôts, par exemple)." },
    { terme: "Constitution", definition: "Texte qui fixe l'organisation des pouvoirs dans un pays." },
    { terme: "Souveraineté nationale", definition: "Principe selon lequel le pouvoir appartient à la nation, c'est-à-dire aux citoyens." },
    { terme: "République", definition: "Régime politique sans roi, où les dirigeants sont choisis par les citoyens." },
  ],
  connexes: [
    { titre: "La société d'Ancien Régime et ses trois ordres", type: "prerequis", matiere: "Histoire-Géographie", pourquoi: "Pour comprendre ce que la Révolution renverse en 1789." },
    { titre: "Les Lumières (Montesquieu, Rousseau, Voltaire)", type: "approfondissement", matiere: "Histoire-Géographie", pourquoi: "Leurs idées inspirent la DDHC et la séparation des pouvoirs." },
    { titre: "Napoléon et l'Empire (1799-1815)", type: "approfondissement", matiere: "Histoire-Géographie", pourquoi: "La suite directe : ce que Bonaparte garde ou abandonne de la Révolution." },
    { titre: "Citoyenneté et droits de l'homme", type: "autre_matiere", matiere: "EMC", pourquoi: "La DDHC fait toujours partie de la Constitution française d'aujourd'hui." },
  ],
  astuce_memo: "« 89, la Bastille tombe ; 91, le roi accepte la Constitution ; 92, on passe à la République. » Les années vont de 2 en 2 : 89 → 91 → 92 (presque !).",
  flashcards: [
    { recto: "À quelle date s'ouvrent les États généraux convoqués par Louis XVI ?", verso: "Le 5 mai 1789, à Versailles." },
    { recto: "Qu'est-ce que le serment du Jeu de paume ?", verso: "Le 20 juin 1789, les députés du tiers état jurent de ne pas se séparer avant d'avoir donné une Constitution à la France." },
    { recto: "À quelle date le peuple de Paris prend-il la Bastille ?", verso: "Le 14 juillet 1789." },
    { recto: "Que se passe-t-il la nuit du 4 août 1789 ?", verso: "L'abolition des privilèges." },
    { recto: "Que signifie DDHC et quand est-elle votée ?", verso: "Déclaration des droits de l'homme et du citoyen, le 26 août 1789." },
    { recto: "Quels sont les trois ordres de la société ?", verso: "Le clergé, la noblesse et le tiers état." },
    { recto: "Quel régime crée la Constitution de 1791 ?", verso: "Une monarchie constitutionnelle." },
    { recto: "À quelle date la royauté est-elle abolie en France ?", verso: "Le 21 septembre 1792 : début de la Ire République." },
    { recto: "À quelle date Louis XVI est-il guillotiné ?", verso: "Le 21 janvier 1793." },
    { recto: "Qu'est-ce que la Terreur ?", verso: "Période de 1793 à 1794 où le gouvernement révolutionnaire (Robespierre) fait arrêter et exécuter les opposants." },
    { recto: "Qui prend le pouvoir en 1799 et comment ?", verso: "Napoléon Bonaparte, par le coup d'État du 18 brumaire." },
    { recto: "Que signifie le principe de souveraineté nationale affirmé en 1789 ?", verso: "Le pouvoir appartient à la nation (aux citoyens) et non plus au roi." },
    { recto: "Que dit l'article 1 de la DDHC ?", verso: "« Les hommes naissent et demeurent libres et égaux en droits. »" },
    { recto: "Pourquoi la Bastille est-elle un symbole ?", verso: "C'était une prison royale, symbole du pouvoir absolu du roi." },
  ],
};

const QCM_HISTOIRE = [
  { n: "facile", question: "En quelle année commence la Révolution française ?", choix: ["1789", "1799", "1815", "1848"], bonne_reponse: 0, explication: "La Révolution commence en 1789 avec la réunion des États généraux." },
  { n: "facile", question: "Que prend le peuple de Paris le 14 juillet 1789 ?", choix: ["Le château de Versailles", "La Bastille", "Le Louvre", "L'Hôtel de Ville"], bonne_reponse: 1, explication: "La Bastille était une prison royale, symbole du pouvoir absolu." },
  { n: "facile", question: "Que signifie DDHC ?", choix: ["Décret des droits et des charges", "Déclaration des devoirs du citoyen", "Déclaration des droits de l'homme et du citoyen", "Discours du dauphin sur l'histoire civile"], bonne_reponse: 2, explication: "Votée le 26 août 1789, elle affirme liberté et égalité en droits." },
  { n: "facile", question: "Quel ordre regroupe environ 98 % de la population ?", choix: ["La noblesse", "Le clergé", "Le tiers état", "La bourgeoisie royale"], bonne_reponse: 2, explication: "Le tiers état regroupe tous ceux qui ne sont ni nobles ni religieux." },
  { n: "facile", question: "Quel roi règne en France en 1789 ?", choix: ["Louis XIV", "Louis XV", "Louis XVI", "Napoléon Ier"], bonne_reponse: 2, explication: "Louis XVI règne de 1774 jusqu'à la chute de la monarchie en 1792." },
  { n: "moyen", question: "Que décident les députés lors du serment du Jeu de paume ?", choix: ["De voter la mort du roi", "De ne pas se séparer avant d'avoir donné une Constitution à la France", "D'abolir l'esclavage", "De déclarer la guerre à l'Autriche"], bonne_reponse: 1, explication: "Le 20 juin 1789, ils affirment que la nation doit avoir une Constitution." },
  { n: "moyen", question: "Que se passe-t-il la nuit du 4 août 1789 ?", choix: ["La prise des Tuileries", "La fuite du roi", "L'abolition des privilèges", "Le vote de la Constitution"], bonne_reponse: 2, explication: "Les députés abolissent les privilèges de la noblesse et du clergé." },
  { n: "moyen", question: "Quel régime la Constitution de 1791 met-elle en place ?", choix: ["Une République", "Une monarchie constitutionnelle", "Un Empire", "Une monarchie absolue"], bonne_reponse: 1, explication: "Le roi garde un rôle mais partage le pouvoir avec une Assemblée élue." },
  { n: "moyen", question: "Quand la royauté est-elle abolie ?", choix: ["14 juillet 1789", "21 septembre 1792", "21 janvier 1793", "2 décembre 1804"], bonne_reponse: 1, explication: "Le 21 septembre 1792, la royauté est abolie : la Ire République commence." },
  { n: "moyen", question: "Quel principe dit que le pouvoir appartient à la nation ?", choix: ["Le droit divin", "La séparation des pouvoirs", "La souveraineté nationale", "L'égalité fiscale"], bonne_reponse: 2, explication: "La souveraineté nationale remplace le pouvoir de droit divin du roi." },
  { n: "difficile", question: "Pourquoi la fuite à Varennes (1791) est-elle importante ?", choix: ["Le roi y signe la paix", "Le roi perd la confiance du peuple", "Elle déclenche la prise de la Bastille", "Elle met fin à la Terreur"], bonne_reponse: 1, explication: "En fuyant, Louis XVI montre qu'il refuse la Révolution : beaucoup ne lui font plus confiance." },
  { n: "difficile", question: "Qui dirige le Comité de salut public pendant la Terreur ?", choix: ["Danton", "Robespierre", "La Fayette", "Bonaparte"], bonne_reponse: 1, explication: "Robespierre est la figure principale de la Terreur (1793-1794)." },
  { n: "difficile", question: "Quel événement met fin à la Révolution en 1799 ?", choix: ["La bataille de Waterloo", "Le sacre de Napoléon", "Le coup d'État du 18 brumaire", "La mort de Robespierre"], bonne_reponse: 2, explication: "Bonaparte prend le pouvoir par la force le 18 brumaire an VIII." },
  { n: "difficile", question: "Quelle phrase vient de l'article 1 de la DDHC ?", choix: ["« L'État, c'est moi »", "« Liberté, Égalité, Fraternité »", "« Les hommes naissent et demeurent libres et égaux en droits »", "« La loi est l'expression de la volonté du roi »"], bonne_reponse: 2, explication: "C'est l'article 1. « Liberté, Égalité, Fraternité » est une devise, pas un article." },
  { n: "difficile", question: "Dans quel ordre ces événements se sont-ils produits ?", choix: ["Bastille → DDHC → République → Terreur", "DDHC → Bastille → Terreur → République", "République → Bastille → DDHC → Terreur", "Bastille → République → DDHC → Terreur"], bonne_reponse: 0, explication: "Juillet 1789, août 1789, septembre 1792, puis 1793-1794." },
];

const SUJET_HISTOIRE = {
  sujet: `## Exercice 1 : Repères (4 points)
Associe chaque date à l'événement qui correspond :
- 14 juillet 1789 · 26 août 1789 · 21 septembre 1792 · 21 janvier 1793
- Exécution de Louis XVI · Abolition de la royauté · Prise de la Bastille · Vote de la DDHC

## Exercice 2 : Vocabulaire (4 points)
Définis en une phrase : **tiers état**, **privilèges**, **souveraineté nationale**, **Constitution**.

## Exercice 3 : Analyse de document (6 points)
> « Art. 1. Les hommes naissent et demeurent libres et égaux en droits. Les distinctions sociales ne peuvent être fondées que sur l'utilité commune. »
> *Déclaration des droits de l'homme et du citoyen, 26 août 1789*

1. Présente le document (nature, date, auteur).
2. Quelles idées nouvelles cet article affirme-t-il ?
3. En quoi s'oppose-t-il à la société d'Ancien Régime ?

## Exercice 4 : Développement construit (6 points)
En une quinzaine de lignes, raconte comment la France passe de la monarchie absolue à la République entre 1789 et 1792.`,
  corrige: `## Exercice 1
14 juillet 1789 → prise de la Bastille · 26 août 1789 → DDHC · 21 septembre 1792 → abolition de la royauté · 21 janvier 1793 → exécution de Louis XVI. *(1 point par bonne association)*

## Exercice 2
- **Tiers état** : ceux qui ne sont ni nobles ni membres du clergé, environ 98 % de la population.
- **Privilèges** : avantages réservés à la noblesse et au clergé.
- **Souveraineté nationale** : le pouvoir appartient à la nation.
- **Constitution** : texte qui organise les pouvoirs d'un pays.

## Exercice 3
1. Texte juridique, voté par l'Assemblée nationale constituante le 26 août 1789.
2. La **liberté** et l'**égalité en droits** de tous les hommes.
3. Sous l'Ancien Régime, la société est divisée en **trois ordres inégaux** et les privilégiés ont des droits que le tiers état n'a pas.

## Exercice 4 : plan attendu
- **Introduction** : en 1789, la France est une monarchie absolue en crise.
- **1789** : États généraux, serment du Jeu de paume, prise de la Bastille, abolition des privilèges, DDHC.
- **1791** : monarchie constitutionnelle ; fuite à Varennes.
- **1792** : chute de la royauté le 21 septembre, la République est proclamée.
- **Conclusion** : en trois ans, le pouvoir passe du roi à la nation.

 *Erreur fréquente : confondre la prise de la Bastille (1789) et la proclamation de la République (1792).*`,
  motsCles: ["1789", "bastille", "jeu de paume", "privilège", "ddhc", "déclaration", "constitution", "1791", "varennes", "1792", "république", "nation", "égalité", "tiers"],
};

// ---------- Cours n°2 : Maths, obtenu en « scannant » en mode démo ----------
const MATHS = {
  demoKey: "maths",
  titre: "Le théorème de Pythagore",
  matiere: "Mathématiques",
  chapitre: "Triangles rectangles",
  transcription: `## Théorème de Pythagore
**Propriété** : si un triangle est rectangle, alors le carré de la longueur de l'hypoténuse est égal à la somme des carrés des longueurs des deux autres côtés.
Si ABC est rectangle en A, alors **BC² = AB² + AC²**.

**Exemple** : ABC rectangle en A, AB = 3 cm, AC = 4 cm.
BC² = 3² + 4² = 9 + 16 = 25, donc BC = √25 = 5 cm.

## Réciproque
Si dans un triangle, le carré du plus grand côté est égal à la somme des carrés des deux autres côtés, alors ce triangle est rectangle.

## Contraposée
Si BC² ≠ AB² + AC² (BC étant le plus grand côté), alors le triangle **n'est pas** rectangle.`,
  resume: `## À savoir par cœur
- L'**hypoténuse** est le côté opposé à l'angle droit : c'est **le plus grand côté**.
- **Théorème** : ABC rectangle en A ⟹ **BC² = AB² + AC²**.

## Les 3 utilisations
| Je veux… | J'utilise… |
|---|---|
| Calculer une longueur | le **théorème** |
| Prouver qu'un triangle est rectangle | la **réciproque** |
| Prouver qu'il n'est pas rectangle | la **contraposée** |

## Méthode pour calculer l'hypoténuse
1. J'écris : « Le triangle ABC est rectangle en A, d'après le théorème de Pythagore : »
2. BC² = AB² + AC²
3. Je remplace par les valeurs et je calcule.
4. BC = √(résultat).

## Calculer un autre côté
**AB² = BC² − AC²** : on part toujours du carré de l'hypoténuse et on enlève l'autre carré.`,
  points_cles: [
    "L'hypoténuse est le côté opposé à l'angle droit, c'est toujours le plus grand côté.",
    "Dans un triangle rectangle en A : BC² = AB² + AC².",
    "Pour trouver un petit côté, on soustrait : AB² = BC² − AC².",
    "La réciproque sert à prouver qu'un triangle est rectangle.",
    "On compare toujours le carré du plus grand côté avec la somme des deux autres carrés.",
  ],
  vocabulaire: [
    { terme: "Hypoténuse", definition: "Côté opposé à l'angle droit dans un triangle rectangle." },
    { terme: "Carré d'un nombre", definition: "Le nombre multiplié par lui-même : 5² = 5 × 5 = 25." },
    { terme: "Racine carrée", definition: "√25 = 5 car 5² = 25." },
    { terme: "Réciproque", definition: "Propriété qui « inverse » le théorème : on part des longueurs pour prouver l'angle droit." },
  ],
  connexes: [
    { titre: "Carrés et racines carrées", type: "prerequis", matiere: "Mathématiques", pourquoi: "Le théorème s'écrit avec des carrés et se termine par une racine carrée." },
    { titre: "Le cosinus dans le triangle rectangle", type: "approfondissement", matiere: "Mathématiques", pourquoi: "L'autre grand outil du triangle rectangle, pour calculer des angles." },
    { titre: "Distance entre deux points dans un repère", type: "approfondissement", matiere: "Mathématiques", pourquoi: "En Seconde, la formule de la distance vient directement de Pythagore." },
    { titre: "Le plan incliné et la décomposition des forces", type: "autre_matiere", matiere: "Physique-Chimie", pourquoi: "On y retrouve des triangles rectangles pour calculer des forces." },
  ],
  astuce_memo: "Triplets à connaître par cœur : 3-4-5, 6-8-10 et 5-12-13. Ils donnent toujours un triangle rectangle.",
  flashcards: [
    { recto: "Qu'est-ce que l'hypoténuse ?", verso: "Le côté opposé à l'angle droit, le plus grand côté du triangle rectangle." },
    { recto: "Énoncé du théorème de Pythagore (ABC rectangle en A) ?", verso: "BC² = AB² + AC²" },
    { recto: "ABC rectangle en A, AB = 3, AC = 4. BC = ?", verso: "BC² = 9 + 16 = 25, donc BC = 5." },
    { recto: "À quoi sert la réciproque du théorème de Pythagore ?", verso: "À prouver qu'un triangle est rectangle." },
    { recto: "ABC est rectangle en A : comment calculer le côté AB si l'on connaît BC et AC ?", verso: "On soustrait : AB² = BC² − AC², puis AB = √(BC² − AC²)." },
    { recto: "Quelle est la racine carrée de 49 ?", verso: "√49 = 7, car 7² = 49." },
    { recto: "Un triangle de côtés 6, 8 et 10 est-il rectangle ?", verso: "Oui : 10² = 100 et 6² + 8² = 36 + 64 = 100." },
    { recto: "Un triangle de côtés 4, 5 et 6 est-il rectangle ?", verso: "Non : 6² = 36 alors que 4² + 5² = 41." },
    { recto: "À quoi sert la contraposée du théorème de Pythagore ?", verso: "À prouver qu'un triangle n'est pas rectangle." },
    { recto: "Dans l'égalité de Pythagore, quel côté est seul d'un côté du signe = ?", verso: "L'hypoténuse, le plus grand côté : BC² = AB² + AC²." },
  ],
};

const QCM_MATHS = [
  { n: "facile", question: "Dans un triangle rectangle, l'hypoténuse est…", choix: ["le plus petit côté", "le côté opposé à l'angle droit", "la hauteur", "un des côtés de l'angle droit"], bonne_reponse: 1, explication: "C'est aussi toujours le plus grand côté." },
  { n: "facile", question: "ABC est rectangle en A. Quelle égalité est vraie ?", choix: ["AB² = BC² + AC²", "AC² = AB² + BC²", "BC² = AB² + AC²", "BC = AB + AC"], bonne_reponse: 2, explication: "L'hypoténuse est BC, le côté opposé à A." },
  { n: "facile", question: "Combien vaut 7² ?", choix: ["14", "49", "77", "21"], bonne_reponse: 1, explication: "7² = 7 × 7 = 49." },
  { n: "facile", question: "Combien vaut √81 ?", choix: ["9", "40,5", "8", "18"], bonne_reponse: 0, explication: "9 × 9 = 81." },
  { n: "moyen", question: "ABC rectangle en A, AB = 6 cm, AC = 8 cm. BC = ?", choix: ["14 cm", "10 cm", "48 cm", "7 cm"], bonne_reponse: 1, explication: "BC² = 36 + 64 = 100, donc BC = 10 cm." },
  { n: "moyen", question: "ABC rectangle en A, BC = 13 cm, AB = 5 cm. AC = ?", choix: ["8 cm", "18 cm", "12 cm", "√194 cm"], bonne_reponse: 2, explication: "AC² = 169 − 25 = 144, donc AC = 12 cm." },
  { n: "moyen", question: "Un triangle a pour côtés 9, 12 et 15. Il est…", choix: ["rectangle", "équilatéral", "non rectangle", "isocèle"], bonne_reponse: 0, explication: "15² = 225 et 9² + 12² = 81 + 144 = 225 : il est rectangle (réciproque)." },
  { n: "moyen", question: "Pour prouver qu'un triangle n'est PAS rectangle, j'utilise…", choix: ["le théorème", "la réciproque", "la contraposée", "Thalès"], bonne_reponse: 2, explication: "La contraposée : si l'égalité est fausse, le triangle n'est pas rectangle." },
  { n: "difficile", question: "Un triangle a pour côtés 7, 8 et 11. Est-il rectangle ?", choix: ["Oui, car 7 + 8 > 11", "Non, car 11² = 121 ≠ 49 + 64 = 113", "Oui, car 121 = 113", "On ne peut pas savoir"], bonne_reponse: 1, explication: "On compare le carré du plus grand côté avec la somme des deux autres carrés." },
  { n: "difficile", question: "Une échelle de 5 m est posée contre un mur, son pied est à 3 m du mur. À quelle hauteur touche-t-elle le mur ?", choix: ["2 m", "4 m", "8 m", "√34 m"], bonne_reponse: 1, explication: "h² = 5² − 3² = 25 − 9 = 16, donc h = 4 m." },
  { n: "difficile", question: "La diagonale d'un carré de côté 1 mesure…", choix: ["2", "1", "√2", "√1"], bonne_reponse: 2, explication: "d² = 1² + 1² = 2, donc d = √2 ≈ 1,41." },
];

const SUJET_MATHS = {
  sujet: `## Exercice 1 (5 points)
ABC est un triangle rectangle en A tel que AB = 9 cm et AC = 12 cm.
Calcule la longueur BC. Rédige ta réponse.

## Exercice 2 (5 points)
EFG est un triangle rectangle en E tel que FG = 17 cm et EF = 8 cm.
Calcule EG.

## Exercice 3 (5 points)
Le triangle RST a pour côtés RS = 20 cm, ST = 21 cm et RT = 29 cm. Est-il rectangle ? Justifie.

## Exercice 4 : problème (5 points)
Une télévision a un écran de 80 cm de large et 60 cm de haut. On mesure la taille d'un écran par sa diagonale. Calcule-la en centimètres.`,
  corrige: `## Exercice 1
ABC est rectangle en A, donc d'après le théorème de Pythagore : BC² = AB² + AC² = 81 + 144 = 225, donc **BC = 15 cm**.

## Exercice 2
EFG est rectangle en E : FG² = EF² + EG², donc EG² = 289 − 64 = 225 et **EG = 15 cm**.

## Exercice 3
Le plus grand côté est RT : RT² = 841. RS² + ST² = 400 + 441 = 841. L'égalité est vraie, donc d'après la réciproque du théorème de Pythagore, **RST est rectangle en S**.

## Exercice 4
d² = 80² + 60² = 6 400 + 3 600 = 10 000, donc **d = 100 cm**.

 *Erreur fréquente : additionner les longueurs au lieu des carrés.*`,
  motsCles: ["pythagore", "rectangle", "225", "15", "réciproque", "841", "100", "²"],
};

const CONTENUS = {
  histoire: { fiche: HISTOIRE, qcm: QCM_HISTOIRE, sujet: SUJET_HISTOIRE },
  maths: { fiche: MATHS, qcm: QCM_MATHS, sujet: SUJET_MATHS },
};
const contenu = (fiche) => CONTENUS[fiche.demoKey] || CONTENUS.histoire;

// ---------- Fonctions qui imitent claude.js ----------

// Questions du test de départ déjà fait dans la démo (pour montrer le graphique de progrès).
export const questionsDepartDemo = () => QCM_HISTOIRE.filter((q) => q.n !== "difficile").slice(0, 10).map(({ n, ...q }) => q);

export function ficheDeDepart() {
  return HISTOIRE;
}

// Lecture simulée : quelques « zooms », puis un texte avec deux passages incertains pour montrer la relecture.
export async function transcrire(_pages, _opts, onProgress, onZoom) {
  for (let z = 1; z <= 3; z++) {
    await wait(700);
    onZoom?.(z);
  }
  const texte = MATHS.transcription
    .replace("Si ABC est rectangle en A", "Si ABC est rectangle en [?A]")
    .replace("**Exemple** :", "**Exemple** ([illisible]) :");
  return simuler(texte, onProgress, 2500);
}
export async function creerFiche(_transcription, _opts, onProgress) {
  await simuler("x".repeat(6000), onProgress, 3500);
  const { transcription, ...reste } = MATHS;
  return reste;
}

export async function genererQCM(fiche, niveau, nombre, dejaPosees, onProgress) {
  await simuler("x".repeat(2500), onProgress, 2200);
  const pool = contenu(fiche).qcm;
  const ordre = { facile: ["facile", "moyen", "difficile"], moyen: ["moyen", "facile", "difficile"], difficile: ["difficile", "moyen", "facile"] }[niveau];
  const neuves = pool.filter((q) => !dejaPosees.includes(q.question));
  const source = neuves.length >= Math.min(nombre, pool.length) ? neuves : pool;
  const tri = [...source].sort((a, b) => ordre.indexOf(a.n) - ordre.indexOf(b.n) || Math.random() - 0.5);
  return tri.slice(0, nombre).sort(() => Math.random() - 0.5);
}

const TITRES = {
  controle: ["Contrôle", "50 min"],
  express: ["Interro express", "10 min"],
  brevet: ["Sujet type Brevet", "1 h"],
  bac: ["Sujet type Bac", "2 h"],
  oral: ["Préparation à l'oral", "10 min de présentation"],
};
// Sujets structurés question par question (démo).
const q = (enonce, points, competence, reponse_attendue, bareme, erreurs_frequentes) => ({ enonce, points, competence, reponse_attendue, bareme, erreurs_frequentes });
const SUJETS = {
  histoire: {
    consignes: "Réponds sous chaque question. Rédige des phrases complètes.",
    exercices: [
      { titre: "Repères", type_exercice: "Repères et notions", methode: "", document: "", questions: [
        q("À quelle date le peuple de Paris prend-il la Bastille ?", 1, "Connaître", "Le **14 juillet 1789**.", [{ critere: "Date exacte", points: 1 }], "Confondre avec la fête nationale actuelle sans donner l'année."),
        q("À quelle date la royauté est-elle abolie ?", 1, "Connaître", "Le **21 septembre 1792**.", [{ critere: "Date exacte (jour, mois, année)", points: 1 }], "Répondre 1789 : c'est la prise de la Bastille."),
        q("Que signifie le sigle DDHC ?", 1, "Connaître", "Déclaration des droits de l'homme et du citoyen.", [{ critere: "Sigle développé sans erreur", points: 1 }], "Oublier « et du citoyen »."),
      ] },
      { titre: "L'article 1 de la DDHC", type_exercice: "Analyse de document(s)", methode: "Présente le document (nature, auteur, date, contexte). Relève les informations utiles et explique-les avec tes connaissances. Montre ce que le texte change par rapport à avant.", document: "> « Art. 1. Les hommes naissent et demeurent libres et égaux en droits. Les distinctions sociales ne peuvent être fondées que sur l'utilité commune. »\n> *Déclaration des droits de l'homme et du citoyen, 26 août 1789*", questions: [
        q("Présente le document : sa nature et sa date.", 2, "Analyser un document", "Un article d'un texte juridique, la DDHC, votée par l'Assemblée nationale constituante le 26 août 1789.", [{ critere: "Nature (texte juridique, déclaration)", points: 1 }, { critere: "Date et auteur (Assemblée, 26 août 1789)", points: 1 }], "Ne donner que la date."),
        q("Quelle idée nouvelle cet article affirme-t-il ?", 3, "Analyser un document", "L'**égalité en droits** et la **liberté** de tous les hommes, dès la naissance.", [{ critere: "Égalité en droits", points: 2 }, { critere: "Liberté", points: 1 }], "Paraphraser sans nommer l'idée."),
        q("En quoi cet article s'oppose-t-il à la société d'Ancien Régime ?", 4, "Argumenter", "Sous l'Ancien Régime, la société est divisée en **trois ordres inégaux** ; la noblesse et le clergé ont des **privilèges** de naissance. L'article met fin à ces distinctions : seules comptent l'utilité commune.", [{ critere: "Mention des trois ordres ou des privilèges", points: 2 }, { critere: "Lien explicite avec l'article (égalité contre privilèges)", points: 1.5 }, { critere: "Rédaction claire", points: 0.5 }], "Oublier de faire le lien avec le texte."),
      ] },
      { titre: "De la monarchie absolue à la République", type_exercice: "Réponse à une question problématisée", methode: "Introduction : définis les mots du sujet, situe dans le temps, pose la problématique et annonce ton plan. Développement : 2 ou 3 parties, chacune avec une idée expliquée et des exemples précis (dates, acteurs). Conclusion : réponds à la problématique.", document: "", questions: [
        q("Comment la France passe-t-elle de la monarchie absolue à la République entre 1789 et 1792 ?", 6, "Argumenter", "**Introduction** : monarchie absolue = le roi détient tous les pouvoirs ; République = régime sans roi. Problématique : comment le pouvoir du roi est-il remis en cause jusqu'à disparaître ? Plan en deux parties.\n\n**1. 1789 : la fin de la monarchie absolue.** États généraux, serment du Jeu de paume (20 juin), prise de la Bastille (14 juillet), abolition des privilèges (4 août), DDHC (26 août).\n\n**2. 1791-1792 : l'échec de la monarchie constitutionnelle.** Constitution de 1791, fuite à Varennes (juin 1791) qui fait perdre confiance au roi, guerre et prise des Tuileries (10 août 1792), abolition de la royauté (21 septembre 1792).\n\n**Conclusion** : en trois ans, la souveraineté passe du roi à la nation.", [{ critere: "Introduction : termes définis, problématique, annonce du plan", points: 1 }, { critere: "Organisation en parties, ordre logique", points: 1 }, { critere: "Connaissances et repères exacts (dates, acteurs, événements)", points: 2.5 }, { critere: "Notions employées (souveraineté, privilèges, constitution…)", points: 1 }, { critere: "Conclusion qui répond à la problématique", points: 0.5 }], "Raconter sans plan, ou oublier l'introduction et la problématique."),
      ] },
    ],
  },
  maths: {
    consignes: "Calculatrice autorisée. Justifie chaque réponse.",
    exercices: [
      { titre: "Calculs de longueurs", type_exercice: "Exercice", methode: "Écris les données, la propriété utilisée, les calculs, puis une phrase de conclusion avec l'unité.", document: "ABC est rectangle en A avec AB = 9 cm et AC = 12 cm.", questions: [
        q("Quel côté du triangle ABC est l'hypoténuse ?", 1, "Connaître", "[BC], le côté opposé à l'angle droit.", [{ critere: "Côté [BC] identifié", points: 1 }], "Choisir le plus long des côtés donnés."),
        q("Calcule BC en justifiant.", 4, "Calculer", "ABC est rectangle en A, donc d'après le théorème de Pythagore : BC² = 81 + 144 = 225, donc BC = 15 cm.", [{ critere: "Théorème cité avec l'angle droit", points: 1 }, { critere: "Égalité BC² = AB² + AC²", points: 1 }, { critere: "Calcul juste", points: 1 }, { critere: "BC = 15 cm avec l'unité", points: 1 }], "Additionner les longueurs au lieu des carrés."),
      ] },
      { titre: "Triangle rectangle ou non", type_exercice: "Exercice", methode: "Repère le plus grand côté, compare son carré à la somme des deux autres carrés, conclus avec la réciproque ou la contraposée.", document: "RST a pour côtés RS = 20 cm, ST = 21 cm et RT = 29 cm.", questions: [
        q("Le triangle RST est-il rectangle ? Justifie.", 5, "Raisonner", "RT² = 841 et RS² + ST² = 400 + 441 = 841 : l'égalité est vraie, donc d'après la réciproque du théorème de Pythagore, RST est rectangle en S.", [{ critere: "Plus grand côté identifié", points: 1 }, { critere: "Calculs justes", points: 2 }, { critere: "Réciproque citée", points: 1 }, { critere: "Conclusion (rectangle en S)", points: 1 }], "Utiliser le théorème au lieu de la réciproque."),
      ] },
      { titre: "Problème", type_exercice: "Problème", methode: "Fais un schéma, repère le triangle rectangle, calcule, puis réponds à la question posée par une phrase.", document: "Un écran mesure 80 cm de large et 60 cm de haut. On mesure sa taille par sa diagonale.", questions: [
        q("Calcule la diagonale de l'écran en centimètres.", 5, "Modéliser", "d² = 80² + 60² = 10 000, donc d = 100 cm.", [{ critere: "Triangle rectangle reconnu", points: 1 }, { critere: "Calcul de d²", points: 2 }, { critere: "d = 100 cm", points: 2 }], "Oublier la racine carrée."),
        q("Une étagère a une profondeur de 70 cm : l'écran posé à plat y entre-t-il sans dépasser ? Explique.", 3, "Raisonner", "Posé à plat, la largeur (80 cm) ou la hauteur (60 cm) est en profondeur : avec 60 cm en profondeur, il entre (60 < 70) ; avec 80 cm, il dépasse.", [{ critere: "Choix des bonnes dimensions", points: 1 }, { critere: "Comparaison avec 70 cm", points: 1 }, { critere: "Conclusion argumentée", points: 1 }], "Comparer la diagonale à la profondeur."),
      ] },
    ],
  },
};
export async function genererSujet(fiche, type, onProgress) {
  await simuler("x".repeat(5000), onProgress, 3500);
  const base = SUJETS[fiche.demoKey === "maths" ? "maths" : "histoire"];
  const [t, duree] = TITRES[type];
  const exercices = type === "express" ? base.exercices.slice(0, 1) : base.exercices;
  return { titre: `${t} : ${fiche.titre}`, duree, consignes: base.consignes, exercices };
}

// Correction simplifiée (démo) : on cherche les mots de la réponse attendue dans la copie.
export async function corrigerCopie(_fiche, sujet, reponses, onProgress) {
  await simuler("x".repeat(1500), onProgress, 2000);
  const questions = sujet.exercices.flatMap((e) => e.questions);
  const niveaux = ["très insuffisant", "insuffisant", "satisfaisant", "très satisfaisant"];
  const resultats = questions.map((qq, i) => {
    const mots = (qq.reponse_attendue.toLowerCase().match(/[a-zàâçéèêëîïôûùüÿ0-9]{4,}/g) || []).slice(0, 12);
    const rep = (reponses[i] || "").toLowerCase();
    const part = mots.length ? mots.filter((m) => rep.includes(m)).length / mots.length : 0;
    const ratio = /je ne sais pas/.test(rep) ? 0 : Math.min(1, part * 1.6);
    return {
      numero: i + 1,
      points_obtenus: Math.round(ratio * qq.points * 2) / 2,
      niveau: niveaux[Math.min(3, Math.floor(ratio * 4))],
      commentaire: ratio > 0.7 ? "Réponse complète et juste." : ratio > 0.3 ? "Réponse partielle : compare avec la réponse attendue." : "Il manque l'essentiel : relis la fiche sur ce point.",
    };
  });
  // Langue (démo) : on repère seulement les phrases sans majuscule ou sans point final.
  const redigees = reponses.filter((r) => r && r.trim().split(/\s+/).length >= 6);
  const fautives = redigees.filter((r) => !/^[A-ZÀ-Ý0-9«"]/.test(r.trim()) || !/[.!?»"]$/.test(r.trim()));
  const erreurs = fautives.slice(0, 3).map((r) => {
    const t = r.trim();
    return { extrait: t.slice(0, 60), correction: (t[0].toUpperCase() + t.slice(1)).replace(/[^.!?»"]$/, (c) => c + ".").slice(0, 61), regle: "Une phrase commence par une majuscule et se termine par un point." };
  });
  const niveau = !redigees.length || !fautives.length ? "très satisfaisant" : fautives.length < redigees.length / 2 ? "satisfaisant" : "insuffisant";
  return {
    questions: resultats,
    langue: { niveau, points_obtenus: { "très satisfaisant": 2, satisfaisant: 1.5, insuffisant: 1 }[niveau], commentaire: "Mode démo : seules la majuscule et la ponctuation sont vérifiées. Avec Claude, l'orthographe, la syntaxe et la clarté sont relues.", erreurs, defaillante: false },
    appreciation: "Mode démo : correction simplifiée par mots-clés. Avec Claude, chaque réponse est vraiment lue et notée selon le barème.",
    points_forts: ["Tu as répondu à toutes les questions."],
    a_travailler: ["Justifie chaque réponse avec le vocabulaire du cours."],
  };
}

export async function plusDeFlashcards(fiche, existantes, onProgress) {
  await simuler("x".repeat(1500), onProgress, 1500);
  const supp = fiche.demoKey === "maths"
    ? [{ recto: "Quel triplet de Pythagore commence par 5 ?", verso: "5-12-13, car 5² + 12² = 25 + 144 = 169 = 13²." }, { recto: "Quelle est la racine carrée de 144 ?", verso: "√144 = 12, car 12² = 144." }]
    : [{ recto: "Qui est Robespierre ?", verso: "Un révolutionnaire, principal dirigeant de la Terreur (1793-1794)." }, { recto: "Qu'est-ce que la fuite à Varennes ?", verso: "En juin 1791, Louis XVI tente de fuir la France ; il est arrêté à Varennes." }];
  return supp.filter((c) => !existantes.some((e) => e.recto === c.recto));
}

const REPONSES = [
  [/10 ans|simple|comprends pas|compris/i, (f) => f.demoKey === "maths"
    ? "Imagine une **échelle posée contre un mur**. Le mur et le sol forment un angle droit. L'échelle, c'est l'**hypoténuse**, le côté le plus long.\n\nPythagore a découvert une règle magique : si tu fais **carré du mur + carré du sol**, tu obtiens **le carré de l'échelle**.\n\n À toi : si le mur fait 3 et le sol 4, combien fait l'échelle ?"
    : "Imagine une classe où **le délégué décide de tout seul**, sans demander l'avis des élèves, et où certains élèves ne font jamais leurs devoirs mais ont les meilleures notes. C'était un peu la France avant 1789 : le **roi** décidait de tout et les **nobles** avaient des **privilèges**.\n\nEn 1789, le peuple dit « stop ! » : il veut que **tout le monde ait les mêmes droits** et que les lois soient décidées par des représentants élus.\n\n À toi : comment s'appellent ces avantages injustes des nobles ?"],
  [/3 choses|important|essentiel|retenir/i, (f) => f.demoKey === "maths"
    ? "Les 3 choses les plus importantes :\n1. L'**hypoténuse** est en face de l'angle droit (le plus grand côté).\n2. **BC² = AB² + AC²** quand le triangle est rectangle en A.\n3. La **réciproque** sert à prouver qu'un triangle est rectangle.\n\n Question : dans un triangle rectangle en E, quelle est l'hypoténuse de EFG ?"
    : "Les 3 choses les plus importantes :\n1. **14 juillet 1789** : prise de la Bastille, début symbolique de la Révolution.\n2. **26 août 1789** : la **DDHC** affirme la liberté et l'égalité en droits.\n3. **21 septembre 1792** : la royauté est abolie, la **République** commence.\n\n Question : que signifie DDHC ?"],
  [/exemple|concret/i, (f) => f.demoKey === "maths"
    ? "Un exemple concret : ta télé ! Un écran de **80 cm de large et 60 cm de haut** : sa diagonale vaut √(80² + 60²) = √10 000 = **100 cm**. C'est pour ça qu'on parle de « pouces » : c'est la diagonale qu'on mesure !"
    : "Exemple concret : avant 1789, un paysan payait la **taille** (un impôt) alors que le noble, son voisin, en était **exempté**. C'est ça un **privilège**. La nuit du **4 août 1789**, ces privilèges sont abolis : tout le monde doit payer selon ses moyens."],
  [/question|vérifie|teste|interroge/i, (f) => f.demoKey === "maths"
    ? "Allez, à toi !\n\nUn triangle a pour côtés **5 cm, 12 cm et 13 cm**. Est-il rectangle ? Explique comment tu fais."
    : "Allez, à toi !\n\n**Remets dans l'ordre** : République, prise de la Bastille, DDHC, Terreur."],
];
export async function discuter(fiche, history, onProgress) {
  const q = history[history.length - 1].content;
  const trouve = REPONSES.find(([re]) => re.test(q));
  const texte = trouve
    ? trouve[1](fiche)
    : `Bonne question ! En mode démo, je ne connais que quelques réponses préparées. Essaie un des boutons de suggestion.\n\nAvec une **clé API**, Claude répond vraiment à toutes tes questions sur « ${fiche.titre} ».`;
  return simuler(texte, onProgress, 1800);
}

export async function trouverConnexes(fiche, onProgress) {
  await simuler("x".repeat(800), onProgress, 1200);
  return contenu(fiche).fiche.connexes;
}

export async function miniFiche(fiche, connexe, onProgress) {
  const texte = `## ${connexe.titre}
**En bref :** voici une mini-fiche d'exemple. En mode démo, le contenu est préparé à l'avance.

- **Ce qu'il faut savoir :** l'essentiel tient en 3 ou 4 idées, avec les mots clés en gras.
- **Un exemple :** un cas concret pour fixer la notion.

 **Lien avec ton cours :** ${connexe.pourquoi}

*Avec une clé ou le code famille, Claude rédige une vraie mini-fiche sur ce sujet.*`;
  return simuler(texte, onProgress, 1500);
}

// ---------- Paliers 2 et 3 en démo ----------
const EXOS = {
  histoire: [
    { titre: "Situer les grandes dates", competence: "Se repérer dans le temps", enonce: "Classe dans l'ordre chronologique : abolition des privilèges, proclamation de la République, prise de la Bastille, exécution de Louis XVI. Donne la date de chacun.", indices: ["Commence par l'événement de l'été 1789 que l'on fête le 14 juillet.", "Deux événements ont lieu en 1789, un en 1792, un en 1793.", "14 juillet 1789 → 4 août 1789 → …"], etapes: [{ titre: "Les événements de 1789", explication: "**14 juillet 1789** : prise de la Bastille ; **4 août 1789** : abolition des privilèges." }, { titre: "La fin de la monarchie", explication: "**21 septembre 1792** : abolition de la royauté, puis **21 janvier 1793** : exécution de Louis XVI." }], reponse: "Bastille (14/07/1789) → privilèges (04/08/1789) → République (21/09/1792) → exécution (21/01/1793)" },
    { titre: "Analyser l'article 1 de la DDHC", competence: "Analyser un document", enonce: "> « Les hommes naissent et demeurent libres et égaux en droits. Les distinctions sociales ne peuvent être fondées que sur l'utilité commune. »\n\n1. Présente le document.\n2. Quelle idée remet-il en cause ?", indices: ["Nature, auteur, date : c'est un texte voté en août 1789.", "Pense à la société des trois ordres.", "Les privilèges de naissance de la noblesse et du clergé…"], etapes: [{ titre: "Présenter", explication: "Article 1 de la **Déclaration des droits de l'homme et du citoyen**, votée par l'Assemblée nationale le **26 août 1789**." }, { titre: "Interpréter", explication: "Il affirme l'**égalité en droits** et remet en cause la société d'ordres fondée sur les **privilèges de naissance**." }], reponse: "Texte juridique de 1789 qui met fin à l'inégalité des trois ordres." },
    { titre: "Expliquer un enchaînement", competence: "Expliquer", enonce: "Explique en 5 lignes pourquoi la fuite à Varennes (juin 1791) fragilise la monarchie constitutionnelle.", indices: ["Que cherchait à faire le roi en fuyant ?", "Pense à la confiance du peuple et des députés.", "Le roi semble refuser la Constitution qu'il a acceptée…"], etapes: [{ titre: "Le fait", explication: "Louis XVI tente de quitter la France et est arrêté à **Varennes**." }, { titre: "La conséquence", explication: "Il apparaît comme opposé à la Révolution : la **confiance** est rompue, l'idée de **République** progresse." }], reponse: "Le roi perd la confiance du peuple, ce qui prépare la chute de la monarchie en 1792." },
  ],
  maths: [
    { titre: "Calculer l'hypoténuse", competence: "Calculer une longueur", enonce: "ABC est rectangle en A, AB = 5 cm et AC = 12 cm. Calcule BC.", indices: ["Quel est le côté opposé à l'angle droit ?", "Théorème de Pythagore : BC² = AB² + AC².", "BC² = 25 + 144 = …"], etapes: [{ titre: "Identifier l'hypoténuse", explication: "L'angle droit est en A : l'hypoténuse est **[BC]**." }, { titre: "Appliquer le théorème", explication: "BC² = AB² + AC² = 25 + 144 = 169." }, { titre: "Conclure", explication: "BC = √169 = **13 cm**." }], reponse: "BC = 13 cm" },
    { titre: "Un côté de l'angle droit", competence: "Calculer une longueur", enonce: "EFG est rectangle en E, FG = 10 cm et EF = 6 cm. Calcule EG.", indices: ["Ici on connaît l'hypoténuse.", "EG² = FG² − EF².", "EG² = 100 − 36 = …"], etapes: [{ titre: "Écrire l'égalité", explication: "FG² = EF² + EG², donc EG² = FG² − EF²." }, { titre: "Calculer", explication: "EG² = 100 − 36 = 64, donc EG = **8 cm**." }], reponse: "EG = 8 cm" },
    { titre: "Rectangle ou pas ?", competence: "Raisonner", enonce: "Un triangle a pour côtés 7 cm, 24 cm et 25 cm. Est-il rectangle ? Justifie.", indices: ["Repère le plus grand côté.", "Compare son carré à la somme des deux autres carrés.", "25² = 625 et 7² + 24² = 49 + 576 = …"], etapes: [{ titre: "Comparer", explication: "25² = 625 ; 7² + 24² = 49 + 576 = 625." }, { titre: "Conclure avec la réciproque", explication: "L'égalité est vraie : d'après la **réciproque du théorème de Pythagore**, le triangle est rectangle." }], reponse: "Oui, il est rectangle." },
  ],
};
const DEFIS = {
  histoire: { titre: "Et si tu étais député en 1789 ?", situation: "Nous sommes en août 1789. Un député du tiers état te demande de l'aider à convaincre l'Assemblée d'abolir les privilèges.", consigne: "Rédige un court discours (10 lignes) avec trois arguments tirés du cours.", criteres: ["Trois arguments justes et différents", "Vocabulaire du chapitre (privilèges, tiers état, égalité…)", "Au moins un exemple précis"], pistes: ["Qui paie l'impôt ?", "Que proclame bientôt la DDHC ?"], corrige: "Arguments attendus : injustice fiscale (le tiers état paie presque tout), égalité en droits des hommes, utilité commune comme seul fondement des distinctions, poids du tiers état (98 % de la population)." },
  maths: { titre: "La télé passe-t-elle ?", situation: "Une famille veut acheter une télévision de 55 pouces (diagonale de 140 cm, format 16/9 : largeur 122 cm, hauteur 69 cm). Le meuble mesure 120 cm de large.", consigne: "La télé tient-elle sur le meuble sans dépasser ? Une télévision de 50 pouces (diagonale 127 cm) conviendrait-elle ? Justifie par des calculs.", criteres: ["Vérification de la largeur de la 55 pouces", "Calcul de la largeur de la 50 pouces avec Pythagore ou la proportionnalité", "Conclusion claire"], pistes: ["La largeur, la hauteur et la diagonale forment un triangle rectangle.", "Pour la 50 pouces, garde le format 16/9."], corrige: "122 cm > 120 cm : la 55 pouces dépasse. Pour la 50 pouces, coefficient 127/140 ≈ 0,907 : largeur ≈ 110,7 cm < 120 cm, elle convient." },
};
const cle = (fiche) => (fiche.demoKey === "maths" ? "maths" : "histoire");
export async function genererExercices(fiche, onProgress) {
  await simuler("x".repeat(3000), onProgress, 2500);
  return EXOS[cle(fiche)];
}
export async function genererDefi(fiche, onProgress) {
  await simuler("x".repeat(1500), onProgress, 2000);
  return DEFIS[cle(fiche)];
}
export async function evaluerDefi(_fiche, _defi, reponse, onProgress) {
  await simuler("x".repeat(800), onProgress, 1500);
  const longue = reponse.trim().split(/\s+/).length >= 30;
  return {
    valide: longue,
    note: longue ? 15 : 8,
    points_forts: longue ? ["Ton raisonnement suit les critères demandés.", "Tu utilises le vocabulaire du chapitre."] : ["Tu as commencé à répondre."],
    a_ameliorer: longue ? ["Ajoute un exemple chiffré ou daté pour convaincre."] : ["Développe davantage : au moins trois arguments ou étapes de calcul."],
    conseil: "Mode démo : évaluation simplifiée. Avec Claude, ta réponse est vraiment lue et corrigée.",
  };
}

export async function testerCle() {
  await wait(600);
  return "OK";
}
