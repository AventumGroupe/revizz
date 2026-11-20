// Parcours en 3 paliers par chapitre : « Je sais », « Je sais faire », « Je vais plus loin ».
// Même règle pour l'écran du chapitre et pour le planning des contrôles.
import { getFiches, getProgres, sur20 } from "./store.js";

export const fichesDuChapitre = (m, c) => getFiches().filter((f) => f.matiere === m && (f.chapitre || "Sans chapitre") === c);

export const SEUILS = { cartesConnues: 80, noteQcm: 16, exercices: 3 };

/**
 * Palier 1 validé : 80 % des cartes du chapitre sues au moins une fois et un QCM du chapitre à 16/20 ou plus.
 * Palier 2 validé : 3 exercices d'application réussis (sans le 3e coup de pouce).
 * Palier 3 validé : un défi jugé réussi par Claude.
 */
export function etatPaliers(m, c) {
  const p = getProgres(m, c);
  const fiches = fichesDuChapitre(m, c);
  const cartes = fiches.flatMap((f) => f.flashcards || []);
  const connues = cartes.length ? Math.round((cartes.filter((x) => x.boite >= 1).length / cartes.length) * 100) : 0;
  const notes = [...fiches.flatMap((f) => f.qcm || []), ...(p.qcmsChap || []), ...(p.finals || [])].map((q) => sur20(q.score, q.total));
  const meilleur = notes.length ? Math.max(...notes) : null;
  const p1 = connues >= SEUILS.cartesConnues && meilleur !== null && meilleur >= SEUILS.noteQcm;
  const reussis = p.p2?.reussis || 0;
  const p2 = reussis >= SEUILS.exercices;
  const p3 = !!p.p3?.valide;
  return { connues, meilleur, p1, reussis, p2, p3, note3: p.p3?.evaluation?.note ?? null, actuel: !p1 ? 1 : !p2 ? 2 : !p3 ? 3 : 4 };
}
