// Le côté jeu de Révizz : gouttes d'encre (points), niveaux, objectif du jour, quêtes du jour et badges.
// Chaque appareil compte ses gouttes jour par jour ; la synchronisation additionne les appareils sans rien compter deux fois.
import { lire, ecrire, getSettings, getStats, getFiches, uid } from "./store.js";

export const OBJECTIF_JOUR = 30;
const BONUS_QUETE = 10;
const jour = () => new Date().toISOString().slice(0, 10);
const cleJeu = () => (getSettings().demo ? "revizz.jeuDemo" : "revizz.jeu");
function appareil() {
  let a = lire("revizz.appareil", null);
  if (!a) ecrire("revizz.appareil", (a = uid()));
  return a;
}
const etat = () => ({ jours: {}, badges: {}, ...lire(cleJeu(), {}) });

// ---------- Niveaux ----------
const TITRES = ["Apprenti", "Curieux", "Studieux", "Bûcheur", "Malin", "Expert", "Érudit", "Savant", "Sage", "Maître", "Grand maître", "Légende"];
const seuil = (n) => 25 * n * (n + 1); // gouttes nécessaires pour atteindre le niveau n+1 : 50, 150, 300, 500…
export function niveauDe(gouttes) {
  let n = 0;
  while (gouttes >= seuil(n + 1)) n++;
  const bas = seuil(n), haut = seuil(n + 1);
  return { niveau: n + 1, titre: TITRES[Math.min(n, TITRES.length - 1)], dans: gouttes - bas, pour: haut - bas, pct: Math.round(((gouttes - bas) / (haut - bas)) * 100) };
}

// ---------- Totaux ----------
function totaux(e = etat(), filtreJour) {
  const t = { g: 0 };
  for (const [k, v] of Object.entries(e.jours)) {
    if (filtreJour && !k.startsWith(filtreJour + "|")) continue;
    t.g += v.g || 0;
    for (const [c, x] of Object.entries(v.n || {})) t[c] = (t[c] || 0) + x;
  }
  return t;
}
export const gouttesTotales = () => totaux().g;
export const aujourdhui = () => totaux(etat(), jour());

// ---------- Quêtes du jour (3 par jour, les mêmes sur tous les appareils) ----------
const QUETES = [
  { id: "cartes10", txt: "Revoir 10 cartes", c: "carte", but: 10 },
  { id: "cartes5", txt: "Revoir 5 cartes", c: "carte", but: 5 },
  { id: "sues6", txt: "Savoir 6 cartes", c: "carte_sue", but: 6 },
  { id: "qcm1", txt: "Terminer un QCM", c: "qcm", but: 1 },
  { id: "qcm16", txt: "Avoir 16/20 ou plus à un QCM", c: "qcm16", but: 1 },
  { id: "prof2", txt: "Poser 2 questions au prof", c: "prof", but: 2 },
  { id: "sujet1", txt: "Rendre un sujet d'entraînement", c: "sujet", but: 1 },
  { id: "exo2", txt: "Réussir 2 exercices d'application", c: "exo", but: 2 },
];
export function quetesDuJour() {
  const j = jour();
  let h = 0;
  for (const ch of j) h = (h * 31 + ch.charCodeAt(0)) | 0;
  const pool = [...QUETES];
  const out = [];
  // Toujours une quête de cartes (la base de la mémorisation), puis deux autres.
  const cartes = pool.filter((q) => q.c.startsWith("carte"));
  out.push(cartes[Math.abs(h) % cartes.length]);
  const autres = pool.filter((q) => !q.c.startsWith("carte"));
  for (let i = 0; out.length < 3; i++) {
    const q = autres[Math.abs(h >> (i + 2)) % autres.length];
    if (!out.includes(q)) out.push(q);
    if (i > 40) break;
  }
  const t = aujourdhui();
  return out.map((q) => ({ ...q, fait: Math.min(q.but, t[q.c] || 0), finie: (t[q.c] || 0) >= q.but, recompensee: !!t[`quete_${q.id}`] }));
}

// ---------- Badges ----------
const fichesReelles = () => getFiches().filter((f) => !f.demoKey || getSettings().demo);
export const BADGES = [
  { id: "premier_scan", nom: "Premier scan", desc: "Créer sa première fiche", icone: "camera", test: () => fichesReelles().length >= 1 },
  { id: "biblio", nom: "Bibliothécaire", desc: "Avoir 10 fiches", icone: "livre", test: () => fichesReelles().length >= 10 },
  { id: "touche_a_tout", nom: "Touche-à-tout", desc: "Des fiches dans 5 matières", icone: "matieres", test: () => new Set(fichesReelles().map((f) => f.matiere)).size >= 5 },
  { id: "cartes_100", nom: "Mémoire d'éléphant", desc: "Revoir 100 cartes", icone: "cartes", test: (t) => (t.carte || 0) >= 100 },
  { id: "cartes_500", nom: "Mémoire infaillible", desc: "Revoir 500 cartes", icone: "cerveau", test: (t) => (t.carte || 0) >= 500 },
  { id: "qcm_10", nom: "Habitué des QCM", desc: "Terminer 10 QCM", icone: "qcm", test: (t) => (t.qcm || 0) >= 10 },
  { id: "sans_faute", nom: "Sans faute", desc: "Faire 20/20 à un QCM", icone: "etoile", test: (t) => (t.qcm_parfait || 0) >= 1 },
  { id: "serie_3", nom: "Bien lancé", desc: "Réviser 3 jours d'affilée", icone: "serie", test: () => getStats().serie >= 3 },
  { id: "serie_7", nom: "Semaine de feu", desc: "Réviser 7 jours d'affilée", icone: "serie", test: () => getStats().serie >= 7 },
  { id: "serie_30", nom: "Inarrêtable", desc: "Réviser 30 jours d'affilée", icone: "trophee", test: () => getStats().serie >= 30 },
  { id: "regulier", nom: "Régulier", desc: "Atteindre l'objectif du jour 7 fois", icone: "fait", test: (t) => (t.objectif || 0) >= 7 },
  { id: "premiere_copie", nom: "Première copie", desc: "Rendre un sujet d'entraînement", icone: "copie", test: (t) => (t.sujet || 0) >= 1 },
  { id: "copie_modele", nom: "Copie modèle", desc: "Avoir 16/20 ou plus à un sujet", icone: "medaille", test: (t) => (t.sujet16 || 0) >= 1 },
  { id: "plume_or", nom: "Plume d'or", desc: "Avoir tous les points de langue à un sujet", icone: "modifier", test: (t) => (t.langue_max || 0) >= 1 },
  { id: "curieux", nom: "Curieux", desc: "Poser 10 questions au prof", icone: "prof", test: (t) => (t.prof || 0) >= 10 },
  { id: "je_sais_faire", nom: "Je sais faire", desc: "Réussir 3 exercices d'application", icone: "outil", test: (t) => (t.exo || 0) >= 3 },
  { id: "sommet", nom: "Au sommet", desc: "Réussir un défi « Je vais plus loin »", icone: "final", test: (t) => (t.defi_valide || 0) >= 1 },
  {
    id: "fusee",
    nom: "Fusée",
    desc: "Gagner 5 points entre le test de départ et le test final",
    icone: "progres",
    test: () =>
      Object.values(lire("revizz.progres", {})).some((p) => {
        const d = p.depart && Math.round((p.depart.score / p.depart.total) * 20);
        return d !== undefined && (p.finals || []).some((f) => Math.round((f.score / f.total) * 20) - d >= 5);
      }),
  },
];

// ---------- Événements (célébrations) ----------
const ecouteurs = [];
export const surEvenement = (fn) => ecouteurs.push(fn);

/**
 * Enregistre des gouttes gagnées.
 * @param {number} gouttes
 * @param {Object} compteurs ex : { carte: 1, carte_sue: 1 }
 */
export function gagner(gouttes, compteurs = {}) {
  const e = etat();
  const k = `${jour()}|${appareil()}`;
  const avantTotal = totaux(e).g;
  const avantJour = totaux(e, jour()).g;
  const entree = e.jours[k] || { g: 0, n: {} };
  entree.g += gouttes;
  for (const [c, x] of Object.entries(compteurs)) entree.n[c] = (entree.n[c] || 0) + x;
  e.jours[k] = entree;
  ecrire(cleJeu(), e);
  const evenements = [];

  // Quêtes du jour terminées
  for (const q of quetesDuJour()) {
    if (q.finie && !q.recompensee) {
      entree.g += BONUS_QUETE;
      entree.n[`quete_${q.id}`] = 1;
      evenements.push({ type: "quete", titre: "Quête terminée", texte: `${q.txt} : +${BONUS_QUETE} gouttes`, petit: true });
    }
  }
  // Objectif du jour
  const tJour = totaux(e, jour()).g;
  if (avantJour < OBJECTIF_JOUR && tJour >= OBJECTIF_JOUR) {
    entree.n.objectif = (entree.n.objectif || 0) + 1;
    evenements.push({ type: "objectif", titre: "Objectif du jour atteint", texte: `${OBJECTIF_JOUR} gouttes d'encre aujourd'hui. La série continue !` });
  }
  ecrire(cleJeu(), e);
  // Niveau
  const n1 = niveauDe(avantTotal).niveau, n2 = niveauDe(totaux(e).g);
  if (n2.niveau > n1) evenements.push({ type: "niveau", titre: `Niveau ${n2.niveau}`, texte: `Tu deviens « ${n2.titre} ».` });
  // Badges
  evenements.push(...verifierBadges());
  if (evenements.length) for (const fn of ecouteurs) fn(evenements);
  return evenements;
}

/** Débloque les badges mérités ; renvoie les nouveaux. */
export function verifierBadges() {
  const e = etat();
  const t = totaux(e);
  const nouveaux = [];
  for (const b of BADGES) {
    if (e.badges[b.id]) continue;
    let ok = false;
    try {
      ok = b.test(t);
    } catch {
      ok = false;
    }
    if (ok) {
      e.badges[b.id] = Date.now();
      nouveaux.push({ type: "badge", titre: `Badge « ${b.nom} »`, texte: b.desc, icone: b.icone });
    }
  }
  if (nouveaux.length) ecrire(cleJeu(), e);
  return nouveaux;
}
export const badgesObtenus = () => etat().badges;

/** Gouttes des 7 derniers jours (pour le petit graphique). */
export function semaine() {
  const e = etat();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(Date.now() - (6 - i) * 864e5).toISOString().slice(0, 10);
    return { jour: d, g: totaux(e, d).g };
  });
}

/** Fusion de deux états de jeu (synchronisation) : rien n'est compté deux fois. */
export function fusionJeu(a = {}, b = {}) {
  const jours = { ...(a.jours || {}) };
  for (const [k, v] of Object.entries(b.jours || {})) {
    const ici = jours[k];
    if (!ici) jours[k] = v;
    else {
      const n = { ...ici.n };
      for (const [c, x] of Object.entries(v.n || {})) n[c] = Math.max(n[c] || 0, x);
      jours[k] = { g: Math.max(ici.g || 0, v.g || 0), n };
    }
  }
  const badges = { ...(a.badges || {}) };
  for (const [id, t] of Object.entries(b.badges || {})) if (!badges[id] || t < badges[id]) badges[id] = t;
  return { jours, badges };
}
