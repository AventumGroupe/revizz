import "@fontsource-variable/plus-jakarta-sans";
import "./style.css";
import { marked } from "marked";
import { Capacitor } from "@capacitor/core";
import * as store from "./store.js";
import * as ai from "./claude.js";
import { ficheDeDepart, questionsDepartDemo } from "./demo.js";
import { ouvrirScanner } from "./scanner.js";
import * as sauvegarde from "./sauvegarde.js";
import * as synchro from "./synchro.js";
import { POINTS_LANGUE, estRedactionnelle } from "./evaluation.js";
import * as ctrl from "./controles.js";
import { getMatieres, suggestions, ajouterMatiere, retirerMatiere, EMOJIS, COULEURS, normaliserMatiere, couleur, pastille } from "./matieres.js";
import { ic } from "./icons.js";
import { mascotte, bulle, reactionNote, phraseAccueil } from "./mascotte.js";
import * as jeu from "./jeu.js";
import * as dose from "./dose.js";
import * as compte from "./compte.js";
import { preparerPage, changerType } from "./image.js";
import { etatPaliers, fichesDuChapitre, SEUILS } from "./paliers.js";

// Version « maquette » publiée en page web : uniquement le mode démo.
const DEMO_ONLY = import.meta.env.VITE_DEMO_ONLY === "1";

const app = document.getElementById("app");

// ---------- Petits outils ----------
const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Le Markdown vient de Claude : on neutralise tout HTML avant de l'afficher.
const md = (s = "") => marked.parse(String(s).replace(/</g, "&lt;"), { breaks: true });
const shuffle = (a) => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
// Fenêtre de confirmation intégrée (les fenêtres du navigateur ne marchent pas partout).
function confirmer(message, libelleOk = "Supprimer") {
  return new Promise((resolve) => {
    const d = document.createElement("div");
    d.className = "modal";
    d.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true"><p>${esc(message)}</p>
      <div class="row"><button class="btn secondary" data-r="0">Annuler</button><button class="btn bad" data-r="1">${esc(libelleOk)}</button></div></div>`;
    d.onclick = (e) => {
      const r = e.target.closest("[data-r]");
      if (!r && e.target !== d) return;
      d.remove();
      resolve(r?.dataset.r === "1");
    };
    document.body.appendChild(d);
  });
}
// Fenêtre intégrée avec un contenu libre ; bind(boîte, fermer) branche les boutons.
function modale(html, bind) {
  const d = document.createElement("div");
  d.className = "modal";
  d.innerHTML = `<div class="modal-box" role="dialog" aria-modal="true">${html}</div>`;
  const fermer = () => d.remove();
  d.onclick = (e) => e.target === d && fermer();
  document.body.appendChild(d);
  bind(d.querySelector(".modal-box"), fermer);
}
function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ---------- Célébrations (badges, niveaux, objectif du jour) ----------
const aCelebrer = [];
function celebrer() {
  if (document.querySelector(".modal")) return setTimeout(celebrer, 800);
  const ev = aCelebrer.shift();
  if (!ev) return;
  const confettis = Array.from({ length: 18 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 6) * 0.12}s;--c:${["#2563eb", "#f5b301", "#12a150", "#60a5fa", "#e8590c"][i % 5]}"></i>`).join("");
  modale(
    `<div class="fete"><div class="confettis">${confettis}</div>
      ${mascotte("bravo", 96)}
      ${ev.icone ? `<span class="badge-rond gagne">${ic(ev.icone, 26)}</span>` : ""}
      <h3>${esc(ev.titre)}</h3><p>${esc(ev.texte)}</p>
      <button class="btn primary big-btn" data-ok>Trop bien !</button></div>`,
    (box, fermer) => (box.querySelector("[data-ok]").onclick = () => (fermer(), setTimeout(celebrer, 250)))
  );
}
function annoncer(evts) {
  const gros = evts.filter((e) => !e.petit);
  evts.filter((e) => e.petit).forEach((e) => toast(e.texte));
  // Plusieurs badges d'un coup : une seule fête, pour ne pas enchaîner les fenêtres.
  const badges = gros.filter((e) => e.type === "badge");
  if (badges.length > 2) {
    aCelebrer.push(...gros.filter((e) => e.type !== "badge"), { type: "badge", titre: `${badges.length} badges débloqués`, texte: "Va les voir dans ton profil !", icone: "medaille" });
  } else aCelebrer.push(...gros);
  setTimeout(celebrer, 600);
}
jeu.surEvenement(annoncer);

// ---------- Navigation ----------
let ui = { view: "home", ficheId: null, tab: "resume", matiere: null, retour: "home" };
const go = (patch) => {
  ui = { ...ui, ...patch };
  render();
  window.scrollTo(0, 0);
};
function back() {
  // Scanner ouvert : le bouton retour le ferme.
  const scanner = document.querySelector(".scanner [data-a=fermer]");
  if (scanner) return scanner.click();
  if (ui.view === "fiche" || ui.view === "scan" || ui.view === "revision") go({ view: ui.retour });
  else if (ui.view === "chapitre") go({ view: ui.retourChapitre || "matiere" });
  else if (ui.view === "controle") go({ view: ui.retourControle || "home" });
  else if (ui.view === "test") go({ view: "chapitre" });
  else if (ui.view === "exos" || ui.view === "defi") go({ view: ui.retourPalier || "chapitre" });
  else if (ui.view === "matiere") go({ view: "matieres" });
  else if (ui.view === "settings" || ui.view === "matieres" || ui.view === "planning") go({ view: "home", matiere: null });
}

// Remet les anciennes fiches (matière en texte libre) dans la liste fixe des matières.
for (const f of store.getFiches()) {
  const m = normaliserMatiere(f.matiere);
  if (m !== f.matiere) store.saveFiche({ ...f, matiere: m });
}
// Bouton retour d'Android : revient à l'accueil, ou quitte l'appli depuis l'accueil.
if (Capacitor.isNativePlatform()) {
  import("@capacitor/app").then(({ App }) =>
    App.addListener("backButton", () => (ui.view === "home" || ui.view === "welcome" ? App.exitApp() : back()))
  );
}

function entrerDemo() {
  store.saveSettings({ demo: true });
  if (!store.getFiches().some((f) => f.demoKey)) {
    // Fiche d'exemple avec un test de départ et deux QCM déjà faits, pour montrer le graphique.
    const f = nouvelleFiche(ficheDeDepart());
    const J = 864e5;
    const now = Date.now();
    f.cree = now - 12 * J;
    f.qcm = [
      { date: now - 8 * J, score: 5, total: 10, niveau: "moyen" },
      { date: now - 3 * J, score: 7, total: 10, niveau: "moyen" },
    ];
    store.saveFiche(f);
    store.saveProgres(f.matiere, f.chapitre, { demo: true, depart: { date: now - 12 * J, score: 3, total: 10, questions: questionsDepartDemo() }, finals: [] });
  }
  go({ view: "home" });
}
function quitterDemo() {
  store.saveSettings({ demo: false });
  store.getFiches().filter((f) => f.demoKey).forEach((f) => store.deleteFiche(f.id));
  store.supprimerProgresDemo();
  ctrl.supprimerControlesDemo();
  store.ecrire("revizz.jeuDemo", {});
}

function render() {
  const s = store.getSettings();
  if (DEMO_ONLY && !s.demo) return entrerDemo();
  if (!ai.estConfigure(s) && ui.view !== "settings" && ui.view !== "connexion") ui.view = "welcome";
  const views = { welcome, connexion: connexionView, home, matieres, planning, relecture: relectureView, exos: exosView, defi: defiView, matiere: matiereView, chapitre: chapitreView, test: testView, controle: controleView, scan, fiche: ficheView, settings, revision };
  const avecNav = VUES_RACINE.includes(ui.view) && ui.view !== "welcome";
  document.body.classList.toggle("avec-nav", avecNav);
  app.innerHTML = views[ui.view]() + (avecNav ? barreNav() : "");
  afterRender[ui.view]?.();
}
const afterRender = {};
afterRender.welcome = () => (document.getElementById("btn-demo").onclick = entrerDemo);

// ---------- Connexion au compte ----------
let modeCompte = "connexion"; // ou "inscription"
function connexionView() {
  const s = store.getSettings();
  const insc = modeCompte === "inscription";
  const adresseConnue = !!ai.adresseServeur({ ...s, serveur: "" });
  return `
  <header class="top"><button class="icon" data-back aria-label="Retour">${ic("retour", 22)}</button><div class="title">Mon compte</div><span></span></header>
  ${bulle(insc ? "salut" : "content", insc ? "Créons ton compte : tout ton travail y sera gardé, sur le téléphone comme sur l'ordinateur." : "Content de te revoir ! Connecte-toi pour retrouver tout ton travail.", { taille: 56 })}
  <div class="seg">${[["connexion", "Se connecter"], ["inscription", "Créer un compte"]].map(([k, l]) => `<button class="${modeCompte === k ? "on" : ""}" data-mode-compte="${k}">${l}</button>`).join("")}</div>
  <form id="form-compte" class="card" autocomplete="on">
    ${adresseConnue ? "" : `<label class="field">Adresse du site Révizz<input id="cx-serveur-url" type="url" inputmode="url" value="${esc(s.serveur || "")}" placeholder="https://revizz.netlify.app" autocomplete="off" required></label>`}
    <label class="field">Identifiant<input id="cx-ident" autocomplete="username" autocapitalize="none" spellcheck="false" value="${esc(s.identifiant || "")}" placeholder="ex : lucas.m" required></label>
    <label class="field">Mot de passe<input id="cx-mdp" type="password" autocomplete="${insc ? "new-password" : "current-password"}" minlength="${insc ? 8 : 1}" required></label>
    ${
      insc
        ? `<label class="field">Confirme le mot de passe<input id="cx-mdp2" type="password" autocomplete="new-password" required></label>
           <label class="field">Code famille <small>(demande-le à un parent)</small><input id="cx-code" type="password" autocomplete="off" required></label>
           <p class="hint">Identifiant : lettres minuscules, chiffres, point ou tiret. Mot de passe : 8 caractères au moins.</p>`
        : ""
    }
    <label class="voir-mdp"><input type="checkbox" id="cx-voir"> Afficher le mot de passe</label>
    <button class="btn primary big-btn" id="cx-ok">${insc ? "Créer mon compte" : "Me connecter"}</button>
    <div id="cx-msg"></div>
  </form>
  ${insc ? "" : `<p class="hint center">Mot de passe oublié ? Un parent peut le réinitialiser dans l'Espace parent, avec le code famille.</p>`}`;
}
afterRender.connexion = () => {
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll("[data-mode-compte]").forEach((b) => (b.onclick = () => ((modeCompte = b.dataset.modeCompte), render())));
  $("cx-voir").onchange = (e) => document.querySelectorAll("#cx-mdp, #cx-mdp2").forEach((x) => (x.type = e.target.checked ? "text" : "password"));
  $("form-compte").onsubmit = async (e) => {
    e.preventDefault();
    const ident = $("cx-ident").value.trim();
    const mdp = $("cx-mdp").value;
    const serveur = $("cx-serveur-url")?.value.trim().replace(/\/+$/, "") || undefined;
    if (modeCompte === "inscription" && mdp !== $("cx-mdp2").value) return ($("cx-msg").innerHTML = `<div class="error">Les deux mots de passe ne sont pas identiques.</div>`);
    $("cx-ok").disabled = true;
    $("cx-msg").innerHTML = "";
    try {
      if (store.getSettings().demo) quitterDemo();
      if (modeCompte === "inscription") await compte.inscription(ident, mdp, $("cx-code").value, serveur);
      else await compte.connexion(ident, mdp, serveur);
      $("cx-msg").innerHTML = `<p class="hint">Connecté ! Je récupère ton travail…</p>`;
      let n = 0;
      try {
        const r = await synchro.synchroniser();
        n = (r?.bilan?.ajoutees || 0) + (r?.bilan?.majs || 0);
      } catch {}
      toast(n ? `Bienvenue ! ${n} fiche${n > 1 ? "s" : ""} récupérée${n > 1 ? "s" : ""}.` : "Bienvenue !");
      go({ view: "home" });
    } catch (err) {
      $("cx-msg").innerHTML = `<div class="error">${esc(err.message)}</div>`;
      $("cx-ok").disabled = false;
    }
  };
};

// ---------- Accueil (premier lancement) ----------
function welcome() {
  return `
  <div class="welcome">
    <div class="welcome-masc">${mascotte("salut", 96)}</div>
    <div class="logo">Révizz</div>
    <p class="masc-presente">Salut, moi c'est Gribouille, ton prof de poche.</p>
    <p class="big">Tes fiches de cours deviennent des résumés, des flashcards, des QCM et des sujets d'entraînement.</p>
    <ul class="steps">
      <li>${ic("camera", 20)}<span>Prends en photo ta fiche ou ton cahier</span></li>
      <li>${ic("resume", 20)}<span>Claude prépare ta fiche de révision</span></li>
      <li>${ic("progres", 20)}<span>Entraîne-toi et suis tes progrès</span></li>
    </ul>
    <div class="welcome-actions">
      <button class="btn primary big-btn" data-go="connexion">Me connecter</button>
      <button class="btn secondary big-btn" id="btn-demo">Essayer la démo</button>
      <button class="btn ghost big-btn" data-go="settings">Espace parent (code famille ou clé API)</button>
    </div>
  </div>`;
}

// ---------- Barre de navigation (en bas de l'écran) ----------
const ONGLETS = [
  ["home", "accueil", "Accueil"],
  ["matieres", "matieres", "Matières"],
  ["scan", "camera", "Scanner"],
  ["planning", "planning", "Planning"],
  ["settings", "profil", "Profil"],
];
const VUES_RACINE = ["home", "matieres", "planning", "settings"];
function barreNav() {
  return `<nav class="tabbar" aria-label="Navigation">${ONGLETS.map(([v, icone, libelle]) =>
    v === "scan"
      ? `<button class="tab-scan" data-scan="" aria-label="Scanner une fiche">${ic("camera", 24)}</button>`
      : `<button class="${ui.view === v ? "on" : ""}" data-go="${v}" ${ui.view === v ? 'aria-current="page"' : ""}>${ic(icone, 22)}<span>${libelle}</span></button>`
  ).join("")}</nav>`;
}

// ---------- Écran principal ----------
const jourDuJour = () => new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
function home() {
  const s = store.getSettings();
  const fiches = store.getFiches();
  const stats = store.getStats();
  const dz = dose.etatDose();
  const dues = dz.restant;
  const recentes = [...fiches].sort((a, b) => (b.vue || b.cree) - (a.vue || a.cree)).slice(0, 6);
  const avecFiches = getMatieres().filter((m) => fiches.some((f) => f.matiere === m.nom));
  return `
  <header class="page-head">
    <div><p class="eyebrow">${jourDuJour()}</p><h1>Bonjour${s.prenom ? ` ${esc(s.prenom)}` : ""}</h1></div>
    <div class="chips-tete"><button class="niveau-chip" data-go="settings" title="Mon niveau">Niv. ${jeu.niveauDe(jeu.gouttesTotales()).niveau}</button><div class="serie" title="Jours de révision d'affilée">${ic("serie", 16)}<b>${stats.serie}</b></div></div>
  </header>
  ${(() => {
    const c = ctrl.aVenir()[0];
    const a = phraseAccueil({ prenom: s.prenom, dues, minutes: dz.minutes, doseFinie: dz.finie, serie: stats.serie, nbFiches: fiches.length, controle: c ? { matiere: c.matiere, jours: ctrl.joursRestants(c) } : null });
    return bulle(a.humeur, esc(a.texte), { cls: "accueil" });
  })()}
  ${s.demo ? `<div class="bandeau"><span><b>Mode démo.</b> Réponses préparées à l'avance, sans Claude.${DEMO_ONLY ? " N'importe quelle photo donne la fiche de maths d'exemple." : ""}</span>${DEMO_ONLY ? "" : `<button class="lien" data-go="settings">Me connecter</button>`}</div>` : ""}

  <section class="bloc">
    <h2>Aujourd'hui</h2>
    <div class="carte-jour">
      ${ligneDose(dz)}
      ${controlesAccueil()}
    </div>
  </section>

  ${fiches.length ? objectifHTML() : ""}

  ${rappelSauvegarde(fiches)}

  ${
    fiches.length
      ? `<section class="bloc">
          <div class="bloc-titre"><h2>Reprendre</h2></div>
          <div class="defile">${recentes.map(carteReprise).join("")}</div>
        </section>
        <section class="bloc">
          <div class="bloc-titre"><h2>Mes matières</h2><button class="lien" data-go="matieres">Tout voir</button></div>
          <div class="liste-lignes">${avecFiches.slice(0, 5).map((m) => ligneMatiere(m, fiches)).join("")}</div>
        </section>`
      : `<section class="vide-etat avec-masc">
          ${mascotte("reflechit", 56)}
          <h2>Ta première fiche</h2>
          <p>Prends en photo un cours ou une fiche : Révizz prépare le résumé, les cartes et les QCM.</p>
          <button class="btn primary big-btn" data-scan="">${ic("camera", 20)} Scanner une fiche</button>
        </section>`
  }`;
}
// Cartes du jour : une dose courte, jamais le stock entier.
function ligneDose(dz) {
  if (dz.restant)
    return `<button class="ligne" data-revision="">${pastilleIcone("cartes", "#2563eb")}<span class="ligne-txt"><b>Cartes du jour</b><small>${dz.restant} carte${dz.restant > 1 ? "s" : ""} · environ ${dz.minutes} min${dz.faites ? ` · ${dz.faites} déjà faite${dz.faites > 1 ? "s" : ""}` : ""}</small>${
      dz.faites ? `<span class="mini-barre"><i style="width:${Math.round((dz.faites / (dz.faites + dz.restant)) * 100)}%"></i></span>` : ""
    }</span>${ic("suite", 18, "chevron")}</button>`;
  if (dz.finie)
    return `<div class="ligne">${pastilleIcone("fait", "#0f9d58")}<span class="ligne-txt"><b>Cartes du jour : c'est fait</b><small>${dz.faites} cartes revues. Le reste attendra demain.</small></span>${
      dz.reserve ? `<button class="lien" data-revision="" data-bonus="1">+ ${dose.TAILLE_BONUS} bonus</button>` : ""
    }</div>`;
  return `<div class="ligne">${pastilleIcone("fait", "#0f9d58")}<span class="ligne-txt"><b>Cartes à jour</b><small>Rien à revoir pour l'instant</small></span></div>`;
}
// Objectif du jour et quêtes du jour (accueil).
function objectifHTML() {
  const g = jeu.aujourdhui().g;
  const pct = Math.min(100, Math.round((g / jeu.OBJECTIF_JOUR) * 100));
  const qs = jeu.quetesDuJour();
  return `<section class="bloc">
    <div class="bloc-titre"><h2>Objectif du jour</h2><span class="gouttes">${goutte()} ${g} / ${jeu.OBJECTIF_JOUR}</span></div>
    <div class="card objectif">
      <div class="obj-barre ${pct >= 100 ? "fini" : ""}"><i style="width:${pct}%"></i></div>
      <ul class="quetes">${qs
        .map((q) => `<li class="${q.finie ? "finie" : ""}"><span class="q-coche">${q.finie ? ic("ok", 14) : ""}</span><span class="q-txt">${esc(q.txt)}</span><span class="q-prog">${q.fait}/${q.but}</span></li>`)
        .join("")}</ul>
      <p class="hint">Chaque quête rapporte 10 gouttes d'encre de bonus.</p>
    </div>
  </section>`;
}
const goutte = (t = 14) => `<svg class="goutte" width="${t}" height="${t}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2C12 2 20 11 20 15.5A8 8 0 0 1 4 15.5C4 11 12 2 12 2Z" fill="currentColor"/></svg>`;
// Profil : niveau, semaine et badges.
function jeuProfilHTML() {
  const total = jeu.gouttesTotales();
  const nv = jeu.niveauDe(total);
  const sem = jeu.semaine();
  const max = Math.max(jeu.OBJECTIF_JOUR, ...sem.map((d) => d.g));
  const obtenus = jeu.badgesObtenus();
  const JOURS = ["D", "L", "M", "M", "J", "V", "S"];
  return `<div class="card parcours-jeu">
    <div class="nv-tete">${mascotte(nv.niveau >= 5 ? "bravo" : "content", 56)}<div><p class="eyebrow">Niveau ${nv.niveau}</p><h2>${esc(nv.titre)}</h2><p class="gouttes">${goutte()} ${total} gouttes d'encre</p></div></div>
    <div class="obj-barre"><i style="width:${nv.pct}%"></i></div>
    <p class="hint">Encore ${nv.pour - nv.dans} gouttes pour le niveau ${nv.niveau + 1}.</p>
    <h3>Cartes par jour</h3>
    <div class="seg">${dose.QUOTAS.map((q) => `<button class="${(Number(store.getSettings().doseCartes) || 15) === q ? "on" : ""}" data-dose="${q}">${q} cartes</button>`).join("")}</div>
    <p class="hint">Environ ${Math.round(((Number(store.getSettings().doseCartes) || 15) * 20) / 60)} minutes par jour. +10 cartes les 3 jours avant un contrôle.</p>
    <h3>Ma semaine</h3>
    <div class="semaine">${sem
      .map((d) => `<div class="sj ${d.g >= jeu.OBJECTIF_JOUR ? "ok" : ""}"><i style="height:${Math.max(4, Math.round((d.g / max) * 100))}%"></i><small>${JOURS[new Date(d.jour).getDay()]}</small></div>`)
      .join("")}</div>
    <h3>Mes badges <small>${Object.keys(obtenus).length}/${jeu.BADGES.length}</small></h3>
    <div class="succes-grille">${jeu.BADGES.map(
      (b) => `<div class="succes ${obtenus[b.id] ? "gagne" : ""}" title="${esc(b.desc)}"><span class="badge-rond">${ic(b.icone, 22)}</span><b>${esc(b.nom)}</b><small>${esc(b.desc)}</small></div>`
    ).join("")}</div>
  </div>`;
}
// Profil : le compte de l'élève.
function carteCompteHTML(s) {
  if (compte.estConnecte(s))
    return `<div class="card compte-carte"><div class="compte-ligne">${ic("profil", 20)}<div><b>${esc(s.identifiant)}</b><small>Ton travail est gardé sur ton compte et synchronisé.</small></div></div>
      <div class="row"><button class="btn secondary" id="btn-mdp">Changer le mot de passe</button><button class="btn ghost" id="btn-deconnexion">Se déconnecter</button></div></div>`;
  return `<div class="card compte-carte"><div class="compte-ligne">${ic("profil", 20)}<div><b>Pas de compte connecté</b><small>Avec un compte, tu retrouves tout ton travail sur le téléphone et sur l'ordinateur.</small></div></div>
    <button class="btn primary big-btn" data-go="connexion">Me connecter ou créer un compte</button></div>`;
}
// Petite pastille ronde avec une icône d'interface (pas une matière).
const pastilleIcone = (icone, couleurHex) => `<span class="pastille pastille-m" style="--c:${couleurHex}">${ic(icone, 18)}</span>`;

function carteReprise(f) {
  const m = store.maitrise(f);
  return `<button class="reprise" data-open="${f.id}">
    ${pastille(f.matiere, "m")}
    <b>${esc(f.titre)}</b>
    <small>${esc(f.matiere)}</small>
    <span class="jauge"><i style="width:${m}%;background:${couleur(f.matiere)}"></i></span>
  </button>`;
}
function ligneMatiere(m, fiches) {
  const siennes = fiches.filter((f) => f.matiere === m.nom);
  const dues = siennes.length ? dose.aMontrer((f) => f.matiere === m.nom) : 0;
  return `<button class="ligne" data-matiere="${esc(m.nom)}">
    ${pastille(m.nom, "m")}
    <span class="ligne-txt"><b>${esc(m.nom)}</b><small>${siennes.length ? `${siennes.length} fiche${siennes.length > 1 ? "s" : ""}` : "Aucune fiche"}</small></span>
    ${dues ? `<span class="badge">${dues}</span>` : ""}${ic("suite", 18, "chevron")}
  </button>`;
}
function rappelSauvegarde(fiches) {
  if (DEMO_ONLY || store.getSettings().demo || fiches.length < 2) return "";
  if (synchro.active()) {
    const e = synchro.etat();
    if (!e.erreur || /Hors ligne/.test(e.erreur)) return "";
    return `<div class="bandeau">${ic("actualiser", 18)}<span><b>Synchronisation en échec.</b> ${esc(e.erreur)}</span><button class="lien" data-go="settings">Voir</button></div>`;
  }
  const der = sauvegarde.derniereSauvegarde();
  if (der && Date.now() - der < 7 * 864e5) return "";
  return `<div class="bandeau">${ic("envoyer", 18)}<span><b>${der ? `Dernière sauvegarde ${ilYa(der)}` : "Aucune sauvegarde"}.</b> Mets tes fiches à l'abri sur Drive.</span><button class="lien" data-go="settings">Sauvegarder</button></div>`;
}

// ---------- Toutes les matières ----------
function matieres() {
  const fiches = store.getFiches();
  return `
  <header class="page-head"><div><p class="eyebrow">${fiches.length} fiche${fiches.length > 1 ? "s" : ""}</p><h1>Matières</h1></div></header>
  <div class="grille-matieres">${grilleMatieres(fiches)}</div>`;
}
// Une tuile par matière de « Mes matières » (« Autre » seulement si elle a des fiches), puis « Ajouter ».
function grilleMatieres(fiches) {
  const tuiles = getMatieres()
    .filter((m) => m.nom !== "Autre" || fiches.some((f) => f.matiere === "Autre"))
    .map((m) => {
      const siennes = fiches.filter((f) => f.matiere === m.nom);
      const dues = siennes.length ? dose.aMontrer((f) => f.matiere === m.nom) : 0;
      return `<button class="tuile ${siennes.length ? "" : "vide"}" data-matiere="${esc(m.nom)}">
        ${pastille(m.nom, "l")}
        <b>${esc(m.nom)}</b>
        <small>${siennes.length ? `${siennes.length} fiche${siennes.length > 1 ? "s" : ""}${dues ? ` · ${dues} à revoir` : ""}` : "Aucune fiche"}</small>
      </button>`;
    });
  tuiles.push(`<button class="tuile ajout" data-ajout-matiere>${ic("plus", 22)}<b>Ajouter une matière</b></button>`);
  return tuiles.join("");
}

// Options d'un menu de matières (avec « Nouvelle matière… » à la fin).
function optionsMatieres(choisie, avecAuto = false) {
  return (
    (avecAuto ? `<option value="">Détecter automatiquement</option>` : "") +
    getMatieres().map((m) => `<option value="${esc(m.nom)}" ${m.nom === choisie ? "selected" : ""}>${esc(m.nom)}</option>`).join("") +
    `<option value="__nouvelle__">+ Nouvelle matière…</option>`
  );
}

// Ajouter une matière : du catalogue (un geste) ou créée par l'élève.
function ouvrirAjoutMatiere(apresAjout) {
  const sugg = suggestions();
  modale(
    `<h3>Ajouter une matière</h3>
    ${sugg.length ? `<p class="hint">Touche une matière pour l'ajouter :</p>
    <div class="sugg-matieres">${sugg.map((m) => `<button class="chip" data-add="${esc(m.nom)}">${m.emoji} ${esc(m.nom)}</button>`).join("")}</div>` : ""}
    <h3>Ou crée la tienne</h3>
    <label class="field">Nom de la matière<input id="nm-nom" placeholder="ex : Option cinéma" maxlength="40"></label>
    <div class="field">Icône<div class="picker" id="nm-emoji">${EMOJIS.map((e, i) => `<button class="pick ${i ? "" : "on"}" data-v="${e}" aria-label="Icône ${e}">${e}</button>`).join("")}</div></div>
    <div class="field">Couleur<div class="picker" id="nm-couleur">${COULEURS.map((c, i) => `<button class="pick swatch ${i ? "" : "on"}" data-v="${c}" style="background:${c}" aria-label="Couleur ${i + 1}"></button>`).join("")}</div></div>
    <div class="row"><button class="btn secondary" id="nm-annuler">Fermer</button><button class="btn primary" id="nm-ok">Créer</button></div>`,
    (box, fermer) => {
      const fini = (nom) => {
        fermer();
        toast(`${nom} ajoutée`);
        apresAjout ? apresAjout(nom) : render();
      };
      box.querySelectorAll("[data-add]").forEach((b) => (b.onclick = () => fini(ajouterMatiere({ nom: b.dataset.add }))));
      box.querySelectorAll(".picker").forEach((pk) =>
        pk.querySelectorAll(".pick").forEach(
          (b) =>
            (b.onclick = () => {
              pk.querySelectorAll(".pick").forEach((x) => x.classList.remove("on"));
              b.classList.add("on");
            })
        )
      );
      box.querySelector("#nm-annuler").onclick = fermer;
      box.querySelector("#nm-ok").onclick = () => {
        const nom = box.querySelector("#nm-nom").value.trim();
        if (!nom) return toast("Donne un nom à ta matière");
        fini(
          ajouterMatiere({
            nom,
            emoji: box.querySelector("#nm-emoji .on").dataset.v,
            couleur: box.querySelector("#nm-couleur .on").dataset.v,
          })
        );
      };
    }
  );
}
function carteFiche(f, avecMatiere = false) {
  const m = store.maitrise(f);
  const d = dose.aMontrer((x) => x.id === f.id);
  return `
  <button class="fiche" data-open="${f.id}">
    ${avecMatiere ? pastille(f.matiere, "m") : ""}
    <span class="fiche-txt">
      <b>${esc(f.titre)}</b>
      <small>${avecMatiere ? `${esc(f.matiere)} · ` : ""}${f.flashcards.length} cartes${d ? ` · <em>${d} à revoir</em>` : ""}</small>
      <span class="jauge"><i style="width:${m}%;background:${couleur(f.matiere)}"></i></span>
    </span>
    ${ic("suite", 18, "chevron")}
  </button>`;
}

// ---------- Une matière ----------
function matiereView() {
  const nom = ui.matiere;
  const fiches = store.getFiches().filter((f) => f.matiere === nom);
  const head = `
  <header class="top">
    <button class="icon" data-go="matieres" aria-label="Retour">${ic("retour", 22)}</button>
    <div class="title">${esc(nom)}</div>
    <span class="icon-place"></span>
  </header>
  <div class="entete-matiere" style="--c:${couleur(nom)}">${pastille(nom, "l")}<div><h1>${esc(nom)}</h1><p class="sub">${fiches.length ? `${fiches.length} fiche${fiches.length > 1 ? "s" : ""}` : "Aucune fiche"}</p></div></div>`;
  if (!fiches.length) {
    return `${head}
    <section class="vide-etat avec-masc">
      ${mascotte("salut", 52)}
      <p>Pas encore de fiche en ${esc(nom)}. Scanne ton premier cours pour commencer.</p>
      <button class="btn primary big-btn" data-scan="${esc(nom)}">${ic("camera", 20)} Ajouter une fiche</button>
    </section>
    ${nom !== "Autre" ? `<button class="btn ghost big-btn" data-retirer="${esc(nom)}">Retirer ${esc(nom)} de mes matières</button>` : ""}`;
  }
  const dues = dose.aMontrer((f) => f.matiere === nom);
  // Regroupe par chapitre ; les chapitres sont triés par ordre alphabétique, les fiches par date.
  const chapitres = {};
  for (const f of fiches) (chapitres[f.chapitre || "Sans chapitre"] ||= []).push(f);
  const groupes = Object.entries(chapitres).sort(([a], [b]) => a.localeCompare(b, "fr"));
  return `${head}
  <div class="actions-rapides">
    <button class="action" data-revision="${esc(nom)}" ${dues ? "" : "disabled"}>${ic("cartes", 20)}<span>Cartes${dues ? ` (${dues})` : ""}</span></button>
    <button class="action" data-scan="${esc(nom)}">${ic("camera", 20)}<span>Ajouter</span></button>
    <button class="action" data-nouveau-controle="${esc(nom)}">${ic("controle", 20)}<span>Contrôle</span></button>
  </div>
  ${groupes
    .map(
      ([chap, liste]) => `<section class="bloc">
        <div class="bloc-titre"><h2 class="chapitre">${esc(chap)}</h2>
        <button class="pill-btn" data-chapitre="${esc(chap)}" data-m="${esc(nom)}">${resumeProgres(nom, chap)}</button></div>
        <div class="liste-lignes">${liste.sort((a, b) => b.cree - a.cree).map((f) => carteFiche(f)).join("")}</div>
      </section>`
    )
    .join("")}`;
}

// ---------- Scanner ----------
let pages = [];
let scanNote = "";
let scanMatiere = ""; // vide = détection automatique
let typeDoc = store.getSettings().typeDoc || "manuscrit"; // manuscrit (haute précision), imprime (économe) ou mixte (imprimé annoté à la main)
const AIDE_TYPE = {
  manuscrit: "Lecture haute précision : photo en haute définition, Claude zoome sur les mots difficiles et signale ceux dont il n'est pas sûr.",
  imprime: "Lecture économe, pour un polycopié ou un manuel imprimé.",
  mixte: "Photocopie ou manuel annoté à la main : Claude lit l'imprimé et les notes manuscrites (marges, mots soulignés, compléments), en haute définition.",
};
let analyseEnCours = false;
function scan() {
  const vide = !pages.length;
  return `
  <header class="top"><button class="icon" data-back aria-label="Retour">${ic("retour", 22)}</button><div class="title">${scanMatiere ? `<small>${pastille(scanMatiere, "s")} ${esc(scanMatiere)}</small>` : ""}Nouvelle fiche</div><span></span></header>
  ${
    vide
      ? `<p class="hint">Comment veux-tu scanner ton cours ?</p>
        <div class="type-doc"><span>Écriture</span><div class="seg" role="group" aria-label="Type de document">
          <button data-type="manuscrit" class="${typeDoc === "manuscrit" ? "on" : ""}">Manuscrite</button>
          <button data-type="imprime" class="${typeDoc === "imprime" ? "on" : ""}">Imprimée</button>
          <button data-type="mixte" class="${typeDoc === "mixte" ? "on" : ""}">Les deux</button></div></div>
        <p class="hint">${AIDE_TYPE[typeDoc] || AIDE_TYPE.manuscrit}</p>
        <div class="choix-scan">
          <button class="choix" data-scanmode="une"><span class="em">${ic("page", 28)}</span><b>Une page</b><small>Une photo, et c'est prêt.</small></button>
          <button class="choix" data-scanmode="plusieurs"><span class="em">${ic("pages", 28)}</span><b>Plusieurs pages</b><small>Enchaîne les photos sans valider chaque page.</small></button>
        </div>
        <button class="btn ghost big-btn" id="btn-import">${ic("galerie")} Importer depuis la galerie ou un PDF</button>`
      : `<p class="hint">${pages.length} page${pages.length > 1 ? "s" : ""}. Vérifie l'ordre avec les flèches, puis crée ta fiche.</p>
        <div class="type-doc"><span>Écriture</span><div class="seg" role="group" aria-label="Type de document">
          <button data-type="manuscrit" class="${typeDoc === "manuscrit" ? "on" : ""}">Manuscrite</button>
          <button data-type="imprime" class="${typeDoc === "imprime" ? "on" : ""}">Imprimée</button>
          <button data-type="mixte" class="${typeDoc === "mixte" ? "on" : ""}">Les deux</button></div></div>
        <p class="hint">${AIDE_TYPE[typeDoc] || AIDE_TYPE.manuscrit}</p>
        <div class="pages">
          ${pages
            .map(
              (p, i) => `<div class="page">${
                p.kind === "pdf" ? `<div class="pdf">${ic("page", 26)}<br>PDF<br><small>${esc(p.name)}</small></div>` : `<img src="${p.preview}" alt="page ${i + 1}">`
              }<button class="del" data-delpage="${i}" aria-label="Retirer la page ${i + 1}">${ic("fermer", 14)}</button><span class="num">${i + 1}</span>
              ${pages.length > 1 ? `<span class="moves">${i ? `<button data-move="${i}" data-dir="-1" aria-label="Avancer la page ${i + 1}">${ic("retour", 14)}</button>` : ""}${i < pages.length - 1 ? `<button data-move="${i}" data-dir="1" aria-label="Reculer la page ${i + 1}">${ic("suite", 14)}</button>` : ""}</span>` : ""}</div>`
            )
            .join("")}
          <button class="page add" data-scanmode="plusieurs">${ic("camera", 24)}<span>Ajouter des pages</span></button>
          <button class="page add" id="btn-import">${ic("galerie", 24)}<span>Galerie / PDF</span></button>
        </div>
        <label class="field">Matière
          <select id="scan-matiere">${optionsMatieres(scanMatiere, true)}</select>
        </label>
        <label class="field">Une précision pour Claude ? (facultatif)
          <input id="note" placeholder="ex : chapitre 3, contrôle vendredi sur la partie 2" value="${esc(scanNote)}">
        </label>
        <button class="btn primary big-btn" id="btn-analyser" ${analyseEnCours ? "disabled" : ""}>Créer ma fiche (${pages.length} page${pages.length > 1 ? "s" : ""})</button>
        <div id="progress"></div>`
  }
  <input type="file" id="file-import" accept="image/*,application/pdf" multiple hidden>
  <input type="file" id="file-camera" accept="image/*" capture="environment" hidden>`;
}
afterRender.scan = () => {
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll("[data-scanmode]").forEach((b) => (b.onclick = () => lancerScanner(b.dataset.scanmode === "plusieurs")));
  document.querySelectorAll("[data-type]").forEach(
    (b) =>
      (b.onclick = async () => {
        typeDoc = b.dataset.type;
        store.saveSettings({ typeDoc });
        // Les pages déjà prises sont reprises à la nouvelle définition (depuis la copie haute définition).
        for (const [i, p] of pages.entries()) if (p.kind === "image") pages[i] = await changerType(p, typeDoc);
        render();
      })
  );
  document.querySelectorAll("[data-move]").forEach(
    (b) =>
      (b.onclick = () => {
        const i = +b.dataset.move;
        const j = i + +b.dataset.dir;
        [pages[i], pages[j]] = [pages[j], pages[i]];
        render();
      })
  );
  $("btn-import").onclick = () => $("file-import").click();
  $("file-import").onchange = (e) => ajouterFichiers(e.target.files);
  $("file-camera").onchange = (e) => ajouterFichiers(e.target.files);
  if (!pages.length) return;
  $("note").oninput = (e) => (scanNote = e.target.value);
  $("scan-matiere").onchange = (e) => {
    if (e.target.value !== "__nouvelle__") return (scanMatiere = e.target.value);
    e.target.value = scanMatiere;
    ouvrirAjoutMatiere((nom) => {
      scanMatiere = nom;
      render();
    });
  };
  $("btn-analyser").onclick = analyser;
};
// Scanner intégré (rafale sans validation) ; si la caméra intégrée est indisponible, appareil photo classique.
async function lancerScanner(multi) {
  const ok = await ouvrirScanner({
    multi,
    dejaPrises: pages.filter((p) => p.kind === "image").length,
    onPage: async (dataUrl) => {
      pages.push(await preparerPage(dataUrl, typeDoc));
    },
    onRetirer: () => pages.pop(),
    onFin: () => render(),
  });
  if (!ok) {
    if (multi) toast("Caméra intégrée indisponible : prends tes pages une par une, ou importe-les depuis la galerie.");
    prendrePhoto();
  }
}
async function prendrePhoto() {
  if (!Capacitor.isNativePlatform()) return document.getElementById("file-camera").click();
  try {
    const { Camera, CameraResultType, CameraSource } = await import("@capacitor/camera");
    const photo = await Camera.getPhoto({
      resultType: CameraResultType.DataUrl,
      source: CameraSource.Camera,
      quality: 85,
      width: 1280,
      correctOrientation: true,
    });
    pages.push(await preparerPage(photo.dataUrl, typeDoc));
    render();
  } catch (e) {
    if (!/cancel/i.test(e?.message || "")) toast("Impossible d'utiliser l'appareil photo : " + (e?.message || e));
  }
}
async function ajouterFichiers(files) {
  for (const f of files) {
    if (f.type === "application/pdf") {
      if (f.size > 25 * 1024 * 1024) {
        toast("PDF trop lourd (25 Mo max).");
        continue;
      }
      const data = (await lireDataUrl(f)).split(",")[1];
      pages.push({ kind: "pdf", data, name: f.name });
    } else if (f.type.startsWith("image/")) {
      pages.push(await preparerPage(await lireDataUrl(f), typeDoc));
    }
  }
  render();
}
const lireDataUrl = (file) =>
  new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
// Gouttes d'un QCM ou d'un test : 5 pour l'avoir fini, 1 par bonne réponse, 10 de bonus pour un sans-faute.
function gagnerQcm(score, total) {
  const note = Math.round((score / total) * 20);
  jeu.gagner(5 + score + (score === total ? 10 : 0), { qcm: 1, ...(note >= 16 ? { qcm16: 1 } : {}), ...(score === total ? { qcm_parfait: 1 } : {}) });
}
function progressUI(el, label) {
  const msgs = ["Je lis ta fiche…", "Je repère les notions importantes…", "Je rédige ta fiche de révision…", "Je prépare les flashcards…", "Presque fini…"];
  el.innerHTML = `<div class="loading">${mascotte("reflechit", 44)}<div><div class="lmsg">${label || msgs[0]}</div><div class="lsub"></div></div></div>`;
  const lmsg = el.querySelector(".lmsg");
  const lsub = el.querySelector(".lsub");
  let i = 0;
  const timer = label ? null : setInterval(() => (lmsg.textContent = msgs[Math.min(++i, msgs.length - 1)]), 7000);
  return {
    update: (chars) => (lsub.textContent = chars ? `${Math.round(chars / 5)} mots écrits` : ""),
    stop: () => timer && clearInterval(timer),
  };
}
function nouvelleFiche(r) {
  return {
    id: store.uid(),
    cree: Date.now(),
    demoKey: r.demoKey,
    titre: r.titre,
    matiere: normaliserMatiere(r.matiere),
    chapitre: r.chapitre,
    transcription: r.transcription,
    resume: r.resume,
    points_cles: r.points_cles,
    vocabulaire: r.vocabulaire,
    astuce: r.astuce_memo,
    connexes: r.connexes || [],
    flashcards: r.flashcards.map(store.nouvelleCarte),
    questionsVues: [],
    qcm: [],
    sujets: [],
    chat: [],
  };
}
async function analyser() {
  if (analyseEnCours) return;
  analyseEnCours = true;
  const btn = document.getElementById("btn-analyser");
  btn.disabled = true;
  const zone = document.getElementById("progress");
  const p = progressUI(zone, typeDoc === "imprime" ? "Je lis ta fiche…" : "Je déchiffre l'écriture…");
  const lsub = zone.querySelector(".lsub");
  let zooms = 0;
  // Garde l'écran allumé pendant la lecture : une mise en veille coupe la connexion.
  let veille = null;
  try {
    veille = await navigator.wakeLock?.request("screen");
  } catch {}
  try {
    const texte = await ai.transcrire(
      pages,
      { matiere: scanMatiere, note: scanNote, type: typeDoc },
      (chars, _acc, page) => (lsub.textContent = `${page && pages.length > 1 ? `Page ${page}/${pages.length} · ` : ""}${zooms ? `${zooms} zoom${zooms > 1 ? "s" : ""} · ` : ""}${Math.round(chars / 5)} mots lus`),
      (n) => {
        zooms = n;
        zone.querySelector(".lmsg").textContent = "Je zoome sur les passages difficiles…";
        lsub.textContent = `${n} zoom${n > 1 ? "s" : ""}`;
      }
    );
    relecture = { texte, original: texte, pages: pages.filter((x) => x.kind === "image"), matiere: scanMatiere, note: scanNote, retour: ui.retour };
    p.stop();
    // Des passages incertains ? L'élève les vérifie avant de créer la fiche.
    if (ai.passagesIncertains(texte).length) go({ view: "relecture" });
    else await creerDepuisTexte(texte, zone);
  } catch (e) {
    zone.innerHTML = `<div class="error">${esc(e.message)}</div>`;
    btn.disabled = false;
  } finally {
    p.stop();
    analyseEnCours = false;
    veille?.release?.().catch(() => {});
  }
}

// Étape 2 : la fiche est rédigée à partir du texte (relu si besoin).
async function creerDepuisTexte(texte, zone) {
  const p = progressUI(zone, "Je prépare ta fiche de révision…");
  try {
    const r = await ai.creerFiche(texte, { matiere: relecture?.matiere, note: relecture?.note }, p.update);
    r.transcription = texte;
    if (relecture?.matiere) r.matiere = relecture.matiere;
    const fiche = nouvelleFiche(r);
    store.saveFiche(fiche);
    jeu.gagner(15, { fiche: 1 });
    const retour = relecture?.retour || ui.retour;
    pages = [];
    scanNote = "";
    scanMatiere = "";
    relecture = null;
    go({ view: "fiche", ficheId: fiche.id, tab: "resume", retour, ...(retour === "matiere" ? { matiere: fiche.matiere } : {}) });
    toast("Fiche créée");
  } finally {
    p.stop();
  }
}

// ---------- Relecture des passages incertains ----------
let relecture = null; // { texte, original, pages, matiere, note, retour }
function relectureView() {
  if (!relecture) {
    ui.view = "scan";
    return scan();
  }
  const items = ai.passagesIncertains(relecture.texte);
  return `
  <header class="top"><button class="icon" id="rl-retour" aria-label="Retour">${ic("retour", 22)}</button><div class="title">Vérifie la lecture</div><span class="icon-place"></span></header>
  <p class="intro">${items.length ? `Claude n'est pas sûr de <b>${items.length} passage${items.length > 1 ? "s" : ""}</b>. Regarde ta feuille et corrige si besoin : la fiche sera plus juste.` : "Plus aucun passage incertain."}</p>
  ${relecture.pages.length ? `<div class="vignettes">${relecture.pages.map((pg, i) => `<button class="vignette" data-voir="${i}" aria-label="Voir la page ${i + 1}"><img src="${pg.preview}" alt=""><span>${i + 1}</span></button>`).join("")}</div>` : ""}
  <div class="liste-lignes incertains">${items
    .map(
      (it, i) => `<div class="incertain">
        <p class="contexte">…${esc(it.avant)}<mark>${it.illisible ? "illisible" : esc(it.lecture)}</mark>${esc(it.apres)}…</p>
        <input data-item="${i}" value="${esc(it.lecture)}" placeholder="${it.illisible ? "Écris ce qui est noté, ou laisse vide" : ""}" aria-label="Correction du passage ${i + 1}">
      </div>`
    )
    .join("")}</div>
  <details class="card"><summary>Voir et modifier tout le texte</summary><textarea id="rl-texte" rows="14">${esc(relecture.texte)}</textarea></details>
  <button class="btn primary big-btn" id="rl-creer">Créer ma fiche</button>
  <div id="progress"></div>`;
}
// Remplace chaque passage incertain par la correction saisie (vide = on garde [illisible]).
function appliquerCorrections(texte, valeurs) {
  const items = ai.passagesIncertains(texte);
  let res = texte;
  for (let i = items.length - 1; i >= 0; i--) {
    const v = (valeurs[i] ?? "").trim();
    const remplace = v ? v : items[i].illisible ? "[illisible]" : items[i].lecture;
    res = res.slice(0, items[i].debut) + remplace + res.slice(items[i].fin);
  }
  return res;
}
afterRender.relecture = () => {
  if (!relecture) return;
  const $ = (id) => document.getElementById(id);
  $("rl-retour").onclick = async () => {
    if (await confirmer("Abandonner cette lecture ? Il faudra relancer l'analyse.", "Abandonner")) {
      relecture = null;
      go({ view: "scan" });
    }
  };
  document.querySelectorAll("[data-voir]").forEach(
    (b) => (b.onclick = () => modale(`<img class="page-entiere" src="${relecture.pages[+b.dataset.voir].original}" alt="Page ${+b.dataset.voir + 1}"><button class="btn secondary big-btn" id="pv-fermer">Fermer</button>`, (box, fermer) => (box.querySelector("#pv-fermer").onclick = fermer)))
  );
  let texteModifie = false;
  $("rl-texte").oninput = () => (texteModifie = true);
  $("rl-creer").onclick = async (e) => {
    e.target.disabled = true;
    const valeurs = [...document.querySelectorAll("[data-item]")].map((i) => i.value);
    const texte = texteModifie ? $("rl-texte").value : appliquerCorrections(relecture.texte, valeurs);
    relecture.texte = texte;
    try {
      await creerDepuisTexte(texte, $("progress"));
    } catch (err) {
      $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
      e.target.disabled = false;
    }
  };
};

// ---------- Fiche ----------
const TABS = [
  ["resume", "resume", "Résumé"],
  ["cartes", "cartes", "Cartes"],
  ["qcm", "qcm", "QCM"],
  ["sujet", "sujet", "Sujet"],
  ["prof", "prof", "Prof"],
];
function ficheView() {
  const f = store.getFiche(ui.ficheId);
  if (!f) return home();
  const body = { resume: tabResume, cartes: tabCartes, qcm: tabQCM, sujet: tabSujet, prof: tabProf }[ui.tab](f);
  return `
  <header class="top" style="--c:${couleur(f.matiere)}">
    <button class="icon" data-back aria-label="Retour">${ic("retour", 22)}</button>
    <button class="title title-edit" id="btn-edit" aria-label="Modifier la matière, le chapitre ou le titre"><small>${pastille(f.matiere, "s")} ${esc(f.matiere)}${f.chapitre ? " · " + esc(f.chapitre) : ""} ${ic("modifier", 13)}</small>${esc(f.titre)}</button>
    <button class="icon" id="btn-suppr" aria-label="Supprimer">${ic("supprimer")}</button>
  </header>
  <nav class="tabs">${TABS.map(([k, i, l]) => `<button class="${ui.tab === k ? "on" : ""}" data-tab="${k}">${ic(i, 18)}<span>${l}</span></button>`).join("")}</nav>
  <div class="tab-body">${body}</div>`;
}
afterRender.fiche = () => {
  const f = store.getFiche(ui.ficheId);
  if (!f) return;
  document.getElementById("btn-suppr").onclick = async () => {
    if (await confirmer(`Supprimer la fiche « ${f.titre} » ?`)) {
      store.deleteFiche(f.id);
      go({ view: ui.retour });
    }
  };
  document.getElementById("btn-edit").onclick = () => editerFiche(f);
  ({ cartes: bindCartes, qcm: bindQCM, sujet: bindSujet, prof: bindProf, resume: bindResume })[ui.tab]?.(f);
};

// --- Classer : matière, chapitre, titre
function editerFiche(f) {
  const chapitres = [...new Set(store.getFiches().map((x) => x.chapitre).filter(Boolean))];
  modale(
    `<h3>Classer la fiche</h3>
    <label class="field">Matière
      <select id="ed-matiere">${optionsMatieres(f.matiere)}</select>
    </label>
    <label class="field">Chapitre
      <input id="ed-chapitre" list="ed-chapitres" value="${esc(f.chapitre || "")}" placeholder="ex : La Révolution française">
      <datalist id="ed-chapitres">${chapitres.map((c) => `<option value="${esc(c)}">`).join("")}</datalist>
    </label>
    <label class="field">Titre<input id="ed-titre" value="${esc(f.titre)}"></label>
    <div class="row"><button class="btn secondary" id="ed-annuler">Annuler</button><button class="btn primary" id="ed-ok">Enregistrer</button></div>`,
    (box, fermer) => {
      box.querySelector("#ed-annuler").onclick = fermer;
      const sel = box.querySelector("#ed-matiere");
      let valeur = sel.value;
      sel.onchange = () => {
        if (sel.value !== "__nouvelle__") return (valeur = sel.value);
        sel.value = valeur;
        ouvrirAjoutMatiere((nom) => {
          valeur = nom;
          sel.innerHTML = optionsMatieres(nom);
        });
      };
      box.querySelector("#ed-ok").onclick = () => {
        const fiche = store.getFiche(f.id);
        const avant = { matiere: fiche.matiere, chapitre: fiche.chapitre };
        fiche.matiere = valeur;
        fiche.chapitre = box.querySelector("#ed-chapitre").value.trim();
        fiche.titre = box.querySelector("#ed-titre").value.trim() || fiche.titre;
        store.saveFiche(fiche);
        // Si plus aucune fiche ne reste dans l'ancien chapitre, ses résultats suivent la fiche.
        if (!fichesDuChapitre(avant.matiere, avant.chapitre || "Sans chapitre").length)
          store.deplacerProgres(avant.matiere, avant.chapitre, fiche.matiere, fiche.chapitre);
        fermer();
        if (ui.retour === "matiere") ui.matiere = fiche.matiere;
        toast("Fiche classée");
        render();
      };
    }
  );
}

// --- Résumé
function tabResume(f) {
  const chap = f.chapitre || "Sans chapitre";
  const sansDepart = !store.getProgres(f.matiere, f.chapitre).depart;
  return `
  ${
    sansDepart
      ? `<div class="depart-banner"><span>${ic("depart", 18)} <b>Nouveau chapitre ?</b> Fais le test de départ de « ${esc(chap)} » avant de réviser : tu pourras mesurer tes progrès.</span>
         <button class="btn secondary" data-chapitre="${esc(chap)}" data-m="${esc(f.matiere)}">Mes progrès</button></div>`
      : ""
  }
  <div class="md card">${md(f.resume)}</div>
  ${
    f.points_cles?.length
      ? `<h3>À retenir</h3><ul class="keys">${f.points_cles.map((p) => `<li>${esc(p)}</li>`).join("")}</ul>`
      : ""
  }
  ${
    f.vocabulaire?.length
      ? `<h3>Vocabulaire</h3><dl class="vocab">${f.vocabulaire
          .map((v) => `<div><dt>${esc(v.terme)}</dt><dd>${esc(v.definition)}</dd></div>`)
          .join("")}</dl>`
      : ""
  }
  ${f.astuce ? `<div class="astuce">${ic("astuce", 18)} <span><b>Astuce mémo</b>  ${esc(f.astuce)}</div>` : ""}
  ${connexesHTML(f)}
  <details class="card"><summary>Texte du cours scanné${ai.passagesIncertains(f.transcription).length ? ` · ${ai.passagesIncertains(f.transcription).length} passage(s) à vérifier` : ""}</summary>
    <div class="md">${surligner(md(f.transcription))}</div>
    <button class="btn secondary big-btn" id="btn-corriger-texte">${ic("modifier", 18)} Corriger le texte</button>
  </details>
  <div class="row">
    <button class="btn secondary" data-tab="cartes">${ic("cartes", 18)} Réviser les cartes</button>
    <button class="btn secondary" data-tab="qcm">${ic("qcm", 18)} Faire un QCM</button>
  </div>`;
}
// Les lectures incertaines restent visibles dans le texte scanné.
const surligner = (html) => html.replace(/\[\?([^\]]*)\]/g, '<mark class="incertain">$1</mark>').replace(/\[illisible\]/g, '<mark class="incertain">illisible</mark>');
function bindResume(f) {
  const corr = document.getElementById("btn-corriger-texte");
  if (corr)
    corr.onclick = () =>
      modale(
        `<h3>Corriger le texte scanné</h3>
        <p class="hint">Les QCM, les sujets et le prof utilisent ce texte : une correction ici les rend plus justes. Supprime les crochets [?…] une fois le mot vérifié.</p>
        <textarea id="ct-texte" rows="16">${esc(f.transcription)}</textarea>
        <div class="row"><button class="btn secondary" id="ct-annuler">Annuler</button><button class="btn primary" id="ct-ok">Enregistrer</button></div>`,
        (box, fermer) => {
          box.querySelector("#ct-annuler").onclick = fermer;
          box.querySelector("#ct-ok").onclick = () => {
            const fiche = store.getFiche(f.id);
            fiche.transcription = box.querySelector("#ct-texte").value;
            store.saveFiche(fiche);
            fermer();
            toast("Texte corrigé");
            render();
          };
        }
      );
  document.querySelectorAll("[data-connexe]").forEach((b) => (b.onclick = () => ouvrirConnexe(f, +b.dataset.connexe)));
  const btn = document.getElementById("btn-connexes");
  if (btn)
    btn.onclick = async () => {
      btn.disabled = true;
      const zone = document.getElementById("progress-connexes");
      const p = progressUI(zone, "Claude cherche les sujets connexes…");
      try {
        const fiche = store.getFiche(f.id);
        fiche.connexes = await ai.trouverConnexes(fiche, p.update);
        store.saveFiche(fiche);
        render();
      } catch (err) {
        zone.innerHTML = `<div class="error">${esc(err.message)}</div>`;
        btn.disabled = false;
      } finally {
        p.stop();
      }
    };
}

// ---------- Sujets connexes et liens entre fiches (calculés sur l'appareil, sans appel) ----------
const MOTS_VIDES = new Set(["entre", "aussi", "comme", "leurs", "cette", "ainsi", "alors", "selon", "notion", "notions", "cours", "chapitre", "fiche", "question", "exemple", "toujours", "permet", "qu'il", "c'est"]);
function motsCles(texte = "") {
  return new Set(
    texte.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").split(/[^a-z0-9]+/).filter((w) => w.length > 4 && !MOTS_VIDES.has(w))
  );
}
const signature = (f) => motsCles([f.titre, f.chapitre, ...(f.vocabulaire || []).map((v) => v.terme), ...(f.points_cles || [])].join(" "));
const communs = (a, b) => [...a].filter((w) => b.has(w)).length;
// Fiches de l'élève qui parlent de la même chose (mots clés en commun).
function fichesLiees(f) {
  const sf = signature(f);
  return store
    .getFiches()
    .filter((x) => x.id !== f.id)
    .map((x) => ({ x, n: communs(sf, signature(x)) }))
    .filter((o) => o.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, 3)
    .map((o) => o.x);
}
// Une fiche de l'élève qui traite déjà ce sujet connexe ?
function ficheDuConnexe(c, f) {
  const mc = motsCles(c.titre);
  if (!mc.size) return null;
  return store.getFiches().find((x) => x.id !== f.id && communs(mc, motsCles([x.titre, x.chapitre, ...(x.vocabulaire || []).map((v) => v.terme)].join(" "))) >= Math.min(2, mc.size));
}
const GROUPES_CONNEXES = [
  ["prerequis", "À revoir avant"],
  ["approfondissement", "Pour aller plus loin"],
  ["autre_matiere", "Dans une autre matière"],
];
function connexesHTML(f) {
  const liees = fichesLiees(f);
  const liens = liees.length
    ? `<div class="liees"><b>Ça rejoint tes fiches</b>${liees.map((x) => `<button class="lien-fiche" data-open="${x.id}">${pastille(x.matiere, "s")} ${esc(x.titre)}</button>`).join("")}</div>`
    : "";
  if (!f.connexes?.length)
    return `<div class="card connexes"><h3>${ic("lien", 18)} Pour aller plus loin</h3>
      <p class="hint">Découvre ce qu'il faut revoir avant ce cours, ce qui le prolonge et ses liens avec tes autres matières.</p>
      <button class="btn secondary big-btn" id="btn-connexes">${ic("lien", 18)} Trouver les sujets connexes</button><div id="progress-connexes"></div>${liens}</div>`;
  return `<div class="card connexes"><h3>${ic("lien", 18)} Pour aller plus loin</h3>
    ${GROUPES_CONNEXES.map(([type, titre]) => {
      const items = f.connexes.map((c, i) => ({ c, i })).filter(({ c }) => c.type === type);
      if (!items.length) return "";
      return `<div class="cx-groupe"><small>${titre}</small><div class="cx-chips">${items
        .map(({ c, i }) => `<button class="cx-chip" data-connexe="${i}" style="--c:${couleur(c.matiere)}">${type === "autre_matiere" ? pastille(c.matiere, "s") + " " : ""}${esc(c.titre)}${c.mini ? ic("ok", 14) : ""}</button>`)
        .join("")}</div></div>`;
    }).join("")}
    ${liens}</div>`;
}
function ouvrirConnexe(f, i) {
  const c = f.connexes[i];
  const liee = ficheDuConnexe(c, f);
  const libelle = Object.fromEntries(GROUPES_CONNEXES)[c.type] || "Sujet connexe";
  modale(
    `<small class="cx-type">${libelle} · ${pastille(c.matiere, "s")} ${esc(c.matiere)}</small>
    <h3>${esc(c.titre)}</h3>
    <p>${esc(c.pourquoi)}</p>
    ${liee ? `<button class="btn secondary big-btn" data-ouvrir="${liee.id}">${ic("resume", 18)} Ta fiche : ${esc(liee.titre)}</button>` : ""}
    <div id="cx-mini">${c.mini ? `<div class="md card">${md(c.mini)}</div>` : `<button class="btn primary big-btn" id="cx-gen">Mini-fiche sur ce sujet</button><p class="hint center">Un petit appel à Claude, gardé ensuite sur la fiche.</p>`}</div>
    <button class="btn ghost" id="cx-fermer">Fermer</button>`,
    (box, fermer) => {
      box.querySelector("#cx-fermer").onclick = fermer;
      box.querySelector("[data-ouvrir]")?.addEventListener("click", (e) => {
        fermer();
        go({ view: "fiche", ficheId: e.currentTarget.dataset.ouvrir, tab: "resume" });
      });
      const gen = box.querySelector("#cx-gen");
      if (gen)
        gen.onclick = async () => {
          gen.disabled = true;
          const zone = box.querySelector("#cx-mini");
          const p = progressUI(zone, "Claude rédige la mini-fiche…");
          try {
            const texte = await ai.miniFiche(f, c, p.update);
            const fiche = store.getFiche(f.id);
            fiche.connexes[i].mini = texte;
            store.saveFiche(fiche);
            f.connexes[i].mini = texte;
            render(); // la pastille du sujet affiche ✓ sous la fenêtre
            zone.innerHTML = `<div class="md card">${md(texte)}</div>`;
          } catch (err) {
            zone.innerHTML = `<div class="error">${esc(err.message)}</div>`;
          } finally {
            p.stop();
          }
        };
    }
  );
}

// --- Flashcards
let session = null; // { ficheId, cartes, i, retourne, sues }
function tabCartes(f) {
  if (!session || session.ficheId !== f.id) {
    return `
    <div class="card center">
      <div class="big-num">${dose.aMontrer((x) => x.id === f.id)}</div>
      <div>carte(s) à revoir maintenant sur ${f.flashcards.length}</div>
      ${store.cartesDues(f).length > dose.aMontrer((x) => x.id === f.id) ? `<small class="hint">Les autres attendront les prochains jours : pas besoin de tout faire d'un coup.</small>` : ""}
      <div class="bar wide"><i style="width:${store.maitrise(f)}%"></i></div>
      <small>Maîtrise : ${store.maitrise(f)} %</small>
    </div>
    <button class="btn primary big-btn" id="start-due" ${dose.aMontrer((x) => x.id === f.id) ? "" : "disabled"}>${ic("jouer", 18)} Réviser les cartes à revoir</button>
    <button class="btn secondary big-btn" id="start-all">${ic("melanger", 18)} Tout réviser (mélangé)</button>
    <button class="btn ghost big-btn" id="more-cards">${ic("plus", 18)} 10 cartes de plus</button>
    <div id="progress"></div>
    <h3>Toutes les cartes</h3>
    <div class="all-cards">${f.flashcards
      .map((c) => `<div class="mini"><b>${esc(c.recto)}</b><span>${esc(c.verso)}</span><i class="lvl l${c.boite}"></i></div>`)
      .join("")}</div>`;
  }
  return sessionCartes(f.id, session);
}
function sessionCartes(ficheId, s) {
  if (s.i >= s.cartes.length) {
    const dz = dose.etatDose();
    const finie = s.jour && dz.restant === 0;
    const r = reactionNote(s.cartes.length ? Math.round((s.sues / s.cartes.length) * 20) : 20, `cartes${s.cartes.length}${s.sues}`);
    return `<div class="card center done">
      ${mascotte(finie ? "bravo" : r.humeur, 84)}
      <p><b>${s.sues} / ${s.cartes.length} cartes sues.</b></p>
      <p class="masc-dit">${finie ? (s.bonus ? "Bonus terminé ! Tu peux vraiment t'arrêter là." : "Dose du jour terminée ! Tu peux t'arrêter là, c'est très bien.") : esc(r.texte)}</p>
      <p class="sub">Les cartes ratées reviendront plus vite, les autres plus tard.</p>
      <div class="row"><button class="btn primary" id="end-session">Terminer</button>${finie && dz.reserve ? `<button class="btn secondary" id="bonus-cartes">+ ${dose.TAILLE_BONUS} bonus</button>` : ""}</div></div>`;
  }
  const c = s.cartes[s.i];
  return `
  <div class="counter">${s.i + 1} / ${s.cartes.length}</div>
  <div class="flip ${s.retourne ? "flipped" : ""}" id="flip">
    <div class="face front">${esc(c.recto)}<small>Touche pour voir la réponse</small></div>
    <div class="face back">${esc(c.verso)}</div>
  </div>
  ${
    s.retourne
      ? `<div class="row"><button class="btn bad" id="ko">${ic("refaire", 18)} À revoir</button><button class="btn good" id="ok">${ic("ok", 18)} Je savais</button></div>`
      : `<button class="btn secondary big-btn" id="show">Voir la réponse</button>`
  }
  <button class="btn ghost" id="end-session">Arrêter</button>`;
}
function bindCartes(f) {
  const $ = (id) => document.getElementById(id);
  if (!session || session.ficheId !== f.id) {
    $("start-due").onclick = () => {
      session = { ficheId: f.id, cartes: shuffle(dose.selection(Math.max(dose.quota(), dose.TAILLE_BONUS), (x) => x.id === f.id)), i: 0, retourne: false, sues: 0 };
      render();
    };
    $("start-all").onclick = () => {
      session = { ficheId: f.id, cartes: shuffle(f.flashcards), i: 0, retourne: false, sues: 0 };
      render();
    };
    $("more-cards").onclick = async (e) => {
      e.target.disabled = true;
      const p = progressUI($("progress"), "Claude écrit de nouvelles cartes…");
      try {
        const nouvelles = await ai.plusDeFlashcards(f, f.flashcards, p.update);
        f.flashcards.push(...nouvelles.map(store.nouvelleCarte));
        store.saveFiche(f);
        toast(nouvelles.length > 1 ? `${nouvelles.length} cartes ajoutées` : "1 carte ajoutée");
        render();
      } catch (err) {
        $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
        e.target.disabled = false;
      } finally {
        p.stop();
      }
    };
    return;
  }
  bindSession(session, () => {
    session = null;
    render();
  });
}
function bindSession(s, onEnd) {
  const $ = (id) => document.getElementById(id);
  $("end-session").onclick = onEnd;
  if ($("bonus-cartes"))
    $("bonus-cartes").onclick = () => {
      Object.assign(s, { cartes: shuffle(dose.selection(dose.TAILLE_BONUS, s.ficheId ? (f) => f.id === s.ficheId : undefined)), i: 0, retourne: false, sues: 0, bonus: true });
      render();
    };
  if (s.i >= s.cartes.length) return;
  const flip = () => {
    s.retourne = !s.retourne;
    render();
  };
  $("flip").onclick = flip;
  if ($("show")) $("show").onclick = flip;
  const noter = (sue) => {
    const c = s.cartes[s.i];
    const fiche = store.getFiche(c.ficheId || s.ficheId);
    const vraie = fiche.flashcards.find((x) => x.id === c.id);
    const nouvelle = vraie && !vraie.prochaine;
    if (vraie) store.noterCarte(vraie, sue);
    store.saveFiche(fiche);
    store.enregistrerActivite("carte");
    jeu.gagner(sue ? 2 : 1, { carte: 1, ...(sue ? { carte_sue: 1 } : {}), ...(nouvelle ? { carte_nouvelle: 1 } : {}) });
    if (sue) s.sues++;
    s.i++;
    s.retourne = false;
    render();
  };
  if ($("ok")) $("ok").onclick = () => noter(true);
  if ($("ko")) $("ko").onclick = () => noter(false);
}

// --- Révision du jour (toutes matières, ou une seule)
let sessionJour = null;
function revision() {
  if (!sessionJour) {
    const fiches = store
      .getFiches()
      .filter((f) => !ui.revMatiere || f.matiere === ui.revMatiere)
      .filter((f) => !ui.revChapitre || (f.chapitre || "Sans chapitre") === ui.revChapitre);
    const ids = new Set(fiches.map((f) => f.id));
    const filtre = (f) => ids.has(f.id);
    // Révision du jour : la dose restante (ou un petit bonus quand elle est finie), cartes prioritaires d'abord.
    const restant = ui.revChapitre ? 0 : dose.etatDose(ui.revMatiere ? filtre : undefined).restant;
    const taille = restant || (ui.revChapitre ? 20 : dose.TAILLE_BONUS);
    let cartes = dose.selection(taille, filtre);
    // Révision d'un chapitre (palier 1) : s'il n'y a rien à revoir, on passe ses cartes, 20 à la fois.
    if (!cartes.length && ui.revChapitre) cartes = shuffle(fiches.flatMap((f) => f.flashcards.map((c) => ({ ...c, ficheId: f.id })))).slice(0, 20);
    sessionJour = { cartes: shuffle(cartes), i: 0, retourne: false, sues: 0, jour: !ui.revChapitre, bonus: !restant };
  }
  return `<header class="top"><button class="icon" data-back aria-label="Retour">${ic("retour", 22)}</button><div class="title">${ui.revMatiere ? `<small>${pastille(ui.revMatiere, "s")} ${esc(ui.revMatiere)}</small>` : ""}${ui.revChapitre ? esc(ui.revChapitre) : "Révision du jour"}</div><span></span></header>
  ${sessionCartes(null, sessionJour)}`;
}
afterRender.revision = () =>
  bindSession(sessionJour, () => {
    sessionJour = null;
    go({ view: ui.retour });
  });

// Mélange les questions et l'ordre des propositions (pour refaire un QCM sans appel à Claude).
function melangerQCM(questions) {
  return shuffle(questions).map((q) => {
    const ordre = shuffle(q.choix.map((_, i) => i));
    return { ...q, choix: ordre.map((i) => q.choix[i]), bonne_reponse: ordre.indexOf(q.bonne_reponse) };
  });
}

// --- QCM
let qcm = null; // { ficheId, questions, i, choisi, score, niveau }
let qcmNiveau = "moyen";
let qcmNombre = 10;
function tabQCM(f) {
  if (!qcm || qcm.ficheId !== f.id) {
    const hist = f.qcm.slice(-5).reverse();
    return `
    <div class="card">
      <h3>Nouveau QCM</h3>
      <div class="seg">${["facile", "moyen", "difficile"]
        .map((n) => `<button class="${qcmNiveau === n ? "on" : ""}" data-niveau="${n}">${n}</button>`)
        .join("")}</div>
      <div class="seg">${[5, 10, 20].map((n) => `<button class="${qcmNombre === n ? "on" : ""}" data-nombre="${n}">${n} questions</button>`).join("")}</div>
      <button class="btn primary big-btn" id="gen-qcm">Générer le QCM</button>
      ${f.dernierQCM?.length ? `<button class="btn secondary big-btn" id="replay-qcm">${ic("refaire", 18)} Refaire le dernier QCM (${f.dernierQCM.length} questions, sans appel à Claude)</button>` : ""}
      <div id="progress"></div>
    </div>
    ${
      hist.length
        ? `<h3>Mes derniers scores</h3><div class="scores">${hist
            .map(
              (h) =>
                `<div class="score"><b>${h.score}/${h.total}</b><span>${h.niveau} · ${new Date(h.date).toLocaleDateString("fr-FR")}</span></div>`
            )
            .join("")}</div>`
        : ""
    }`;
  }
  if (qcm.i >= qcm.questions.length) {
    const note = Math.round((qcm.score / qcm.questions.length) * 20);
    const r = reactionNote(note, `qcm${f.id}${qcm.questions.length}`);
    return `<div class="card center done">
      ${mascotte(r.humeur, 84)}
      <div class="big-num">${note}/20</div>
      <p>${qcm.score} bonne${qcm.score > 1 ? "s" : ""} réponse${qcm.score > 1 ? "s" : ""} sur ${qcm.questions.length}</p>
      <p class="sub masc-dit">${esc(r.texte)}</p>
      ${qcm.erreurs.length ? `<h3>À revoir</h3><ul class="keys">${qcm.erreurs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
      <div class="row"><button class="btn secondary" id="qcm-fin">Terminer</button><button class="btn primary" id="qcm-again">Nouveau QCM</button></div>
    </div>`;
  }
  const q = qcm.questions[qcm.i];
  const rep = qcm.choisi;
  return `
  <div class="qcm-tete"><div class="qcm-barre"><i style="width:${Math.round(((qcm.i + (rep !== null ? 1 : 0)) / qcm.questions.length) * 100)}%"></i></div>${(qcm.combo || 0) >= 3 ? `<span class="combo">${ic("serie", 14)} Combo x${qcm.combo}</span>` : ""}</div>
  <div class="counter">Question ${qcm.i + 1} / ${qcm.questions.length} · Score ${qcm.score}</div>
  <div class="card question">${esc(q.question)}</div>
  <div class="choices">${q.choix
    .map((c, i) => {
      let cls = "";
      if (rep !== null) cls = i === q.bonne_reponse ? "good" : i === rep ? "bad" : "dim";
      return `<button class="choice ${cls}" data-choix="${i}" ${rep !== null ? "disabled" : ""}><b>${"ABCD"[i]}</b>${esc(c)}</button>`;
    })
    .join("")}</div>
  ${
    rep !== null
      ? `<div class="explain ${rep === q.bonne_reponse ? "ok" : "ko"}">${rep === q.bonne_reponse ? ((qcm.combo || 0) >= 3 ? `${qcm.combo} d'affilée, bravo !` : "Bravo !") : "Raté."} ${esc(q.explication)}</div>
         <button class="btn primary big-btn" id="qcm-next">${qcm.i + 1 < qcm.questions.length ? "Question suivante →" : "Voir mon score"}</button>`
      : ""
  }
  <button class="btn ghost" id="qcm-stop">Arrêter</button>`;
}
function bindQCM(f) {
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll("[data-niveau]").forEach((b) => (b.onclick = () => ((qcmNiveau = b.dataset.niveau), render())));
  document.querySelectorAll("[data-nombre]").forEach((b) => (b.onclick = () => ((qcmNombre = +b.dataset.nombre), render())));
  if ($("gen-qcm"))
    $("gen-qcm").onclick = async (e) => {
      e.target.disabled = true;
      const p = progressUI($("progress"), "Claude prépare tes questions…");
      try {
        const questions = await ai.genererQCM(f, qcmNiveau, qcmNombre, f.questionsVues || [], p.update);
        f.questionsVues = [...(f.questionsVues || []), ...questions.map((q) => q.question)].slice(-40);
        f.dernierQCM = questions; // gardé pour le refaire hors ligne
        store.saveFiche(f);
        qcm = { ficheId: f.id, questions, i: 0, choisi: null, score: 0, niveau: qcmNiveau, erreurs: [] };
        render();
      } catch (err) {
        $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
        e.target.disabled = false;
      } finally {
        p.stop();
      }
    };
  if ($("replay-qcm"))
    $("replay-qcm").onclick = () => {
      const questions = melangerQCM(f.dernierQCM);
      qcm = { ficheId: f.id, questions, i: 0, choisi: null, score: 0, niveau: "rejoué", erreurs: [] };
      render();
    };
  document.querySelectorAll("[data-choix]").forEach(
    (b) =>
      (b.onclick = () => {
        const q = qcm.questions[qcm.i];
        qcm.choisi = +b.dataset.choix;
        if (qcm.choisi === q.bonne_reponse) {
          qcm.score++;
          qcm.combo = (qcm.combo || 0) + 1;
        } else {
          qcm.combo = 0;
          qcm.erreurs.push(`${q.question} → ${q.choix[q.bonne_reponse]}`);
        }
        render();
      })
  );
  if ($("qcm-next"))
    $("qcm-next").onclick = () => {
      qcm.i++;
      qcm.choisi = null;
      if (qcm.i >= qcm.questions.length) {
        f.qcm.push({ date: Date.now(), score: qcm.score, total: qcm.questions.length, niveau: qcm.niveau });
        store.saveFiche(f);
        store.enregistrerActivite("qcm");
        gagnerQcm(qcm.score, qcm.questions.length);
      }
      render();
    };
  const reset = () => ((qcm = null), render());
  if ($("qcm-stop")) $("qcm-stop").onclick = reset;
  if ($("qcm-fin")) $("qcm-fin").onclick = reset;
  if ($("qcm-again")) $("qcm-again").onclick = reset;
}

// --- Sujet d'entraînement
let sujetType = "controle";
let sujetOuvert = null; // index dans f.sujets
let corrigeVisible = false; // anciens sujets (format texte)
const questionsDu = (s) => (s.exercices || []).flatMap((e) => e.questions || []);
// Note sur 20 à partir des points obtenus (le barème est respecté question par question).
// La maîtrise de la langue a sa ligne à part (au moins 2 points, comme aux examens à partir de 2027).
const langueSur = (s) => (s.correction?.langue ? s.langueSur ?? POINTS_LANGUE : 0);
function noteDuSujet(s, matiere) {
  const qs = questionsDu(s);
  const lsur = langueSur(s);
  const total = qs.reduce((n, q) => n + (Number(q.points) || 0), 0) + lsur || 20;
  const langue = lsur ? Math.min(lsur, Math.max(0, Number(s.correction.langue.points_obtenus) || 0)) : 0;
  const obtenu = langue + qs.reduce((n, q, i) => n + Math.min(Number(q.points) || 0, Math.max(0, Number(s.correction?.questions?.find((r) => r.numero === i + 1)?.points_obtenus) || 0)), 0);
  let sur20 = Math.round((obtenu / total) * 20 * 2) / 2;
  // Épreuve rédactionnelle : une copie défaillante sur toute la langue ne peut pas avoir la moyenne.
  const plafonne = !!(s.correction?.langue?.defaillante && estRedactionnelle(matiere) && s.type !== "express" && sur20 >= 10);
  if (plafonne) sur20 = 9.5;
  return { obtenu, total, sur20, langue, lsur, plafonne };
}
const fmt = (n) => String(n).replace(".", ",");
function tabSujet(f) {
  const s = sujetOuvert !== null ? f.sujets[sujetOuvert] : null;
  if (!s) {
    return `
    <div class="card">
      <h3>Préparer un sujet d'entraînement</h3>
      <div class="seg wrap">${Object.entries(ai.TYPES_SUJET)
        .map(([k, l]) => `<button class="${sujetType === k ? "on" : ""}" data-stype="${k}">${l}</button>`)
        .join("")}</div>
      <p class="hint">Une question à la fois, ta réponse juste en dessous. La correction et le barème apparaissent quand tu rends ta copie.</p>
      <button class="btn primary big-btn" id="gen-sujet">Générer le sujet</button>
      <div id="progress"></div>
    </div>
    <div class="card">
      <h3>Sujets officiels et annales</h3>
      <p class="hint">Télécharge un sujet officiel (ou prends en photo un devoir de ton prof), puis importe-le : Révizz le transforme en sujet à remplir, avec barème et correction.</p>
      <button class="btn secondary big-btn" id="btn-annale">${ic("telecharger", 18)} Importer un sujet (PDF ou photos)</button>
      <input type="file" id="file-annale" accept="image/*,application/pdf" multiple hidden>
      <details class="aide"><summary>Où trouver des sujets gratuits</summary>
        <div class="liste-lignes">${liensAnnales(f.matiere)
          .map(([url, nom, desc]) => `<a class="ligne" href="${url}" target="_blank" rel="noopener"><span class="ligne-txt"><b>${nom}</b><small>${desc}</small></span>${ic("suite", 18, "chevron")}</a>`)
          .join("")}</div>
      </details>
      <div id="progress-annale"></div>
    </div>
    ${
      f.sujets.length
        ? `<h3>Mes sujets</h3><div class="liste-lignes">${f.sujets
            .map(
              (x, i) =>
                `<button class="ligne" data-sujet="${i}">${ic("sujet", 20, "t-ic")}<span class="ligne-txt"><b>${esc(x.titre)}</b><small>${esc(x.duree)}${x.correction ? ` · ${fmt(noteDuSujet(x, f.matiere).sur20)}/20` : x.note ? " · corrigé" : ""}</small></span>${ic("suite", 18, "chevron")}</button>`
            )
            .join("")}</div>`
        : ""
    }`;
  }
  // Ancien format (texte libre) : consultation seulement.
  if (!s.exercices)
    return `
    <button class="btn ghost" id="sujet-back">${ic("retour", 18)} Mes sujets</button>
    <div class="card md"><h2>${esc(s.titre)}</h2><p class="sub">${ic("heure", 15)} ${esc(s.duree)}</p>${md(s.sujet || "")}</div>
    ${s.note ? `<div class="card md correction">${md(s.note)}</div>` : ""}
    <p class="hint">Ce sujet date de l'ancienne version. Génère un nouveau sujet pour répondre question par question.</p>
    <button class="btn secondary big-btn" id="toggle-corrige">${corrigeVisible ? "Cacher" : "Voir"} le corrigé</button>
    ${corrigeVisible ? `<div class="card md">${md(s.corrige || "")}</div>` : ""}`;

  const corrige = !!s.correction;
  const reps = s.reponses || [];
  const total = questionsDu(s).length;
  const remplies = reps.filter((r) => r && r.trim()).length;
  const note = corrige ? noteDuSujet(s, f.matiere) : null;
  let n = 0;
  return `
  <button class="btn ghost" id="sujet-back">${ic("retour", 18)} Mes sujets</button>
  <div class="card sujet-tete">
    <h2>${esc(s.titre)}</h2>
    <p class="sub">${ic("heure", 15)} ${esc(s.duree)} · noté sur 20</p>
    ${s.consignes ? `<p class="consigne-generale">${esc(s.consignes)}</p>` : ""}
  </div>
  ${
    corrige
      ? `<div class="card bilan">
          ${(() => {
            const r = reactionNote(note.sur20, s.titre);
            return bulle(r.humeur, esc(r.texte), { taille: 56 });
          })()}
          <div class="bilan-note"><b class="big-num">${fmt(note.sur20)}<small>/20</small></b><span>${fmt(note.obtenu)} point${note.obtenu > 1 ? "s" : ""} sur ${fmt(note.total)}</span></div>
          ${note.plafonne ? `<p class="alerte">Note ramenée sous la moyenne : la copie est défaillante sur l'ensemble de la langue (règle des épreuves rédactionnelles).</p>` : ""}
          <p>${esc(s.correction.appreciation)}</p>
          ${s.correction.points_forts?.length ? `<h3>Points forts</h3><ul class="keys">${s.correction.points_forts.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          ${
            note.lsur
              ? `<div class="langue-bloc"><div class="corr-tete"><b>Maîtrise de la langue <span class="nowrap">${fmt(note.langue)} / ${fmt(note.lsur)}</span></b><span>${esc(s.correction.langue.niveau || "")}</span></div>
                <p>${esc(s.correction.langue.commentaire || "")}</p>
                ${
                  s.correction.langue.erreurs?.length
                    ? `<details><summary>Corrections de la rédaction (${s.correction.langue.erreurs.length})</summary><ul class="erreurs-langue">${s.correction.langue.erreurs
                        .map((e) => `<li><s>${esc(e.extrait)}</s><b>${esc(e.correction)}</b><small>${esc(e.regle)}</small></li>`)
                        .join("")}</ul></details>`
                    : ""
                }</div>`
              : ""
          }
          ${s.correction.a_travailler?.length ? `<h3>À travailler</h3><ul class="keys">${s.correction.a_travailler.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        </div>`
      : ""
  }
  ${s.exercices
    .map(
      (ex, ie) => `<section class="exercice">
      <h3 class="ex-titre">Exercice ${ie + 1} · ${esc(ex.titre)} <span>${fmt(ex.questions.reduce((t, q) => t + (Number(q.points) || 0), 0))} pts</span></h3>
      ${ex.type_exercice || ex.methode ? `<details class="methode"><summary>${ic("astuce", 16)} Méthode${ex.type_exercice ? ` : ${esc(ex.type_exercice)}` : ""}</summary>${ex.methode ? `<p>${esc(ex.methode)}</p>` : ""}</details>` : ""}
      ${ex.document ? `<div class="card md document">${md(ex.document)}</div>` : ""}
      ${ex.questions
        .map((q) => {
          const i = n++;
          const r = s.correction?.questions?.find((x) => x.numero === i + 1);
          return `<div class="question-bloc">
            <p class="q-enonce"><b>${i + 1}.</b> <span>${esc(q.enonce)}</span> <em>${fmt(q.points)} pt${q.points > 1 ? "s" : ""}</em></p>
            <textarea data-rep="${i}" rows="${q.points >= 6 ? 12 : q.points >= 3 ? 5 : 3}" placeholder="Ta réponse" ${corrige ? "readonly" : ""}>${esc(reps[i] || "")}</textarea>
            ${
              corrige
                ? `<div class="corr ${r && r.points_obtenus >= q.points * 0.75 ? "corr-ok" : r && r.points_obtenus >= q.points * 0.5 ? "corr-moyen" : "corr-ko"}">
                    <div class="corr-tete"><b>${fmt(Math.min(q.points, r?.points_obtenus ?? 0))} / ${fmt(q.points)}</b><span>${esc(r?.niveau || "")}</span></div>
                    ${r?.commentaire ? `<p>${esc(r.commentaire)}</p>` : ""}
                    <details><summary>Réponse attendue et barème</summary>
                      <div class="md">${md(q.reponse_attendue)}</div>
                      <ul class="bareme">${(q.bareme || []).map((b) => `<li><span>${esc(b.critere)}</span><b>${fmt(b.points)} pt${b.points > 1 ? "s" : ""}</b></li>`).join("")}</ul>
                      ${q.erreurs_frequentes ? `<p class="hint">${ic("info", 14)} Erreur fréquente : ${esc(q.erreurs_frequentes)}</p>` : ""}
                    </details>
                  </div>`
                : ""
            }
          </div>`;
        })
        .join("")}
    </section>`
    )
    .join("")}
  ${
    corrige
      ? `<button class="btn secondary big-btn" id="recorriger">${ic("actualiser", 18)} Faire relire ma copie</button>
         <button class="btn ghost big-btn" id="refaire-sujet">${ic("refaire", 18)} Refaire ce sujet</button>`
      : `<p class="hint center" id="compteur-reps">${remplies}/${total} réponses remplies${remplies < total ? " : réponds à toutes les questions pour voir la correction (écris « je ne sais pas » si besoin)" : ""}</p>
         <button class="btn primary big-btn" id="corriger" ${remplies < total ? "disabled" : ""}>${ic("copie", 18)} Rendre ma copie</button>`
  }
  <div id="progress"></div>`;
}
// Banques de sujets gratuites et officielles.
function liensAnnales(matiere) {
  const l = [
    ["https://www.education.gouv.fr/reussir-au-lycee/bns", "Banque nationale de sujets", "Sujets officiels de 1re et terminale (ministère)"],
    ["https://www.education.gouv.fr/brevet-bac-et-cap-les-sujets-des-examens-2025-450400", "Sujets du bac et du brevet", "Les sujets officiels des dernières sessions"],
    ["https://eduscol.education.gouv.fr/5202/preparer-le-diplome-national-du-brevet-dnb-avec-les-sujets-des-annales", "Annales du brevet (Éduscol)", "Pour consolider les bases du collège"],
  ];
  if (matiere === "Mathématiques") l.push(["https://www.apmep.fr", "APMEP", "Annales de maths corrigées par des professeurs (rubrique Annales)"]);
  if (matiere === "NSI") l.push(["https://eduscol.education.fr/2661/banque-des-epreuves-pratiques-de-specialite-nsi", "Épreuves pratiques de NSI", "Banque officielle d'exercices de programmation"]);
  return l;
}
function bindSujet(f) {
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll("[data-stype]").forEach((b) => (b.onclick = () => ((sujetType = b.dataset.stype), render())));
  document.querySelectorAll("[data-sujet]").forEach(
    (b) => (b.onclick = () => ((sujetOuvert = +b.dataset.sujet), (corrigeVisible = false), render()))
  );
  if ($("gen-sujet"))
    $("gen-sujet").onclick = async (e) => {
      e.target.disabled = true;
      const p = progressUI($("progress"), "Claude rédige ton sujet et son barème…");
      try {
        const s = await ai.genererSujet(f, sujetType, p.update);
        f.sujets.unshift({ ...s, type: sujetType, date: Date.now(), reponses: [], langueSur: POINTS_LANGUE });
        f.sujets = f.sujets.slice(0, 10);
        store.saveFiche(f);
        sujetOuvert = 0;
        render();
      } catch (err) {
        $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
        e.target.disabled = false;
      } finally {
        p.stop();
      }
    };
  if ($("btn-annale")) $("btn-annale").onclick = () => $("file-annale").click();
  if ($("file-annale"))
    $("file-annale").onchange = async (ev) => {
      const fichiers = [...ev.target.files];
      if (!fichiers.length) return;
      const pagesSujet = [];
      for (const fi of fichiers) {
        if (fi.type === "application/pdf") {
          if (fi.size > 25 * 1024 * 1024) return toast("PDF trop lourd (25 Mo max).");
          pagesSujet.push({ kind: "pdf", data: (await lireDataUrl(fi)).split(",")[1], name: fi.name });
        } else if (fi.type.startsWith("image/")) pagesSujet.push(await preparerPage(await lireDataUrl(fi), "imprime"));
      }
      if (!pagesSujet.length) return toast("Choisis un PDF ou des photos.");
      $("btn-annale").disabled = true;
      const p = progressUI($("progress-annale"), "Je lis le sujet et je prépare le barème…");
      try {
        const sj = await ai.importerSujet(f, pagesSujet, p.update);
        f.sujets.unshift({ ...sj, type: "annale", date: Date.now(), reponses: [], langueSur: POINTS_LANGUE });
        f.sujets = f.sujets.slice(0, 10);
        store.saveFiche(f);
        sujetOuvert = 0;
        render();
      } catch (err) {
        $("progress-annale").innerHTML = `<div class="error">${esc(err.message)}</div>`;
        $("btn-annale").disabled = false;
      } finally {
        p.stop();
      }
    };
  if ($("sujet-back")) $("sujet-back").onclick = () => ((sujetOuvert = null), render());
  if ($("toggle-corrige")) $("toggle-corrige").onclick = () => ((corrigeVisible = !corrigeVisible), render());
  const s = sujetOuvert !== null ? f.sujets[sujetOuvert] : null;
  if (!s?.exercices) return;
  const total = questionsDu(s).length;
  // Les réponses sont gardées au fil de la frappe ; la correction ne s'ouvre que quand tout est rempli.
  document.querySelectorAll("[data-rep]").forEach(
    (t) =>
      (t.oninput = () => {
        s.reponses = s.reponses || [];
        s.reponses[+t.dataset.rep] = t.value;
        store.saveFiche(f);
        const remplies = s.reponses.filter((r) => r && r.trim()).length;
        if ($("compteur-reps")) $("compteur-reps").textContent = `${remplies}/${total} réponses remplies${remplies < total ? " : réponds à toutes les questions pour voir la correction (écris « je ne sais pas » si besoin)" : ""}`;
        if ($("corriger")) $("corriger").disabled = remplies < total;
      })
  );
  if ($("refaire-sujet"))
    $("refaire-sujet").onclick = async () => {
      if (!(await confirmer("Effacer tes réponses et la correction pour refaire ce sujet ?", "Refaire"))) return;
      s.reponses = [];
      delete s.correction;
      store.saveFiche(f);
      render();
    };
  // Nouvelle correction des mêmes réponses (par exemple après une correction trop sévère sur les mots).
  if ($("recorriger"))
    $("recorriger").onclick = async (e) => {
      e.target.disabled = true;
      const avant = noteDuSujet(s, f.matiere).sur20;
      const p = progressUI($("progress"), "Le prof relit ta copie…");
      try {
        s.correction = await ai.corrigerCopie(f, s, (s.reponses || []).slice(0, total), p.update);
        store.saveFiche(f);
        const apres = noteDuSujet(s, f.matiere).sur20;
        render();
        window.scrollTo(0, 0);
        toast(apres === avant ? `Note confirmée : ${fmt(apres)}/20` : `Nouvelle note : ${fmt(apres)}/20 (avant ${fmt(avant)})`);
      } catch (err) {
        $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
        e.target.disabled = false;
      } finally {
        p.stop();
      }
    };
  if ($("corriger"))
    $("corriger").onclick = async (e) => {
      const reps = (s.reponses || []).slice(0, total);
      if (reps.filter((r) => r && r.trim()).length < total) return toast("Réponds d'abord à toutes les questions");
      e.target.disabled = true;
      const p = progressUI($("progress"), "Le prof corrige ta copie avec le barème…");
      try {
        s.correction = await ai.corrigerCopie(f, s, reps, p.update);
        store.saveFiche(f);
        store.enregistrerActivite("qcm");
        {
          const nt = noteDuSujet(s, f.matiere);
          jeu.gagner(10 + Math.round(nt.sur20), { sujet: 1, ...(nt.sur20 >= 16 ? { sujet16: 1 } : {}), ...(nt.lsur && nt.langue >= nt.lsur ? { langue_max: 1 } : {}) });
        }
        render();
        window.scrollTo(0, 0);
      } catch (err) {
        $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
        e.target.disabled = false;
      } finally {
        p.stop();
      }
    };
}

// --- Prof particulier (chat)
let chatBusy = false;
function tabProf(f) {
  const suggestions = ["Explique-moi ce cours comme si j'avais 10 ans", "Quelles sont les 3 choses les plus importantes ?", "Donne-moi un exemple concret", "Pose-moi une question pour vérifier"];
  return `
  <div class="chat" id="chat">
    <div class="msg-bot"><span class="avatar">${mascotte("salut", 34)}</span><div class="bubble bot">Salut ! Moi c'est Gribouille, ton prof pour « ${esc(f.titre)} ». Qu'est-ce que tu n'as pas compris ?</div></div>
    ${f.chat.map((m) => (m.role === "user" ? `<div class="bubble me">${esc(m.content)}</div>` : `<div class="msg-bot"><span class="avatar">${mascotte("content", 34)}</span><div class="bubble bot md">${md(m.content)}</div></div>`)).join("")}
    <div id="live"></div>
  </div>
  ${!f.chat.length ? `<div class="sugg">${suggestions.map((s) => `<button class="chip" data-sugg="${esc(s)}">${esc(s)}</button>`).join("")}</div>` : ""}
  <form class="composer" id="composer">
    <input id="msg" placeholder="Pose ta question…" autocomplete="off">
    <button class="btn primary" ${chatBusy ? "disabled" : ""}aria-label="Envoyer">${ic("send", 18)}</button>
  </form>
  ${f.chat.length ? `<button class="btn ghost" id="clear-chat">Effacer la conversation</button>` : ""}`;
}
function bindProf(f) {
  const $ = (id) => document.getElementById(id);
  const envoyer = async (texte) => {
    if (!texte.trim() || chatBusy) return;
    chatBusy = true;
    f.chat.push({ role: "user", content: texte.trim() });
    store.saveFiche(f);
    jeu.gagner(2, { prof: 1 });
    render();
    const cadre = $("live");
    cadre.className = "msg-bot";
    cadre.innerHTML = `<span class="avatar">${mascotte("reflechit", 34)}</span><div class="bubble bot md"><span class="dots"><i></i><i></i><i></i></span></div>`;
    const live = cadre.querySelector(".bubble");
    cadre.scrollIntoView({ block: "end" });
    try {
      const rep = await ai.discuter(f, f.chat.slice(-20), (_, acc) => {
        live.innerHTML = md(acc);
        live.scrollIntoView({ block: "end" });
      });
      f.chat.push({ role: "assistant", content: rep });
    } catch (err) {
      f.chat.pop();
      toast(err.message);
    }
    store.saveFiche(f);
    chatBusy = false;
    if (ui.view === "fiche" && ui.tab === "prof") render();
    document.getElementById("live")?.scrollIntoView({ block: "end" });
  };
  $("composer").onsubmit = (e) => {
    e.preventDefault();
    envoyer($("msg").value);
  };
  document.querySelectorAll("[data-sugg]").forEach((b) => (b.onclick = () => envoyer(b.dataset.sugg)));
  if ($("clear-chat"))
    $("clear-chat").onclick = () => {
      f.chat = [];
      store.saveFiche(f);
      render();
    };
}

// ---------- Réglages ----------
const CLASSES = ["CM2", "6e", "5e", "4e", "3e", "Seconde", "Première", "Terminale", "Études supérieures"];
function settings() {
  const s = store.getSettings();
  return `
  <header class="page-head"><div><p class="eyebrow">Profil et réglages</p><h1>${s.prenom ? esc(s.prenom) : "Profil"}</h1></div></header>
  ${DEMO_ONLY ? "" : carteCompteHTML(s)}
  ${jeuProfilHTML()}
  <label class="field">Ton prénom<input id="prenom" value="${esc(s.prenom)}" placeholder="ex : Lucas"></label>
  <label class="field">Ta classe<select id="classe">${CLASSES.map((c) => `<option ${c === s.classe ? "selected" : ""}>${c}</option>`).join("")}</select></label>
  ${
    DEMO_ONLY
      ? `<div class="card parent"><h3>${ic("cle", 18)} Espace parent</h3><p class="hint">Dans l'appli Android, c'est ici que tu colles la clé API Claude et que tu choisis le modèle. Cette maquette fonctionne uniquement en mode démo.</p></div>`
      : `<div class="card parent">
    <h3>${ic("cle", 18)} Espace parent</h3>
    <div class="seg" role="group" aria-label="Connexion à Claude">
      <button data-cx="serveur" class="${s.connexion !== "cle" ? "on" : ""}">Code famille</button>
      <button data-cx="cle" class="${s.connexion === "cle" ? "on" : ""}">Clé API personnelle</button>
    </div>
    <div id="cx-serveur" ${s.connexion === "cle" ? "hidden" : ""}>
      <label class="field">Adresse du site Révizz
        <input id="serveur" type="url" inputmode="url" value="${esc(s.serveur || ai.adresseServeur({ ...s, serveur: "" }))}" placeholder="https://revizz.netlify.app" autocomplete="off">
      </label>
      <label class="field">Code famille
        <input id="code" type="password" value="${esc(s.code)}" placeholder="le code choisi dans Netlify" autocomplete="off">
      </label>
      <p class="hint">La clé Claude est gardée sur le serveur Netlify : elle n'est jamais sur cet appareil. Le même code fonctionne sur le téléphone et sur le site web.</p>
    </div>
    <div id="cx-cle" ${s.connexion === "cle" ? "" : "hidden"}>
      <label class="field">Clé API Claude
        <input id="apikey" type="password" value="${esc(s.apiKey)}" placeholder="sk-ant-…" autocomplete="off">
      </label>
      <p class="hint">Crée une clé sur <b>platform.claude.com</b> → API Keys. Elle reste sur cet appareil. Pense à fixer une limite de dépense mensuelle dans la console.</p>
    </div>
    <details class="aide"><summary>Réinitialiser le mot de passe d'un compte élève</summary>
      <label class="field">Identifiant du compte<input id="re-ident" autocapitalize="none" autocomplete="off"></label>
      <label class="field">Nouveau mot de passe<input id="re-mdp" type="text" autocomplete="off" placeholder="8 caractères au moins"></label>
      <label class="field">Code famille<input id="re-code" type="password" autocomplete="off"></label>
      <button class="btn secondary big-btn" id="re-ok">Réinitialiser</button>
    </details>
    <label class="field">Modèle<select id="model">${ai.MODELS.map((m) => `<option value="${m.id}" ${m.id === s.model ? "selected" : ""}>${m.label}</option>`).join("")}</select></label>
  </div>`
  }
  <button class="btn primary big-btn" id="save">Enregistrer</button>
  ${DEMO_ONLY ? "" : `<button class="btn ghost big-btn" id="test">Tester la connexion</button>`}
  ${s.demo && !DEMO_ONLY ? `<button class="btn ghost big-btn" id="quit-demo">Quitter la démo</button>` : ""}
  <div id="progress"></div>
  <div class="card">
    <h3>Mes matières</h3>
    <div class="mes-matieres">${getMatieres()
      .filter((m) => m.nom !== "Autre")
      .map((m) => `<span class="chip-m" style="--c:${m.couleur}">${pastille(m.nom, "s")} ${esc(m.nom)}<button data-retirer="${esc(m.nom)}" aria-label="Retirer ${esc(m.nom)}">${ic("fermer", 14)}</button></span>`)
      .join("")}</div>
    <button class="btn secondary big-btn" data-ajout-matiere>${ic("plus", 18)} Ajouter une matière</button>
  </div>
  ${DEMO_ONLY ? "" : sauvegardeHTML()}
  ${consoHTML()}
  <p class="hint center">Révizz · tes fiches restent sur cet appareil, et dans tes sauvegardes.</p>`;
}
const nf = (n) => n.toLocaleString("fr-FR");
const ilYa = (t) => {
  const j = Math.floor((Date.now() - t) / 864e5);
  return j <= 0 ? "aujourd'hui" : j === 1 ? "hier" : `il y a ${j} jours`;
};
function sauvegardeHTML() {
  const der = sauvegarde.derniereSauvegarde();
  const natif = Capacitor.isNativePlatform();
  const sy = store.getSettings();
  const e = synchro.etat();
  const blocSynchro = synchro.disponible(sy)
    ? `<label class="interrupteur"><input type="checkbox" id="synchro-auto" ${sy.synchro !== false ? "checked" : ""}><span><b>Synchronisation automatique</b><small>Le téléphone et le site web partagent les mêmes fiches, par ton site Révizz et le code famille.</small></span></label>
      ${
        sy.synchro !== false
          ? `<p class="${e.erreur ? "alerte" : "hint"}" id="etat-synchro">${e.erreur ? esc(e.erreur) : e.date ? `Synchronisé ${ilYa(e.date)}` : "Pas encore synchronisé"}</p>
             <button class="btn secondary big-btn" id="btn-synchro">${ic("actualiser", 18)} Synchroniser maintenant</button>`
          : ""
      }`
    : `<p class="hint">Synchronisation automatique : disponible avec la connexion « Code famille » (site Révizz sur Netlify).</p>`;
  return `<div class="card" id="carte-synchro">
    <h3>Synchronisation</h3>
    ${blocSynchro}
  </div>
  <div class="card" id="carte-sauvegarde">
    <h3>Sauvegarde dans un fichier</h3>
    <p class="${der && Date.now() - der < 7 * 864e5 ? "hint" : "alerte"}">Dernière sauvegarde : <b>${der ? ilYa(der) : "jamais"}</b></p>
    <button class="btn primary big-btn" id="btn-sauver">${ic(natif ? "envoyer" : "telecharger", 18)} ${natif ? "Sauvegarder vers Drive" : "Télécharger une sauvegarde"}</button>
    <button class="btn secondary big-btn" id="btn-reprendre">${ic("actualiser", 18)} Reprendre une sauvegarde</button>
    <input type="file" id="file-sauvegarde" accept="application/json,.json" hidden>
    <details class="aide"><summary>Passer du téléphone au site web (et inversement)</summary>
      <ol>
        <li>Sur l'appareil où sont les fiches : <b>Sauvegarder vers Drive</b> (sur le téléphone, choisis « Drive » dans le menu de partage).</li>
        <li>Sur l'autre appareil : <b>Reprendre une sauvegarde</b> et choisis le fichier <i>revizz-sauvegarde-…</i> (sur ordinateur, télécharge-le d'abord depuis Drive).</li>
        <li>Choisis <b>Fusionner</b> : rien n'est perdu, et pour une même fiche c'est la version la plus récente qui est gardée.</li>
      </ol>
    </details>
  </div>`;
}
function bindSauvegarde() {
  const $ = (id) => document.getElementById(id);
  if ($("synchro-auto"))
    $("synchro-auto").onchange = (ev) => {
      synchro.activer(ev.target.checked);
      if (ev.target.checked) synchro.synchroniser().catch(() => {}).finally(render);
      render();
    };
  if ($("btn-synchro"))
    $("btn-synchro").onclick = async (ev) => {
      ev.target.disabled = true;
      $("etat-synchro").textContent = "Synchronisation…";
      try {
        const r = await synchro.synchroniser();
        const n = (r?.bilan?.ajoutees || 0) + (r?.bilan?.majs || 0);
        toast(n ? `${n} fiche${n > 1 ? "s" : ""} reçue${n > 1 ? "s" : ""} de l'autre appareil` : "Tout est à jour");
      } catch (err) {
        toast(err.message);
      }
      render();
    };
  if (!$("btn-sauver")) return;
  $("btn-sauver").onclick = async () => {
    try {
      const nom = await sauvegarde.sauvegarder();
      toast(`Sauvegarde prête : ${nom}`);
      render();
    } catch (e) {
      if (!/cancel|annul/i.test(e?.message || "")) toast("Sauvegarde impossible : " + (e?.message || e));
    }
  };
  $("btn-reprendre").onclick = () => $("file-sauvegarde").click();
  $("file-sauvegarde").onchange = async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    let s;
    try {
      s = sauvegarde.lireSauvegarde(await f.text());
    } catch (err) {
      return toast(err.message);
    }
    const nb = (s.donnees["revizz.fiches"] || []).length;
    modale(
      `<h3>Reprendre la sauvegarde</h3>
      <p>Sauvegarde du <b>${new Date(s.date).toLocaleDateString("fr-FR")}</b> : ${nb} fiche${nb > 1 ? "s" : ""}.</p>
      <button class="btn primary big-btn" data-mode="fusionner">${ic("fusion", 18)} Fusionner (recommandé)</button>
      <p class="hint">Garde les fiches de cet appareil et ajoute celles de la sauvegarde.</p>
      <button class="btn secondary big-btn" data-mode="remplacer">Tout remplacer</button>
      <p class="hint">Cet appareil devient une copie exacte de la sauvegarde.</p>
      <button class="btn ghost" data-mode="">Annuler</button>`,
      (box, fermer) =>
        box.querySelectorAll("[data-mode]").forEach(
          (b) =>
            (b.onclick = () => {
              fermer();
              if (!b.dataset.mode) return;
              const bilan = sauvegarde.reprendre(s, b.dataset.mode);
              toast(b.dataset.mode === "remplacer" ? `Sauvegarde reprise : ${bilan.ajoutees} fiches` : `${bilan.ajoutees} fiche(s) ajoutée(s), ${bilan.majs} mise(s) à jour`);
              render();
            })
        )
    );
    e.target.value = "";
  };
}
function consoHTML() {
  const c = store.getConso();
  if (!c.appels) return "";
  const total = c.entree + c.cache + c.sortie;
  const partCache = total ? Math.round((c.cache / (c.entree + c.cache || 1)) * 100) : 0;
  return `<div class="card conso">
    <h3>${ic("eco", 18)} Consommation</h3>
    <div class="conso-grid">
      <div><b>${nf(c.appels)}</b><span>demandes à Claude</span></div>
      <div><b>${nf(c.entree + c.cache)}</b><span>tokens lus</span></div>
      <div><b>${nf(c.sortie)}</b><span>tokens écrits</span></div>
      <div><b>${partCache} %</b><span>relus depuis le cache</span></div>
    </div>
    <p class="hint">Les tokens écrits sont les plus coûteux en énergie. Refaire un QCM déjà généré ou réviser les cartes ne consomme rien.</p>
    <button class="btn ghost" id="reset-conso">Remettre le compteur à zéro</button>
  </div>`;
}
let cxTouche = false;
afterRender.settings = () => {
  const $$ = (id) => document.getElementById(id);
  if ($$("btn-deconnexion"))
    $$("btn-deconnexion").onclick = async () => {
      if (!(await confirmer("Se déconnecter ? Ton travail reste sur ton compte, mais il sera effacé de cet appareil jusqu'à ta prochaine connexion.", "Se déconnecter"))) return;
      try {
        await synchro.synchroniser();
      } catch (e) {
        if (!(await confirmer(`La dernière synchronisation a échoué (${e.message}). Le travail fait ici depuis la dernière synchronisation serait perdu. Se déconnecter quand même ?`, "Se déconnecter"))) return;
      }
      compte.deconnecter();
      go({ view: "welcome" });
    };
  if ($$("btn-mdp"))
    $$("btn-mdp").onclick = () =>
      modale(
        `<h3>Changer le mot de passe</h3>
        <label class="field">Mot de passe actuel<input id="m-ancien" type="password" autocomplete="current-password"></label>
        <label class="field">Nouveau mot de passe<input id="m-nouveau" type="password" autocomplete="new-password" placeholder="8 caractères au moins"></label>
        <p class="hint">Les autres appareils devront se reconnecter.</p>
        <button class="btn primary big-btn" id="m-ok">Changer</button><div id="m-msg"></div>`,
        (box, fermer) =>
          (box.querySelector("#m-ok").onclick = async () => {
            try {
              await compte.changerMotDePasse(box.querySelector("#m-ancien").value, box.querySelector("#m-nouveau").value);
              fermer();
              toast("Mot de passe changé");
            } catch (e) {
              box.querySelector("#m-msg").innerHTML = `<div class="error">${esc(e.message)}</div>`;
            }
          })
      );
  if ($$("re-ok"))
    $$("re-ok").onclick = async () => {
      try {
        await compte.reinitialiser($$("re-ident").value.trim(), $$("re-mdp").value, $$("re-code").value);
        toast("Mot de passe réinitialisé");
        $$("re-mdp").value = "";
      } catch (e) {
        toast(e.message);
      }
    };
  document.querySelectorAll("[data-dose]").forEach((b) => (b.onclick = () => (store.saveSettings({ doseCartes: +b.dataset.dose }), render())));
  const $ = (id) => document.getElementById(id);
  bindSauvegarde();
  if ($("reset-conso"))
    $("reset-conso").onclick = () => {
      store.resetConso();
      render();
    };
  cxTouche = false;
  document.querySelectorAll("[data-cx]").forEach(
    (b) =>
      (b.onclick = () => {
        cxTouche = true;
        document.querySelectorAll("[data-cx]").forEach((x) => x.classList.toggle("on", x === b));
        $("cx-serveur").hidden = b.dataset.cx !== "serveur";
        $("cx-cle").hidden = b.dataset.cx !== "cle";
      })
  );
  const save = () => {
    const reglages = { prenom: $("prenom").value.trim(), classe: $("classe").value };
    if (!DEMO_ONLY) {
      const choisi = document.querySelector("[data-cx].on")?.dataset.cx || "serveur";
      // Un élève connecté à son compte le reste, sauf si le parent change explicitement de mode.
      const connexion = compte.estConnecte() && !cxTouche ? "compte" : choisi;
      const serveur = $("serveur").value.trim();
      Object.assign(reglages, {
        connexion,
        apiKey: $("apikey").value.trim(),
        code: $("code").value.trim(),
        // On ne mémorise l'adresse que si elle diffère de celle trouvée automatiquement.
        serveur: serveur && serveur !== ai.adresseServeur({ serveur: "" }) ? serveur : "",
        model: $("model").value,
      });
    }
    store.saveSettings(reglages);
  };
  $("save").onclick = () => {
    save();
    const s = store.getSettings();
    const pret = ai.estConfigure({ ...s, demo: false });
    if (!pret && !s.demo) return toast(s.connexion === "cle" ? "Il faut une clé API pour utiliser Révizz." : "Il faut l'adresse du site et le code famille.");
    if (pret && s.demo && !DEMO_ONLY) quitterDemo();
    if (synchro.active()) synchro.synchroniser().catch(() => {});
    toast("Enregistré");
    go({ view: "home" });
  };
  if ($("quit-demo"))
    $("quit-demo").onclick = async () => {
      if (!(await confirmer("Quitter la démo ? Les fiches d'exemple seront supprimées.", "Quitter"))) return;
      quitterDemo();
      go({ view: ai.estConfigure() ? "home" : "welcome" });
    };
  if ($("test")) $("test").onclick = async (e) => {
    save();
    e.target.disabled = true;
    const p = progressUI($("progress"), "Je contacte Claude…");
    try {
      await ai.testerCle();
      $("progress").innerHTML = `<div class="success">${ic("fait", 18)} Connexion à Claude réussie</div>`;
    } catch (err) {
      $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
    } finally {
      p.stop();
      e.target.disabled = false;
    }
  };
};

async function demanderRetrait(nom) {
  const n = store.getFiches().filter((f) => f.matiere === nom).length;
  if (n) return toast(`${nom} contient ${n} fiche${n > 1 ? "s" : ""} : déplace-les ou supprime-les d'abord.`);
  if (!(await confirmer(`Retirer ${nom} de tes matières ?`, "Retirer"))) return;
  retirerMatiere(nom);
  if (ui.view === "matiere") go({ view: "home", matiere: null });
  else render();
}

// ---------- Progrès d'un chapitre : test de départ → révisions → test final ----------
// Toutes les fiches du chapitre réunies, pour générer un test sur l'ensemble du chapitre.
function ficheChapitre(m, c) {
  const fiches = fichesDuChapitre(m, c);
  return {
    titre: c,
    matiere: m,
    chapitre: c === "Sans chapitre" ? "" : c,
    demoKey: fiches[0]?.demoKey,
    transcription: fiches.map((f) => `## ${f.titre}\n${f.transcription}`).join("\n\n"),
  };
}
const humeur = (n) => (n >= 16 ? "Excellent" : n >= 12 ? "Bien" : n >= 8 ? "En progrès" : "À travailler");
const noteDe = (r) => store.sur20(r.score, r.total);

function resumeProgres(m, c) {
  const p = store.getProgres(m, c);
  if (!p.depart) return `${ic("depart", 15)} Mesurer mes progrès`;
  const fin = p.finals?.at(-1);
  return fin ? `${ic("progres", 15)} ${noteDe(p.depart)} → ${noteDe(fin)}/20` : `${ic("progres", 15)} Départ ${noteDe(p.depart)}/20`;
}

// Points du graphique : test de départ, QCM d'entraînement du chapitre, tests finals, dans l'ordre.
function pointsDuChapitre(m, c) {
  const p = store.getProgres(m, c);
  const pts = [];
  if (p.depart) pts.push({ date: p.depart.date, note: noteDe(p.depart), type: "depart" });
  for (const q of fichesDuChapitre(m, c).flatMap((f) => f.qcm || [])) pts.push({ date: q.date, note: noteDe(q), type: "qcm" });
  for (const q of p.qcmsChap || []) pts.push({ date: q.date, note: noteDe(q), type: "qcm" });
  for (const f of p.finals || []) pts.push({ date: f.date, note: noteDe(f), type: "final" });
  pts.sort((a, b) => a.date - b.date);
  let k = 0;
  for (const pt of pts) pt.label = pt.type === "depart" ? "Départ" : pt.type === "final" ? "Final" : `QCM ${++k}`;
  return pts;
}

// Graphique en courbe, notes sur 20, avec la ligne de la moyenne.
function graphique(points) {
  const W = 320, H = 190, L = 30, R = 26, T = 18, B = 34;
  const w = W - L - R, h = H - T - B;
  const x = (i) => (points.length === 1 ? L + w / 2 : L + (i * w) / (points.length - 1));
  const y = (n) => T + (1 - n / 20) * h;
  const montrerLabels = points.length <= 8;
  const grille = [0, 5, 10, 15, 20]
    .map((v) => `<line class="g-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="g-axe" x="${L - 6}" y="${y(v) + 3.5}" text-anchor="end">${v}</text>`)
    .join("");
  const ligne = points.map((pt, i) => `${x(i).toFixed(1)},${y(pt.note).toFixed(1)}`).join(" ");
  const marques = points
    .map(
      (pt, i) => `<circle class="g-pt g-${pt.type}" cx="${x(i)}" cy="${y(pt.note)}" r="${pt.type === "qcm" ? 5 : 7}"/>
      <text class="g-val" x="${x(i)}" y="${y(pt.note) - 11}" text-anchor="middle">${pt.note}</text>
      ${montrerLabels || pt.type !== "qcm" ? `<text class="g-lab" x="${x(i)}" y="${H - 12}" text-anchor="middle">${pt.label}</text>` : ""}`
    )
    .join("");
  return `<svg class="graph" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution des notes sur 20 : ${points.map((p) => `${p.label} ${p.note}`).join(", ")}">
    ${grille}
    <line class="g-moy" x1="${L}" x2="${W - R}" y1="${y(10)}" y2="${y(10)}"/>
    ${points.length > 1 ? `<polyline class="g-line" points="${ligne}"/>` : ""}
    ${marques}
  </svg>`;
}

// Grandes barres « Avant / Après », lisibles d'un coup d'œil.
function avantApres(p) {
  const avant = noteDe(p.depart);
  const fin = p.finals?.at(-1);
  const apres = fin ? noteDe(fin) : null;
  const barre = (note, cls, titre) => `
    <div class="aa-col">
      <div class="aa-note">${note === null ? "?" : `${note}<small>/20</small>`}</div>
      <div class="aa-track"><div class="aa-bar ${cls}" style="height:${note === null ? 100 : Math.max(4, (note / 20) * 100)}%"></div></div>
      <div class="aa-lab"><b>${titre}</b><br>${note === null ? "à faire" : humeur(note)}</div>
    </div>`;
  let message = "Révise tes fiches et tes cartes, puis fais le test final pour voir tes progrès !";
  if (apres !== null) {
    const gain = apres - avant;
    message =
      gain >= 6 ? `+${gain} points : énorme progrès !` :
      gain >= 3 ? `+${gain} points : beau progrès !` :
      gain > 0 ? `+${gain} point${gain > 1 ? "s" : ""} : tu progresses` :
      gain === 0 ? "Même note qu'au départ : refais un tour des cartes et réessaie." :
      "Pas grave : revois les cartes à revoir, puis retente le test final.";
  }
  return `<div class="card aa">
    <div class="aa-cols">${barre(avant, "avant", "Avant")}<div class="aa-fleche">→</div>${barre(apres, apres === null ? "attente" : "apres", "Après")}</div>
    <p class="aa-msg">${message}</p>
  </div>`;
}

function chapitreView() {
  const m = ui.matiere;
  const c = ui.chapitre;
  const fiches = fichesDuChapitre(m, c);
  const p = store.getProgres(m, c);
  const pts = pointsDuChapitre(m, c);
  const cartes = fiches.flatMap((f) => f.flashcards);
  const maitrise = cartes.length ? Math.round(fiches.reduce((s, f) => s + store.maitrise(f) * f.flashcards.length, 0) / cartes.length) : 0;
  return `
  <header class="top" style="--c:${couleur(m)}">
    <button class="icon" data-back aria-label="Retour">${ic("retour", 22)}</button>
    <div class="title"><small>${pastille(m, "s")} ${esc(m)} · Parcours</small>${esc(c)}</div>
    <span></span>
  </header>
  ${parcoursHTML(m, c)}
  ${ressourcesHTML(m, c)}
  <h2 class="titre-section">Mesurer mes progrès</h2>
  ${
    !p.depart
      ? `<div class="card">
          <h3>${ic("depart", 18)} Test de départ</h3>
          <p>Fais-le <b>au début du chapitre</b>, avant de réviser : il montre d'où tu pars. Une note basse est normale, c'est justement ce qu'on veut mesurer !</p>
          <p class="hint">10 questions sur tout le chapitre. À la fin du chapitre, tu referas le même test pour voir tes progrès.</p>
          <button class="btn primary big-btn" data-test="depart">Commencer le test de départ</button>
          <div id="progress"></div>
        </div>`
      : `${avantApres(p)}
        <div class="card">
          <h3>${ic("progres", 18)} Ton parcours</h3>
          ${graphique(pts)}
          <div class="legende"><span><i class="g-depart"></i>Départ</span><span><i class="g-qcm"></i>QCM d'entraînement</span><span><i class="g-final"></i>Test final</span><span><i class="g-moy-l"></i>Moyenne (10/20)</span></div>
          <div class="maitrise"><span>${ic("cartes", 16)} Cartes maîtrisées</span><div class="bar wide"><i style="width:${maitrise}%"></i></div><b>${maitrise} %</b></div>
        </div>
        <button class="btn primary big-btn" data-test="final">${ic(p.finals?.length ? "refaire" : "final", 18)} ${p.finals?.length ? "Refaire le test final" : "Faire le test final"}</button>
        <p class="hint center">Les mêmes questions qu'au départ, dans un autre ordre : la comparaison est juste.</p>
        <div id="progress"></div>`
  }
  <h3 class="chapitre">Fiches du chapitre</h3>
  <div class="liste-lignes">${fiches.map((f) => carteFiche(f)).join("")}</div>`;
}

// ---------- Parcours en 3 paliers ----------
function parcoursHTML(m, c) {
  const e = etatPaliers(m, c);
  const etape = (n, titre, sous, valide, detail, boutons) => {
    const etat = valide ? "valide" : e.actuel === n ? "actuel" : "a-venir";
    return `<div class="palier ${etat}">
      <div class="palier-num">${valide ? ic("ok", 16) : n}</div>
      <div class="palier-corps">
        <b>${titre}</b><small>${sous}</small>
        <p class="palier-detail">${detail}</p>
        ${etat !== "a-venir" || valide ? `<div class="palier-actions">${boutons}</div>` : ""}
      </div>
    </div>`;
  };
  return `<section class="parcours">
    ${etape(1, "Je sais", "Connaître le cours", e.p1,
      `Cartes sues : <b>${e.connues} %</b> (objectif ${SEUILS.cartesConnues} %) · Meilleur QCM : <b>${e.meilleur ?? "—"}/20</b> (objectif ${SEUILS.noteQcm})`,
      `<button class="btn secondary" data-palier="1cartes">${ic("cartes", 16)} Cartes</button><button class="btn secondary" data-palier="1qcm">${ic("qcm", 16)} QCM du chapitre</button>`)}
    ${etape(2, "Je sais faire", "Appliquer avec méthode", e.p2,
      `Exercices réussis : <b>${Math.min(e.reussis, SEUILS.exercices)}/${SEUILS.exercices}</b>, avec coups de pouce et correction pas à pas`,
      `<button class="btn ${e.actuel === 2 ? "primary" : "secondary"}" data-palier="2">${ic("copie", 16)} Exercices d'application</button>`)}
    ${etape(3, "Je vais plus loin", "Réfléchir dans une situation nouvelle", e.p3,
      e.p3 ? `Défi réussi${e.note3 !== null ? ` : <b>${e.note3}/20</b>` : ""}` : "Un défi qui mobilise tout le chapitre, évalué par Claude",
      `<button class="btn ${e.actuel === 3 ? "primary" : "secondary"}" data-palier="3">${ic("medaille", 16)} Défi</button>`)}
    ${e.actuel === 4 ? `<p class="parcours-fin">${ic("trophee", 18)} Chapitre maîtrisé : les trois paliers sont validés.</p>` : ""}
    <div id="progress"></div>
  </section>`;
}
// Ressources publiques gratuites, ouvertes dans le navigateur.
function ressourcesHTML(m, c) {
  const q = encodeURIComponent(c === "Sans chapitre" ? m : c);
  const liens = [[`https://www.lumni.fr/recherche?query=${q}`, "Lumni", "Vidéos et quiz gratuits de l'audiovisuel public"]];
  if (m === "Mathématiques") liens.push(["https://coopmaths.fr/alea/", "MathALÉA", "Exercices de maths corrigés, à volonté"]);
  return `<details class="card ressources"><summary>${ic("lien", 16)} Pour réviser autrement</summary>
    ${liens.map(([url, nom, desc]) => `<a class="ligne" href="${url}" target="_blank" rel="noopener"><span class="ligne-txt"><b>${nom}</b><small>${desc}</small></span>${ic("suite", 18, "chevron")}</a>`).join("")}
  </details>`;
}

// --- Palier 2 : exercices d'application
function exosView() {
  const m = ui.matiere, c = ui.chapitre;
  const p = store.getProgres(m, c);
  const e = etatPaliers(m, c);
  const exos = p.p2?.exos || [];
  const head = `<header class="top"><button class="icon" data-back aria-label="Retour">${ic("retour", 22)}</button><div class="title"><small>${pastille(m, "s")} ${esc(c)}</small>Je sais faire</div><span class="icon-place"></span></header>`;
  if (!exos.length)
    return `${head}<section class="vide-etat"><h2>Exercices d'application</h2><p>3 exercices comme en classe, de difficulté croissante. Pour chacun : 3 coups de pouce si tu bloques, puis la correction pas à pas.</p>
      <button class="btn primary big-btn" id="gen-exos">Préparer mes exercices</button><div id="progress"></div></section>`;
  return `${head}
  <div class="resume-palier"><b>${Math.min(e.reussis, SEUILS.exercices)}/${SEUILS.exercices}</b> exercices réussis${e.p2 ? " · palier 2 validé" : ""}</div>
  ${exos
    .map((x, i) => {
      const st = p.p2.etat[i] || {};
      const finis = st.resultat;
      return `<article class="card exo ${finis ? `exo-${finis}` : ""}">
        <div class="exo-tete"><span class="tag-comp">${esc(x.competence)}</span>${finis === "reussi" ? `<span class="tag-ok">${ic("ok", 14)} Réussi</span>` : finis === "rate" ? `<span class="tag-ko">À retravailler</span>` : ""}</div>
        <h3>${i + 1}. ${esc(x.titre)}</h3>
        <div class="md">${md(x.enonce)}</div>
        <textarea data-brouillon="${i}" rows="3" placeholder="Ta réponse ou ton brouillon">${esc(st.brouillon || "")}</textarea>
        ${(x.indices || []).slice(0, st.indices || 0).map((ind, k) => `<p class="indice">${ic("astuce", 16)} <span><b>Coup de pouce ${k + 1}</b> ${esc(ind)}</span></p>`).join("")}
        ${(x.etapes || []).slice(0, st.etapes || 0).map((et, k) => `<div class="etape"><b>Étape ${k + 1} · ${esc(et.titre)}</b><div class="md">${md(et.explication)}</div></div>`).join("")}
        ${st.etapes >= (x.etapes || []).length ? `<p class="reponse">${ic("fait", 16)} <span><b>Réponse :</b> ${esc(x.reponse)}</span></p>` : ""}
        <div class="exo-actions">
          ${!st.etapes && (st.indices || 0) < 3 ? `<button class="btn secondary" data-indice="${i}">${ic("astuce", 16)} Coup de pouce (${(st.indices || 0) + 1}/3)</button>` : ""}
          ${(st.etapes || 0) < (x.etapes || []).length ? `<button class="btn secondary" data-etape="${i}">${st.etapes ? "Étape suivante" : "Correction pas à pas"}</button>` : ""}
          ${st.etapes >= (x.etapes || []).length && !finis ? `<button class="btn good" data-resultat="${i}:reussi">${ic("ok", 16)} J'ai réussi</button><button class="btn secondary" data-resultat="${i}:rate">Pas encore</button>` : ""}
        </div>
        ${st.etapes >= (x.etapes || []).length && !finis && (st.indices || 0) >= 3 ? `<p class="hint">Avec les 3 coups de pouce, l'exercice ne compte pas pour le palier : refais-en un autre seul.</p>` : ""}
      </article>`;
    })
    .join("")}
  <button class="btn ghost big-btn" id="gen-exos">${ic("actualiser", 16)} Nouveaux exercices</button>
  <div id="progress"></div>`;
}
afterRender.exos = () => {
  const m = ui.matiere, c = ui.chapitre;
  const lire = () => store.getProgres(m, c);
  const ecrire = (p) => store.saveProgres(m, c, p);
  const $ = (id) => document.getElementById(id);
  if ($("gen-exos"))
    $("gen-exos").onclick = async (e) => {
      e.target.disabled = true;
      const pr = progressUI($("progress"), "Claude prépare tes exercices…");
      try {
        const exos = await ai.genererExercices(ficheChapitre(m, c), pr.update);
        const p = lire();
        p.p2 = { ...(p.p2 || {}), exos, etat: exos.map(() => ({})), reussis: p.p2?.reussis || 0 };
        ecrire(p);
        render();
      } catch (err) {
        $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
        e.target.disabled = false;
      } finally {
        pr.stop();
      }
    };
  const maj = (i, f) => {
    const p = lire();
    p.p2.etat[i] = f({ ...(p.p2.etat[i] || {}) }, p);
    ecrire(p);
  };
  document.querySelectorAll("[data-brouillon]").forEach((t) => (t.onchange = () => maj(+t.dataset.brouillon, (st) => ({ ...st, brouillon: t.value }))));
  document.querySelectorAll("[data-indice]").forEach((b) => (b.onclick = () => (maj(+b.dataset.indice, (st) => ({ ...st, indices: Math.min(3, (st.indices || 0) + 1) })), render())));
  document.querySelectorAll("[data-etape]").forEach((b) => (b.onclick = () => (maj(+b.dataset.etape, (st) => ({ ...st, etapes: (st.etapes || 0) + 1 })), render())));
  document.querySelectorAll("[data-resultat]").forEach(
    (b) =>
      (b.onclick = () => {
        const [i, res] = b.dataset.resultat.split(":");
        const p = lire();
        const st = p.p2.etat[+i] || {};
        st.resultat = res;
        // Réussi sans le 3e coup de pouce : compte pour le palier.
        if (res === "reussi" && (st.indices || 0) < 3) p.p2.reussis = (p.p2.reussis || 0) + 1;
        p.p2.etat[+i] = st;
        ecrire(p);
        store.enregistrerActivite("qcm");
        jeu.gagner(res === "reussi" ? 8 : 2, res === "reussi" ? { exo: 1 } : {});
        if (etatPaliers(m, c).p2 && res === "reussi") toast("Palier 2 validé : place au défi !");
        render();
      })
  );
};

// --- Palier 3 : défi
function defiView() {
  const m = ui.matiere, c = ui.chapitre;
  const p = store.getProgres(m, c);
  const d = p.p3?.defi;
  const ev = p.p3?.evaluation;
  const head = `<header class="top"><button class="icon" data-back aria-label="Retour">${ic("retour", 22)}</button><div class="title"><small>${pastille(m, "s")} ${esc(c)}</small>Je vais plus loin</div><span class="icon-place"></span></header>`;
  if (!d)
    return `${head}<section class="vide-etat"><h2>Le défi du chapitre</h2><p>Une situation nouvelle, qui oblige à réfléchir avec tout ce que tu as appris. Compte 20 à 30 minutes. Claude lit ta réponse et te dit si ton raisonnement tient.</p>
      <button class="btn primary big-btn" id="gen-defi">Voir mon défi</button><div id="progress"></div></section>`;
  return `${head}
  <article class="card">
    <h2>${esc(d.titre)}</h2>
    <div class="md">${md(d.situation)}</div>
    <p class="consigne">${ic("fleche", 16)} <b>${esc(d.consigne)}</b></p>
    <h3>Ce qui sera évalué</h3>
    <ul class="keys">${(d.criteres || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
    <details><summary>Besoin d'une piste ?</summary><ul class="keys">${(d.pistes || []).map((x) => `<li>${esc(x)}</li>`).join("")}</ul></details>
  </article>
  <h3>Ma réponse</h3>
  <textarea id="defi-rep" rows="9" placeholder="Explique ton raisonnement : c'est lui qui compte.">${esc(p.p3.reponse || "")}</textarea>
  <button class="btn primary big-btn" id="defi-eval">${ic("copie", 18)} Faire évaluer ma réponse</button>
  <div id="progress"></div>
  ${
    ev
      ? `<div class="card eval ${ev.valide ? "eval-ok" : "eval-ko"}">
          <div class="eval-tete"><b class="big-num">${ev.note}/20</b><span>${ev.valide ? `${ic("ok", 16)} Défi réussi · palier 3 validé` : "Pas encore validé"}</span></div>
          ${ev.points_forts?.length ? `<h3>Points forts</h3><ul class="keys">${ev.points_forts.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          ${ev.a_ameliorer?.length ? `<h3>À améliorer</h3><ul class="keys">${ev.a_ameliorer.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
          <p class="astuce">${ic("astuce", 18)} <span>${esc(ev.conseil)}</span></p>
        </div>
        <details class="card"><summary>Voir le corrigé</summary><div class="md">${md(d.corrige)}</div></details>`
      : ""
  }
  <button class="btn ghost big-btn" id="gen-defi">${ic("actualiser", 16)} Un autre défi</button>`;
}
afterRender.defi = () => {
  const m = ui.matiere, c = ui.chapitre;
  const $ = (id) => document.getElementById(id);
  $("gen-defi").onclick = async (e) => {
    e.target.disabled = true;
    const zone = $("progress");
    const pr = progressUI(zone, "Claude prépare ton défi…");
    try {
      const defi = await ai.genererDefi(ficheChapitre(m, c), pr.update);
      const p = store.getProgres(m, c);
      p.p3 = { ...(p.p3 || {}), defi, reponse: "", evaluation: null, valide: p.p3?.valide || false };
      store.saveProgres(m, c, p);
      render();
    } catch (err) {
      zone.innerHTML = `<div class="error">${esc(err.message)}</div>`;
      e.target.disabled = false;
    } finally {
      pr.stop();
    }
  };
  if (!$("defi-rep")) return;
  $("defi-rep").onchange = () => {
    const p = store.getProgres(m, c);
    p.p3.reponse = $("defi-rep").value;
    store.saveProgres(m, c, p);
  };
  $("defi-eval").onclick = async (e) => {
    const reponse = $("defi-rep").value.trim();
    if (reponse.split(/\s+/).length < 8) return toast("Développe un peu plus ta réponse");
    e.target.disabled = true;
    const pr = progressUI($("progress"), "Claude lit ta réponse…");
    try {
      const p = store.getProgres(m, c);
      const evaluation = await ai.evaluerDefi(ficheChapitre(m, c), p.p3.defi, reponse, pr.update);
      p.p3 = { ...p.p3, reponse, evaluation, valide: p.p3.valide || !!evaluation.valide, essais: (p.p3.essais || 0) + 1 };
      store.saveProgres(m, c, p);
      store.enregistrerActivite("qcm");
      jeu.gagner(evaluation.valide ? 40 : 10, evaluation.valide ? { defi: 1, defi_valide: 1 } : { defi: 1 });
      if (evaluation.valide) toast("Palier 3 validé !");
      render();
    } catch (err) {
      $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
      e.target.disabled = false;
    } finally {
      pr.stop();
    }
  };
};

let test = null; // { type, questions, i, choisi, score, erreurs, fini }
async function lancerTest(type) {
  const m = ui.matiere;
  const c = ui.chapitre;
  const p = store.getProgres(m, c);
  let questions;
  if (type === "final" && p.depart?.questions?.length) {
    // Éco-conception : on reprend les questions du départ, sans appel à Claude.
    questions = melangerQCM(p.depart.questions);
  } else {
    const zone = document.getElementById("progress");
    document.querySelectorAll("[data-test]").forEach((b) => (b.disabled = true));
    const pr = progressUI(zone, "Claude prépare ton test sur tout le chapitre…");
    try {
      questions = await ai.genererQCM(ficheChapitre(m, c), "moyen", 10, [], pr.update);
    } catch (err) {
      zone.innerHTML = `<div class="error">${esc(err.message)}</div>`;
      document.querySelectorAll("[data-test]").forEach((b) => (b.disabled = false));
      return;
    } finally {
      pr.stop();
    }
  }
  test = { type, questions, i: 0, choisi: null, score: 0, erreurs: [], fini: false };
  go({ view: "test" });
}

function testView() {
  if (!test) {
    ui.view = "chapitre";
    return chapitreView();
  }
  const titre = test.type === "depart" ? "Test de départ" : test.type === "palier1" ? "QCM du chapitre" : "Test final";
  const head = `<header class="top" style="--c:${couleur(ui.matiere)}"><button class="icon" data-back aria-label="Retour">${ic("retour", 22)}</button><div class="title"><small>${esc(ui.chapitre)}</small>${titre}</div><span></span></header>`;
  if (test.i >= test.questions.length) {
    const note = store.sur20(test.score, test.questions.length);
    const p = store.getProgres(ui.matiere, ui.chapitre);
    const comparaison =
      test.type === "final" && p.depart
        ? `<div class="compare"><span>Avant <b>${noteDe(p.depart)}/20</b></span><span class="aa-fleche">→</span><span>Maintenant <b>${note}/20</b></span></div>`
        : test.type === "palier1"
          ? `<p class="sub">${note >= SEUILS.noteQcm ? (etatPaliers(ui.matiere, ui.chapitre).p1 ? "Palier 1 validé : passe aux exercices d'application !" : `Bravo ! Pour valider le palier 1, révise aussi les cartes (${SEUILS.cartesConnues} % à connaître).`) : `Il faut ${SEUILS.noteQcm}/20 pour valider le palier 1 : relis la fiche et retente.`}</p>`
          : `<p class="sub">C'est ton point de départ. Révise les fiches et les cartes du chapitre, puis fais le test final !</p>`;
    const r = reactionNote(note, `test${test.type}${ui.chapitre}`);
    return `${head}<div class="card center done">
      ${mascotte(r.humeur, 84)}
      <div class="big-num">${note}/20</div><p class="sub">${humeur(note)}</p>
      <p class="masc-dit">${esc(r.texte)}</p>
      <p>${test.score} bonne${test.score > 1 ? "s" : ""} réponse${test.score > 1 ? "s" : ""} sur ${test.questions.length}</p>
      ${comparaison}
      ${test.erreurs.length ? `<h3>À revoir</h3><ul class="keys">${test.erreurs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
      <button class="btn primary big-btn" id="test-voir">${ic("progres", 18)} ${test.type === "palier1" ? "Voir mon parcours" : "Voir mes progrès"}</button>
    </div>`;
  }
  const q = test.questions[test.i];
  const rep = test.choisi;
  return `${head}
  <div class="counter">Question ${test.i + 1} / ${test.questions.length}</div>
  <div class="card question">${esc(q.question)}</div>
  <div class="choices">${q.choix
    .map((ch, i) => {
      let cls = "";
      if (rep !== null) cls = i === q.bonne_reponse ? "good" : i === rep ? "bad" : "dim";
      return `<button class="choice ${cls}" data-tchoix="${i}" ${rep !== null ? "disabled" : ""}><b>${"ABCD"[i]}</b>${esc(ch)}</button>`;
    })
    .join("")}</div>
  ${
    rep !== null
      ? `<div class="explain ${rep === q.bonne_reponse ? "ok" : "ko"}">${rep === q.bonne_reponse ? "Bravo !" : "Raté."} ${esc(q.explication)}</div>
         <button class="btn primary big-btn" id="test-next">${test.i + 1 < test.questions.length ? "Question suivante →" : "Voir ma note"}</button>`
      : ""
  }`;
}
afterRender.test = () => {
  if (!test) return;
  const $ = (id) => document.getElementById(id);
  document.querySelectorAll("[data-tchoix]").forEach(
    (b) =>
      (b.onclick = () => {
        const q = test.questions[test.i];
        test.choisi = +b.dataset.tchoix;
        if (test.choisi === q.bonne_reponse) test.score++;
        else test.erreurs.push(`${q.question} → ${q.choix[q.bonne_reponse]}`);
        render();
      })
  );
  if ($("test-next"))
    $("test-next").onclick = () => {
      test.i++;
      test.choisi = null;
      if (test.i >= test.questions.length && !test.fini) {
        test.fini = true;
        const p = store.getProgres(ui.matiere, ui.chapitre);
        const resultat = { date: Date.now(), score: test.score, total: test.questions.length };
        if (test.type === "depart") p.depart = { ...resultat, questions: test.questions };
        else if (test.type === "palier1") p.qcmsChap = [...(p.qcmsChap || []), resultat];
        else p.finals = [...(p.finals || []), resultat];
        store.saveProgres(ui.matiere, ui.chapitre, p);
        store.enregistrerActivite("qcm");
        gagnerQcm(test.score, test.questions.length);
      }
      render();
      window.scrollTo(0, 0);
    };
  if ($("test-voir"))
    $("test-voir").onclick = () => {
      test = null;
      go({ view: "chapitre" });
    };
};

// ---------- Mode « J'ai un contrôle » ----------
const dateLisible = (isoDate) => new Date(isoDate + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const dateCourte = (isoDate) => new Date(isoDate + "T12:00").toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
const libelleJour = (isoDate) => {
  const r = Math.round((new Date(isoDate + "T12:00") - new Date(ctrl.aujourdhui() + "T12:00")) / 864e5);
  return r === 0 ? "Aujourd'hui" : r === 1 ? "Demain" : dateLisible(isoDate);
};
const compteARebours = (c) => {
  const r = ctrl.joursRestants(c);
  return r === 0 ? "Aujourd'hui" : r === 1 ? "Demain" : `Dans ${r} jours`;
};
const ICONE_TACHE = { relire: "resume", qcm: "qcm", sujet: "sujet", cartes: "cartes", points: "resume", test: "final", p1qcm: "qcm", exos: "copie", defi: "medaille" };

// Sur l'accueil : les contrôles à venir, avec l'avancement du jour.
function controlesAccueil() {
  const prochains = ctrl.aVenir();
  const aNoter = ctrl.passes().filter((c) => c.note === null && ctrl.joursRestants(c) >= -7);
  return [
    ...prochains.map((c) => {
      const { taches, faites } = ctrl.duJour(c);
      return `<button class="ligne" data-controle="${c.id}">
        ${pastille(c.matiere, "m")}
        <span class="ligne-txt"><b>Contrôle de ${esc(c.matiere)}</b><small>${compteARebours(c)}${taches.length ? ` · ${faites}/${taches.length} tâche${taches.length > 1 ? "s" : ""} aujourd'hui` : ""}</small></span>
        <span class="jx">${ctrl.joursRestants(c) === 0 ? "J" : `J-${ctrl.joursRestants(c)}`}</span>
      </button>`;
    }),
    ...aNoter.map(
      (c) => `<button class="ligne" data-controle="${c.id}">${pastille(c.matiere, "m")}<span class="ligne-txt"><b>Ta note en ${esc(c.matiere)} ?</b><small>Note-la pour suivre tes progrès</small></span>${ic("suite", 18, "chevron")}</button>`
    ),
  ].join("");
}

// ---------- Planning : tous les contrôles ----------
function planning() {
  const prochains = ctrl.aVenir();
  const passes = ctrl.passes().slice(0, 8);
  const carte = (c) => {
    const plan = ctrl.planning(c);
    const total = plan.reduce((n, j) => n + j.taches.length, 0);
    const faites = plan.reduce((n, j) => n + j.taches.filter((t) => c.faits[t.id]).length, 0);
    return `<button class="ligne" data-controle="${c.id}">
      ${pastille(c.matiere, "m")}
      <span class="ligne-txt"><b>${esc(c.matiere)}${c.titre ? ` · ${esc(c.titre)}` : ""}</b><small>${dateLisible(c.date)}</small>
      ${total ? `<span class="jauge"><i style="width:${Math.round((faites / total) * 100)}%;background:${couleur(c.matiere)}"></i></span>` : ""}</span>
      <span class="jx">${ctrl.joursRestants(c) === 0 ? "J" : `J-${ctrl.joursRestants(c)}`}</span>
    </button>`;
  };
  return `
  <header class="page-head"><div><p class="eyebrow">Contrôles et révisions</p><h1>Planning</h1></div></header>
  <button class="btn primary big-btn" data-nouveau-controle="">${ic("controle", 20)} Nouveau contrôle</button>
  ${
    prochains.length
      ? `<section class="bloc"><h2>À venir</h2><div class="liste-lignes">${prochains.map(carte).join("")}</div></section>`
      : `<section class="vide-etat"><p>Aucun contrôle prévu. Ajoute la date de ton prochain contrôle : Révizz te prépare un planning jour par jour, avec relectures, QCM et sujets blancs.</p></section>`
  }
  ${
    passes.length
      ? `<section class="bloc"><h2>Passés</h2><div class="liste-lignes">${passes
          .map((c) => `<button class="ligne" data-controle="${c.id}">${pastille(c.matiere, "m")}<span class="ligne-txt"><b>${esc(c.matiere)}</b><small>${dateLisible(c.date)}</small></span><span class="note-pill">${c.note === null ? "Noter" : `${c.note}/20`}</span></button>`)
          .join("")}</div></section>`
      : ""
  }`;
}

// ---------- Calendrier intégré (plus fiable que le sélecteur natif dans l'appli) ----------
function calendrier(el, valeurInitiale, onChange) {
  let choisie = valeurInitiale;
  const debutMois = (isoDate) => {
    const d = new Date(isoDate + "T12:00");
    d.setDate(1);
    return d;
  };
  let mois = debutMois(choisie);
  const auj = ctrl.aujourdhui();
  const raccourcis = [["Demain", 1], ["Dans 3 jours", 3], ["Dans 1 semaine", 7], ["Dans 2 semaines", 14]];
  const dessiner = () => {
    const y = mois.getFullYear();
    const m = mois.getMonth();
    const decalage = (new Date(y, m, 1).getDay() + 6) % 7; // lundi en premier
    const nb = new Date(y, m + 1, 0).getDate();
    const cases = Array.from({ length: decalage }, () => "<span></span>");
    for (let j = 1; j <= nb; j++) {
      const d = ctrl.iso(new Date(y, m, j));
      cases.push(`<button type="button" data-d="${d}" class="${d === choisie ? "on" : ""} ${d === auj ? "auj" : ""}" ${d < auj ? "disabled" : ""}>${j}</button>`);
    }
    const moisPrecedentPossible = new Date(y, m, 1) > new Date(auj + "T12:00");
    el.innerHTML = `
      <div class="dp-raccourcis">${raccourcis.map(([l, n]) => `<button type="button" class="chip ${ctrl.iso(Date.now() + n * 864e5) === choisie ? "on" : ""}" data-plus="${n}">${l}</button>`).join("")}</div>
      <div class="dp-mois"><button type="button" data-nav="-1" aria-label="Mois précédent" ${moisPrecedentPossible ? "" : "disabled"}>${ic("retour", 18)}</button>
        <b>${mois.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</b>
        <button type="button" data-nav="1" aria-label="Mois suivant">${ic("suite", 18)}</button></div>
      <div class="dp-grille">${["L", "M", "M", "J", "V", "S", "D"].map((j) => `<small>${j}</small>`).join("")}${cases.join("")}</div>
      <p class="dp-choix">${ic("calendrier", 16)} ${dateLisible(choisie)}</p>`;
  };
  el.onclick = (e) => {
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    e.preventDefault();
    if (b.dataset.nav) mois.setMonth(mois.getMonth() + Number(b.dataset.nav));
    else if (b.dataset.d) choisie = b.dataset.d;
    else if (b.dataset.plus) {
      choisie = ctrl.iso(Date.now() + Number(b.dataset.plus) * 864e5);
      mois = debutMois(choisie);
    }
    if (b.dataset.d || b.dataset.plus) onChange?.(choisie);
    dessiner();
  };
  dessiner();
  return { valeur: () => choisie };
}

// Créer un contrôle, ou modifier celui qui existe (date, chapitres, précision).
function ouvrirNouveauControle(matiere, existant = null) {
  const fichesDe = (m) => store.getFiches().filter((f) => f.matiere === m);
  const listeChapitres = (m, coches) => {
    const chaps = [...new Set(fichesDe(m).map((f) => f.chapitre || "Sans chapitre"))];
    return chaps.length
      ? chaps.map((c) => `<label class="check"><input type="checkbox" value="${esc(c)}" ${!coches || !coches.length || coches.includes(c) ? "checked" : ""}> ${esc(c)}</label>`).join("")
      : `<p class="hint">Pas encore de fiche dans cette matière : le planning proposera les cartes et des sujets dès que tu auras scanné tes cours.</p>`;
  };
  const choisie = existant?.matiere || matiere || getMatieres().find((m) => fichesDe(m.nom).length)?.nom || getMatieres()[0].nom;
  modale(
    `<h3>${existant ? "Modifier le contrôle" : "Nouveau contrôle"}</h3>
    <label class="field">Matière<select id="nc-matiere">${getMatieres().map((m) => `<option value="${esc(m.nom)}" ${m.nom === choisie ? "selected" : ""}>${esc(m.nom)}</option>`).join("")}</select></label>
    <div class="field">Date du contrôle<div id="nc-date" class="datepick"></div></div>
    <div class="field">Chapitres au programme<div id="nc-chapitres" class="checks">${listeChapitres(choisie, existant?.chapitres)}</div></div>
    <label class="field">Précision (facultatif)<input id="nc-titre" placeholder="ex : interro sur la partie 2" maxlength="40" value="${esc(existant?.titre || "")}"></label>
    <div class="row"><button class="btn secondary" id="nc-annuler">Annuler</button><button class="btn primary" id="nc-ok">${existant ? "Enregistrer" : "Créer mon planning"}</button></div>`,
    (box, fermer) => {
      const $ = (sel) => box.querySelector(sel);
      const cal = calendrier($("#nc-date"), existant?.date && existant.date >= ctrl.aujourdhui() ? existant.date : ctrl.iso(Date.now() + 7 * 864e5));
      $("#nc-matiere").onchange = (e) => ($("#nc-chapitres").innerHTML = listeChapitres(e.target.value));
      $("#nc-annuler").onclick = fermer;
      $("#nc-ok").onclick = async () => {
        const date = cal.valeur();
        if (!date || date < ctrl.aujourdhui()) return toast("Choisis une date à venir");
        const donnees = {
          matiere: $("#nc-matiere").value,
          date,
          chapitres: [...box.querySelectorAll("#nc-chapitres input:checked")].map((i) => i.value),
          titre: $("#nc-titre").value.trim(),
        };
        let c;
        if (existant) {
          c = ctrl.getControle(existant.id);
          c.matiere = donnees.matiere;
          ctrl.modifierControle(c, donnees);
        } else c = ctrl.nouveauControle(donnees);
        fermer();
        if (existant) {
          toast("Contrôle modifié");
          render();
        } else go({ view: "controle", controleId: c.id, retourControle: ui.view === "matiere" ? "matiere" : ui.view === "planning" ? "planning" : "home" });
        const ok = await ctrl.programmerRappels(c, c.matiere);
        if (Capacitor.isNativePlatform() && !existant) toast(ok ? "Rappel chaque jour à 18 h" : "Rappels refusés : autorise les notifications de Révizz dans les réglages d'Android.");
      };
    }
  );
}

// Ajouter une tâche à un jour du planning.
function ouvrirAjoutTache(c, date) {
  const fiches = ctrl.fichesDuControle(c);
  const types = [
    ["qcm", "QCM"],
    ["exos", "Exercices d'application"],
    ["defi", "Défi"],
    ["sujet", "Sujet blanc"],
    ["relire", "Relire une fiche"],
    ["cartes", "Cartes"],
    ["test", "Test final du chapitre"],
  ];
  modale(
    `<h3>Ajouter pour ${libelleJour(date).toLowerCase()}</h3>
    <div class="seg wrap" id="at-type">${types.map(([v, l], i) => `<button type="button" data-v="${v}" class="${i ? "" : "on"}">${ic(ICONE_TACHE[v], 16)} ${l}</button>`).join("")}</div>
    <label class="field" id="at-champ-fiche">Fiche
      <select id="at-fiche">${fiches.map((f) => `<option value="${f.id}">${esc(f.titre)}</option>`).join("")}</select>
    </label>
    ${fiches.length ? "" : `<p class="hint">Aucune fiche dans ce contrôle : seules les cartes peuvent être ajoutées.</p>`}
    <div class="row"><button class="btn secondary" id="at-annuler">Annuler</button><button class="btn primary" id="at-ok">Ajouter</button></div>`,
    (box, fermer) => {
      let type = "qcm";
      const champ = box.querySelector("#at-champ-fiche");
      box.querySelectorAll("#at-type button").forEach(
        (b) =>
          (b.onclick = () => {
            type = b.dataset.v;
            box.querySelectorAll("#at-type button").forEach((x) => x.classList.toggle("on", x === b));
            champ.hidden = type === "cartes" || !fiches.length;
          })
      );
      champ.hidden = !fiches.length;
      box.querySelector("#at-annuler").onclick = fermer;
      box.querySelector("#at-ok").onclick = () => {
        const fiche = fiches.find((f) => f.id === box.querySelector("#at-fiche")?.value);
        if (type !== "cartes" && !fiche) return toast("Choisis une fiche");
        ctrl.ajouterTache(ctrl.getControle(c.id), date, type, fiche);
        fermer();
        render();
      };
    }
  );
}

function controleView() {
  const c = ctrl.getControle(ui.controleId);
  if (!c) {
    ui.view = "planning";
    return planning();
  }
  const r = ctrl.joursRestants(c);
  const head = `<header class="top"><button class="icon" data-back aria-label="Retour">${ic("retour", 22)}</button>
    <div class="title">Contrôle de ${esc(c.matiere)}</div>
    <button class="icon" id="ctrl-suppr" aria-label="Supprimer ce contrôle">${ic("supprimer")}</button></header>`;
  if (r < 0) {
    return `${head}
    <div class="card center">
      <p class="sub">${dateLisible(c.date)}</p>
      <h2>Quelle note as-tu eue ?</h2>
      <div class="note-row"><input id="ctrl-note" type="number" min="0" max="20" step="0.5" inputmode="decimal" value="${c.note ?? ""}" placeholder="—"><span>/20</span></div>
      <button class="btn primary big-btn" id="ctrl-note-ok">Enregistrer ma note</button>
      ${c.note !== null ? `<p class="aa-msg">${c.note}/20 · ${humeur(c.note)}</p>` : ""}
    </div>`;
  }
  const plan = ctrl.planning(c);
  const total = plan.reduce((n, j) => n + j.taches.length, 0);
  const faites = plan.reduce((n, j) => n + j.taches.filter((t) => c.faits[t.id]).length, 0);
  return `${head}
  <div class="resume-controle" style="--c:${couleur(c.matiere)}">
    <div class="jx-grand">${r === 0 ? "Jour J" : `J-${r}`}</div>
    <div class="rc-txt">
      <b>${dateLisible(c.date)}</b>
      <small>${c.titre ? `${esc(c.titre)} · ` : ""}${faites}/${total} tâche${total > 1 ? "s" : ""} faite${total > 1 ? "s" : ""}</small>
      <span class="jauge"><i style="width:${total ? Math.round((faites / total) * 100) : 0}%;background:${couleur(c.matiere)}"></i></span>
    </div>
  </div>
  <div class="liste-lignes paliers-ctrl">${ctrl.chapitresDu(c).map((ch) => {
    const e = etatPaliers(c.matiere, ch);
    const puce = (n, ok) => `<span class="puce ${ok ? "ok" : e.actuel === n ? "cours" : ""}">${ok ? ic("ok", 12) : n}</span>`;
    return `<button class="ligne" data-chapitre="${esc(ch)}" data-m="${esc(c.matiere)}"><span class="ligne-txt"><b>${esc(ch)}</b><small>${e.actuel === 4 ? "Les 3 paliers sont validés" : `Palier ${e.actuel} en cours`}</small></span><span class="puces">${puce(1, e.p1)}${puce(2, e.p2)}${puce(3, e.p3)}</span></button>`;
  }).join("")}</div>
  <button class="btn secondary big-btn" id="ctrl-modifier">${ic("calendrier", 18)} Changer la date ou les chapitres</button>
  ${Capacitor.isNativePlatform() ? `<p class="hint center">${ic("rappel", 14)} Rappel chaque jour vers 18 h</p>` : ""}
  ${plan
    .map(
      (j) => `<section class="bloc jour ${j.date === ctrl.aujourdhui() ? "jour-actuel" : ""}">
      <div class="bloc-titre"><h2>${libelleJour(j.date)}</h2><button class="lien" data-ajout-jour="${j.date}">${ic("plus", 16)} Ajouter</button></div>
      <div class="taches">${
        j.taches.length
          ? j.taches
              .map(
                (t) => `<div class="tache ${c.faits[t.id] ? "faite" : ""}">
            <button class="coche" data-coche="${esc(t.id)}" aria-label="${c.faits[t.id] ? "Marquer à faire" : "Marquer comme faite"}">${c.faits[t.id] ? ic("ok", 16) : ""}</button>
            <button class="tache-txt" data-tache="${esc(t.id)}">${ic(ICONE_TACHE[t.type] || "taches", 18, "t-ic")}<span>${esc(t.label)}</span></button>
            <button class="tache-x" data-retirer-tache="${esc(t.id)}" aria-label="Retirer cette tâche">${ic("fermer", 16)}</button>
          </div>`
              )
              .join("")
          : `<p class="hint">Journée libre. Ajoute un QCM ou un sujet blanc si tu veux.</p>`
      }</div>
    </section>`
    )
    .join("")}
  <p class="hint center">Touche une tâche pour la faire : elle se coche toute seule.</p>`;
}
afterRender.controle = () => {
  const c = ctrl.getControle(ui.controleId);
  if (!c) return;
  const $ = (id) => document.getElementById(id);
  $("ctrl-suppr").onclick = async () => {
    if (!(await confirmer("Supprimer ce contrôle et son planning ?"))) return;
    await ctrl.supprimerControle(c.id);
    go({ view: ui.retourControle || "planning" });
  };
  if ($("ctrl-modifier")) $("ctrl-modifier").onclick = () => ouvrirNouveauControle(c.matiere, c);
  if ($("ctrl-note-ok"))
    $("ctrl-note-ok").onclick = () => {
      const v = parseFloat(String($("ctrl-note").value).replace(",", "."));
      if (isNaN(v) || v < 0 || v > 20) return toast("Une note entre 0 et 20");
      c.note = v;
      ctrl.saveControle(c);
      toast("Note enregistrée");
      render();
    };
  const taches = Object.fromEntries(ctrl.planning(c).flatMap((j) => j.taches).map((t) => [t.id, t]));
  document.querySelectorAll("[data-ajout-jour]").forEach((b) => (b.onclick = () => ouvrirAjoutTache(c, b.dataset.ajoutJour)));
  document.querySelectorAll("[data-retirer-tache]").forEach(
    (b) =>
      (b.onclick = () => {
        ctrl.retirerTache(c, b.dataset.retirerTache);
        render();
      })
  );
  document.querySelectorAll("[data-coche]").forEach(
    (b) =>
      (b.onclick = () => {
        ctrl.cocher(c, b.dataset.coche, !c.faits[b.dataset.coche]);
        render();
      })
  );
  document.querySelectorAll("[data-tache]").forEach(
    (b) =>
      (b.onclick = () => {
        const t = taches[b.dataset.tache];
        ctrl.cocher(c, t.id, true);
        const a = t.action;
        if (a.vue === "fiche") {
          if (a.tab === "sujet") sujetType = "controle";
          if (a.tab === "qcm") qcmNiveau = a.niveau || "moyen";
          go({ view: "fiche", ficheId: a.ficheId, tab: a.tab, retour: "controle" });
        } else if (a.vue === "revision") {
          sessionJour = null;
          go({ view: "revision", revMatiere: c.matiere, revChapitre: null, retour: "controle" });
        } else if (a.vue === "chapitre") go({ view: "chapitre", matiere: c.matiere, chapitre: a.chapitre });
        else if (a.vue === "palier") ouvrirPalier(String(a.palier), c.matiere, a.chapitre, "controle");
        else go({ view: "matiere", matiere: c.matiere });
      })
  );
};

// Ouvre une étape du parcours (depuis le chapitre ou depuis une tâche du planning).
function ouvrirPalier(quoi, matiere, chapitre, retour) {
  ui.matiere = matiere;
  ui.chapitre = chapitre;
  if (quoi === "1cartes") {
    sessionJour = null;
    go({ view: "revision", revMatiere: matiere, revChapitre: chapitre, retour: "chapitre" });
  } else if (quoi === "1qcm") lancerTest("palier1");
  else if (quoi === "1") go({ view: "chapitre", retourChapitre: retour === "controle" ? "controle" : ui.retourChapitre });
  else go({ view: quoi === "2" ? "exos" : "defi", retourPalier: retour });
}

// ---------- Clics globaux ----------
app.addEventListener("click", (e) => {
  const t = e.target.closest("[data-go],[data-back],[data-open],[data-tab],[data-matiere],[data-scan],[data-revision],[data-delpage],[data-ajout-matiere],[data-retirer],[data-chapitre],[data-test],[data-nouveau-controle],[data-controle],[data-palier]");
  if (!t) return;
  // D'où vient-on ? (pour que « ← » ramène à la matière ou à l'accueil)
  const origine = ["matiere", "matieres", "planning", "chapitre"].includes(ui.view) ? ui.view : "home";
  if (t.dataset.go) go({ view: t.dataset.go, ...(t.dataset.go === "home" ? { matiere: null } : {}) });
  else if (t.dataset.back !== undefined) back();
  else if (t.dataset.open) {
    const f = store.getFiche(t.dataset.open);
    if (f) store.saveFiche({ ...f, vue: Date.now() });
    go({ view: "fiche", ficheId: t.dataset.open, tab: "resume", retour: origine });
  } else if (t.dataset.tab) go({ tab: t.dataset.tab });
  else if (t.dataset.matiere) go({ view: "matiere", matiere: t.dataset.matiere });
  else if (t.dataset.ajoutMatiere !== undefined) ouvrirAjoutMatiere();
  else if (t.dataset.retirer) demanderRetrait(t.dataset.retirer);
  else if (t.dataset.chapitre) go({ view: "chapitre", chapitre: t.dataset.chapitre, matiere: t.dataset.m || ui.matiere, retourChapitre: ui.view === "controle" ? "controle" : "matiere" });
  else if (t.dataset.test) lancerTest(t.dataset.test);
  else if (t.dataset.palier) ouvrirPalier(t.dataset.palier, ui.matiere, ui.chapitre, "chapitre");
  else if (t.dataset.nouveauControle !== undefined) ouvrirNouveauControle(t.dataset.nouveauControle || ui.matiere || "");
  else if (t.dataset.controle) go({ view: "controle", controleId: t.dataset.controle, retourControle: origine });
  else if (t.dataset.scan !== undefined) {
    scanMatiere = t.dataset.scan;
    go({ view: "scan", retour: origine });
  } else if (t.dataset.revision !== undefined) {
    sessionJour = null;
    go({ view: "revision", revMatiere: t.dataset.revision || null, revChapitre: null, retour: origine });
  }
  else if (t.dataset.delpage !== undefined) {
    pages.splice(+t.dataset.delpage, 1);
    render();
  }
});

render();
// Synchronisation automatique : quand des fiches arrivent d'un autre appareil, on rafraîchit l'écran
// (sauf pendant que l'élève écrit, pour ne pas lui faire perdre sa saisie).
// Badges déjà mérités (par exemple après une mise à jour de l'appli).
setTimeout(() => {
  const n = jeu.verifierBadges();
  if (n.length) annoncer(n);
}, 1500);
if (!DEMO_ONLY)
  synchro.demarrer((bilan) => {
    const el = document.activeElement;
    if (el && /^(TEXTAREA|INPUT|SELECT)$/.test(el.tagName)) return;
    render();
    const n = (bilan?.ajoutees || 0) + (bilan?.majs || 0);
    if (n) toast(`${n} fiche${n > 1 ? "s" : ""} mise${n > 1 ? "s" : ""} à jour depuis l'autre appareil`);
  });
