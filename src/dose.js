// « Dose du jour » : une petite quantité de cartes chaque jour, choisies par ordre d'importance,
// au lieu d'afficher tout le stock en retard (103 cartes, ça décourage).
// - quota réglable (10, 15 ou 25 cartes), +10 quand un contrôle approche ;
// - au plus 8 cartes jamais vues par jour, pour qu'une nouvelle fiche de 30 cartes n'écrase pas tout ;
// - priorité : chapitres du prochain contrôle, puis cartes ratées, puis les plus en retard, puis les nouvelles.
import { getFiches, getSettings, estDue } from "./store.js";
import { aujourdhui } from "./jeu.js";
import { aVenir, joursRestants } from "./controles.js";

export const QUOTAS = [10, 15, 25];
const NOUVELLES_MAX = 8;
const SECONDES_PAR_CARTE = 20;
export const TAILLE_BONUS = 10;

function controleProche() {
  const c = aVenir()[0];
  return c && joursRestants(c) <= 7 ? c : null;
}
export function quota() {
  const base = Number(getSettings().doseCartes) || 15;
  const c = controleProche();
  return base + (c && joursRestants(c) <= 3 ? 10 : 0);
}
export const faitesAujourdhui = () => aujourdhui().carte || 0;
const nouvellesVuesAujourdhui = () => aujourdhui().carte_nouvelle || 0;

/** Toutes les cartes à revoir, triées par priorité. filtre(f) limite aux fiches voulues. */
function candidates(filtre = () => true) {
  const c = controleProche();
  const duControle = (f) => c && f.matiere === c.matiere && (!c.chapitres?.length || c.chapitres.includes(f.chapitre || "Sans chapitre"));
  const liste = [];
  for (const f of getFiches().filter(filtre)) {
    for (const carte of f.flashcards || []) {
      if (!estDue(carte)) continue;
      const nouvelle = !carte.prochaine;
      // Plus le score est petit, plus la carte passe tôt.
      let prio = nouvelle ? 3 : carte.boite === 0 ? 1 : 2;
      if (duControle(f)) prio -= 1;
      liste.push({ ...carte, ficheId: f.id, nouvelle, prio, retard: carte.prochaine || 0 });
    }
  }
  return liste.sort((a, b) => a.prio - b.prio || a.retard - b.retard);
}

/** Sélectionne n cartes en respectant la limite de nouvelles cartes du jour. */
export function selection(n, filtre) {
  let nouvellesRestantes = Math.max(0, NOUVELLES_MAX - nouvellesVuesAujourdhui());
  const out = [];
  for (const c of candidates(filtre)) {
    if (out.length >= n) break;
    if (c.nouvelle) {
      if (nouvellesRestantes <= 0) continue;
      nouvellesRestantes--;
    }
    out.push(c);
  }
  return out;
}

/** État de la dose du jour (pour l'accueil). */
export function etatDose(filtre) {
  const q = quota();
  const faites = faitesAujourdhui();
  const dispo = selection(Math.max(0, q - faites), filtre).length;
  const restant = Math.min(Math.max(0, q - faites), dispo);
  const reserve = candidates(filtre).length - restant;
  return {
    quota: q,
    faites: Math.min(faites, q),
    restant,
    reserve: Math.max(0, reserve),
    finie: restant === 0 && faites > 0,
    rien: restant === 0 && faites === 0,
    minutes: Math.max(1, Math.round((restant * SECONDES_PAR_CARTE) / 60)),
    controle: controleProche(),
  };
}

/** Nombre de cartes à montrer pour une fiche ou une matière (jamais le stock entier). */
export function aMontrer(filtre) {
  return Math.min(selection(Math.max(quota(), TAILLE_BONUS), filtre).length, Math.max(quota(), TAILLE_BONUS));
}
