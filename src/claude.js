// Tout ce qui parle à l'API Claude est ici.
import Anthropic from "@anthropic-ai/sdk";
import { getSettings } from "./store.js";

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

function systemPrompt() {
  const { prenom, classe } = getSettings();
  return [
    `Tu es Révizz, un professeur particulier bienveillant et exigeant qui aide ${prenom || "un élève"} (niveau : ${classe || "collège/lycée"}) à réussir à l'école en France.`,
    "Tu t'adresses à l'élève en le tutoyant, avec des phrases claires et adaptées à son niveau.",
    "Tu respectes les programmes de l'Éducation nationale et le vocabulaire utilisé en classe.",
    "Tu restes fidèle au contenu du cours fourni : tu n'inventes pas de notions absentes, sauf pour compléter une explication de façon exacte.",
    "Pour les formules, écris en texte simple avec des symboles Unicode (x², √, π, ≤, →, H₂O), jamais en LaTeX.",
    "Quand tu écris du Markdown, utilise des titres courts (##), des listes et du **gras** pour les mots importants.",
  ].join("\n");
}

function baseParams({ effort = "medium", maxTokens = 32000 } = {}) {
  const { model } = getSettings();
  const params = {
    model,
    max_tokens: maxTokens,
    system: systemPrompt(),
    output_config: { effort },
    // Met en cache le début de la requête : les questions suivantes sur le même cours coûtent moins cher.
    cache_control: { type: "ephemeral" },
  };
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

const FLASHCARD = obj({ recto: str("Question ou notion, courte"), verso: str("Réponse précise et courte") });

const ANALYSE_SCHEMA = obj({
  titre: str("Titre court du cours"),
  matiere: str("Matière scolaire, ex : Histoire-Géographie, Mathématiques, SVT, Français, Anglais, Physique-Chimie"),
  chapitre: str("Chapitre ou thème, vide si inconnu"),
  transcription: str("Transcription fidèle et complète du texte des pages, remise en ordre, en Markdown"),
  resume: str("Fiche de révision en Markdown : l'essentiel du cours, structuré, facile à apprendre"),
  points_cles: arr(str("Une idée clé à retenir"), "5 à 10 idées clés"),
  vocabulaire: arr(obj({ terme: str("Mot ou notion"), definition: str("Définition simple") }), "Mots et notions à connaître, dates et formules incluses"),
  astuce_memo: str("Un moyen mnémotechnique ou une astuce pour retenir le cours"),
  flashcards: arr(FLASHCARD, "15 à 25 flashcards couvrant tout le cours"),
});

const QCM_SCHEMA = obj({
  questions: arr(
    obj({
      question: str("Énoncé de la question"),
      choix: arr(str("Proposition"), "Exactement 4 propositions"),
      bonne_reponse: { type: "integer", description: "Indice (0 à 3) de la bonne proposition" },
      explication: str("Pourquoi c'est la bonne réponse, en 1 à 3 phrases"),
    }),
    "Les questions du QCM"
  ),
});

const SUJET_SCHEMA = obj({
  titre: str("Titre du sujet"),
  duree: str("Durée conseillée, ex : 30 min"),
  sujet: str("Énoncé complet en Markdown, avec les points de chaque exercice"),
  corrige: str("Corrigé détaillé en Markdown, avec la méthode et les erreurs à éviter"),
});

const FLASHCARDS_SCHEMA = obj({ flashcards: arr(FLASHCARD, "Nouvelles flashcards") });

// ---------- Fonctions utilisées par l'appli ----------

/**
 * pages : [{ kind: "image", mediaType, data }] ou [{ kind: "pdf", data }] (base64 sans préfixe)
 */
export async function analyserCours(pages, note, onProgress) {
  const content = pages.map((p) =>
    p.kind === "pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: p.data } }
      : { type: "image", source: { type: "base64", media_type: p.mediaType, data: p.data } }
  );
  content.push({
    type: "text",
    text: [
      `Voici ${pages.length > 1 ? `les ${pages.length} pages` : "la page"} d'une fiche ou d'un cours (photo, parfois manuscrite).`,
      "1. Transcris fidèlement tout le contenu (corrige seulement les fautes évidentes de lecture).",
      "2. Rédige une fiche de révision claire pour apprendre ce cours.",
      "3. Liste les points clés, le vocabulaire, une astuce mémo et des flashcards.",
      "Si une partie est illisible, indique [illisible] plutôt que d'inventer.",
      note ? `Précision de l'élève : ${note}` : "",
    ].join("\n"),
  });
  return runJSON(
    { ...baseParams({ effort: "medium", maxTokens: 48000 }), messages: [{ role: "user", content }] },
    ANALYSE_SCHEMA,
    onProgress
  );
}

function coursMessage(fiche) {
  return `<cours titre="${fiche.titre}" matiere="${fiche.matiere}">\n${fiche.transcription}\n\n## Fiche de révision\n${fiche.resume}\n</cours>`;
}

const NIVEAUX = {
  facile: "faciles : vérifier que les notions de base sont connues",
  moyen: "de difficulté moyenne, comme dans un contrôle en classe",
  difficile: "difficiles : pièges classiques, application et raisonnement",
};

export async function genererQCM(fiche, niveau, nombre, dejaPosees, onProgress) {
  const deja = dejaPosees.length
    ? `\nNe repose pas ces questions déjà vues :\n${dejaPosees.slice(-40).map((q) => "- " + q).join("\n")}`
    : "";
  const data = await runJSON(
    {
      ...baseParams({ effort: "medium", maxTokens: 24000 }),
      messages: [
        {
          role: "user",
          content: `${coursMessage(fiche)}\n\nCrée un QCM de ${nombre} questions ${NIVEAUX[niveau]}. Chaque question a exactement 4 propositions plausibles et une seule bonne réponse. Varie la position de la bonne réponse.${deja}`,
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

export async function genererSujet(fiche, type, onProgress) {
  return runJSON(
    {
      ...baseParams({ effort: "high", maxTokens: 32000 }),
      messages: [
        {
          role: "user",
          content: `${coursMessage(fiche)}\n\nPrépare un sujet d'entraînement de type « ${TYPES_SUJET[type]} » sur ce cours, réaliste et adapté au niveau de l'élève, avec des exercices variés (questions de cours, application, réflexion). Fournis aussi un corrigé détaillé et un barème.`,
        },
      ],
    },
    SUJET_SCHEMA,
    onProgress
  );
}

export async function corrigerCopie(fiche, sujet, reponse, onProgress) {
  return run(
    {
      ...baseParams({ effort: "high", maxTokens: 16000 }),
      messages: [
        {
          role: "user",
          content: `${coursMessage(fiche)}\n\n<sujet>\n${sujet.sujet}\n</sujet>\n\n<corrige_officiel>\n${sujet.corrige}\n</corrige_officiel>\n\n<copie_eleve>\n${reponse}\n</copie_eleve>\n\nCorrige la copie comme un professeur bienveillant : donne une note sur 20, ce qui est réussi, ce qui manque ou est faux (avec la bonne réponse), puis 3 conseils concrets pour progresser. Réponds en Markdown.`,
        },
      ],
    },
    onProgress
  );
}

export async function plusDeFlashcards(fiche, existantes, onProgress) {
  const data = await runJSON(
    {
      ...baseParams({ effort: "low", maxTokens: 16000 }),
      messages: [
        {
          role: "user",
          content: `${coursMessage(fiche)}\n\nCrée 10 nouvelles flashcards sur ce cours, différentes de celles-ci :\n${existantes.map((c) => "- " + c.recto).join("\n")}`,
        },
      ],
    },
    FLASHCARDS_SCHEMA,
    onProgress
  );
  return data.flashcards;
}

/** history : [{ role: "user" | "assistant", content: string }] */
export async function discuter(fiche, history, onProgress) {
  const messages = [
    {
      role: "user",
      content: `${coursMessage(fiche)}\n\nJe vais te poser des questions sur ce cours. Explique simplement, avec des exemples concrets, et vérifie que j'ai compris en me posant parfois une petite question. Réponses courtes (10 lignes max) sauf si je demande plus.`,
    },
    { role: "assistant", content: "D'accord ! Pose-moi ta question sur ce cours." },
    ...history,
  ];
  return run({ ...baseParams({ effort: "low", maxTokens: 8000 }), messages }, onProgress);
}

export async function testerCle() {
  return run({ ...baseParams({ effort: "low", maxTokens: 2000 }), messages: [{ role: "user", content: "Réponds juste : OK" }] });
}
