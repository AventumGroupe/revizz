// Les tuteurs de Révizz, dessinés en SVG et animés :
// - Gribouille, une goutte d'encre à lunettes (collège → Seconde) ;
// - Atlas, un héros du savoir (Première → études supérieures), dont la tenue évolue avec le niveau de l'élève.
// Humeurs : salut, content, bravo, reflechit, courage.
import { tuteurActuel, nomTuteur } from "./tuteurs.js";
import { niveauDe, gouttesTotales } from "./jeu.js";
// Dessin vectoriel (SVG) dans l'appli : net à toutes les tailles, rien à télécharger.
// Humeurs : salut, content, bravo, reflechit, courage.

let n = 0;
const ENCRE = "#0b1b3a";

const BOUCHES = {
  salut: `<path d="M51 97 Q60 105 69 97" stroke="${ENCRE}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  content: `<path d="M51 97 Q60 105 69 97" stroke="${ENCRE}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  bravo: `<path d="M49 95 Q60 112 71 95 Z" fill="${ENCRE}"/><path d="M55 103 Q60 108 65 103 Q60 100 55 103Z" fill="#ff8a8a"/>`,
  reflechit: `<ellipse cx="64" cy="100" rx="3.2" ry="2.6" fill="${ENCRE}"/>`,
  courage: `<path d="M53 99 Q60 103 67 99" stroke="${ENCRE}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
};
// Décalage des pupilles (où regarde Gribouille).
const REGARD = { salut: [0, 0], content: [0, 1], bravo: [0, -1], reflechit: [2.5, -3], courage: [0, 2] };
const SOURCILS = {
  reflechit: `<path d="M64 60 Q72 56 80 60" stroke="${ENCRE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
  courage: `<path d="M38 64 Q45 60 52 62" stroke="${ENCRE}" stroke-width="2.5" fill="none" stroke-linecap="round"/><path d="M68 62 Q75 60 82 64" stroke="${ENCRE}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`,
};
const BRAS = {
  salut: `<path d="M23 90 Q14 96 11 102" class="bras"/><path class="bras bras-coucou" d="M97 84 Q108 72 112 60"/>`,
  content: `<path d="M23 90 Q14 96 11 102" class="bras"/><path d="M97 90 Q106 96 109 102" class="bras"/>`,
  bravo: `<path d="M24 82 Q12 70 9 58" class="bras"/><path d="M96 82 Q108 70 111 58" class="bras"/>`,
  reflechit: `<path d="M23 90 Q14 96 11 102" class="bras"/><path d="M97 92 Q92 108 78 106" class="bras"/>`,
  courage: `<path d="M23 92 Q15 100 13 107" class="bras"/><path d="M97 92 Q105 100 107 107" class="bras"/>`,
};
const etoile = (x, y, r, d) =>
  `<path class="etincelle" style="animation-delay:${d}s" d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3}Z" fill="#f5b301"/>`;

/** Le tuteur de l'élève (Gribouille ou Atlas), avec l'humeur demandée. */
export function mascotte(humeur = "content", taille = 72, qui = tuteurActuel()) {
  return qui === "atlas" ? atlas(humeur, taille, etapeAtlas()) : gribouille(humeur, taille);
}

/** Tenue d'Atlas selon le niveau : 1 apprenti (niveaux 1 à 4), 2 confirmé avec cape (5 à 9), 3 légendaire (10 et plus). */
export function etapeAtlas() {
  const nv = niveauDe(gouttesTotales()).niveau;
  return nv >= 10 ? 3 : nv >= 5 ? 2 : 1;
}
export const NOMS_ETAPES_ATLAS = { 1: "Atlas apprenti", 2: "Atlas confirmé", 3: "Atlas légendaire" };

const PEAU = "#e8b48a", COSTUME = "#1e3a8a", OR = "#f5b301", CAPE = "#ea580c";
const BOUCHES_ATLAS = {
  salut: `<path d="M53 55 Q60 61 67 55" stroke="${ENCRE}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  content: `<path d="M53 55 Q60 61 67 55" stroke="${ENCRE}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  bravo: `<path d="M52 54 Q60 66 68 54 Z" fill="${ENCRE}"/><path d="M56 59 Q60 63 64 59 Q60 57 56 59Z" fill="#ff8a8a"/>`,
  reflechit: `<ellipse cx="63" cy="57" rx="2.6" ry="2.2" fill="${ENCRE}"/>`,
  courage: `<path d="M53 55 L67 54" stroke="${ENCRE}" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M64 54 Q67 52 68 55" stroke="${ENCRE}" stroke-width="2" fill="none" stroke-linecap="round"/>`,
};
// [tracé du bras, x et y du poing]
const BRAS_ATLAS = {
  salut: [["M42 72 Q32 84 30 96", 30, 96], ["M78 72 Q92 60 94 44", 94, 44, "bras-coucou"]],
  content: [["M42 72 Q32 84 30 96", 30, 96], ["M78 72 Q88 84 90 96", 90, 96]],
  bravo: [["M42 72 Q30 56 28 42", 28, 42], ["M78 72 Q90 56 92 42", 92, 42]],
  reflechit: [["M42 72 Q32 84 30 96", 30, 96], ["M78 72 Q88 68 70 61", 70, 61]],
  courage: [["M42 72 Q28 84 44 96", 44, 96], ["M78 72 Q92 84 76 96", 76, 96]], // poings sur les hanches : posture de héros
};

function atlas(humeur, taille, etape) {
  const id = `at${++n}`;
  const h = BOUCHES_ATLAS[humeur] ? humeur : "content";
  const [dx, dy] = REGARD[h].map((v) => v * 0.55);
  const bras = BRAS_ATLAS[h]
    .map(([d, x, y, cls]) => `<g class="${cls || ""}"><path d="${d}" class="bras"/><circle cx="${x}" cy="${y}" r="5" fill="${PEAU}"/></g>`)
    .join("");
  const sourcils =
    h === "reflechit"
      ? `<path d="M64 36 Q70 33 76 36" stroke="${ENCRE}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
      : h === "courage"
        ? `<path d="M44 38 Q50 35 56 37" stroke="${ENCRE}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M64 37 Q70 35 76 38" stroke="${ENCRE}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`
        : "";
  return `<svg class="masc masc-atlas masc-${h}" width="${taille}" height="${Math.round(taille * 1.08)}" viewBox="0 0 120 130" role="img" aria-label="Atlas, ton coach">
  <defs><radialGradient id="${id}"><stop offset="0" stop-color="#fde68a" stop-opacity=".9"/><stop offset="1" stop-color="#fde68a" stop-opacity="0"/></radialGradient></defs>
  <ellipse class="masc-ombre" cx="60" cy="126" rx="30" ry="4" fill="${ENCRE}" opacity=".12"/>
  ${etape >= 3 ? `<circle class="aura" cx="60" cy="70" r="58" fill="url(#${id})"/>` : ""}
  <g class="masc-corps">
    ${etape >= 2 ? `<path d="M40 66 Q18 98 24 122 L96 122 Q102 98 80 66 Z" fill="${CAPE}"/><path d="M60 70 Q56 100 60 122" stroke="#c2410c" stroke-width="2" fill="none" opacity=".6"/>` : ""}
    <rect x="46" y="100" width="12" height="16" fill="${COSTUME}"/><rect x="62" y="100" width="12" height="16" fill="${COSTUME}"/>
    <rect x="44" y="112" width="16" height="10" rx="3" fill="${OR}"/><rect x="60" y="112" width="16" height="10" rx="3" fill="${OR}"/>
    ${bras}
    <path d="M40 70 Q60 62 80 70 L76 104 Q60 108 44 104 Z" fill="${COSTUME}"/>
    <rect x="44" y="95" width="32" height="6" rx="2" fill="${OR}"/>
    <circle cx="60" cy="82" r="${etape >= 3 ? 10 : 9}" fill="${OR}" ${etape >= 3 ? `stroke="#fff" stroke-width="2"` : ""}/>
    <path d="M53.5 81 Q57 79 60 81 Q63 79 66.5 81 L66.5 86.5 Q63 84.5 60 86.5 Q57 84.5 53.5 86.5Z" fill="${COSTUME}"/>
    <rect x="55" y="60" width="10" height="7" fill="${PEAU}"/>
    <circle cx="60" cy="45" r="19" fill="${PEAU}"/>
    <path d="M41 43 Q42 24 60 23 Q78 24 79 43 L74 34 L70 40 L65 30 L59 38 L53 30 L48 40 Z" fill="#1f2937"/>
    ${sourcils}
    <path d="M40 41 Q60 35 80 41 L80 51 Q60 46 40 51 Z" fill="${COSTUME}"/>
    <g class="masc-yeux">
      <ellipse cx="51" cy="45.5" rx="6" ry="4.4" fill="#fff"/><ellipse cx="69" cy="45.5" rx="6" ry="4.4" fill="#fff"/>
      <circle cx="${51 + dx}" cy="${46 + dy}" r="2.3" fill="${ENCRE}"/><circle cx="${69 + dx}" cy="${46 + dy}" r="2.3" fill="${ENCRE}"/>
    </g>
    ${BOUCHES_ATLAS[h]}
  </g>
  ${h === "bravo" ? etoile(14, 30, 7, 0) + etoile(106, 24, 6, 0.3) + etoile(110, 50, 4, 0.6) : ""}
  ${h === "reflechit" ? `<g class="masc-pensee" fill="#94a3b8"><circle cx="96" cy="30" r="3"/><circle cx="104" cy="20" r="4"/><circle cx="111" cy="8" r="5"/></g>` : ""}
</svg>`;
}

/** SVG de Gribouille. */
function gribouille(humeur = "content", taille = 72) {
  const id = `gr${++n}`;
  const h = BOUCHES[humeur] ? humeur : "content";
  const [dx, dy] = REGARD[h];
  return `<svg class="masc masc-${h}" width="${taille}" height="${Math.round(taille * 1.08)}" viewBox="0 0 120 130" role="img" aria-label="Gribouille, ton prof">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#1d4ed8"/></linearGradient></defs>
  <ellipse class="masc-ombre" cx="60" cy="126" rx="30" ry="4" fill="${ENCRE}" opacity=".12"/>
  <g class="masc-corps">
    ${BRAS[h]}
    <path d="M60 8 C60 8 102 58 102 84 A42 42 0 0 1 18 84 C18 58 60 8 60 8Z" fill="url(#${id})"/>
    <ellipse cx="40" cy="66" rx="6" ry="12" fill="#fff" opacity=".3" transform="rotate(-22 40 66)"/>
    ${SOURCILS[h] || ""}
    <g class="masc-yeux">
      <circle cx="47" cy="79" r="9" fill="#fff"/><circle cx="73" cy="79" r="9" fill="#fff"/>
      <circle cx="${47 + dx}" cy="${80 + dy}" r="4.2" fill="${ENCRE}"/><circle cx="${73 + dx}" cy="${80 + dy}" r="4.2" fill="${ENCRE}"/>
      <circle cx="${48.5 + dx}" cy="${78.5 + dy}" r="1.3" fill="#fff"/><circle cx="${74.5 + dx}" cy="${78.5 + dy}" r="1.3" fill="#fff"/>
    </g>
    <g fill="none" stroke="${ENCRE}" stroke-width="2.6"><circle cx="47" cy="79" r="12.5"/><circle cx="73" cy="79" r="12.5"/><path d="M59.5 78 Q60 76 60.5 78"/></g>
    <circle cx="36" cy="94" r="5" fill="#ff9aa2" opacity=".55"/><circle cx="84" cy="94" r="5" fill="#ff9aa2" opacity=".55"/>
    ${BOUCHES[h]}
  </g>
  ${h === "bravo" ? etoile(14, 30, 7, 0) + etoile(104, 24, 6, 0.3) + etoile(110, 46, 4, 0.6) : ""}
  ${h === "reflechit" ? `<g class="masc-pensee" fill="#94a3b8"><circle cx="100" cy="30" r="3"/><circle cx="108" cy="20" r="4"/><circle cx="114" cy="8" r="5"/></g>` : ""}
</svg>`;
}

/** Le tuteur avec une bulle de dialogue. */
export function bulle(humeur, texte, { taille = 64, cls = "" } = {}) {
  return `<div class="masc-bulle ${cls}">${mascotte(humeur, taille)}<p class="masc-texte">${texte}</p></div>`;
}

// Choix stable d'une phrase : la même tant que le contexte et le jour ne changent pas (pas de clignotement à chaque affichage).
function choisir(liste, graine = "") {
  const s = `${graine}|${new Date().toDateString()}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return liste[Math.abs(h) % liste.length];
}

/** Humeur et phrase après une note sur 20. */
export function reactionNote(note, graine = "") {
  if (note >= 16)
    return { humeur: "bravo", texte: choisir(["Waouh ! Je n'ai presque rien à corriger.", "Là, tu m'impressionnes. Je vais devoir trouver des questions plus dures.", "Excellent ! Même mes lunettes n'en reviennent pas.", "Bravo, c'est du travail de pro."], graine) };
  if (note >= 12)
    return { humeur: "content", texte: choisir(["Bien joué ! Encore un petit effort et c'est parfait.", "C'est solide. On peaufine les détails ?", "Belle copie ! Regarde ce qui t'a coûté des points, et tu passes au niveau au-dessus."], graine) };
  if (note >= 8)
    return { humeur: "courage", texte: choisir(["Ça vient ! Relis les points à revoir et on retente.", "Pas mal du tout. Une relecture et ça passe au-dessus de la moyenne.", "Tu as les bases. Il reste quelques trous à boucher, je t'aide."], graine) };
  return { humeur: "courage", texte: choisir(["Pas de panique : c'est en se trompant qu'on apprend. On relit ensemble ?", "Ce n'est qu'un entraînement, et maintenant tu sais exactement quoi revoir.", "Même les meilleurs ont commencé comme ça. On reprend tranquillement ?"], graine) };
}

/** Phrase d'accueil selon la journée de l'élève. */
export function phraseAccueil({ prenom, dues, minutes, doseFinie, serie, nbFiches, controle }) {
  const p = prenom ? ` ${prenom}` : "";
  if (!nbFiches) return { humeur: "salut", texte: `Salut${p} ! Moi c'est ${nomTuteur()}, ${tuteurActuel() === "atlas" ? "ton coach de révision" : "ton prof de poche"}. Montre-moi un cours en photo et je m'occupe du reste.` };
  if (controle && controle.jours <= 1)
    return { humeur: "reflechit", texte: controle.jours === 0 ? `C'est le jour du contrôle de ${controle.matiere}. Tu es prêt, respire un bon coup.` : `Contrôle de ${controle.matiere} demain : une dernière relecture et au lit tôt !` };
  if (doseFinie) return { humeur: "bravo", texte: choisir([`Cartes du jour bouclées${p} ! Le reste peut attendre demain.`, `Dose du jour terminée${p}. Ton cerveau te remercie.`], prenom || "x") };
  if (serie >= 3 && dues) return { humeur: "bravo", texte: `${serie} jours d'affilée${p} ! ${minutes} petites minutes de cartes et la série continue.` };
  if (dues) return { humeur: "salut", texte: choisir([`Salut${p} ! Environ ${minutes} minutes de cartes aujourd'hui, et c'est plié.`, `Coucou${p} ! Ta dose du jour : ${dues} cartes, à peu près ${minutes} minutes.`], `${prenom}${dues}`) };
  if (controle) return { humeur: "content", texte: `Contrôle de ${controle.matiere} dans ${controle.jours} jours. Le programme du jour est prêt.` };
  return { humeur: "content", texte: choisir([`Tout est à jour${p}. Un petit QCM pour garder la forme ?`, `Rien d'urgent aujourd'hui${p}. Tu peux scanner ton dernier cours ?`, `Cartes à jour, bravo${p}. Je fais une sieste… non, je plaisante, je reste là.`], prenom || "x") };
}

