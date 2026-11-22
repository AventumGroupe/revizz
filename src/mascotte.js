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
export function mascotte(humeur = "content", taille = 72, qui = tuteurActuel(), etape) {
  return qui === "atlas" ? atlas(humeur, taille, etape || etapeAtlas()) : gribouille(humeur, taille);
}

/** Tenue d'Atlas selon le niveau : 1 apprenti (niveaux 1 à 4), 2 confirmé avec cape (5 à 9), 3 légendaire (10 et plus). */
export function etapeAtlas() {
  const nv = niveauDe(gouttesTotales()).niveau;
  return nv >= 10 ? 3 : nv >= 5 ? 2 : 1;
}
export const NOMS_ETAPES_ATLAS = { 1: "Atlas Recrue", 2: "Atlas Héros", 3: "Atlas Légendaire" };
// Skins d'Atlas, du plus simple au plus rare (débloqués aux niveaux 1, 5 et 10).
export const SKINS_ATLAS = {
  1: { rarete: "Rare", couleur: "#16a34a", niveau: 1 },
  2: { rarete: "Épique", couleur: "#2563eb", niveau: 5 },
  3: { rarete: "Légendaire", couleur: "#f59e0b", niveau: 10 },
};

// Style « jeu mobile » : grosse tête, contour épais, ombres franches (aplat clair + aplat sombre), gants et bottes massifs.
const TRAIT = "#111827";
const PALETTES = {
  1: { costume: "#2563eb", ombre: "#1d4ed8", accent: "#cbd5e1", accentOmbre: "#94a3b8", masque: "#334155", cape: null, cheveux: "#3b2a1f" },
  2: { costume: "#1e40af", ombre: "#1e3a8a", accent: "#fbbf24", accentOmbre: "#d97706", masque: "#1e3a8a", cape: "#ea580c", capeOmbre: "#c2410c", cheveux: "#2b1d14" },
  3: { costume: "#0f172a", ombre: "#020617", accent: "#fcd34d", accentOmbre: "#f59e0b", masque: "#f59e0b", cape: "#dc2626", capeOmbre: "#991b1b", cheveux: "#1f160f" },
};
const PEAU = "#f1c08f", PEAU_OMBRE = "#d99a66";
const BOUCHES_ATLAS = {
  salut: `<path d="M49 53 Q60 63 71 53 Q60 57 49 53Z" fill="#fff" stroke="${TRAIT}" stroke-width="2.4" stroke-linejoin="round"/>`,
  content: `<path d="M49 53 Q60 63 71 53 Q60 57 49 53Z" fill="#fff" stroke="${TRAIT}" stroke-width="2.4" stroke-linejoin="round"/>`,
  bravo: `<path d="M47 51 Q60 70 73 51 Z" fill="#7f1d1d" stroke="${TRAIT}" stroke-width="2.4" stroke-linejoin="round"/><path d="M48.5 52 L71.5 52 L70 55 L50 55Z" fill="#fff"/><path d="M54 62 Q60 66 66 62 Q60 59 54 62Z" fill="#f87171"/>`,
  reflechit: `<path d="M55 57 Q60 54 66 57" stroke="${TRAIT}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
  courage: `<path d="M50 56 Q61 59 70 52" stroke="${TRAIT}" stroke-width="3" fill="none" stroke-linecap="round"/>`,
};
// Sourcils épais et expressifs (gauche, droite).
const SOURCILS_ATLAS = {
  salut: ["M39 30 L54 32", "M66 32 L81 30"],
  content: ["M39 30 L54 32", "M66 32 L81 30"],
  bravo: ["M39 27 L54 29", "M66 29 L81 27"],
  reflechit: ["M40 32 L54 32", "M66 29 L80 25"],
  courage: ["M39 28 L54 33", "M66 33 L81 28"],
};
const REGARD_ATLAS = { salut: [0, 0], content: [0, 0.5], bravo: [0, -0.5], reflechit: [2, -1.8], courage: [0, 0] };
// Bras : [tracé, x du gant, y du gant, classe]
const BRAS_ATLAS = {
  salut: [["M41 74 Q30 86 29 97", 29, 97], ["M79 74 Q93 62 95 46", 95, 46, "bras-coucou"]],
  content: [["M41 74 Q30 86 29 97", 29, 97], ["M79 74 Q90 86 91 97", 91, 97]],
  bravo: [["M41 74 Q28 58 26 42", 26, 42], ["M79 74 Q92 58 94 42", 94, 42]],
  reflechit: [["M41 74 Q30 86 29 97", 29, 97], ["M79 74 Q90 72 72 63", 72, 63]],
  courage: [["M41 74 Q27 86 42 98", 42, 98], ["M79 74 Q93 86 78 98", 78, 98]],
};

function atlas(humeur, taille, etape) {
  const id = `at${++n}`;
  const h = BOUCHES_ATLAS[humeur] ? humeur : "content";
  const c = PALETTES[etape] || PALETTES[1];
  const [dx, dy] = REGARD_ATLAS[h];
  const t = `stroke="${TRAIT}" stroke-width="3" stroke-linejoin="round"`;
  const bras = BRAS_ATLAS[h]
    .map(
      ([d, x, y, cls]) => `<g class="${cls || ""}">
      <path d="${d}" stroke="${TRAIT}" stroke-width="12" stroke-linecap="round" fill="none"/>
      <path d="${d}" stroke="${c.costume}" stroke-width="7" stroke-linecap="round" fill="none"/>
      <circle cx="${x}" cy="${y}" r="7" fill="${c.accent}" ${t}/><path d="M${x - 4} ${y + 2} Q${x} ${y + 5} ${x + 4} ${y + 2}" stroke="${c.accentOmbre}" stroke-width="2" fill="none"/>
    </g>`
    )
    .join("");
  const [sg, sd] = SOURCILS_ATLAS[h];
  return `<svg class="masc masc-atlas masc-${h} skin-${etape}" width="${taille}" height="${Math.round(taille * 1.08)}" viewBox="0 0 120 130" role="img" aria-label="${NOMS_ETAPES_ATLAS[etape]}, ton coach">
  <defs><radialGradient id="${id}"><stop offset="0" stop-color="#fde68a" stop-opacity=".95"/><stop offset=".6" stop-color="#fbbf24" stop-opacity=".35"/><stop offset="1" stop-color="#fbbf24" stop-opacity="0"/></radialGradient></defs>
  <ellipse class="masc-ombre" cx="60" cy="126" rx="30" ry="4" fill="${TRAIT}" opacity=".15"/>
  ${etape >= 3 ? `<circle class="aura" cx="60" cy="66" r="60" fill="url(#${id})"/>` : ""}
  <g class="masc-corps">
    ${
      c.cape
        ? `<path d="M42 70 Q20 92 18 120 L31 114 L41 122 L51 115 L60 123 L69 115 L79 122 L89 114 L102 120 Q100 92 78 70 Z" fill="${c.cape}" ${t}/>
           <path d="M78 72 Q96 94 99 116 L89 112 L79 119 Q84 96 72 74Z" fill="${c.capeOmbre}"/>
           ${etape >= 3 ? `<path d="M18 120 L31 114 L41 122 L51 115 L60 123 L69 115 L79 122 L89 114 L102 120" stroke="${c.accent}" stroke-width="2.5" fill="none" stroke-linejoin="round"/>` : ""}`
        : ""
    }
    <rect x="46" y="100" width="12" height="14" rx="3" fill="${c.costume}" ${t}/><rect x="62" y="100" width="12" height="14" rx="3" fill="${c.costume}" ${t}/>
    <path d="M42 110 h17 v8 q0 4 -4 4 h-13 q-3 0 -3 -3 v-6 q0 -3 3 -3Z" fill="${c.accent}" ${t}/><path d="M61 110 h17 q3 0 3 3 v6 q0 3 -3 3 h-13 q-4 0 -4 -4Z" fill="${c.accent}" ${t}/>
    <path d="M42 70 Q60 63 78 70 Q83 88 77 106 Q60 111 43 106 Q37 88 42 70Z" fill="${c.costume}" ${t}/>
    <path d="M66 67 Q78 70 79 80 Q81 94 76 105 Q70 107 66 107 Q71 88 66 67Z" fill="${c.ombre}"/>
    <rect x="43" y="95" width="34" height="7" rx="2" fill="${c.accent}" ${t}/><rect x="56" y="94" width="8" height="9" rx="2" fill="${c.accentOmbre}" ${t}/>
    <path d="M50 75 L70 75 L70 84 Q70 91 60 94 Q50 91 50 84Z" fill="${c.accent}" ${t}/>
    ${
      etape >= 3
        ? `<path d="M60 77 L62.2 82 L67.5 82.4 L63.4 85.8 L64.8 91 L60 88 L55.2 91 L56.6 85.8 L52.5 82.4 L57.8 82Z" fill="${c.costume}"/>`
        : `<path d="M53.5 80 Q57 78 60 80 Q63 78 66.5 80 L66.5 87 Q63 85 60 87 Q57 85 53.5 87Z" fill="${c.costume}"/>`
    }
    ${h === "reflechit" ? "" : bras}
    <circle cx="60" cy="42" r="25" fill="${PEAU}" ${t}/>
    <path d="M72 22 Q86 32 84 48 Q80 62 66 66 Q80 52 76 36 Q74 28 72 22Z" fill="${PEAU_OMBRE}"/>
    <path d="M34 40 Q32 18 52 14 Q48 20 52 22 Q56 11 70 13 Q66 18 70 20 Q80 14 88 22 Q83 24 84 28 Q90 32 87 42 Q80 30 66 28 Q50 26 40 34 Q36 37 34 40Z" fill="${c.cheveux}" ${t}/>
    <path d="M50 19 Q58 15 66 17" stroke="#fff" stroke-width="2" fill="none" opacity=".35" stroke-linecap="round"/>
    <path d="${sg}" stroke="${TRAIT}" stroke-width="4" stroke-linecap="round"/><path d="${sd}" stroke="${TRAIT}" stroke-width="4" stroke-linecap="round"/>
    <path d="M33 37 Q60 31 87 37 L94 33 L90 42 Q88 46 87 47 Q60 41 33 47 Q31 45 30 42 L26 33Z" fill="${c.masque}" ${t}/>
    <g class="masc-yeux">
      <ellipse cx="50" cy="41.5" rx="7" ry="5.6" fill="#fff" stroke="${TRAIT}" stroke-width="2"/><ellipse cx="70" cy="41.5" rx="7" ry="5.6" fill="#fff" stroke="${TRAIT}" stroke-width="2"/>
      <circle cx="${51 + dx}" cy="${42 + dy}" r="3.2" fill="${TRAIT}"/><circle cx="${71 + dx}" cy="${42 + dy}" r="3.2" fill="${TRAIT}"/>
      <circle cx="${52.2 + dx}" cy="${40.8 + dy}" r="1.1" fill="#fff"/><circle cx="${72.2 + dx}" cy="${40.8 + dy}" r="1.1" fill="#fff"/>
    </g>
    ${BOUCHES_ATLAS[h]}
    ${h === "reflechit" ? bras : ""}
  </g>
  ${h === "bravo" ? etoile(12, 30, 7, 0) + etoile(108, 22, 6, 0.3) + etoile(112, 50, 4, 0.6) : ""}
  ${h === "reflechit" ? `<g class="masc-pensee" fill="#94a3b8"><circle cx="97" cy="28" r="3"/><circle cx="105" cy="18" r="4"/><circle cx="112" cy="7" r="5"/></g>` : ""}
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

