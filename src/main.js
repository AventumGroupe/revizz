import "@fontsource-variable/plus-jakarta-sans";
import "./style.css";
import { marked } from "marked";
import { Capacitor } from "@capacitor/core";
import * as store from "./store.js";
import * as ai from "./claude.js";
import { ficheDeDepart, questionsDepartDemo } from "./demo.js";
import { ouvrirScanner } from "./scanner.js";
import * as sauvegarde from "./sauvegarde.js";
import * as ctrl from "./controles.js";
import { getMatieres, suggestions, ajouterMatiere, retirerMatiere, EMOJIS, COULEURS, normaliserMatiere, couleur, pastille } from "./matieres.js";
import { ic } from "./icons.js";

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
  else if (ui.view === "chapitre") go({ view: "matiere" });
  else if (ui.view === "controle") go({ view: ui.retourControle || "home" });
  else if (ui.view === "test") go({ view: "chapitre" });
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
}

function render() {
  const s = store.getSettings();
  if (DEMO_ONLY && !s.demo) return entrerDemo();
  if (!ai.estConfigure(s) && ui.view !== "settings") ui.view = "welcome";
  const views = { welcome, home, matieres, planning, matiere: matiereView, chapitre: chapitreView, test: testView, controle: controleView, scan, fiche: ficheView, settings, revision };
  const avecNav = VUES_RACINE.includes(ui.view) && ui.view !== "welcome";
  document.body.classList.toggle("avec-nav", avecNav);
  app.innerHTML = views[ui.view]() + (avecNav ? barreNav() : "");
  afterRender[ui.view]?.();
}
const afterRender = {};
afterRender.welcome = () => (document.getElementById("btn-demo").onclick = entrerDemo);

// ---------- Accueil (premier lancement) ----------
function welcome() {
  return `
  <div class="welcome">
    <div class="logo">Révizz</div>
    <p class="big">Tes fiches de cours deviennent des résumés, des flashcards, des QCM et des sujets d'entraînement.</p>
    <ul class="steps">
      <li>${ic("camera", 20)}<span>Prends en photo ta fiche ou ton cahier</span></li>
      <li>${ic("resume", 20)}<span>Claude prépare ta fiche de révision</span></li>
      <li>${ic("progres", 20)}<span>Entraîne-toi et suis tes progrès</span></li>
    </ul>
    <div class="welcome-actions">
      <button class="btn primary big-btn" data-go="settings">Me connecter avec le code famille</button>
      <button class="btn secondary big-btn" id="btn-demo">Essayer la démo, sans clé</button>
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
  const dues = fiches.reduce((n, f) => n + store.cartesDues(f).length, 0);
  const recentes = [...fiches].sort((a, b) => (b.vue || b.cree) - (a.vue || a.cree)).slice(0, 6);
  const avecFiches = getMatieres().filter((m) => fiches.some((f) => f.matiere === m.nom));
  return `
  <header class="page-head">
    <div><p class="eyebrow">${jourDuJour()}</p><h1>Bonjour${s.prenom ? ` ${esc(s.prenom)}` : ""}</h1></div>
    <div class="serie" title="Jours de révision d'affilée">${ic("serie", 16)}<b>${stats.serie}</b></div>
  </header>
  ${s.demo ? `<div class="bandeau"><span><b>Mode démo.</b> Réponses préparées à l'avance, sans Claude.${DEMO_ONLY ? " N'importe quelle photo donne la fiche de maths d'exemple." : ""}</span>${DEMO_ONLY ? "" : `<button class="lien" data-go="settings">Me connecter</button>`}</div>` : ""}

  <section class="bloc">
    <h2>Aujourd'hui</h2>
    <div class="carte-jour">
      ${
        dues
          ? `<button class="ligne" data-revision="">${pastilleIcone("cartes", "#2563eb")}<span class="ligne-txt"><b>Cartes à revoir</b><small>${dues} carte${dues > 1 ? "s" : ""} prête${dues > 1 ? "s" : ""}</small></span>${ic("suite", 18, "chevron")}</button>`
          : `<div class="ligne">${pastilleIcone("fait", "#0f9d58")}<span class="ligne-txt"><b>Cartes à jour</b><small>Rien à revoir pour l'instant</small></span></div>`
      }
      ${controlesAccueil()}
    </div>
  </section>

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
      : `<section class="vide-etat">
          <h2>Ta première fiche</h2>
          <p>Prends en photo un cours ou une fiche : Révizz prépare le résumé, les cartes et les QCM.</p>
          <button class="btn primary big-btn" data-scan="">${ic("camera", 20)} Scanner une fiche</button>
        </section>`
  }`;
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
  const dues = siennes.reduce((n, f) => n + store.cartesDues(f).length, 0);
  return `<button class="ligne" data-matiere="${esc(m.nom)}">
    ${pastille(m.nom, "m")}
    <span class="ligne-txt"><b>${esc(m.nom)}</b><small>${siennes.length ? `${siennes.length} fiche${siennes.length > 1 ? "s" : ""}` : "Aucune fiche"}</small></span>
    ${dues ? `<span class="badge">${dues}</span>` : ""}${ic("suite", 18, "chevron")}
  </button>`;
}
function rappelSauvegarde(fiches) {
  if (DEMO_ONLY || store.getSettings().demo || fiches.length < 2) return "";
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
      const dues = siennes.reduce((n, f) => n + store.cartesDues(f).length, 0);
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
  const d = store.cartesDues(f).length;
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
    <section class="vide-etat">
      <p>Pas encore de fiche en ${esc(nom)}. Scanne ton premier cours pour commencer.</p>
      <button class="btn primary big-btn" data-scan="${esc(nom)}">${ic("camera", 20)} Ajouter une fiche</button>
    </section>
    ${nom !== "Autre" ? `<button class="btn ghost big-btn" data-retirer="${esc(nom)}">Retirer ${esc(nom)} de mes matières</button>` : ""}`;
  }
  const dues = fiches.reduce((n, f) => n + store.cartesDues(f).length, 0);
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
let analyseEnCours = false;
function scan() {
  const vide = !pages.length;
  return `
  <header class="top"><button class="icon" data-back aria-label="Retour">${ic("retour", 22)}</button><div class="title">${scanMatiere ? `<small>${pastille(scanMatiere, "s")} ${esc(scanMatiere)}</small>` : ""}Nouvelle fiche</div><span></span></header>
  ${
    vide
      ? `<p class="hint">Comment veux-tu scanner ton cours ?</p>
        <div class="choix-scan">
          <button class="choix" data-scanmode="une"><span class="em">${ic("page", 28)}</span><b>Une page</b><small>Une photo, et c'est prêt.</small></button>
          <button class="choix" data-scanmode="plusieurs"><span class="em">${ic("pages", 28)}</span><b>Plusieurs pages</b><small>Enchaîne les photos sans valider chaque page.</small></button>
        </div>
        <button class="btn ghost big-btn" id="btn-import">${ic("galerie")} Importer depuis la galerie ou un PDF</button>`
      : `<p class="hint">${pages.length} page${pages.length > 1 ? "s" : ""}. Vérifie l'ordre avec les flèches, puis crée ta fiche.</p>
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
      pages.push(await imagePage(dataUrl));
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
    pages.push(await imagePage(photo.dataUrl));
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
      pages.push(await imagePage(await lireDataUrl(f)));
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
// Réduit la photo (1280 px max) : environ 1 600 tokens par page au lieu de 2 400, l'écriture reste lisible.
function imagePage(dataUrl) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const max = 1280;
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const out = c.toDataURL("image/jpeg", 0.8);
      res({ kind: "image", mediaType: "image/jpeg", data: out.split(",")[1], preview: out });
    };
    img.onerror = () => rej(new Error("Image illisible"));
    img.src = dataUrl;
  });
}
function progressUI(el, label) {
  const msgs = ["Je lis ta fiche…", "Je repère les notions importantes…", "Je rédige ta fiche de révision…", "Je prépare les flashcards…", "Presque fini…"];
  el.innerHTML = `<div class="loading"><div class="spinner"></div><div class="lmsg">${label || msgs[0]}</div><div class="lsub"></div></div>`;
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
  const p = progressUI(document.getElementById("progress"));
  try {
    const r = await ai.analyserCours(pages, scanNote, scanMatiere, p.update);
    if (scanMatiere) r.matiere = scanMatiere;
    const fiche = nouvelleFiche(r);
    store.saveFiche(fiche);
    pages = [];
    scanNote = "";
    scanMatiere = "";
    go({ view: "fiche", ficheId: fiche.id, tab: "resume", ...(ui.retour === "matiere" ? { matiere: fiche.matiere } : {}) });
    toast("Fiche créée");
  } catch (e) {
    document.getElementById("progress").innerHTML = `<div class="error">${esc(e.message)}</div>`;
    btn.disabled = false;
  } finally {
    p.stop();
    analyseEnCours = false;
  }
}

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
  <details class="card"><summary>Voir le texte du cours scanné</summary><div class="md">${md(f.transcription)}</div></details>
  <div class="row">
    <button class="btn secondary" data-tab="cartes">${ic("cartes", 18)} Réviser les cartes</button>
    <button class="btn secondary" data-tab="qcm">${ic("qcm", 18)} Faire un QCM</button>
  </div>`;
}
function bindResume(f) {
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
      <div class="big-num">${store.cartesDues(f).length}</div>
      <div>carte(s) à revoir maintenant sur ${f.flashcards.length}</div>
      <div class="bar wide"><i style="width:${store.maitrise(f)}%"></i></div>
      <small>Maîtrise : ${store.maitrise(f)} %</small>
    </div>
    <button class="btn primary big-btn" id="start-due" ${store.cartesDues(f).length ? "" : "disabled"}>${ic("jouer", 18)} Réviser les cartes à revoir</button>
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
    return `<div class="card center done">
      <div class="rond-ok">${ic("fait", 34)}</div>
      <p>Bravo ! ${s.sues} / ${s.cartes.length} cartes sues.</p>
      <p class="sub">Les cartes ratées reviendront plus vite, les autres plus tard.</p>
      <button class="btn primary" id="end-session">Terminer</button></div>`;
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
      session = { ficheId: f.id, cartes: shuffle(store.cartesDues(f)), i: 0, retourne: false, sues: 0 };
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
    if (vraie) store.noterCarte(vraie, sue);
    store.saveFiche(fiche);
    store.enregistrerActivite("carte");
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
    const cartes = store
      .getFiches()
      .filter((f) => !ui.revMatiere || f.matiere === ui.revMatiere)
      .flatMap((f) => store.cartesDues(f).map((c) => ({ ...c, ficheId: f.id })));
    sessionJour = { cartes: shuffle(cartes).slice(0, 40), i: 0, retourne: false, sues: 0 };
  }
  return `<header class="top"><button class="icon" data-back aria-label="Retour">${ic("retour", 22)}</button><div class="title">${ui.revMatiere ? `<small>${pastille(ui.revMatiere, "s")} ${esc(ui.revMatiere)}</small>` : ""}Révision du jour</div><span></span></header>
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
    return `<div class="card center done">
      <div class="big-num">${note}/20</div>
      <p>${qcm.score} bonne${qcm.score > 1 ? "s" : ""} réponse${qcm.score > 1 ? "s" : ""} sur ${qcm.questions.length}</p>
      <p class="sub">${note >= 16 ? "Excellent, tu maîtrises !" : note >= 12 ? "Bien joué, encore un petit effort" : "Relis le résumé puis réessaie, tu vas y arriver"}</p>
      ${qcm.erreurs.length ? `<h3>À revoir</h3><ul class="keys">${qcm.erreurs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
      <div class="row"><button class="btn secondary" id="qcm-fin">Terminer</button><button class="btn primary" id="qcm-again">Nouveau QCM</button></div>
    </div>`;
  }
  const q = qcm.questions[qcm.i];
  const rep = qcm.choisi;
  return `
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
      ? `<div class="explain ${rep === q.bonne_reponse ? "ok" : "ko"}">${rep === q.bonne_reponse ? "Bravo !" : "Raté."} ${esc(q.explication)}</div>
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
        if (qcm.choisi === q.bonne_reponse) qcm.score++;
        else qcm.erreurs.push(`${q.question} → ${q.choix[q.bonne_reponse]}`);
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
let corrigeVisible = false;
function tabSujet(f) {
  const s = sujetOuvert !== null ? f.sujets[sujetOuvert] : null;
  if (!s) {
    return `
    <div class="card">
      <h3>Préparer un sujet d'entraînement</h3>
      <div class="seg wrap">${Object.entries(ai.TYPES_SUJET)
        .map(([k, l]) => `<button class="${sujetType === k ? "on" : ""}" data-stype="${k}">${l}</button>`)
        .join("")}</div>
      <button class="btn primary big-btn" id="gen-sujet">Générer le sujet</button>
      <div id="progress"></div>
    </div>
    ${
      f.sujets.length
        ? `<h3>Mes sujets</h3><div class="liste-lignes">${f.sujets
            .map(
              (x, i) =>
                `<button class="ligne" data-sujet="${i}">${ic("sujet", 20, "t-ic")}<span class="ligne-txt"><b>${esc(x.titre)}</b><small>${esc(x.duree)}${x.note ? " · corrigée" : ""}</small></span>${ic("suite", 18, "chevron")}</button>`
            )
            .join("")}</div>`
        : ""
    }`;
  }
  return `
  <button class="btn ghost" id="sujet-back">${ic("retour", 18)} Mes sujets</button>
  <div class="card md"><h2>${esc(s.titre)}</h2><p class="sub">${ic("heure", 15)} ${esc(s.duree)}</p>${md(s.sujet)}</div>
  <h3>Ma réponse</h3>
  <textarea id="copie" rows="8" placeholder="Écris tes réponses ici (ou résume-les), puis demande la correction.">${esc(s.copie || "")}</textarea>
  <button class="btn primary big-btn" id="corriger">${ic("copie", 18)} Corriger ma copie</button>
  <div id="progress"></div>
  ${s.note ? `<div class="card md correction">${md(s.note)}</div>` : ""}
  <button class="btn secondary big-btn" id="toggle-corrige">${corrigeVisible ? "Cacher" : "Voir"} le corrigé</button>
  ${corrigeVisible ? `<div class="card md">${md(s.corrige)}</div>` : ""}`;
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
      const p = progressUI($("progress"), "Claude rédige ton sujet et son corrigé…");
      try {
        const s = await ai.genererSujet(f, sujetType, p.update);
        f.sujets.unshift({ ...s, type: sujetType, date: Date.now() });
        f.sujets = f.sujets.slice(0, 10);
        store.saveFiche(f);
        sujetOuvert = 0;
        corrigeVisible = false;
        render();
      } catch (err) {
        $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
        e.target.disabled = false;
      } finally {
        p.stop();
      }
    };
  if ($("sujet-back")) $("sujet-back").onclick = () => ((sujetOuvert = null), render());
  if ($("toggle-corrige")) $("toggle-corrige").onclick = () => ((corrigeVisible = !corrigeVisible), render());
  if ($("copie")) {
    const s = f.sujets[sujetOuvert];
    $("copie").oninput = (e) => {
      s.copie = e.target.value;
      store.saveFiche(f);
    };
    $("corriger").onclick = async (e) => {
      if (!s.copie?.trim()) return toast("Écris d'abord ta réponse");
      e.target.disabled = true;
      const p = progressUI($("progress"), "Le prof corrige ta copie…");
      try {
        s.note = await ai.corrigerCopie(f, s, s.copie, p.update);
        store.saveFiche(f);
        render();
      } catch (err) {
        $("progress").innerHTML = `<div class="error">${esc(err.message)}</div>`;
        e.target.disabled = false;
      } finally {
        p.stop();
      }
    };
  }
}

// --- Prof particulier (chat)
let chatBusy = false;
function tabProf(f) {
  const suggestions = ["Explique-moi ce cours comme si j'avais 10 ans", "Quelles sont les 3 choses les plus importantes ?", "Donne-moi un exemple concret", "Pose-moi une question pour vérifier"];
  return `
  <div class="chat" id="chat">
    <div class="bubble bot">Salut ! Je suis ton prof pour « ${esc(f.titre)} ». Qu'est-ce que tu n'as pas compris ?</div>
    ${f.chat.map((m) => `<div class="bubble ${m.role === "user" ? "me" : "bot md"}">${m.role === "user" ? esc(m.content) : md(m.content)}</div>`).join("")}
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
    render();
    const live = $("live");
    live.className = "bubble bot md";
    live.innerHTML = `<span class="dots"><i></i><i></i><i></i></span>`;
    live.scrollIntoView({ block: "end" });
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
        <input id="serveur" type="url" inputmode="url" value="${esc(s.serveur || ai.adresseServeur({ ...s, serveur: "" }))}" placeholder="https://revizz-famille.netlify.app" autocomplete="off">
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
  return `<div class="card" id="carte-sauvegarde">
    <h3>Sauvegarde et synchronisation</h3>
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
afterRender.settings = () => {
  const $ = (id) => document.getElementById(id);
  bindSauvegarde();
  if ($("reset-conso"))
    $("reset-conso").onclick = () => {
      store.resetConso();
      render();
    };
  document.querySelectorAll("[data-cx]").forEach(
    (b) =>
      (b.onclick = () => {
        document.querySelectorAll("[data-cx]").forEach((x) => x.classList.toggle("on", x === b));
        $("cx-serveur").hidden = b.dataset.cx !== "serveur";
        $("cx-cle").hidden = b.dataset.cx !== "cle";
      })
  );
  const save = () => {
    const reglages = { prenom: $("prenom").value.trim(), classe: $("classe").value };
    if (!DEMO_ONLY) {
      const connexion = document.querySelector("[data-cx].on")?.dataset.cx || "serveur";
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
const fichesDuChapitre = (m, c) => store.getFiches().filter((f) => f.matiere === m && (f.chapitre || "Sans chapitre") === c);
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
    <div class="title"><small>${pastille(m, "s")} ${esc(m)} · Mes progrès</small>${esc(c)}</div>
    <span></span>
  </header>
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
  const titre = test.type === "depart" ? "Test de départ" : "Test final";
  const head = `<header class="top" style="--c:${couleur(ui.matiere)}"><button class="icon" data-back aria-label="Retour">${ic("retour", 22)}</button><div class="title"><small>${esc(ui.chapitre)}</small>${titre}</div><span></span></header>`;
  if (test.i >= test.questions.length) {
    const note = store.sur20(test.score, test.questions.length);
    const p = store.getProgres(ui.matiere, ui.chapitre);
    const comparaison =
      test.type === "final" && p.depart
        ? `<div class="compare"><span>Avant <b>${noteDe(p.depart)}/20</b></span><span class="aa-fleche">→</span><span>Maintenant <b>${note}/20</b></span></div>`
        : `<p class="sub">C'est ton point de départ. Révise les fiches et les cartes du chapitre, puis fais le test final !</p>`;
    return `${head}<div class="card center done">
      <div class="big-num">${humeur(note)} ${note}/20</div>
      <p>${test.score} bonne${test.score > 1 ? "s" : ""} réponse${test.score > 1 ? "s" : ""} sur ${test.questions.length}</p>
      ${comparaison}
      ${test.erreurs.length ? `<h3>À revoir</h3><ul class="keys">${test.erreurs.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}
      <button class="btn primary big-btn" id="test-voir">${ic("progres", 18)} Voir mes progrès</button>
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
        else p.finals = [...(p.finals || []), resultat];
        store.saveProgres(ui.matiere, ui.chapitre, p);
        store.enregistrerActivite("qcm");
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
const ICONE_TACHE = { relire: "resume", qcm: "qcm", sujet: "sujet", cartes: "cartes", points: "resume", test: "final" };

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
          go({ view: "revision", revMatiere: c.matiere, retour: "controle" });
        } else if (a.vue === "chapitre") go({ view: "chapitre", matiere: c.matiere, chapitre: a.chapitre });
        else go({ view: "matiere", matiere: c.matiere });
      })
  );
};

// ---------- Clics globaux ----------
app.addEventListener("click", (e) => {
  const t = e.target.closest("[data-go],[data-back],[data-open],[data-tab],[data-matiere],[data-scan],[data-revision],[data-delpage],[data-ajout-matiere],[data-retirer],[data-chapitre],[data-test],[data-nouveau-controle],[data-controle]");
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
  else if (t.dataset.chapitre) go({ view: "chapitre", chapitre: t.dataset.chapitre, matiere: t.dataset.m || ui.matiere });
  else if (t.dataset.test) lancerTest(t.dataset.test);
  else if (t.dataset.nouveauControle !== undefined) ouvrirNouveauControle(t.dataset.nouveauControle || ui.matiere || "");
  else if (t.dataset.controle) go({ view: "controle", controleId: t.dataset.controle, retourControle: origine });
  else if (t.dataset.scan !== undefined) {
    scanMatiere = t.dataset.scan;
    go({ view: "scan", retour: origine });
  } else if (t.dataset.revision !== undefined) {
    sessionJour = null;
    go({ view: "revision", revMatiere: t.dataset.revision || null, retour: origine });
  }
  else if (t.dataset.delpage !== undefined) {
    pages.splice(+t.dataset.delpage, 1);
    render();
  }
});

render();
