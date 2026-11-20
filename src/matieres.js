// Matières : un catalogue des matières du collège et du lycée, et la liste « Mes matières »
// que l'élève complète au fur et à mesure (catalogue ou matière créée par lui).
import { lire, ecrire } from "./store.js";
import { ic } from "./icons.js";

// Catalogue : icône, couleur et mots qui permettent de reconnaître la matière.
export const CATALOGUE = [
  { nom: "Français", icone: "livre", emoji: "📖", couleur: "#e8590c", mots: ["fran", "littérature", "grammaire", "orthographe", "conjugaison"] },
  { nom: "Mathématiques", icone: "maths", emoji: "📐", couleur: "#0f9d8a", mots: ["math", "géométrie", "algèbre", "probabilit", "statistique"] },
  { nom: "Histoire-Géographie", icone: "globe", emoji: "🌍", couleur: "#c88a04", mots: ["histoire-g", "histoire g", "histoire", "géographie", "geographie"] },
  { nom: "EMC", icone: "balance", emoji: "⚖️", couleur: "#c92a2a", mots: ["emc", "enseignement moral", "civique"] },
  { nom: "SES", icone: "graphique", emoji: "📊", couleur: "#0c8599", mots: ["ses", "sciences économiques", "économique", "sociolog"] },
  { nom: "SVT", icone: "pousse", emoji: "🌱", couleur: "#2f9e44", mots: ["svt", "sciences de la vie", "biolog"] },
  { nom: "Physique-Chimie", icone: "fiole", emoji: "⚗️", couleur: "#1c7ed6", mots: ["physique", "chimie"] },
  { nom: "SNT", icone: "ecran", emoji: "💻", couleur: "#1098ad", mots: ["snt", "sciences numériques"] },
  { nom: "Anglais", icone: "langues", emoji: "🇬🇧", couleur: "#d6336c", mots: ["anglais", "english"] },
  { nom: "Espagnol", icone: "langues", emoji: "🇪🇸", couleur: "#f08c00", mots: ["espagnol", "español"] },
  { nom: "Italien", icone: "langues", emoji: "🇮🇹", couleur: "#5c940d", mots: ["italien", "italiano"] },
  { nom: "Allemand", icone: "langues", emoji: "🇩🇪", couleur: "#868e96", mots: ["allemand", "deutsch"] },
  { nom: "Enseignement scientifique", icone: "microscope", emoji: "🔬", couleur: "#087f5b", mots: ["enseignement scientifique"] },
  { nom: "Philosophie", icone: "cerveau", emoji: "💭", couleur: "#495b70", mots: ["philo"] },
  { nom: "HGGSP", icone: "carte", emoji: "🗺️", couleur: "#a5651e", mots: ["hggsp", "géopolitique", "sciences politiques"] },
  { nom: "NSI", icone: "code", emoji: "🖥️", couleur: "#1864ab", mots: ["nsi", "numérique et sciences informatiques", "informatique"] },
  { nom: "Sciences de l'ingénieur", icone: "outil", emoji: "🛠️", couleur: "#495057", mots: ["sciences de l'ingénieur", "si"] },
  { nom: "HLP", icone: "parchemin", emoji: "📜", couleur: "#9c6644", mots: ["hlp", "humanités"] },
  { nom: "LLCER", icone: "langues", emoji: "🗣️", couleur: "#e03131", mots: ["llcer", "langues, littératures"] },
  { nom: "Langues anciennes", icone: "monument", emoji: "🏛️", couleur: "#a0522d", mots: ["latin", "grec"] },
  { nom: "Arts plastiques", icone: "palette", emoji: "🎨", couleur: "#e64980", mots: ["arts plastiques", "art plastique"] },
  { nom: "Musique", icone: "musique", emoji: "🎵", couleur: "#f76707", mots: ["musique", "musical"] },
  { nom: "EPS", icone: "trophee", emoji: "🏃", couleur: "#2b8a3e", mots: ["eps", "éducation physique"] },
  { nom: "Technologie", icone: "engrenage", emoji: "⚙️", couleur: "#5f6b7a", mots: ["technologie"] },
];
const AUTRE = { nom: "Autre", icone: "dossier", emoji: "📁", couleur: "#64748b", mots: [] };

// Matières de départ : celles de Seconde générale de l'élève.
const PAR_DEFAUT = ["Français", "Mathématiques", "Histoire-Géographie", "EMC", "SES", "SVT", "Physique-Chimie", "SNT", "Anglais", "Espagnol", "Italien"];

// Pour créer une matière : icônes et couleurs proposées.
export const EMOJIS = ["📘", "🧪", "💻", "🗣️", "🎭", "🧭", "🧮", "🎨", "🎵", "⚽", "📝", "🔭", "🌐", "💡"];
export const COULEURS = ["#1c7ed6", "#0f9d8a", "#2f9e44", "#c88a04", "#e8590c", "#c92a2a", "#d6336c", "#1098ad", "#5f6b7a", "#a0522d"];

const KEY = "revizz.matieres";
const duCatalogue = (nom) => CATALOGUE.find((m) => m.nom === nom);

/** « Mes matières », dans l'ordre choisi, suivies de « Autre ». */
export function getMatieres() {
  const liste = lire(KEY, null) ?? PAR_DEFAUT.map((nom) => ({ ...duCatalogue(nom) }));
  return [...liste, AUTRE];
}
const sauver = (liste) => {
  ecrire(KEY, liste.filter((m) => m.nom !== AUTRE.nom));
  ecrire("revizz.matieresMaj", Date.now()); // pour la synchronisation : la liste la plus récente gagne
};

export function ajouterMatiere({ nom, emoji = "📘", couleur = COULEURS[0] }) {
  nom = nom.trim();
  if (!nom) return null;
  const liste = getMatieres();
  const existe = liste.find((m) => m.nom.toLowerCase() === nom.toLowerCase());
  if (existe) return existe.nom;
  const m = duCatalogue(nom) ? { ...duCatalogue(nom) } : { nom, emoji, couleur, mots: [nom.toLowerCase()], perso: true };
  sauver([...liste, m]);
  return m.nom;
}
export function retirerMatiere(nom) {
  sauver(getMatieres().filter((m) => m.nom !== nom));
}
/** Matières du catalogue pas encore dans « Mes matières ». */
export const suggestions = () => CATALOGUE.filter((c) => !getMatieres().some((m) => m.nom === c.nom));

/** Noms proposés à Claude au scan : « Mes matières » + « Autre ». */
export const nomsPourClaude = () => getMatieres().map((m) => m.nom);

// Un mot court (ses, snt, si…) doit être un mot entier ; un mot long peut être un début de mot.
function contient(texte, mot) {
  if (mot.length > 4) return texte.includes(mot);
  return new RegExp(`(^|[^a-zà-ÿ])${mot}([^a-zà-ÿ]|$)`).test(texte);
}

/**
 * Ramène un texte libre (« Histoire-Géo », « maths »…) à une matière.
 * Une matière reconnue dans le catalogue est ajoutée à « Mes matières » si besoin.
 */
export function normaliserMatiere(texte = "") {
  const mes = getMatieres();
  const exacte = mes.find((m) => m.nom.toLowerCase() === texte.toLowerCase());
  if (exacte) return exacte.nom;
  const t = texte.toLowerCase();
  const parmiMes = mes.find((m) => m.mots?.some((mot) => contient(t, mot)));
  if (parmiMes) return parmiMes.nom;
  const auCatalogue = CATALOGUE.find((m) => m.mots.some((mot) => contient(t, mot)));
  if (auCatalogue) return ajouterMatiere(auCatalogue);
  return AUTRE.nom;
}

export const infoMatiere = (nom) => getMatieres().find((m) => m.nom === nom) || duCatalogue(nom) || AUTRE;
export const couleur = (nom) => infoMatiere(nom).couleur;
export const emoji = (nom) => infoMatiere(nom).emoji;

/** Pastille colorée de la matière : icône au trait (ou l'emoji choisi pour une matière créée par l'élève). */
export function pastille(nom, taille = "m") {
  const m = infoMatiere(nom);
  const icone = duCatalogue(nom)?.icone || m.icone;
  const px = { s: 14, m: 18, l: 22 }[taille] || 18;
  const contenu = icone ? ic(icone, px) : `<span class="pastille-emoji">${m.emoji || "📘"}</span>`;
  return `<span class="pastille pastille-${taille}" style="--c:${m.couleur}">${contenu}</span>`;
}
