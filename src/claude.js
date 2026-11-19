// Tout ce qui parle à l'API Claude est ici.
import Anthropic from "@anthropic-ai/sdk";
import { getSettings, enregistrerConso } from "./store.js";
import * as demo from "./demo.js";
import { NOMS_MATIERES } from "./matieres.js";

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (le plus intelligent, recommandé)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (rapide, moitié moins cher)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (très économique)" },
];

// Les modèles qui acceptent le repli automatique côté serveur en cas de refus.
const SUPPORTS_FALLBACK = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

function client() {
  const { apiKey } = getSettings();
  if (!apiKey) throw new Error("Ajoute d'abord ta clé API Claude dans les Réglages ⚙️.");
  // L'appli tourne sur le téléphone : la clé reste sur l'appareil et part directement chez Anthropic.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 3 });
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
    "Formules en texte simple avec symboles Unicode (x², √, π, ≤, →, H₂O), jamais en LaTeX.",
    "Markdown : titres courts (##), listes, **gras** pour les mots importants. Sois concis : pas de répétition ni de formule de politesse.",
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
  if (err instanceof Anthropic.AuthenticationError) return new Error("Clé API refusée. Vérifie-la dans les Réglages ⚙️.");
  if (err instanceof Anthropic.PermissionDeniedError) return new Error("Cette clé n'a pas accès à ce modèle. Essaie un autre modèle dans les Réglages.");
  if (err instanceof Anthropic.RateLimitError) return new Error("Trop de demandes d'un coup. Attends une minute et réessaie.");
  if (err instanceof Anthropic.BadRequestError) {
    if (/credit|billing|balance/i.test(err.message)) return new Error("Le crédit du compte Claude est épuisé. Demande à un parent de recharger le compte.");
    return new Error("Claude n'a pas pu traiter la demande : " + err.message);
  }
  if (err instanceof Anthropic.InternalServerError) return new Error("Claude est surchargé pour le moment. Réessaie dans un instant.");
  if (err instanceof Anthropic.APIConnectionError) return new Error("Pas de connexion internet. Vérifie le Wi-Fi ou les données mobiles.");
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

const ANALYSE_SCHEMA = obj({
  titre: str("Titre court du cours"),
  matiere: { type: "string", enum: NOMS_MATIERES, description: "Matière scolaire" },
  chapitre: str("Chapitre ou grand thème du programme, court (ex : « La Révolution française », « Théorème de Pythagore »)"),
  transcription: str("Texte fidèle et complet des pages, remis en ordre, en Markdown sobre"),
  resume: str("Fiche de révision synthétique en Markdown (pas une copie de la transcription)"),
  points_cles: arr(str("Une idée clé, une phrase"), "4 à 8 idées clés"),
  vocabulaire: arr(obj({ terme: str("Mot ou notion"), definition: str("Définition simple, une phrase") }), "Mots, dates et formules essentiels, 10 au maximum"),
  astuce_memo: str("Un moyen mnémotechnique court"),
  flashcards: arr(FLASHCARD, "12 à 20 flashcards couvrant tout le cours"),
});

const QCM_SCHEMA = obj({
  questions: arr(
    obj({
      question: str("Énoncé précis et autonome"),
      choix: arr(str("Proposition courte"), "Exactement 4 propositions"),
      bonne_reponse: { type: "integer", description: "Indice (0 à 3) de la bonne proposition" },
      explication: str("Pourquoi c'est la bonne réponse, en 1 ou 2 phrases"),
    }),
    "Les questions du QCM"
  ),
});

const SUJET_SCHEMA = obj({
  titre: str("Titre du sujet"),
  duree: str("Durée conseillée, ex : 30 min"),
  sujet: str("Énoncé complet en Markdown, avec les points de chaque exercice"),
  corrige: str("Corrigé en Markdown : réponses attendues, méthode, erreurs à éviter"),
});

const FLASHCARDS_SCHEMA = obj({ flashcards: arr(FLASHCARD, "Nouvelles flashcards") });

// ---------- Fonctions utilisées par l'appli ----------

/**
 * pages : [{ kind: "image", mediaType, data }] ou [{ kind: "pdf", data }] (base64 sans préfixe)
 */
async function analyserCoursClaude(pages, note, matiere, onProgress) {
  const content = pages.map((p) =>
    p.kind === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.data } }
      : { type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } }
  );
  content.push({
    type: "text",
    text: [
      `Voici ${pages.length > 1 ? `les ${pages.length} pages` : "la page"} d'une fiche ou d'un cours (photo, parfois manuscrite).`,
      "1. Transcris fidèlement le contenu (corrige seulement les fautes évidentes de lecture) ; si une partie est illisible, écris [illisible].",
      "2. Rédige une fiche de révision synthétique : l'essentiel à apprendre, sans recopier la transcription.",
      "3. Ajoute les points clés, le vocabulaire essentiel, une astuce mémo et des flashcards.",
      REGLES_FLASHCARDS,
      matiere ? `Matière : ${matiere}.` : "",
      note ? `Précision de l'élève : ${note}` : "",
    ].join("\n"),
  });
  // Lecture de l'écriture manuscrite : on garde un effort moyen pour la fiabilité.
  return runJSON(
    { ...baseParams({ effort: "medium", maxTokens: 32000 }), messages: [{ role: "user", content }] },
    ANALYSE_SCHEMA,
    onProgress
  );
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
          content: `Crée un QCM de ${nombre} questions ${NIVEAUX[niveau]} sur le cours. Chaque question est précise et autonome (elle nomme le sujet), avec exactement 4 propositions plausibles et une seule bonne réponse. Varie la position de la bonne réponse.${deja}`,
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

export const TYPES_SUJET = {
  controle: "Contrôle en classe (30 à 55 min)",
  express: "Interro express (10 min)",
  brevet: "Sujet type Brevet",
  bac: "Sujet type Bac",
  oral: "Préparation à l'oral",
};

async function genererSujetClaude(fiche, type, onProgress) {
  return runJSON(
    {
      ...baseParams({ effort: "medium", maxTokens: 24000, system: systemCours(fiche) }),
      messages: [
        {
          role: "user",
          content: `Prépare un sujet d'entraînement de type « ${TYPES_SUJET[type]} » sur le cours, réaliste et adapté au niveau de l'élève, avec des exercices variés (questions de cours, application, réflexion) et un barème. Corrigé : réponses attendues et méthode, sans paraphraser l'énoncé.`,
        },
      ],
    },
    SUJET_SCHEMA,
    onProgress
  );
}

async function corrigerCopieClaude(fiche, sujet, reponse, onProgress) {
  return run(
    {
      ...baseParams({ effort: "medium", maxTokens: 12000, system: systemCours(fiche) }),
      messages: [
        {
          role: "user",
          content: `<sujet>\n${sujet.sujet}\n</sujet>\n\n<corrige>\n${sujet.corrige}\n</corrige>\n\n<copie_eleve>\n${reponse}\n</copie_eleve>\n\nCorrige la copie en professeur bienveillant, en Markdown et en 25 lignes au plus : note sur 20, ce qui est réussi, ce qui manque ou est faux (avec la bonne réponse), puis 3 conseils concrets.`,
        },
      ],
    },
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

/** history : [{ role: "user" | "assistant", content: string }] */
async function discuterClaude(fiche, history, onProgress) {
  const system = systemCours(fiche);
  system.push({
    type: "text",
    text: "Tu réponds aux questions de l'élève sur ce cours : explications simples, exemples concrets, et parfois une petite question pour vérifier qu'il a compris. 8 lignes au plus, sauf s'il demande plus.",
  });
  // Les 10 derniers messages suffisent : moins de texte renvoyé à chaque question.
  const messages = history.slice(-10);
  while (messages.length && messages[0].role !== "user") messages.shift();
  return run({ ...baseParams({ effort: "low", maxTokens: 4000, system }), messages }, onProgress);
}

async function testerCleClaude() {
  return run({ ...baseParams({ effort: "low", maxTokens: 1000, system: "Réponds en un mot." }), messages: [{ role: "user", content: "OK ?" }] });
}

// ---------- Aiguillage : mode démo (réponses préparées) ou vrai Claude ----------
const choisir = (reel, factice) => (...args) => (getSettings().demo ? factice : reel)(...args);
export const analyserCours = choisir(analyserCoursClaude, demo.analyserCours);
export const genererQCM = choisir(genererQCMClaude, demo.genererQCM);
export const genererSujet = choisir(genererSujetClaude, demo.genererSujet);
export const corrigerCopie = choisir(corrigerCopieClaude, demo.corrigerCopie);
export const plusDeFlashcards = choisir(plusDeFlashcardsClaude, demo.plusDeFlashcards);
export const discuter = choisir(discuterClaude, demo.discuter);
export const testerCle = choisir(testerCleClaude, demo.testerCle);
