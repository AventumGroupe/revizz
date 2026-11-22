// Tout ce qui parle à l'API Claude est ici.
import Anthropic from "@anthropic-ai/sdk";
import { Capacitor } from "@capacitor/core";
import { getSettings, enregistrerConso } from "./store.js";
import * as demo from "./demo.js";
import { nomsPourClaude } from "./matieres.js";
import { personaTuteur } from "./tuteurs.js";
import { referentielPourSujet, grillePourCorrection, GRILLE_LANGUE, POINTS_LANGUE } from "./evaluation.js";
import { zoomer } from "./image.js";

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (le plus intelligent, recommandé)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (rapide, moitié moins cher)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (très économique)" },
];

// Les modèles qui acceptent le repli automatique côté serveur en cas de refus.
const SUPPORTS_FALLBACK = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

// Adresse du site Révizz : celle saisie, sinon (version web) le site lui-même, sinon celle fixée à la compilation.
/** « revizz.netlify.app/ », « http://revizz.netlify.app » … → « https://revizz.netlify.app ». */
export function normaliserAdresse(v) {
  let t = String(v || "").trim().replace(/\s+/g, "");
  if (!t) return "";
  if (!/^https?:\/\//i.test(t)) t = "https://" + t;
  try {
    const u = new URL(t);
    // Un site Netlify est toujours en https ; un téléphone refuse souvent le http.
    if (u.hostname !== "localhost" && !/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) u.protocol = "https:";
    return u.origin;
  } catch {
    return t.replace(/\/+$/, "");
  }
}
export const ADRESSE_PAR_DEFAUT = normaliserAdresse(import.meta.env.VITE_REVIZZ_SERVEUR || "");
export function adresseServeur(s = getSettings()) {
  if (s.serveur) return normaliserAdresse(s.serveur);
  if (!Capacitor.isNativePlatform() && /^https?:$/.test(location.protocol)) return location.origin;
  return ADRESSE_PAR_DEFAUT;
}
/** L'appli peut-elle appeler Claude ? (démo, clé personnelle, ou serveur + code famille) */
export function estConfigure(s = getSettings()) {
  if (s.demo) return true;
  if (s.connexion === "compte") return !!(s.jeton && adresseServeur(s));
  return s.connexion === "cle" ? !!s.apiKey : !!(s.code && adresseServeur(s));
}

/** Une clé collée depuis un message ou un mail traîne souvent des espaces, retours à la ligne ou guillemets. */
export const nettoyerCle = (k) => String(k || "").replace(/[\s"'«»`]/g, "");

function client() {
  const s = getSettings();
  if (s.connexion === "cle") {
    if (!s.apiKey) throw new Error("Ajoute d'abord ta clé API Claude dans les Réglages ⚙️.");
    // Clé personnelle : elle reste sur l'appareil et part directement chez Anthropic.
    return new Anthropic({ apiKey: nettoyerCle(s.apiKey), dangerouslyAllowBrowser: true, maxRetries: 3 });
  }
  const base = adresseServeur(s);
  if (s.connexion === "compte") {
    if (!base || !s.jeton) throw new Error("Connecte-toi à ton compte dans le Profil.");
    return new Anthropic({ apiKey: "relais-revizz", baseURL: `${base}/api/claude`, dangerouslyAllowBrowser: true, maxRetries: 3, defaultHeaders: { "x-revizz-jeton": s.jeton } });
  }
  if (!base || !s.code) throw new Error("Saisis l'adresse du site Révizz et le code famille dans les Réglages ⚙️.");
  // Serveur Révizz : la vraie clé est sur Netlify ; l'appareil n'envoie que le code famille.
  return new Anthropic({
    apiKey: "relais-revizz",
    baseURL: `${base}/api/claude`,
    dangerouslyAllowBrowser: true,
    maxRetries: 3,
    defaultHeaders: { "x-revizz-code": String(s.code || "").trim() },
  });
}

// ---------- Éco-conception ----------
// - Le cours est placé dans le prompt système et mis en cache : QCM, sujets, cartes et prof
//   relisent ce début de requête depuis le cache (10 % du prix, beaucoup moins de calcul).
// - Seule la transcription sert de référence (la fiche résumé n'est pas renvoyée en double).
// - L'effort de réflexion est réglé au plus juste pour chaque tâche.
// - Les sorties demandées sont courtes et sans répétition.

function consignes() {
  const { prenom, classe } = getSettings();
  return [
    `Tu es Révizz, professeur particulier bienveillant et exigeant de ${prenom || "un élève"} (niveau : ${classe || "collège/lycée"}), en France.`,
    "Tutoie l'élève. Phrases claires, adaptées à son niveau, vocabulaire des programmes de l'Éducation nationale.",
    "Reste fidèle au cours fourni ; n'invente pas de notions absentes, sauf pour compléter une explication de façon exacte.",
    "Respecte les attendus du programme officiel de ce niveau (Éduscol) : notions, capacités et vocabulaire attendus en classe.",
    "Formules en texte simple avec symboles Unicode (x², √, π, ≤, →, H₂O), jamais en LaTeX.",
    "Markdown : titres courts (##), listes, **gras** pour les mots importants. Sois concis : pas de répétition, pas de formule de politesse, pas d'emoji.",
  ].join("\n");
}

// Prompt système pour les tâches sur une fiche : consignes + cours, avec un point de cache après le cours.
function systemCours(fiche) {
  return [
    { type: "text", text: consignes() },
    {
      type: "text",
      text: `<cours titre="${fiche.titre}" matiere="${fiche.matiere}"${fiche.chapitre ? ` chapitre="${fiche.chapitre}"` : ""}>\n${fiche.transcription}\n</cours>`,
      cache_control: { type: "ephemeral" },
    },
  ];
}

function baseParams({ effort, maxTokens, system }) {
  const { model } = getSettings();
  const params = { model, max_tokens: maxTokens, system: system ?? consignes(), output_config: { effort } };
  if (SUPPORTS_FALLBACK.has(model)) {
    params.betas = ["server-side-fallback-2026-07-01"];
    params.fallbacks = "default";
  }
  return params;
}

function explainError(err) {
  // Messages du serveur Révizz (code famille, configuration) : on les affiche tels quels.
  if (err?.error?.error?.type === "revizz_error") return new Error(err.error.error.message);
  if (err instanceof Anthropic.AuthenticationError)
    return new Error(
      getSettings().connexion === "cle"
        ? `Clé API refusée par Claude (clé enregistrée : ${nettoyerCle(getSettings().apiKey).slice(0, 10)}…, ${nettoyerCle(getSettings().apiKey).length} caractères). Vérifie qu'elle est complète, ou passe plutôt par un compte élève (Profil) : la clé reste alors sur le serveur.`
        : "Le serveur Révizz refuse la clé API : vérifie ANTHROPIC_API_KEY dans Netlify."
    );
  if (err instanceof Anthropic.NotFoundError && getSettings().connexion !== "cle") return new Error("Adresse du site Révizz introuvable : vérifie-la dans les Réglages ⚙️.");
  if (err instanceof Anthropic.PermissionDeniedError) return new Error("Cette clé n'a pas accès à ce modèle. Essaie un autre modèle dans les Réglages.");
  if (err instanceof Anthropic.RateLimitError) return new Error("Trop de demandes d'un coup. Attends une minute et réessaie.");
  if (err instanceof Anthropic.BadRequestError) {
    if (/credit|billing|balance/i.test(err.message)) return new Error("Le crédit du compte Claude est épuisé. Demande à un parent de recharger le compte.");
    return new Error("Claude n'a pas pu traiter la demande : " + err.message);
  }
  if (err instanceof Anthropic.InternalServerError) return new Error("Claude est surchargé pour le moment. Réessaie dans un instant.");
  if (err instanceof Anthropic.APIConnectionError)
    return new Error(
      navigator.onLine === false
        ? "Pas de connexion internet. Vérifie le Wi-Fi ou les données mobiles."
        : `La connexion avec ${getSettings().connexion === "cle" ? "Claude" : "le site Révizz"} a été coupée (envoi trop lourd, appli mise en arrière-plan ou écran en veille). Réessaie en gardant l'appli ouverte ; si ça recommence, scanne moins de pages à la fois.`
    );
  if (err instanceof Anthropic.APIError) return new Error(`Erreur Claude (${err.status}) : ${err.message}`);
  return err;
}

function textOf(message) {
  return message.content.filter((b) => b.type === "text").map((b) => b.text).join("");
}

function checkStop(message) {
  if (message.stop_reason === "refusal") throw new Error("Claude a refusé de traiter ce contenu. Essaie avec une autre fiche.");
  if (message.stop_reason === "max_tokens") throw new Error("La réponse était trop longue et a été coupée. Essaie avec moins de pages à la fois.");
}

// Appel en streaming. onProgress(nbCaractères, texteEnCours) permet d'afficher l'avancement.
async function run(params, onProgress) {
  try {
    const stream = client().beta.messages.stream(params);
    let chars = 0;
    let acc = "";
    stream.on("text", (delta) => {
      chars += delta.length;
      acc += delta;
      onProgress?.(chars, acc);
    });
    const message = await stream.finalMessage();
    enregistrerConso(message.usage);
    checkStop(message);
    return textOf(message);
  } catch (err) {
    throw explainError(err);
  }
}

async function runJSON(params, schema, onProgress) {
  params.output_config = { ...params.output_config, format: { type: "json_schema", schema } };
  const text = await run(params, onProgress);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("La réponse de Claude était incomplète. Réessaie.");
  }
}

// ---------- Schémas de sortie ----------

const obj = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const str = (description) => ({ type: "string", description });
const arr = (items, description) => ({ type: "array", items, description });

const FLASHCARD = obj({
  recto: str("Question complète et précise, compréhensible sans le cours sous les yeux"),
  verso: str("Réponse exacte en 1 ou 2 phrases, mot-clé en premier"),
});

// Règles communes pour des flashcards précises.
const REGLES_FLASHCARDS = `Règles pour chaque flashcard :
- Le recto est une question complète et autonome : nomme le sujet précis (personnage, événement, lieu, notion, chapitre). Exemple : « En quelle année a eu lieu la prise de la Bastille ? » et non « Quelle date ? » ; « Que dit le théorème de Pythagore dans un triangle ABC rectangle en A ? » et non « Que dit le théorème ? ».
- Une seule notion par carte, et une seule bonne réponse possible.
- Interdit : questions vagues (« Explique… », « Parle de… », « Que sais-tu de… »), questions oui/non, renvois au document (« d'après le cours », « dans ce texte »), pronoms sans référent (« il », « cela »).
- Le verso répond exactement à la question, en 1 ou 2 phrases.
- Varie les types : définition, date, acteur, cause, conséquence, exemple, formule, application.`;

// Construit à chaque scan : la liste des matières de l'élève peut changer.
const analyseSchema = () => obj({
  titre: str("Titre court du cours"),
  matiere: { type: "string", enum: nomsPourClaude(), description: "Matière scolaire (Autre si aucune ne convient)" },
  chapitre: str("Chapitre ou grand thème du programme, court (ex : « La Révolution française », « Théorème de Pythagore »)"),
  transcription: str("Texte fidèle et complet des pages, remis en ordre, en Markdown sobre"),
  resume: str("Fiche de révision synthétique en Markdown (pas une copie de la transcription)"),
  points_cles: arr(str("Une idée clé, une phrase"), "4 à 8 idées clés"),
  vocabulaire: arr(obj({ terme: str("Mot ou notion"), definition: str("Définition simple, une phrase") }), "Mots, dates et formules essentiels, 10 au maximum"),
  astuce_memo: str("Un moyen mnémotechnique court"),
  flashcards: arr(FLASHCARD, "12 à 20 flashcards couvrant tout le cours"),
  connexes: arr(CONNEXE, CONNEXES_DESC),
});

const QCM_SCHEMA = obj({
  questions: arr(
    obj({
      question: str("UNE seule question, précise et autonome : pas de « et » qui en demande deux, pas de sous-question"),
      choix: arr(str("Proposition courte"), "Exactement 4 propositions"),
      bonne_reponse: { type: "integer", description: "Indice (0 à 3) de la bonne proposition" },
      explication: str("Pourquoi c'est la bonne réponse, en 1 ou 2 phrases"),
    }),
    "Les questions du QCM"
  ),
});

const SUJET_SCHEMA = obj({
  titre: str("Titre du sujet"),
  duree: str("Durée conseillée, ex : 50 min"),
  consignes: str("Consignes générales courtes (calculatrice, rédaction…), vide si aucune"),
  exercices: arr(
    obj({
      titre: str("Titre de l'exercice"),
      type_exercice: str("Nom officiel du type d'exercice, ex : Réponse à une question problématisée, Analyse de document(s), Commentaire de texte, Automatismes, Étude d'un document"),
      methode: str("Méthode attendue rappelée à l'élève en 2 à 4 phrases courtes (étapes), vide pour des questions de cours"),
      document: str("Document à étudier en Markdown (texte, données, description d'une carte ou d'un graphique), vide s'il n'y en a pas"),
      questions: arr(
        obj({
          enonce: str("UNE seule question ou tâche, claire, à laquelle l'élève répond juste en dessous"),
          points: { type: "number", description: `Points de la question (le total des questions fait ${20 - POINTS_LANGUE} ; les ${POINTS_LANGUE} derniers points vont à la maîtrise de la langue)` },
          competence: str("Compétence évaluée, ex : Connaître, Calculer, Raisonner, Analyser un document, Argumenter"),
          reponse_attendue: str("Réponse attendue en Markdown, complète"),
          bareme: arr(obj({ critere: str("Ce qui rapporte des points"), points: { type: "number" } }), "Barème détaillé de la question, critère par critère"),
          erreurs_frequentes: str("Erreur fréquente à éviter, une phrase"),
        }),
        "Questions de l'exercice"
      ),
    }),
    "2 à 4 exercices"
  ),
});

// Méthode de correction, d'après les pratiques d'évaluation de l'Éducation nationale.
const METHODE_CORRECTION = `Méthode de correction :
- Corrige comme un professeur bienveillant : tu notes la compréhension, pas les mots. La réponse attendue est un modèle, pas une formulation imposée. Une idée juste dite avec d'autres mots que le cours, un synonyme, une périphrase, un exemple différent ou un raisonnement mené autrement mais correct rapporte TOUS les points du critère. Ne retire jamais de points parce qu'un terme du cours manque si l'idée est là.
- Le vocabulaire précis ne compte que si la question le demande expressément (« définis… », « nomme… », « quel est le terme… ») ou si le critère du barème porte explicitement sur une notion ; même alors, une idée juste mal nommée garde au moins la moitié des points du critère.
- Dans le doute entre deux notes, choisis la plus favorable à l'élève.
- Applique le barème de chaque question critère par critère ; accorde des points partiels (par demi-points).
- Mathématiques et sciences : valorise la démarche. Un raisonnement juste avec une erreur de calcul garde l'essentiel des points ; une trace de recherche pertinente, même incomplète, rapporte des points ; un résultat juste sans la justification demandée n'obtient pas tous les points. Repère les compétences (chercher, modéliser, représenter, raisonner, calculer, communiquer).
- Réponses rédigées (histoire-géographie, français, SES, langues, philosophie) : évalue par capacités (connaissances, compréhension et analyse, argumentation et organisation, maîtrise de la langue) avec 4 niveaux de maîtrise : très insuffisant (0 à 25 % des points), insuffisant (25 à 50 %), satisfaisant (50 à 75 %), très satisfaisant (75 à 100 %).
- La langue n'est pas notée dans les questions : elle a sa propre ligne (voir plus bas).
- Une réponse vide, « je ne sais pas » ou hors sujet vaut 0. Ne prête pas à l'élève ce qu'il n'a pas écrit.
- Commentaires bienveillants et précis : ce qui est réussi, ce qui manque, la bonne réponse en une phrase.`;

const CORRECTION_SCHEMA = obj({
  questions: arr(
    obj({
      numero: { type: "integer", description: "Numéro de la question (1, 2, 3… dans l'ordre du sujet)" },
      points_obtenus: { type: "number", description: "Points obtenus, par demi-points, sans dépasser le barème" },
      niveau: { type: "string", enum: ["très insuffisant", "insuffisant", "satisfaisant", "très satisfaisant"] },
      commentaire: str("Ce qui est réussi et ce qui manque, 1 à 3 phrases. Si l'idée est juste avec d'autres mots, dis-le et donne le terme du cours comme conseil, sans retirer de points"),
    }),
    "Une entrée par question"
  ),
  langue: obj({
    niveau: { type: "string", enum: ["très insuffisant", "insuffisant", "satisfaisant", "très satisfaisant"] },
    points_obtenus: { type: "number", description: "Points de maîtrise de la langue, par demi-points, de 0 au maximum de la ligne" },
    commentaire: str("Bilan de l'expression écrite en 1 ou 2 phrases, avec un conseil concret"),
    erreurs: arr(obj({ extrait: str("Passage fautif, recopié tel quel"), correction: str("Passage corrigé"), regle: str("La règle en quelques mots") }), "Erreurs les plus utiles à corriger, 8 au plus, vide s'il n'y en a pas"),
    defaillante: { type: "boolean", description: "true seulement si la copie est défaillante sur l'ensemble des aspects de la langue" },
  }),
  appreciation: str("Appréciation générale, 2 phrases, comme sur une copie"),
  points_forts: arr(str("Point fort"), "1 à 3 points forts"),
  a_travailler: arr(str("Point à travailler, concret"), "1 à 3 points à travailler"),
});


const FLASHCARDS_SCHEMA = obj({ flashcards: arr(FLASHCARD, "Nouvelles flashcards") });

// Sujets connexes : ce qu'il faut revoir avant, ce qui prolonge le cours, les liens avec d'autres matières.
const CONNEXE = obj({
  titre: str("Notion ou sujet, court et précis"),
  type: { type: "string", enum: ["prerequis", "approfondissement", "autre_matiere"], description: "prerequis = à revoir avant ; approfondissement = pour aller plus loin ; autre_matiere = lien avec une autre matière" },
  matiere: str("Matière de ce sujet"),
  pourquoi: str("Le lien avec le cours, en une phrase"),
});
const CONNEXES_DESC = "3 à 5 sujets connexes : au moins un prérequis, un approfondissement et un lien avec une autre matière";
const CONNEXES_SCHEMA = obj({ connexes: arr(CONNEXE, CONNEXES_DESC) });

// ---------- Fonctions utilisées par l'appli ----------

// ---------- Lecture des pages (OCR exigeant, écriture manuscrite) ----------
// Étape 1 : Claude ne fait que lire, avec un outil de zoom pour les passages difficiles.
// Étape 2 : la fiche est rédigée à partir du texte, une fois relu par l'élève.

const OUTIL_ZOOM = {
  name: "zoom",
  description:
    "Agrandit une zone d'une page pour lire un mot ou une ligne difficile (petit, pâle, raturé, écriture serrée). " +
    "Coordonnées en pixels de l'image de la page telle que tu la vois, origine en haut à gauche. " +
    "Encadre large : une ligne entière ou un paragraphe plutôt qu'un seul mot.",
  input_schema: {
    type: "object",
    properties: {
      page: { type: "integer", description: "Numéro de la page, à partir de 1" },
      x0: { type: "integer" }, y0: { type: "integer" }, x1: { type: "integer" }, y1: { type: "integer" },
    },
    required: ["page", "x0", "y0", "x1", "y1"],
    additionalProperties: false,
  },
  strict: true,
  eager_input_streaming: true,
};
const MAX_ZOOMS = 14;

const CONSIGNES_LECTURE = `Tu es un expert de la lecture d'écritures manuscrites d'élèves (cahiers, fiches, copies), en français.
Ta seule tâche : transcrire fidèlement et complètement les pages fournies. Ne résume pas, ne corrige pas le fond.

Méthode :
- Lis chaque page entièrement, dans l'ordre de lecture (colonnes, marges, bulles et annotations comprises). Commence chaque page par « ## Page n ».
- Avant de conclure sur un passage petit, pâle, serré, raturé ou ambigu, utilise l'outil zoom pour l'agrandir. Pour une écriture difficile, n'hésite pas à zoomer ligne par ligne.
- Déchiffre en croisant : la forme des lettres ailleurs sur la page (même main), le sens de la phrase, la matière et le niveau, le vocabulaire du programme.
- Développe les abréviations de prise de notes courantes (qd → quand, pr → pour, ds → dans, tjrs → toujours, cad → c'est-à-dire, gvt → gouvernement), mais garde les sigles (DDHC, PIB, ADN).
- Restitue la structure en Markdown : titres (##, ###), listes, flèches (→, ⇒), encadrés (> ), tableaux, mots soulignés en **gras**.
- Formules et symboles en Unicode (x², √, π, ≤, →, H₂O), jamais en LaTeX. Décris brièvement les schémas : [Schéma : …].
- Ignore ce qui est barré, les gribouillis et le texte d'une autre page visible en transparence.

Honnêteté :
- N'invente jamais. Si un mot reste incertain même après zoom, écris ta meilleure lecture ainsi : [?mot]. Si un passage est impossible à lire : [illisible].
- Une date, un nombre, un nom propre ou une formule douteux doit être marqué [?…], car une erreur sur ces éléments fausserait les révisions.

Réponds uniquement avec la transcription.`;

/**
 * pages : [{ kind: "image", mediaType, data, largeur, hauteur, original }] ou [{ kind: "pdf", data }]
 * onZoom(n) : appelé à chaque zoom de Claude (pour l'affichage).
 */
// Les pages sont lues une par une (un PDF compte pour un envoi) : chaque requête reste légère,
// ce qui évite les coupures de connexion avec plusieurs photos haute définition, et la lecture avance page après page.
async function transcrireClaude(pages, opts = {}, onProgress, onZoom) {
  if (pages.length <= 1) return transcrireLot(pages, opts, onProgress, onZoom, 1, "");
  const morceaux = [];
  let deja = 0, zoomsAvant = 0, zoomsLot = 0, numero = 1;
  for (const p of pages) {
    zoomsLot = 0;
    const texte = await transcrireLot(
      [p],
      { ...opts, total: pages.length },
      (chars, acc) => onProgress?.(deja + chars, acc, numero),
      (n) => onZoom?.(zoomsAvant + (zoomsLot = n)),
      numero,
      morceaux.join("\n\n").slice(-600)
    );
    morceaux.push(texte);
    deja += texte.length;
    zoomsAvant += zoomsLot;
    numero++;
  }
  return morceaux.join("\n\n");
}

// Appel en flux avec une nouvelle tentative si la connexion saute (réseau mobile, mise en veille…).
async function fluxAvecReprise(params, onText) {
  for (let essai = 0; ; essai++) {
    try {
      const stream = client().beta.messages.stream(params);
      let acc = "";
      stream.on("text", (delta) => {
        acc += delta;
        onText?.(acc);
      });
      return await stream.finalMessage();
    } catch (err) {
      if (err instanceof Anthropic.APIConnectionError && essai < 2) {
        await new Promise((r) => setTimeout(r, 2000 * (essai + 1)));
        continue;
      }
      throw explainError(err);
    }
  }
}

async function transcrireLot(pages, { matiere, note, type, total } = {}, onProgress, onZoom, premierNumero = 1, contexte = "") {
  const content = [];
  if (contexte) content.push({ type: "text", text: `Fin de la page précédente (pour le contexte, ne la recopie pas) :\n${contexte}` });
  pages.forEach((p, i) => {
    content.push({ type: "text", text: p.kind === "pdf" ? `Document PDF (pages suivantes)` : `Page ${premierNumero + i}${total ? ` sur ${total}` : ""} (${p.largeur} × ${p.hauteur} px)` });
    content.push(
      p.kind === "pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.data } }
        : { type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } }
    );
  });
  const { classe } = getSettings();
  content.push({
    type: "text",
    text: [
      `Transcris ${pages.length > 1 ? `ces ${pages.length} pages` : "cette page"} (${type === "imprime" ? "document plutôt imprimé" : type === "mixte" ? "document imprimé annoté à la main : transcris le texte imprimé ET toutes les annotations manuscrites (marges, mots entourés ou soulignés, compléments, réponses écrites dans les blancs) ; place chaque annotation à l'endroit où elle se rapporte, sous la forme « > Annotation : … », et marque [?…] les mots manuscrits incertains" : "prise de notes manuscrite"}).${premierNumero > 1 || total ? ` Commence par « ## Page ${premierNumero} ». Pour l'outil zoom, cette page est la page 1.` : ""}`,
      `Niveau de l'élève : ${classe || "lycée"}.`,
      matiere ? `Matière : ${matiere}.` : "",
      note ? `Précision de l'élève : ${note}` : "",
    ].filter(Boolean).join("\n"),
  });
  const messages = [{ role: "user", content }];
  const params = {
    ...baseParams({ effort: type === "imprime" ? "medium" : "high", maxTokens: 32000, system: CONSIGNES_LECTURE }),
    tools: pages.some((p) => p.kind === "image") ? [OUTIL_ZOOM] : [],
  };
  let zooms = 0;
  for (let tour = 0; tour < 8; tour++) {
    const message = await fluxAvecReprise({ ...params, messages }, (acc) => onProgress?.(acc.length, acc));
    enregistrerConso(message.usage);
    if (message.stop_reason === "refusal") throw new Error("Claude a refusé de traiter ce contenu. Essaie avec une autre fiche.");
    const appels = message.content.filter((b) => b.type === "tool_use");
    if (message.stop_reason !== "tool_use" || !appels.length) {
      checkStop(message);
      return textOf(message).trim();
    }
    // Claude demande des zooms : on découpe les zones sur le téléphone et on les lui renvoie.
    messages.push({ role: "assistant", content: message.content });
    const resultats = [];
    for (const appel of appels) {
      const e = appel.input || {};
      const page = pages[(e.page | 0) - 1];
      const valide = page && page.kind === "image" && [e.x0, e.y0, e.x1, e.y1].every((v) => Number.isFinite(v));
      if (!valide) {
        resultats.push({ type: "tool_result", tool_use_id: appel.id, is_error: true, content: "Page ou coordonnées invalides." });
        continue;
      }
      if (zooms >= MAX_ZOOMS) {
        resultats.push({ type: "tool_result", tool_use_id: appel.id, is_error: true, content: "Nombre maximal de zooms atteint : termine la transcription avec [?…] pour les mots incertains." });
        continue;
      }
      try {
        const data = await zoomer(page, e);
        zooms++;
        onZoom?.(zooms);
        resultats.push({
          type: "tool_result",
          tool_use_id: appel.id,
          content: [
            { type: "image", source: { type: "base64", media_type: "image/jpeg", data } },
            { type: "text", text: `Zone agrandie de la page ${e.page}.` },
          ],
        });
      } catch (err) {
        resultats.push({ type: "tool_result", tool_use_id: appel.id, is_error: true, content: err.message });
      }
    }
    messages.push({ role: "user", content: resultats });
  }
  throw new Error("La lecture a pris trop d'étapes. Réessaie avec moins de pages à la fois.");
}

// Étape 2 : fiche de révision à partir du texte relu (sans renvoyer les photos : moins de tokens).
async function creerFicheClaude(transcription, { matiere, note } = {}, onProgress) {
  const schema = analyseSchema();
  delete schema.properties.transcription;
  schema.required = schema.required.filter((k) => k !== "transcription");
  return runJSON(
    {
      ...baseParams({ effort: "medium", maxTokens: 24000 }),
      messages: [
        {
          role: "user",
          content: [
            `<transcription>\n${transcription}\n</transcription>`,
            "Voici la transcription d'un cours (photo, souvent manuscrite). Les mots entre [?…] sont des lectures incertaines : vérifie-les par le sens et le programme, et n'en fais pas des flashcards s'ils restent douteux.",
            "Les lignes « > Annotation : … » sont des notes manuscrites ajoutées sur un document imprimé : intègre-les, elles signalent souvent ce que le professeur a jugé essentiel.",
            "1. Rédige une fiche de révision synthétique : l'essentiel à apprendre, sans recopier la transcription.",
            "2. Ajoute les points clés, le vocabulaire essentiel, une astuce mémo et des flashcards.",
            "3. Propose des sujets connexes adaptés au niveau de l'élève : une notion à revoir avant, une pour approfondir, un lien avec une autre matière.",
            REGLES_FLASHCARDS,
            matiere ? `Matière : ${matiere}.` : "",
            note ? `Précision de l'élève : ${note}` : "",
          ].filter(Boolean).join("\n"),
        },
      ],
    },
    schema,
    onProgress
  );
}

/** Repère les passages incertains d'une transcription : [?mot] et [illisible]. */
export function passagesIncertains(texte) {
  const items = [];
  const re = /\[\?([^\]]*)\]|\[illisible\]/g;
  let m;
  while ((m = re.exec(texte))) {
    items.push({
      debut: m.index,
      fin: m.index + m[0].length,
      illisible: !m[0].startsWith("[?"),
      lecture: m[1] || "",
      avant: texte.slice(Math.max(0, m.index - 50), m.index).replace(/\s+/g, " "),
      apres: texte.slice(m.index + m[0].length, m.index + m[0].length + 50).replace(/\s+/g, " "),
    });
  }
  return items;
}

const NIVEAUX = {
  facile: "faciles : vérifier que les notions de base sont connues",
  moyen: "de difficulté moyenne, comme dans un contrôle en classe",
  difficile: "difficiles : pièges classiques, application et raisonnement",
};
const court = (t, n = 80) => (t.length > n ? t.slice(0, n) + "…" : t);

async function genererQCMClaude(fiche, niveau, nombre, dejaPosees, onProgress) {
  const deja = dejaPosees.length
    ? `\nÉvite ces questions déjà posées :\n${dejaPosees.slice(-20).map((q) => "- " + court(q)).join("\n")}`
    : "";
  const data = await runJSON(
    {
      ...baseParams({ effort: "low", maxTokens: 16000, system: systemCours(fiche) }),
      messages: [
        {
          role: "user",
          content: `Crée un QCM de ${nombre} questions ${NIVEAUX[niveau]} sur le cours. Chaque question est précise et autonome (elle nomme le sujet) et ne demande qu'UNE seule chose : jamais deux questions en une (pas de « Quand et pourquoi… ? », pas de « Qui… et que… ? »). Exactement 4 propositions plausibles et une seule bonne réponse. Varie la position de la bonne réponse.${deja}`,
        },
      ],
    },
    QCM_SCHEMA,
    onProgress
  );
  // Garde-fou : on ne garde que les questions bien formées.
  return data.questions.filter(
    (q) => Array.isArray(q.choix) && q.choix.length >= 2 && q.bonne_reponse >= 0 && q.bonne_reponse < q.choix.length
  );
}

// ---------- Parcours en 3 paliers ----------
// Palier 1 « Je sais » : cartes + QCM (déjà en place).
// Palier 2 « Je sais faire » : exercices d'application avec coups de pouce et correction pas à pas.
// Palier 3 « Je vais plus loin » : un défi (situation nouvelle), évalué par Claude.

const EXERCICES_SCHEMA = obj({
  exercices: arr(
    obj({
      titre: str("Titre court"),
      competence: str("Capacité travaillée, ex : « Calculer une longueur », « Analyser un document »"),
      enonce: str("Énoncé complet en Markdown ; inclure le court document à étudier s'il y en a un"),
      indices: arr(str("Coup de pouce"), "Exactement 3 coups de pouce progressifs : 1) une piste, 2) la méthode, 3) le début de la résolution"),
      etapes: arr(obj({ titre: str("Nom de l'étape"), explication: str("Ce qu'on fait et pourquoi, en Markdown") }), "Correction pas à pas, 2 à 5 étapes"),
      reponse: str("Réponse finale attendue, courte"),
    }),
    "Les exercices"
  ),
});

const DEFI_SCHEMA = obj({
  titre: str("Titre accrocheur"),
  situation: str("Situation nouvelle et concrète en Markdown, qui mobilise plusieurs notions du chapitre"),
  consigne: str("Ce que l'élève doit produire"),
  criteres: arr(str("Critère de réussite"), "3 à 5 critères d'évaluation visibles par l'élève"),
  pistes: arr(str("Piste"), "2 pistes de réflexion, sans donner la réponse"),
  corrige: str("Corrigé détaillé en Markdown : démarche attendue et réponse"),
});

const EVALUATION_SCHEMA = obj({
  valide: { type: "boolean", description: "true si le raisonnement est correct et répond à la consigne, même avec de petites maladresses" },
  note: { type: "integer", description: "Note sur 20" },
  points_forts: arr(str("Point fort"), "1 à 3 points forts"),
  a_ameliorer: arr(str("Point à améliorer, avec la correction"), "0 à 3 points à améliorer"),
  conseil: str("Un conseil concret pour progresser, une phrase"),
});

// Selon la matière, ce que veut dire « appliquer » et « aller plus loin ».
const APPLICATION_PAR_MATIERE = `Adapte les exercices à la matière :
- Mathématiques, Physique-Chimie : calculs et problèmes d'application directe du cours (données numériques réalistes, unités).
- SVT, Physique-Chimie : exploitation d'une expérience ou d'un résultat (tableau, graphique décrit en texte).
- Histoire-Géographie, EMC : analyse guidée d'un court document fourni dans l'énoncé (texte, chiffres, carte décrite), repères à situer.
- SES : calcul et lecture de données (taux de variation, pourcentages, coefficient multiplicateur), définition mobilisée sur un exemple.
- Français : repérage et interprétation dans un court extrait fourni.
- Langues : compréhension d'un court texte et production guidée dans la langue (consignes en français).
- SNT, NSI : petit exercice de logique, de données ou de lecture de code.`;

async function genererExercicesClaude(fiche, onProgress) {
  const data = await runJSON(
    {
      ...baseParams({ effort: "medium", maxTokens: 20000, system: systemCours(fiche) }),
      messages: [
        {
          role: "user",
          content: `Palier 2 « Je sais faire » : crée 3 exercices d'application du cours, de difficulté croissante, comme ceux faits en classe, qui couvrent les notions principales.\n${APPLICATION_PAR_MATIERE}\nChaque exercice a 3 coups de pouce progressifs et une correction pas à pas qui explique la méthode.`,
        },
      ],
    },
    EXERCICES_SCHEMA,
    onProgress
  );
  return data.exercices;
}

async function genererDefiClaude(fiche, onProgress) {
  return runJSON(
    {
      ...baseParams({ effort: "medium", maxTokens: 16000, system: systemCours(fiche) }),
      messages: [
        {
          role: "user",
          content: `Palier 3 « Je vais plus loin » : propose un défi qui oblige à transférer le cours dans une situation nouvelle (problème à modéliser, question de réflexion, argumentation, lien avec l'actualité ou une autre matière). Il doit être faisable en 20 à 30 minutes par l'élève, sans réponse toute faite dans le cours.`,
        },
      ],
    },
    DEFI_SCHEMA,
    onProgress
  );
}

async function evaluerDefiClaude(fiche, defi, reponse, onProgress) {
  return runJSON(
    {
      ...baseParams({ effort: "medium", maxTokens: 8000, system: systemCours(fiche) }),
      messages: [
        {
          role: "user",
          content: `<defi>\n${defi.situation}\n\nConsigne : ${defi.consigne}\nCritères : ${defi.criteres.join(" ; ")}\n</defi>\n\n<corrige>\n${defi.corrige}\n</corrige>\n\n<reponse_eleve>\n${reponse}\n</reponse_eleve>\n\nÉvalue la réponse de l'élève en professeur bienveillant mais exigeant : le raisonnement compte plus que la rédaction. Valide le défi si le raisonnement est juste et répond à la consigne.`,
        },
      ],
    },
    EVALUATION_SCHEMA,
    onProgress
  );
}

export const TYPES_SUJET = {
  controle: "Contrôle en classe (30 à 55 min)",
  express: "Interro express (10 min)",
  brevet: "Sujet type Brevet",
  bac: "Format officiel (type Bac)",
  oral: "Préparation à l'oral",
};

const FORMAT_SUJET = {
  controle: "un contrôle de 50 minutes comme en classe : 2 ou 3 exercices, des questions de cours puis les types d'exercices officiels de la matière (voir les attendus)",
  express: "une interro express de 10 minutes : 1 exercice, 3 à 4 questions courtes",
  brevet: "un sujet type brevet : 2 ou 3 exercices progressifs, avec documents si la matière s'y prête",
  bac: "un sujet qui reprend le format officiel de l'épreuve de la matière (voir les attendus), à la mesure d'un élève de Seconde",
  oral: "une préparation à l'oral : 4 à 6 questions de jury, l'élève écrit les idées qu'il dirait",
};
async function genererSujetClaude(fiche, type, onProgress) {
  return runJSON(
    {
      ...baseParams({ effort: "medium", maxTokens: 24000, system: systemCours(fiche) }),
      messages: [
        {
          role: "user",
          content: `Prépare ${FORMAT_SUJET[type] || FORMAT_SUJET.controle}, sur le cours, réaliste et adapté au niveau de l'élève.
- Chaque question ne demande qu'UNE seule chose : l'élève y répond juste en dessous. Découpe les questions doubles.
- Total des points des questions : ${20 - POINTS_LANGUE} (les ${POINTS_LANGUE} derniers points de la note sur 20 sont réservés à la maîtrise de la langue, notée à part). Barème détaillé pour chaque question (critères et points), comme un professeur. Chaque critère décrit une idée ou un savoir-faire à montrer, pas des mots exacts à recopier ; ne réserve un critère au vocabulaire que si la question demande une définition ou un terme.
- Réponse attendue complète pour chaque question (elle ne sera montrée qu'après la copie rendue).
- Utilise les types d'exercices officiels de la matière, avec leur nom et leur méthode. Un exercice long (réponse à une question problématisée, commentaire, raisonnement sur dossier, mobiliser ses connaissances…) tient en UNE question notée sur beaucoup de points, avec un barème qui reprend les critères de la méthode (introduction, organisation, connaissances, exemples, rédaction…).
${referentielPourSujet(fiche.matiere) || APPLICATION_PAR_MATIERE}`,
        },
      ],
    },
    SUJET_SCHEMA,
    onProgress
  );
}

/**
 * Transforme un sujet d'annale (photos ou PDF, avec parfois son corrigé ou son barème officiel) en sujet interactif.
 * pages : comme pour transcrire (images préparées ou PDF).
 */
async function importerSujetClaude(fiche, pages, onProgress) {
  const content = [];
  pages.forEach((p, i) => {
    content.push({ type: "text", text: p.kind === "pdf" ? `Document PDF ${p.name || ""}` : `Page ${i + 1}` });
    content.push(
      p.kind === "pdf"
        ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.data } }
        : { type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } }
    );
  });
  content.push({
    type: "text",
    text: `Voici un sujet officiel (annale du bac ou du brevet, Banque nationale de sujets, ou devoir donné en classe), peut-être avec son corrigé ou son barème. Transforme-le en sujet interactif pour un élève de ${getSettings().classe || "Seconde"} :
- Recopie fidèlement les énoncés et les consignes ; les documents (textes, tableaux, données) en Markdown ; décris en texte les cartes, graphiques et images.
- Découpe en questions où l'élève répond juste en dessous ; une question longue (dissertation, commentaire, question problématisée, problème) reste une seule question.
- Garde les points officiels s'ils sont indiqués ; sinon propose un barème réaliste (total ${20 - POINTS_LANGUE} pour les questions, les ${POINTS_LANGUE} derniers points vont à la maîtrise de la langue).
- Réponse attendue : utilise le corrigé officiel s'il est fourni, sinon rédige-la. Barème détaillé critère par critère, sur les idées et non sur des mots exacts.
- Indique le type d'exercice officiel et sa méthode. Le titre reprend l'origine du sujet (ex : « Bac 2025, Métropole »).
- N'invente pas de questions qui ne sont pas dans le document.
${referentielPourSujet(fiche.matiere)}`,
  });
  return runJSON({ ...baseParams({ effort: "medium", maxTokens: 32000, system: systemCours(fiche) }), messages: [{ role: "user", content }] }, SUJET_SCHEMA, onProgress);
}

/** reponses : tableau des réponses de l'élève, dans l'ordre des questions du sujet. */
async function corrigerCopieClaude(fiche, sujet, reponses, onProgress) {
  let n = 0;
  const copie = sujet.exercices
    .map(
      (ex, i) =>
        `## Exercice ${i + 1} : ${ex.titre}${ex.type_exercice ? ` (${ex.type_exercice})` : ""}\n${ex.methode ? `Méthode attendue : ${ex.methode}\n` : ""}${ex.document ? `Document :\n${ex.document}\n` : ""}` +
        ex.questions
          .map((q) => {
            n++;
            return `### Question ${n} (${q.points} pts) : ${q.enonce}\nRéponse attendue : ${q.reponse_attendue}\nBarème : ${q.bareme.map((b) => `${b.critere} (${b.points})`).join(" ; ")}\n<reponse_eleve>\n${reponses[n - 1] || ""}\n</reponse_eleve>`;
          })
          .join("\n\n")
    )
    .join("\n\n");
  return runJSON(
    {
      ...baseParams({ effort: "medium", maxTokens: 16000, system: systemCours(fiche) }),
      messages: [{ role: "user", content: `${copie}\n\nCorrige cette copie question par question, puis note la maîtrise de la langue sur l'ensemble de la copie.\n${METHODE_CORRECTION}\n${grillePourCorrection(fiche.matiere)}\n${GRILLE_LANGUE.replace(/sur \d+ points/, `sur ${sujet.langueSur ?? POINTS_LANGUE} points`)}` }],
    },
    CORRECTION_SCHEMA,
    onProgress
  );
}

async function plusDeFlashcardsClaude(fiche, existantes, onProgress) {
  const data = await runJSON(
    {
      ...baseParams({ effort: "low", maxTokens: 8000, system: systemCours(fiche) }),
      messages: [
        {
          role: "user",
          content: `Crée 10 nouvelles flashcards sur le cours, sur des notions différentes de celles-ci :\n${existantes.map((c) => "- " + court(c.recto, 60)).join("\n")}\n\n${REGLES_FLASHCARDS}`,
        },
      ],
    },
    FLASHCARDS_SCHEMA,
    onProgress
  );
  return data.flashcards;
}

async function trouverConnexesClaude(fiche, onProgress) {
  const data = await runJSON(
    {
      ...baseParams({ effort: "low", maxTokens: 4000, system: systemCours(fiche) }),
      messages: [{ role: "user", content: "Propose des sujets connexes à ce cours, adaptés au niveau de l'élève : une notion à revoir avant, une pour approfondir, un lien avec une autre matière." }],
    },
    CONNEXES_SCHEMA,
    onProgress
  );
  return data.connexes;
}

const TYPES_CONNEXE = { prerequis: "à revoir avant ce cours", approfondissement: "pour aller plus loin", autre_matiere: "lien avec une autre matière" };
async function miniFicheClaude(fiche, connexe, onProgress) {
  return run(
    {
      ...baseParams({ effort: "low", maxTokens: 3000, system: systemCours(fiche) }),
      messages: [
        {
          role: "user",
          content: `Rédige une mini-fiche (12 lignes au plus, Markdown) sur « ${connexe.titre} » (${connexe.matiere}, ${TYPES_CONNEXE[connexe.type] || "sujet connexe"}) : définition simple, l'essentiel à savoir, un exemple, puis le lien avec le cours en une phrase.`,
        },
      ],
    },
    onProgress
  );
}

/** history : [{ role: "user" | "assistant", content: string }] */
async function discuterClaude(fiche, history, onProgress) {
  const system = systemCours(fiche);
  system.push({
    type: "text",
    text: `${personaTuteur()} Tu réponds à ses questions sur ce cours : explications simples, exemples concrets, et parfois une petite question pour vérifier qu'il a compris. 8 lignes au plus, sauf s'il demande plus.`,
  });
  // Les 10 derniers messages suffisent : moins de texte renvoyé à chaque question.
  const messages = history.slice(-10);
  while (messages.length && messages[0].role !== "user") messages.shift();
  return run({ ...baseParams({ effort: "low", maxTokens: 4000, system }), messages }, onProgress);
}

/**
 * Diagnostic de connexion, étape par étape, pour comprendre un refus.
 * Renvoie une liste de { ok, titre, detail } et ne montre jamais une clé en entier.
 */
export async function diagnostic() {
  const s = getSettings();
  const lignes = [];
  const ajoute = (ok, titre, detail = "") => lignes.push({ ok, titre, detail });
  ajoute(true, "Mode de connexion", { cle: "Clé API sur cet appareil", serveur: "Code famille (clé sur le serveur)", compte: `Compte élève (${s.identifiant || "?"})` }[s.connexion] || s.connexion);
  ajoute(navigator.onLine !== false, "Internet", navigator.onLine === false ? "Le téléphone se dit hors ligne." : "Le téléphone se dit en ligne.");
  ajoute(true, "Navigateur intégré", navigator.userAgent.match(/Chrome\/[\d.]+/)?.[0] || navigator.userAgent.slice(0, 80));
  if (s.connexion === "cle") {
    const k = nettoyerCle(s.apiKey);
    ajoute(k.startsWith("sk-ant-"), "Clé enregistrée", `${k.slice(0, 10)}…${k.slice(-4)} (${k.length} caractères)${k.startsWith("sk-ant-") ? "" : " : une clé Claude commence par sk-ant-"}`);
    try {
      const r = await fetch("https://api.anthropic.com/v1/models?limit=1", {
        headers: { "x-api-key": k, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
        cache: "no-store",
      });
      const brut = await r.text();
      let msg = "", deClaude = true;
      try {
        msg = JSON.parse(brut)?.error?.message || "";
      } catch {
        deClaude = false; // une page HTML : la réponse vient d'un filtre, pas de Claude
        msg = brut.slice(0, 120).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      }
      const quoi = { 200: "Clé acceptée par Claude", 401: "Claude refuse cette clé (invalide, révoquée ou mal recopiée)", 403: "Accès interdit : la clé n'a pas les droits, ou un filtre (contrôle parental, réseau) bloque Claude", 429: "Trop de demandes ou limite de dépense atteinte" }[r.status] || `Réponse ${r.status}`;
      ajoute(r.ok, "Réponse de Claude", `${quoi}${msg ? ` · ${msg}` : ""}`);
      if (!r.ok && !deClaude) ajoute(false, "Piste", "La réponse ne vient pas de Claude : un contrôle parental (Family Link, Samsung Kids) ou un filtre de la box bloque sans doute api.anthropic.com. Le compte élève contourne ce problème : tout passe par revizz.netlify.app.");
    } catch (e) {
      ajoute(false, "Réponse de Claude", `Impossible de joindre api.anthropic.com (${e.message}). Un filtre réseau ou un contrôle parental bloque peut-être ce site. Le compte élève passe par revizz.netlify.app à la place.`);
    }
    return lignes;
  }
  const base = adresseServeur(s);
  ajoute(!!base, "Adresse du site", base || "manquante");
  if (!base) return lignes;
  const entetes = s.connexion === "compte" ? { "x-revizz-jeton": s.jeton } : { "x-revizz-code": String(s.code || "").trim() };
  try {
    const r = await fetch(`${base}/api/claude/diagnostic`, { headers: entetes, cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      ajoute(false, "Site Révizz", d?.error?.message || (r.status === 405 ? "Le site n'a pas encore le diagnostic : remets-le en ligne sur Netlify." : `Réponse ${r.status}`));
      return lignes;
    }
    ajoute(true, "Site Révizz", s.connexion === "compte" ? "Compte reconnu" : "Code famille accepté");
    ajoute(d.cle?.prefixeOk && d.cle?.longueur > 40, "Clé enregistrée sur Netlify", `${d.cle?.longueur || 0} caractères${d.cle?.prefixeOk ? "" : ", ne commence pas par sk-ant-"}${d.cle?.nettoyee ? " (des espaces ou guillemets ont été retirés automatiquement)" : ""}`);
    const a = d.anthropic || {};
    ajoute(a.status === 200, "Claude accepte la clé du serveur", a.status === 200 ? "Oui" : `Non (${a.status}) ${a.message || ""}`);
  } catch (e) {
    ajoute(false, "Site Révizz", `Impossible de joindre ${base} (${e.message})`);
  }
  return lignes;
}

async function testerCleClaude() {
  return run({ ...baseParams({ effort: "low", maxTokens: 1000, system: "Réponds en un mot." }), messages: [{ role: "user", content: "OK ?" }] });
}

// ---------- Aiguillage : mode démo (réponses préparées) ou vrai Claude ----------
const choisir = (reel, factice) => (...args) => (getSettings().demo ? factice : reel)(...args);
export const transcrire = choisir(transcrireClaude, demo.transcrire);
export const creerFiche = choisir(creerFicheClaude, demo.creerFiche);
export const genererQCM = choisir(genererQCMClaude, demo.genererQCM);
export const genererSujet = choisir(genererSujetClaude, demo.genererSujet);
export const importerSujet = choisir(importerSujetClaude, (fiche, _pages, onProgress) => demo.genererSujet(fiche, "bac", onProgress));
export const corrigerCopie = choisir(corrigerCopieClaude, demo.corrigerCopie);
export const plusDeFlashcards = choisir(plusDeFlashcardsClaude, demo.plusDeFlashcards);
export const discuter = choisir(discuterClaude, demo.discuter);
export const testerCle = choisir(testerCleClaude, demo.testerCle);
export const trouverConnexes = choisir(trouverConnexesClaude, demo.trouverConnexes);
export const miniFiche = choisir(miniFicheClaude, demo.miniFiche);
export const genererExercices = choisir(genererExercicesClaude, demo.genererExercices);
export const genererDefi = choisir(genererDefiClaude, demo.genererDefi);
export const evaluerDefi = choisir(evaluerDefiClaude, demo.evaluerDefi);
