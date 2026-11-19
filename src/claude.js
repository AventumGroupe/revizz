// Tout ce qui parle à l'API Claude est ici.
import Anthropic from "@anthropic-ai/sdk";
import { Capacitor } from "@capacitor/core";
import { getSettings, enregistrerConso } from "./store.js";
import * as demo from "./demo.js";
import { nomsPourClaude } from "./matieres.js";
import { zoomer } from "./image.js";

export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5 (le plus intelligent, recommandé)" },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5 (rapide, moitié moins cher)" },
  { id: "claude-haiku-5-5", label: "Claude Haiku 5.5 (très économique)" },
];

// Les modèles qui acceptent le repli automatique côté serveur en cas de refus.
const SUPPORTS_FALLBACK = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

// Adresse du site Révizz : celle saisie, sinon (version web) le site lui-même, sinon celle fixée à la compilation.
export function adresseServeur(s = getSettings()) {
  if (s.serveur) return s.serveur.trim().replace(/\/+$/, "");
  if (!Capacitor.isNativePlatform() && /^https?:$/.test(location.protocol)) return location.origin;
  return (import.meta.env.VITE_REVIZZ_SERVEUR || "").replace(/\/+$/, "");
}
/** L'appli peut-elle appeler Claude ? (démo, clé personnelle, ou serveur + code famille) */
export function estConfigure(s = getSettings()) {
  if (s.demo) return true;
  return s.connexion === "cle" ? !!s.apiKey : !!(s.code && adresseServeur(s));
}

function client() {
  const s = getSettings();
  if (s.connexion === "cle") {
    if (!s.apiKey) throw new Error("Ajoute d'abord ta clé API Claude dans les Réglages ⚙️.");
    // Clé personnelle : elle reste sur l'appareil et part directement chez Anthropic.
    return new Anthropic({ apiKey: s.apiKey, dangerouslyAllowBrowser: true, maxRetries: 3 });
  }
  const base = adresseServeur(s);
  if (!base || !s.code) throw new Error("Saisis l'adresse du site Révizz et le code famille dans les Réglages ⚙️.");
  // Serveur Révizz : la vraie clé est sur Netlify ; l'appareil n'envoie que le code famille.
  return new Anthropic({
    apiKey: "relais-revizz",
    baseURL: `${base}/api/claude`,
    dangerouslyAllowBrowser: true,
    maxRetries: 3,
    defaultHeaders: { "x-revizz-code": s.code },
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
    return new Error(getSettings().connexion === "cle" ? "Clé API refusée. Vérifie-la dans les Réglages ⚙️." : "Le serveur Révizz refuse la clé API : vérifie ANTHROPIC_API_KEY dans Netlify.");
  if (err instanceof Anthropic.NotFoundError && getSettings().connexion !== "cle") return new Error("Adresse du site Révizz introuvable : vérifie-la dans les Réglages ⚙️.");
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
async function transcrireClaude(pages, { matiere, note, type } = {}, onProgress, onZoom) {
  const content = [];
  pages.forEach((p, i) => {
    content.push({ type: "text", text: p.kind === "pdf" ? `Document PDF (pages suivantes)` : `Page ${i + 1} (${p.largeur} × ${p.hauteur} px)` });
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
      `Transcris ${pages.length > 1 ? `ces ${pages.length} pages` : "cette page"} (${type === "imprime" ? "document plutôt imprimé" : "prise de notes manuscrite"}).`,
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
    let message;
    try {
      const stream = client().beta.messages.stream({ ...params, messages });
      let chars = 0, acc = "";
      stream.on("text", (delta) => {
        chars += delta.length;
        acc += delta;
        onProgress?.(chars, acc);
      });
      message = await stream.finalMessage();
      enregistrerConso(message.usage);
    } catch (err) {
      throw explainError(err);
    }
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
export const transcrire = choisir(transcrireClaude, demo.transcrire);
export const creerFiche = choisir(creerFicheClaude, demo.creerFiche);
export const genererQCM = choisir(genererQCMClaude, demo.genererQCM);
export const genererSujet = choisir(genererSujetClaude, demo.genererSujet);
export const corrigerCopie = choisir(corrigerCopieClaude, demo.corrigerCopie);
export const plusDeFlashcards = choisir(plusDeFlashcardsClaude, demo.plusDeFlashcards);
export const discuter = choisir(discuterClaude, demo.discuter);
export const testerCle = choisir(testerCleClaude, demo.testerCle);
export const trouverConnexes = choisir(trouverConnexesClaude, demo.trouverConnexes);
export const miniFiche = choisir(miniFicheClaude, demo.miniFiche);
