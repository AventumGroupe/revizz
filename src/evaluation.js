// Ce qu'on attend des élèves à l'écrit, matière par matière, d'après les textes et les ressources de l'Éducation nationale
// (définitions d'épreuves du bac, programmes, grilles académiques). Sert à rédiger les sujets et à les corriger.
// Rien n'est envoyé si la matière n'est pas concernée : chaque sujet ne reçoit que le référentiel de sa matière.

const R = {
  "Histoire-Géographie": {
    reference:
      "Bac général, histoire-géographie : 1re partie, réponse à une question problématisée ; 2e partie, analyse de document(s) OU production graphique (croquis, schéma). Au collège, la réponse longue s'appelle « développement construit ». En Seconde, on prépare ces exercices.",
    exercices: [
      {
        nom: "Réponse à une question problématisée",
        methode:
          "Introduction : définir les mots du sujet, situer dans le temps et l'espace, poser la problématique, annoncer le plan. Développement : 2 ou 3 parties, chacune avec une idée, expliquée et illustrée par des exemples précis (dates, lieux, acteurs, chiffres). Conclusion : répondre à la problématique.",
        criteres:
          "comprendre le sujet et la problématique ; organiser la réponse (introduction, parties, conclusion) ; mobiliser des connaissances et des repères exacts à bon escient ; employer les notions de la discipline (l'idée compte plus que le mot exact) ; rédiger clairement",
      },
      {
        nom: "Analyse de document(s)",
        methode:
          "Présenter le document (nature, auteur, date, contexte). Suivre la consigne : relever les informations utiles et les expliquer avec ses connaissances. Montrer l'intérêt et les limites du document (point de vue de l'auteur).",
        criteres:
          "comprendre le sens général du document ; sélectionner les informations pertinentes ; les expliquer avec ses connaissances ; porter un regard critique ; rédiger",
      },
      {
        nom: "Production graphique (croquis ou schéma)",
        methode:
          "Lire le texte et en tirer les informations à représenter. Construire une légende organisée en 2 ou 3 parties, avec des figurés adaptés (surface, point, ligne, flèche). Donner un titre et nommer les lieux importants. Dans l'appli, on écrit la légende organisée et on décrit les figurés.",
        criteres: "titre pertinent ; légende organisée ; choix des figurés adapté ; informations du texte toutes transposées ; nomenclature",
      },
      { nom: "Repères et notions", methode: "Réponse courte et exacte : une date, un lieu, une définition avec un exemple.", criteres: "exactitude ; précision" },
    ],
  },
  EMC: {
    reference:
      "EMC : évaluée en contrôle continu, à l'écrit et à l'oral. On attend l'usage des notions (liberté, droit, laïcité, citoyenneté…) et une argumentation respectueuse.",
    exercices: [
      { nom: "Analyse d'une situation ou d'un document", methode: "Identifier la situation, les acteurs et la valeur ou le droit en jeu, puis expliquer avec les notions du cours.", criteres: "notions exactes ; lien entre la situation et les principes ; clarté" },
      { nom: "Argumentation", methode: "Prendre position, donner 2 arguments expliqués et illustrés, envisager un point de vue opposé.", criteres: "position claire ; arguments justifiés et illustrés ; prise en compte d'autres points de vue ; rédaction" },
    ],
  },
  Français: {
    reference:
      "Épreuve anticipée de français (fin de 1re) : écrit de 4 h, commentaire de texte OU dissertation ; oral avec explication linéaire et question de grammaire, puis entretien. En Seconde, on s'entraîne à ces exercices.",
    exercices: [
      {
        nom: "Commentaire de texte",
        methode:
          "Introduction : présenter le texte (auteur, œuvre, date, genre), le situer, formuler un projet de lecture, annoncer les axes. Développement : 2 ou 3 axes ; chaque idée s'appuie sur des citations courtes analysées (procédé, puis effet produit). Conclusion : bilan et ouverture.",
        criteres:
          "pertinence du projet de lecture ; organisation en axes ; analyse des procédés avec citations (procédé et effet, pas de paraphrase) ; connaissances littéraires ; correction de la langue",
      },
      {
        nom: "Dissertation",
        methode:
          "Analyser le sujet (mots clés, présupposés), poser une problématique, construire un plan en 2 ou 3 parties qui avance. Chaque argument est illustré par un exemple tiré des œuvres étudiées. Introduction et conclusion rédigées.",
        criteres: "compréhension du sujet ; problématique ; plan progressif ; arguments illustrés par les œuvres ; correction de la langue",
      },
      { nom: "Explication linéaire", methode: "Suivre le texte dans l'ordre, mouvement par mouvement : citer, nommer le procédé, interpréter l'effet. Répondre au projet de lecture.", criteres: "découpage en mouvements ; analyse précise des procédés ; interprétation ; expression" },
      { nom: "Question de grammaire", methode: "Identifier précisément la notion (proposition, fonction, classe, négation, interrogation…), justifier avec le texte, puis dire l'effet en une phrase.", criteres: "identification exacte ; justification ; terminologie grammaticale" },
    ],
  },
  Mathématiques: {
    reference:
      "Épreuve anticipée de mathématiques (fin de 1re, depuis juin 2026) : 2 h ; 1re partie sur 6 points, des automatismes (questions courtes, sans calculatrice) ; 2e partie, exercices et problèmes. Compétences travaillées au lycée : chercher, modéliser, représenter, raisonner, calculer, communiquer.",
    exercices: [
      { nom: "Automatismes", methode: "Questions courtes à faire de tête ou en quelques lignes : calcul, pourcentages, fractions, lecture graphique, équations simples. Réponse directe.", criteres: "résultat exact" },
      {
        nom: "Exercice ou problème",
        methode: "Écrire les données, la méthode ou la propriété utilisée, les calculs, puis une phrase de conclusion avec l'unité. Chaque réponse est justifiée.",
        criteres:
          "démarche juste (une trace de recherche pertinente rapporte des points) ; justification par une propriété ou un calcul ; calculs exacts ; conclusion rédigée",
      },
    ],
  },
  "Physique-Chimie": {
    reference:
      "Physique-chimie au lycée : compétences de la démarche scientifique, s'approprier (APP), analyser-raisonner (ANA-RAI), réaliser (REA), valider (VAL), communiquer (COM).",
    exercices: [
      {
        nom: "Exercice à partir d'une situation ou d'un document",
        methode: "Extraire les données utiles, écrire la relation littérale, faire l'application numérique avec l'unité et un nombre de chiffres significatifs adapté, puis commenter le résultat (ordre de grandeur, cohérence).",
        criteres: "extraire les informations (APP) ; choisir la relation ou la loi (ANA-RAI) ; calcul exact avec unité (REA) ; regard critique sur le résultat (VAL) ; rédaction claire (COM)",
      },
      { nom: "Question de cours", methode: "Définition, loi ou schéma précis, avec les unités.", criteres: "exactitude ; vocabulaire scientifique" },
    ],
  },
  SVT: {
    reference:
      "Bac, spécialité SVT : exercice 1, mobiliser ses connaissances pour répondre à une question par un texte structuré (schéma possible) ; exercice 2, démarche scientifique à partir de documents. En Seconde, on prépare ces deux types.",
    exercices: [
      {
        nom: "Mobiliser ses connaissances",
        methode: "Introduction qui pose le problème, développement organisé (paragraphes ou parties) avec les notions du cours, schéma si utile, conclusion qui répond à la question.",
        criteres: "notions exactes et complètes ; organisation logique ; vocabulaire scientifique ; schéma juste et légendé s'il y en a un",
      },
      {
        nom: "Démarche scientifique à partir de documents",
        methode: "Pour chaque document : « je vois » (information précise, chiffrée), « je sais » (connaissance du cours), « j'en déduis ». Puis mettre les documents en relation et conclure en répondant au problème posé.",
        criteres: "informations extraites avec précision ; mise en relation avec les connaissances ; raisonnement cohérent ; conclusion qui répond au problème",
      },
    ],
  },
  SES: {
    reference:
      "Bac, SES, épreuve composée : EC1 mobilisation des connaissances (4 pts), EC2 étude d'un document (6 pts), EC3 raisonnement s'appuyant sur un dossier documentaire (10 pts : raisonnement, exploitation des documents, connaissances personnelles, introduction, développement, conclusion) ; ou dissertation. En Seconde, on travaille ces savoir-faire sur des sujets plus courts.",
    exercices: [
      { nom: "Mobilisation des connaissances", methode: "Définir les notions, puis expliquer le mécanisme demandé étape par étape, avec un exemple.", criteres: "définitions exactes ; mécanisme expliqué ; exemple pertinent" },
      {
        nom: "Étude d'un document",
        methode: "Présenter le document (source, date, unité), lire une donnée en phrase complète, calculer si demandé (taux de variation, coefficient multiplicateur, part en %), puis interpréter.",
        criteres: "lecture juste des données avec l'unité ; calculs exacts ; interprétation en lien avec le cours",
      },
      {
        nom: "Raisonnement s'appuyant sur un dossier documentaire",
        methode: "Introduction (définitions, problématique, annonce du plan), développement en paragraphes « affirmer, expliquer, illustrer » avec les documents et ses connaissances, conclusion.",
        criteres: "raisonnement construit ; exploitation des documents ; connaissances personnelles ; introduction, développement, conclusion",
      },
    ],
  },
  "Enseignement scientifique": {
    reference: "Enseignement scientifique (1re et terminale) : exercices à partir de documents, avec raisonnement, calculs simples et argumentation scientifique.",
    exercices: [
      { nom: "Exercice sur documents", methode: "Extraire les informations, raisonner avec le cours, calculer si besoin, conclure.", criteres: "informations exactes ; raisonnement scientifique ; calculs ; conclusion" },
    ],
  },
  SNT: {
    reference: "SNT : pas d'épreuve écrite nationale ; évaluation en classe sur des exercices, des activités en Python et des projets.",
    exercices: [
      { nom: "Exercice d'application", methode: "Lire les données ou le code, appliquer la notion du cours (données, réseaux, web, algorithmes), justifier.", criteres: "notion juste ; résultat exact ; justification" },
    ],
  },
  NSI: {
    reference: "NSI : exercices de programmation (Python), d'algorithmique et de données.",
    exercices: [{ nom: "Exercice de programmation ou d'algorithmique", methode: "Comprendre ce qui est demandé, écrire ou lire le code, tester sur un exemple, expliquer.", criteres: "code correct ; logique ; explication" }],
  },
  Philosophie: {
    reference: "Bac, philosophie : dissertation OU explication de texte, 4 h.",
    exercices: [
      { nom: "Dissertation", methode: "Analyser les termes, problématiser, plan progressif, arguments et exemples, références aux auteurs.", criteres: "problématisation ; argumentation ; références ; expression" },
      { nom: "Explication de texte", methode: "Thèse, enjeu, étapes de l'argumentation, explication précise, intérêt du texte.", criteres: "compréhension ; analyse précise ; enjeux ; expression" },
    ],
  },
};

// Langues vivantes : référentiel commun (CECRL).
const LANGUES = {
  reference:
    "Langues vivantes au lycée : activités langagières du CECRL (compréhension de l'écrit et de l'oral, expression écrite et orale, interaction). En Seconde : LVA, consolider B1 (B1+ visé avec les programmes de 2025), pour B2 en terminale ; LVB, consolider A2 pour B1 en terminale.",
  exercices: [
    { nom: "Compréhension de l'écrit", methode: "Lire le texte, repérer qui, quoi, où, quand, pourquoi, puis rendre compte des idées principales et des détails demandés (en français si la consigne le dit).", criteres: "idées principales comprises ; détails exacts ; compréhension fine (implicite, point de vue)" },
    { nom: "Expression écrite", methode: "Répondre dans la langue à la consigne, avec des phrases reliées par des mots de liaison, un vocabulaire varié et les temps du cours.", criteres: "réalisation de la tâche ; cohérence et articulation ; correction de la langue ; richesse du lexique" },
  ],
};
for (const l of ["Anglais", "Espagnol", "Italien", "Allemand", "LLCER"]) R[l] = LANGUES;
R.HGGSP = R["Histoire-Géographie"];

export function referentiel(matiere) {
  return R[matiere] || null;
}

/** Bloc à joindre à la demande de sujet : formats officiels et méthodes de la matière. */
export function referentielPourSujet(matiere) {
  const r = R[matiere];
  if (!r) return "";
  return `<attendus matiere="${matiere}">
${r.reference}
Types d'exercices de la matière (reprends leur nom exact dans type_exercice, et leur méthode dans methode) :
${r.exercices.map((e) => `- ${e.nom} : ${e.methode}`).join("\n")}
</attendus>`;
}

/** Critères de correction de la matière, par type d'exercice. */
export function grillePourCorrection(matiere) {
  const r = R[matiere];
  if (!r) return "";
  return `Grille de la matière (${matiere}) :\n${r.exercices.map((e) => `- ${e.nom} : ${e.criteres}`).join("\n")}`;
}

// Maîtrise de la langue : note de service « Exigences en matière de maîtrise de la langue à tous les examens »
// (BO spécial n° 4 du 17 septembre 2026, à partir de la session 2027) : au moins 2 points dans chaque épreuve,
// y compris en mathématiques et en sciences ; dans les épreuves à dimension rédactionnelle majeure, une copie défaillante
// sur l'ensemble des aspects de la langue ne peut pas avoir la moyenne. Ailleurs, la perte se limite à cette ligne.
export const POINTS_LANGUE = 2;
const REDACTIONNELLES = new Set(["Français", "Histoire-Géographie", "HGGSP", "SES", "EMC", "Philosophie", "HLP", "LLCER", "Langues anciennes"]);
export const estRedactionnelle = (matiere) => REDACTIONNELLES.has(matiere);

export const GRILLE_LANGUE = `Maîtrise de la langue (ligne à part, sur ${POINTS_LANGUE} points) :
- Critères : orthographe et grammaire (accords, conjugaison, homophones) ; syntaxe (phrases complètes et bien construites, ponctuation) ; clarté du raisonnement (idées enchaînées, mots de liaison) ; lexique précis et registre adapté (pas de langage familier ni d'abréviations type SMS).
- Niveaux : très satisfaisant = ${POINTS_LANGUE} (quelques erreurs isolées seulement) ; satisfaisant = 1,5 (erreurs ponctuelles qui ne gênent pas la lecture) ; insuffisant = 0,5 à 1 (erreurs fréquentes, phrases mal construites qui gênent la lecture) ; très insuffisant = 0 (expression qui empêche souvent de comprendre).
- Juge l'ensemble de la copie, pas chaque faute : une ou deux erreurs isolées ne font pas perdre de points. Les réponses très courtes (date, nombre, mot) ne comptent pas ; un calcul n'est pas jugé sur la langue, mais la phrase de justification ou de conclusion l'est.
- La langue n'est notée QUE sur cette ligne : ne retire jamais de points de langue dans les questions (pas de double sanction).
- Relève les erreurs les plus utiles à corriger (8 au plus) : l'extrait fautif tel qu'écrit, sa correction, et la règle en quelques mots.
- defaillante = true seulement si la copie est défaillante sur l'ensemble des aspects (orthographe, syntaxe et clarté) au point de gêner fortement la compréhension.`;
