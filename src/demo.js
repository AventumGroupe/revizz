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
  chapitre: "Chapitre 3 : la Révolution et l'Empire",
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

> 💬 Phrase à savoir dire : « La Révolution remplace la monarchie absolue de droit divin par un pouvoir qui vient de la nation. »`,
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

⚠️ *Erreur fréquente : confondre la prise de la Bastille (1789) et la proclamation de la République (1792).*`,
  motsCles: ["1789", "bastille", "jeu de paume", "privilège", "ddhc", "déclaration", "constitution", "1791", "varennes", "1792", "république", "nation", "égalité", "tiers"],
};

// ---------- Cours n°2 : Maths, obtenu en « scannant » en mode démo ----------
const MATHS = {
  demoKey: "maths",
  titre: "Le théorème de Pythagore",
  matiere: "Mathématiques",
  chapitre: "Géométrie : triangles rectangles",
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

⚠️ *Erreur fréquente : additionner les longueurs au lieu des carrés.*`,
  motsCles: ["pythagore", "rectangle", "225", "15", "réciproque", "841", "100", "²"],
};

const CONTENUS = {
  histoire: { fiche: HISTOIRE, qcm: QCM_HISTOIRE, sujet: SUJET_HISTOIRE },
  maths: { fiche: MATHS, qcm: QCM_MATHS, sujet: SUJET_MATHS },
};
const contenu = (fiche) => CONTENUS[fiche.demoKey] || CONTENUS.histoire;

// ---------- Fonctions qui imitent claude.js ----------

export function ficheDeDepart() {
  return HISTOIRE;
}

export async function analyserCours(_pages, _note, onProgress) {
  await simuler("x".repeat(9000), onProgress, 6000);
  return MATHS;
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
export async function genererSujet(fiche, type, onProgress) {
  await simuler("x".repeat(5000), onProgress, 3500);
  const s = contenu(fiche).sujet;
  const [t, duree] = TITRES[type];
  let sujet = s.sujet;
  if (type === "express") sujet = sujet.split("## Exercice 3")[0];
  if (type === "oral")
    sujet = `## Ta présentation orale\nPrésente « ${fiche.titre} » en 5 minutes devant le jury, sans lire tes notes.\n\n**Plan conseillé :**\n1. Une phrase d'accroche.\n2. Les notions essentielles (voir ta fiche).\n3. Un exemple précis.\n4. Une conclusion.\n\n**Questions possibles du jury :**\n${s.sujet.split("\n").filter((l) => l.startsWith("## ")).map((l) => "- " + l.replace("## ", "")).join("\n")}`;
  return { titre: `${t} : ${fiche.titre}`, duree, sujet, corrige: s.corrige };
}

export async function corrigerCopie(fiche, _sujet, reponse, onProgress) {
  const mots = contenu(fiche).sujet.motsCles;
  const txt = reponse.toLowerCase();
  const trouves = mots.filter((m) => txt.includes(m));
  const manquants = mots.filter((m) => !txt.includes(m));
  const longueur = Math.min(4, Math.floor(reponse.trim().split(/\s+/).length / 25));
  const note = Math.max(3, Math.min(19, 4 + trouves.length * 1.5 + longueur));
  const texte = `## Note : ${Math.round(note)}/20

### ✅ Ce qui est réussi
${trouves.length ? trouves.map((m) => `- Tu utilises bien la notion **${m}**.`).join("\n") : "- Tu as osé te lancer, c'est le plus important !"}

### ❌ Ce qui manque
${manquants.slice(0, 5).map((m) => `- Il manque **${m}** : regarde le corrigé.`).join("\n") || "- Presque rien, bravo !"}

### 💡 3 conseils
1. Commence chaque réponse par une phrase qui reprend la question.
2. Cite des dates ou des chiffres précis : ils rapportent des points.
3. Relis ta fiche « Résumé » puis refais le sujet demain sans regarder.

*Mode démo : cette correction est simplifiée. Avec une clé API, Claude lit vraiment ta copie.*`;
  return simuler(texte, onProgress, 2500);
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
    ? "Imagine une **échelle posée contre un mur** 🪜. Le mur et le sol forment un angle droit. L'échelle, c'est l'**hypoténuse**, le côté le plus long.\n\nPythagore a découvert une règle magique : si tu fais **carré du mur + carré du sol**, tu obtiens **le carré de l'échelle**.\n\n👉 À toi : si le mur fait 3 et le sol 4, combien fait l'échelle ?"
    : "Imagine une classe où **le délégué décide de tout seul**, sans demander l'avis des élèves, et où certains élèves ne font jamais leurs devoirs mais ont les meilleures notes 😤. C'était un peu la France avant 1789 : le **roi** décidait de tout et les **nobles** avaient des **privilèges**.\n\nEn 1789, le peuple dit « stop ! » : il veut que **tout le monde ait les mêmes droits** et que les lois soient décidées par des représentants élus.\n\n👉 À toi : comment s'appellent ces avantages injustes des nobles ?"],
  [/3 choses|important|essentiel|retenir/i, (f) => f.demoKey === "maths"
    ? "Les 3 choses les plus importantes :\n1. L'**hypoténuse** est en face de l'angle droit (le plus grand côté).\n2. **BC² = AB² + AC²** quand le triangle est rectangle en A.\n3. La **réciproque** sert à prouver qu'un triangle est rectangle.\n\n👉 Question : dans un triangle rectangle en E, quelle est l'hypoténuse de EFG ?"
    : "Les 3 choses les plus importantes :\n1. **14 juillet 1789** : prise de la Bastille, début symbolique de la Révolution.\n2. **26 août 1789** : la **DDHC** affirme la liberté et l'égalité en droits.\n3. **21 septembre 1792** : la royauté est abolie, la **République** commence.\n\n👉 Question : que signifie DDHC ?"],
  [/exemple|concret/i, (f) => f.demoKey === "maths"
    ? "Un exemple concret : ta télé 📺 ! Un écran de **80 cm de large et 60 cm de haut** : sa diagonale vaut √(80² + 60²) = √10 000 = **100 cm**. C'est pour ça qu'on parle de « pouces » : c'est la diagonale qu'on mesure !"
    : "Exemple concret : avant 1789, un paysan payait la **taille** (un impôt) alors que le noble, son voisin, en était **exempté**. C'est ça un **privilège**. La nuit du **4 août 1789**, ces privilèges sont abolis : tout le monde doit payer selon ses moyens."],
  [/question|vérifie|teste|interroge/i, (f) => f.demoKey === "maths"
    ? "Allez, à toi ! 🎯\n\nUn triangle a pour côtés **5 cm, 12 cm et 13 cm**. Est-il rectangle ? Explique comment tu fais."
    : "Allez, à toi ! 🎯\n\n**Remets dans l'ordre** : République, prise de la Bastille, DDHC, Terreur."],
];
export async function discuter(fiche, history, onProgress) {
  const q = history[history.length - 1].content;
  const trouve = REPONSES.find(([re]) => re.test(q));
  const texte = trouve
    ? trouve[1](fiche)
    : `Bonne question ! En mode démo, je ne connais que quelques réponses préparées. Essaie un des boutons de suggestion.\n\nAvec une **clé API**, Claude répond vraiment à toutes tes questions sur « ${fiche.titre} ».`;
  return simuler(texte, onProgress, 1800);
}

export async function testerCle() {
  await wait(600);
  return "OK";
}
