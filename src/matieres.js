// Liste fixe des matières : un classement stable, avec une icône et une couleur chacune.
export const MATIERES = [
  { nom: "Français", emoji: "📖", couleur: "#e8590c", mots: ["fran", "littérature", "grammaire", "orthographe", "conjugaison", "lettres"] },
  { nom: "Mathématiques", emoji: "📐", couleur: "#0f9d8a", mots: ["math", "géométrie", "algèbre", "calcul", "probabilit"] },
  { nom: "Histoire-Géographie", emoji: "🌍", couleur: "#c88a04", mots: ["hist", "géo", "geo"] },
  { nom: "EMC", emoji: "⚖️", couleur: "#c92a2a", mots: ["emc", "civique", "moral"] },
  { nom: "SVT", emoji: "🌱", couleur: "#2f9e44", mots: ["svt", "vie et de la terre", "biolog"] },
  { nom: "Physique-Chimie", emoji: "⚗️", couleur: "#1c7ed6", mots: ["phys", "chim"] },
  { nom: "Technologie", emoji: "⚙️", couleur: "#495057", mots: ["techno", "informatique", "nsi", "sciences de l'ingénieur"] },
  { nom: "Anglais", emoji: "🇬🇧", couleur: "#d6336c", mots: ["angl", "english"] },
  { nom: "Espagnol", emoji: "🇪🇸", couleur: "#f08c00", mots: ["espa"] },
  { nom: "Allemand", emoji: "🇩🇪", couleur: "#868e96", mots: ["allem", "deutsch"] },
  { nom: "Langues anciennes", emoji: "🏛️", couleur: "#a0522d", mots: ["latin", "grec"] },
  { nom: "Philosophie", emoji: "💭", couleur: "#495b70", mots: ["philo"] },
  { nom: "SES", emoji: "📊", couleur: "#0c8599", mots: ["ses", "économ", "social"] },
  { nom: "Arts et musique", emoji: "🎨", couleur: "#e64980", mots: ["arts", "plastique", "musique", "musical"] },
  { nom: "Autre", emoji: "📁", couleur: "#64748b", mots: [] },
];
export const NOMS_MATIERES = MATIERES.map((m) => m.nom);

const parNom = Object.fromEntries(MATIERES.map((m) => [m.nom, m]));

// Ramène un texte libre (« Histoire-Géo », « maths »…) à une matière de la liste.
export function normaliserMatiere(texte = "") {
  if (parNom[texte]) return texte;
  const t = texte.toLowerCase();
  const trouvee = MATIERES.find((m) => m.mots.some((mot) => t.includes(mot)));
  return trouvee ? trouvee.nom : "Autre";
}
export const infoMatiere = (nom) => parNom[nom] || parNom.Autre;
export const couleur = (nom) => infoMatiere(nom).couleur;
export const emoji = (nom) => infoMatiere(nom).emoji;
